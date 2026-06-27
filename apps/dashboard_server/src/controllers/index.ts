import { Router } from "express";
import home from "./home";
import posts from "./posts";
import likes from "./likes";
import { postCommentsRouter, commentsRouter } from "./comments";
import dashboard from "./dashboard";
import users from "./users";
import admin from "./admin";
import favorites from "./favorites";

export const router = Router();

router.use("/", home);
router.use("/api/posts", posts);
// Likes nest under a post (POST /api/posts/:postId/like). Mounted after the
// posts router so the posts read routes match first; the like toggle is the
// only POST handler here.
router.use("/api/posts", likes);
// Comments nest under a post for create/list (GET+POST /api/posts/:postId/comments);
// mounted after posts/likes so the literal `/comments` segment is not captured
// by a post id matcher. The delete-by-comment-id route mounts separately below.
router.use("/api/posts", postCommentsRouter);
router.use("/api/comments", commentsRouter);
router.use("/api/dashboard", dashboard);
router.use("/api/users", users);
router.use("/api/admin", admin);
router.use("/api/favorites", favorites);
// router.use("/accounts", require("./accounts"));
// router.use("/auth", require("./auth"));
// router.use("/chat", require("./chat"));
// router.use("/products", require("./products"));
// router.use("/cart", require("./cart"));
// router.use("/api/categories", require("./categories"));

export default router;
