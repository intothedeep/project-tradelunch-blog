import {
    ETreeNodeType,
    PROJECTS_ROOT_CATEGORY_TITLE,
    type TTreeNode,
} from '@repo/types';
import { projectPath, projectsPath, postPath } from '@/utils/routes';

// Pure helpers over the flat category+post list the tree endpoint returns.
// A "project" is a direct child category of the `projects` category.

const findProjectsRoot = (nodes: TTreeNode[]): TTreeNode | undefined =>
    nodes.find(
        (node) =>
            node.type === ETreeNodeType.CATEGORY &&
            node.title === PROJECTS_ROOT_CATEGORY_TITLE
    );

// Walk up from `node` to the category directly under the root; null when the
// node is the root itself or sits outside the projects subtree.
const projectOf = (
    nodes: TTreeNode[],
    root: TTreeNode,
    node: TTreeNode
): TTreeNode | null => {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    let current: TTreeNode | undefined = node;
    while (current && current.parent_id) {
        if (current.parent_id === root.id) return current;
        current = byId.get(current.parent_id);
    }
    return null;
};

// Keep the projects root and everything under it, in the original order.
// projectOfSlug maps a post slug to the title of the project that holds it.
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
    const subtree = nodes.filter((node) => inSubtree.has(node.id));

    const projectOfSlug: Record<string, string> = {};
    for (const node of subtree) {
        if (node.type !== ETreeNodeType.POST) continue;
        const project = projectOf(subtree, root, node);
        if (project) projectOfSlug[node.slug] = project.title;
    }
    return { nodes: subtree, projectOfSlug };
}

// Where a click on `node` goes: root -> projects list, project (or a sub
// category of it) -> that project, post -> post detail.
export function hrefOfNode(
    nodes: TTreeNode[],
    node: TTreeNode,
    username: string
): string {
    if (node.type === ETreeNodeType.POST) return postPath(username, node.slug);
    const root = findProjectsRoot(nodes);
    const project = root ? projectOf(nodes, root, node) : null;
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
        return (
            nodes.find(
                (node) =>
                    node.type === ETreeNodeType.CATEGORY &&
                    node.parent_id === root.id &&
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
