// Purpose: server-side data fetch for the mobile filter chip rows. Returns the
// author's TOP-LEVEL category titles + their scoped popular tags as flat filter
// items keyed by the value the feed filters on (categories filter by title;
// tags filter by tag). Each source is failure-contained (returns [] on error),
// so one source failing degrades to the other and never throws into the page.
// Side effects: two isolated network reads (each failure-contained).

import { getCategoriesByUsername } from '@/apis/getCategories.api';
import { getUserPopularTags } from '@/apis/getUserPopularTags.api';
import { ETreeNodeType, type TTreeNode } from '@repo/types';

export type TFilterItem = {
    label: string;
    value: string;
    count?: number;
};

const TAGS_LIMIT = 12;

// A root category has no parent (or is self-referencing) — same root rule
// buildCategoryTree uses.
const isRootCategory = (node: TTreeNode): boolean =>
    node.type === ETreeNodeType.CATEGORY &&
    (!node.parent_id || node.parent_id === node.id);

export const getCategoryFilterItems = async (
    username: string
): Promise<TFilterItem[]> => {
    try {
        const { categories } = await getCategoriesByUsername(username);
        return (categories ?? []).filter(isRootCategory).map((node) => ({
            label: node.title,
            value: node.title,
        }));
    } catch {
        return [];
    }
};

export const getTagFilterItems = async (
    username: string
): Promise<TFilterItem[]> => {
    try {
        const tags = await getUserPopularTags(username, TAGS_LIMIT);
        return tags.map(({ tag, count }) => ({
            label: tag,
            value: tag,
            count,
        }));
    } catch {
        return [];
    }
};
