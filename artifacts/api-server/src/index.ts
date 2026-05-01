import { createServer } from "http";
import type { IncomingMessage } from "http";
import type { Duplex } from "stream";
import app from "./app";
import { logger } from "./lib/logger";
import { createLiveAnalysisWss } from "./lib/liveAnalysisWs";
import { createOctogoneAnalysisWss } from "./lib/octogoneAnalysisWs";
import { pool } from "@workspace/db";

async function runStartupMigrations() {
  const client = await pool.connect();
  try {
    await client.query(
      `ALTER TABLE analyses ADD COLUMN IF NOT EXISTS session_id text`,
    );
    logger.info("Startup migration: analyses.session_id ready");
  } finally {
    client.release();
  }
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = createServer(app);

const liveWss = createLiveAnalysisWss();
const octogoneWss = createOctogoneAnalysisWss();

// Route WebSocket upgrade requests manually so both WSS instances
// can coexist on the same HTTP server without one rejecting the other.
server.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
  const pathname = req.url ?? "";

  if (pathname === "/api/live") {
    liveWss.handleUpgrade(req, socket, head, (ws) => {
      liveWss.emit("connection", ws, req);
    });
  } else if (pathname === "/api/octogone") {
    octogoneWss.handleUpgrade(req, socket, head, (ws) => {
      octogoneWss.emit("connection", ws, req);
    });
  } else {
    // Unknown path — destroy the socket cleanly
    socket.destroy();
  }
});

logger.info("Live analysis WebSocket server attached at /api/live");
logger.info("Octogone analysis WebSocket server attached at /api/octogone");

runStartupMigrations()
  .then(() => {
    server.listen(port, (err?: Error) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }

      logger.info({ port }, "Server listening");
    });
  })
  .catch((err) => {
    logger.error({ err }, "Startup migration failed");
    process.exit(1);
  });
