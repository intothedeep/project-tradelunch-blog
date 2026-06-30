// posts.ts — read-router barrel. Composes the split read-route modules onto a
// single read Router consumed by ./index.ts and the route tests. Handlers live
// in posts.feed / posts.user-feed / posts.user-categories / posts.user-meta /
// posts.detail; shared SQL in posts.shared.
//
// Route-order invariant: GET /:postid (posts.detail) is a single-segment
// catch-all and MUST be registered LAST so it never shadows the specific routes.
import { Router } from 'express';
import { registerFeedRoutes } from './posts.feed';
import { registerUserFeedRoutes } from './posts.user-feed';
import { registerUserCategoriesRoutes } from './posts.user-categories';
import { registerUserMetaRoutes } from './posts.user-meta';
import { registerDetailRoutes } from './posts.detail';

export const router = Router();
registerFeedRoutes(router);
registerUserFeedRoutes(router);
registerUserCategoriesRoutes(router);
registerUserMetaRoutes(router);
registerDetailRoutes(router); // LAST: /:postid catch-all
