// Purpose: barrel for the threaded-comment service (Option C). Re-exports the
//          public surface so '../../helpers/comments' resolves here unchanged
//          after the file→directory split (read path, write path, shared errors).
// Invariants: this file adds NO logic — it only re-exports.
// Side effects: none.
export {
    CommentParentError,
    CommentForbiddenError,
    CommentNotFoundError,
    CommentDeletedError,
} from './errors';
export { listCommentTree, listCommentPage, orderByRoots } from './list';
export { createComment, softDeleteComment, updateComment } from './write';
