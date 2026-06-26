import { Router } from "express";
import home from "./home";
import posts from "./posts";
import dashboard from "./dashboard";
import users from "./users";
import admin from "./admin";

export const router = Router();

router.use("/", home);
router.use("/api/posts", posts);
router.use("/api/dashboard", dashboard);
router.use("/api/users", users);
router.use("/api/admin", admin);
// router.use("/accounts", require("./accounts"));
// router.use("/auth", require("./auth"));
// router.use("/chat", require("./chat"));
// router.use("/products", require("./products"));
// router.use("/cart", require("./cart"));
// router.use("/api/categories", require("./categories"));

export default router;
