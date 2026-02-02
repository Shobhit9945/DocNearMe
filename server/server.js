import express from "express";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

// Test route — this confirms your server works
app.get("/", (req, res) => {
  res.send("✅ Server is running on port 5000");
});

app.listen(5000, () => console.log("🚀 Server running on http://localhost:5000"));
