import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import router from "./routes";
import { logger } from "./lib/logger";

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

app.use("/api", router);

// En production le frontend est servi par ce meme serveur : une seule URL, un
// seul port, ce qui laisse les WebSockets (/api/live, /api/octogone) passer par
// la meme origine. En dev c'est Vite qui sert le frontend et proxifie /api.
const clientDir =
  process.env["CLIENT_DIST"] ??
  path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../belkhayate-trader/dist/public",
  );

if (existsSync(path.join(clientDir, "index.html"))) {
  app.use(express.static(clientDir));

  // Fallback SPA : toute route inconnue renvoie index.html pour que le routeur
  // client prenne le relais. Les routes /api non trouvees gardent leur 404.
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(clientDir, "index.html"));
  });

  logger.info({ clientDir }, "Frontend servi depuis le serveur API");
} else {
  logger.warn(
    { clientDir },
    "Build frontend introuvable — seule l'API est servie",
  );
}

export default app;
