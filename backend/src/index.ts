import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import authRouter from "./auth";
import essaysRouter from "./essays";
import plagiarismRouter from "./plagiarism";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3000;
const HOST = "0.0.0.0";

// Frontend build output path (relative to backend dir)
const FRONTEND_DIST = path.resolve(__dirname, "../../frontend/dist");

const app = express();

// --- Middleware ---
app.use(express.json());

// --- API routes ---

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRouter);
app.use("/api/essays", essaysRouter);
app.use("/api/essays", plagiarismRouter);

// --- Serve frontend in production ---
// Serve static assets from the built frontend.
app.use(express.static(FRONTEND_DIST));

// Fall back to index.html for all non-API routes (SPA client-side routing).
// Express 5 uses path-to-regexp v8, which does not support bare "*" — use
// middleware instead of a route to avoid path-to-regexp parsing.
app.use((req, res) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ error: "Not found" });
  }
  res.sendFile(path.join(FRONTEND_DIST, "index.html"));
});

// --- Start server ---
// The publish script frees port 3000 before starting, so we just bind.
app.listen(PORT, HOST, () => {
  console.log(`PaperProof server running on http://${HOST}:${PORT}`);
});
