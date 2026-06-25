import { Router } from "express";
import { promises as fs } from "fs";
import path from "path";

export const router = Router();

router.get("/", (req, res) => {
	res.json({ status: "ok" });
});

router.get("/health", (req, res) => {
	res.json({ status: "ok", msg: "Healthy" });
});

router.get("/status", async (req, res) => {
	try {
		const filePath = path.join(
			process.cwd(),
			"packages",
			"assets",
			"docs",
			"test.txt"
		);

		const content = await fs.readFile(filePath, "utf-8");
		res.json({ status: "ok", content });
	} catch (error) {
		console.error("Failed to read asset file:", error);
		res.status(500).json({ status: "error", message: "Could not read file" });
	}
});
