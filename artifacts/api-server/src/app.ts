import express, { type Express } from "express";
import cors from "cors";
import path from "node:path";
import pinoHttp from "pino-http";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const publicPath = path.resolve(__dirname, "public");

// Images are versioned (?v=N) — cache aggressively for 1 year
const imagesCachePath = path.resolve(publicPath, "images");
const imgCache = { maxAge: "1y", immutable: true };
app.use("/images", express.static(imagesCachePath, imgCache));
app.use("/api/images", express.static(imagesCachePath, imgCache));

// Serve static assets at both / and /api/ (proxy may not strip prefix)
app.use(express.static(publicPath, { maxAge: "1h" }));
app.use("/api", express.static(publicPath, { maxAge: "1h" }));

// API routes (after static so static files take priority for asset paths)
app.use("/api", router);

// Fallback: serve index.html for any unmatched route
app.get("/{*path}", (_req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

export default app;
