import { Router } from "express";
import { Db } from "mongodb";
import { connectToDatabase, isMemoryDb } from "../db";

const router = Router();

router.get("/db", async (_req, res) => {
  try {
    const db = await connectToDatabase();

    if (isMemoryDb(db)) {
      return res.status(200).json({
        status: "degraded",
        detail: "in_memory_db",
        hint: "Set MONGODB_URI to enable persistent storage.",
      });
    }

    await (db as Db).command({ ping: 1 });

    return res.status(200).json({ status: "ok" });
  } catch (error) {
    return res.status(503).json({
      status: "down",
      detail: "mongo_unreachable",
      hint: "Verify MONGODB_URI and network access between the server and MongoDB.",
    });
  }
});

export default router;
