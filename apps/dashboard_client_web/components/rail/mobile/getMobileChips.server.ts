// Purpose: server-side data fetch for the mobile context header chip row. Fetches
// a user's TOP-LEVEL categories (getCategoriesByUsername) + their scoped popular
// tags (getUserPopularTags) and merges them into a flat TMobileChip[]. Each source
// is wrapped in its own try/catch returning [] on failure, so one source failing
// (or being empty) degrades to the other — it never throws into the server layout.
// Category hrefs reuse the EXACT shape CategorySidebar builds
// (`/blog/@<username>?category_title=<encoded title>`).
// Side effects: two isolated network reads (each failure-contained).

import { getCategoriesByUsername } from '@/apis/getCategories.api';
import { getUserPopularTags } from '@/apis/getUserPopularTags.api';
import { ETreeNodeType, type TTreeNode } from '@repo/types';

export type TMobileChip = {
    kind: 'category' | 'tag';
    label: string;
    href: string;
    count?: number;
};

const TAGS_LIMIT = 12;

// Flatten to TOP-LEVEL category nodes only. A root category has no parent (or is
// self-referencing) — the same root rule buildCategoryTree uses in CategoryTree.
const isRootCategory = (node: TTreeNode): boolean =>
    node.type === ETreeNodeType.CATEGORY &&
    (!node.parent_id || node.parent_id === node.id);

const toCategoryChips = (nodes: TTreeNode[], username: string): TMobileChip[] =>
    nodes.filter(isRootCategory).map((node) => ({
        kind: 'category' as const,
        label: node.title,
        href: `/blog/@${username}?category_title=${encodeURIComponent(node.title)}`,
    }));

const fetchCategoryChips = async (username: string): Promise<TMobileChip[]> => {
    try {
        const { categories } = await getCategoriesByUsername(username);
        return toCategoryChips(categories ?? [], username);
    } catch {
        return [];
    }
};

const fetchTagChips = async (username: string): Promise<TMobileChip[]> => {
    try {
        const tags = await getUserPopularTags(username, TAGS_LIMIT);
        return tags.map(({ tag, count }) => ({
            kind: 'tag' as const,
            label: tag,
            href: `/tags/${encodeURIComponent(tag)}`,
            count,
        }));
    } catch {
        return [];
    }
};

export const getMobileChips = async (
    username: string
): Promise<TMobileChip[]> => {
    const [categoryChips, tagChips] = await Promise.all([
        fetchCategoryChips(username),
        fetchTagChips(username),
    ]);
    return [...categoryChips, ...tagChips];
};
