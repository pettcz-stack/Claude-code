import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { config } from "./config.js";
import { api } from "./api/routes.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());

app.use("/api", api);

// Statický frontend (cenová mapa)
app.use(express.static(join(__dirname, "..", "public")));

// Centrální error handler
app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(err);
    res.status(500).json({ error: "internal", detail: String(err) });
  },
);

app.listen(config.port, () => {
  console.log(`Cenová mapa běží na http://localhost:${config.port}`);
});
