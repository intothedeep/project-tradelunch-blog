import {
    ETreeNodeType,
    PROJECTS_ROOT_CATEGORY_TITLE,
    type TTreeNode,
} from '@repo/types';
import { projectPath, projectsPath, postPath } from '@/utils/routes';
import { groupAnchorPath } from '@/utils/project-groups';

// Pure helpers over the flat category+post list the tree endpoint returns.
// Under the `projects` root, a direct child with child categories is a GROUP
// and its children are projects; a direct child without child categories is an
// ungrouped project (projects.design.md §12.3, same rule as the SQL).

const findProjectsRoot = (nodes: TTreeNode[]): TTreeNode | undefined =>
    nodes.find(
        (node) =>
            node.type === ETreeNodeType.CATEGORY &&
            node.title === PROJECTS_ROOT_CATEGORY_TITLE
    );

const parentIdsOfCategories = (nodes: TTreeNode[]): Set<string> =>
    new Set(
        nodes
            .filter(
                (node) => node.type === ETreeNodeType.CATEGORY && node.parent_id
            )
            .map((node) => node.parent_id as string)
    );

// Which category ids are groups and which are projects.
export function classifyProjectNodes(nodes: TTreeNode[]): {
    groupIds: Set<string>;
    projectIds: Set<string>;
} {
    const groupIds = new Set<string>();
    const projectIds = new Set<string>();
    const root = findProjectsRoot(nodes);
    if (!root) return { groupIds, projectIds };

    const hasChildCategory = parentIdsOfCategories(nodes);
    const categories = nodes.filter(
        (node) => node.type === ETreeNodeType.CATEGORY
    );
    for (const node of categories) {
        if (node.parent_id !== root.id) continue;
        if (hasChildCategory.has(node.id)) groupIds.add(node.id);
        else projectIds.add(node.id);
    }
    for (const node of categories) {
        if (node.parent_id && groupIds.has(node.parent_id)) {
            projectIds.add(node.id);
        }
    }
    return { groupIds, projectIds };
}

// Walk up from `node` to the nearest project (the node itself counts); null
// for the root, a group, or a node outside the projects subtree.
const projectOf = (
    byId: Map<string, TTreeNode>,
    projectIds: Set<string>,
    node: TTreeNode
): TTreeNode | null => {
    let current: TTreeNode | undefined = node;
    while (current) {
        if (projectIds.has(current.id)) return current;
        current = current.parent_id ? byId.get(current.parent_id) : undefined;
    }
    return null;
};

// Keep the projects root and everything under it, in the original order.
// Direct children with no child at all (an empty group, or an empty ungrouped
// project) are dropped. projectOfSlug maps a post slug to its project's title.
export function sliceProjectsSubtree(nodes: TTreeNode[]): {
    nodes: TTreeNode[];
    projectOfSlug: Record<string, string>;
} {
    const root = findProjectsRoot(nodes);
    if (!root) return { nodes: [], projectOfSlug: {} };

    const inSubtree = new Set<string>([root.id]);
    // The list is ordered by path, so a parent always precedes its children.
    for (const node of nodes) {
        if (node.parent_id && inSubtree.has(node.parent_id)) {
            inSubtree.add(node.id);
        }
    }
    const withParent = new Set(
        nodes.filter((node) => node.parent_id).map((node) => node.parent_id)
    );
    const subtree = nodes.filter(
        (node) =>
            inSubtree.has(node.id) &&
            !(node.parent_id === root.id && !withParent.has(node.id))
    );

    const { projectIds } = classifyProjectNodes(subtree);
    const byId = new Map(subtree.map((n) => [n.id, n]));
    const projectOfSlug: Record<string, string> = {};
    for (const node of subtree) {
        if (node.type !== ETreeNodeType.POST) continue;
        const project = projectOf(byId, projectIds, node);
        if (project) projectOfSlug[node.slug] = project.title;
    }
    return { nodes: subtree, projectOfSlug };
}

// Where a click on `node` goes: root -> projects list, group -> its anchor on
// the list, project (or a sub category of it) -> that project, post -> detail.
export function hrefOfNode(
    nodes: TTreeNode[],
    node: TTreeNode,
    username: string
): string {
    if (node.type === ETreeNodeType.POST) return postPath(username, node.slug);
    const { groupIds, projectIds } = classifyProjectNodes(nodes);
    if (groupIds.has(node.id)) return groupAnchorPath(username, node.title);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const project = projectOf(byId, projectIds, node);
    return project
        ? projectPath(username, project.title)
        : projectsPath(username);
}

// Tree node to highlight for a pathname: /@u/projects -> root,
// /@u/projects/<project> -> that project, /@u/<slug> -> that post.
export function selectedNodeIdOf(
    nodes: TTreeNode[],
    pathname: string
): string | null {
    const [, , first, second] = pathname.split('/').map(safeDecode);
    if (!first) return null;
    if (first === 'projects') {
        const root = findProjectsRoot(nodes);
        if (!root) return null;
        if (!second) return root.id;
        const { projectIds } = classifyProjectNodes(nodes);
        return (
            nodes.find(
                (node) =>
                    node.type === ETreeNodeType.CATEGORY &&
                    projectIds.has(node.id) &&
                    node.title === second
            )?.id ?? null
        );
    }
    return (
        nodes.find(
            (node) => node.type === ETreeNodeType.POST && node.slug === first
        )?.id ?? null
    );
}

const safeDecode = (segment: string): string => {
    try {
        return decodeURIComponent(segment);
    } catch {
        return segment;
    }
};
