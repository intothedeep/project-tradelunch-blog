// // __tests__/utils/tree.utils.spec.ts
// import { buildTree, isCategoryNode, isPostNode } from '../../utils/tree.utils';
// import { ETreeNodeType } from '../../types/category.types';
// import type { TTreeNode } from '../../types/category.types';

// describe('Tree Utils', () => {
//     describe('buildTree', () => {
//         it('flat 데이터를 계층 구조로 변환', () => {
//             const flatData: TTreeNode[] = [
//                 {
//                     type: ETreeNodeType.CATEGORY,
//                     id: 1,
//                     title: 'Root',
//                     parent_id: null,
//                     level: 0,
//                     group_id: 1,
//                     priority: 100,
//                     post_id: null,
//                     slug: null,
//                     content: null,
//                     description: null,
//                     created_at: null,
//                     updated_at: null,
//                 },
//                 {
//                     type: ETreeNodeType.CATEGORY,
//                     id: 2,
//                     title: 'Child',
//                     parent_id: 1,
//                     level: 1,
//                     group_id: 1,
//                     priority: 100,
//                     post_id: null,
//                     slug: null,
//                     content: null,
//                     description: null,
//                     created_at: null,
//                     updated_at: null,
//                 },
//                 {
//                     type: ETreeNodeType.POST,
//                     id: 2,
//                     title: 'Post 1',
//                     parent_id: 2,
//                     level: 2,
//                     group_id: null,
//                     priority: 100,
//                     post_id: 101,
//                     slug: 'post-1',
//                     content: 'Content',
//                     description: 'Desc',
//                     created_at: '2025-01-01T00:00:00Z',
//                     updated_at: '2025-01-01T00:00:00Z',
//                 },
//             ];

//             const tree = buildTree(flatData);

//             expect(tree).toHaveLength(1);
//             expect(tree[0].title).toBe('Root');
//             expect(tree[0].children).toHaveLength(1);
//             expect(tree[0].children![0].title).toBe('Child');
//             expect(tree[0].children![0].children).toHaveLength(1);
//             expect(tree[0].children![0].children![0].title).toBe('Post 1');
//         });
//     });

//     describe('Type Guards', () => {
//         it('isCategoryNode 정상 동작', () => {
//             const node: TTreeNode = {
//                 type: ETreeNodeType.CATEGORY,
//                 id: 1,
//                 title: 'Test',
//                 parent_id: null,
//                 level: 0,
//                 group_id: 1,
//                 priority: 100,
//                 post_id: null,
//                 slug: null,
//                 content: null,
//                 description: null,
//                 created_at: null,
//                 updated_at: null,
//             };

//             expect(isCategoryNode(node)).toBe(true);
//             expect(isPostNode(node)).toBe(false);
//         });

//         it('isPostNode 정상 동작', () => {
//             const node: TTreeNode = {
//                 type: ETreeNodeType.POST,
//                 id: 1,
//                 title: 'Post',
//                 parent_id: 1,
//                 level: 1,
//                 group_id: null,
//                 priority: 100,
//                 post_id: 101,
//                 slug: 'post',
//                 content: 'Content',
//                 description: null,
//                 created_at: '2025-01-01T00:00:00Z',
//                 updated_at: '2025-01-01T00:00:00Z',
//             };

//             expect(isPostNode(node)).toBe(true);
//             expect(isCategoryNode(node)).toBe(false);
//         });
//     });
// });
