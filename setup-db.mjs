import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pg = require("./lib/db/node_modules/pg/lib/index.js");
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Charger .env manuellement
const envPath = path.join(__dirname, ".env");
const envLines = readFileSync(envPath, "utf8").split("\n");
for (const line of envLines) {
  if (line.trim().startsWith("#") || !line.includes("=")) continue;
  const [key, ...rest] = line.split("=");
  process.env[key.trim()] = rest.join("=").trim();
}

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const sql = `
CREATE TABLE IF NOT EXISTS analyses (
  id SERIAL PRIMARY KEY,
  signal TEXT NOT NULL,
  asset TEXT,
  timeframe TEXT,
  synthesis TEXT NOT NULL,
  raw_analysis TEXT NOT NULL,
  image_base64 TEXT,
  energy_state TEXT NOT NULL DEFAULT 'Absent',
  direction_trend TEXT NOT NULL DEFAULT 'NEUTRE',
  nearest_pivot TEXT NOT NULL DEFAULT 'FA',
  entry TEXT,
  stop_loss TEXT,
  tp1 TEXT,
  tp2 TEXT,
  mode TEXT DEFAULT 'SOLO',
  session_id TEXT,
  tp_mismatch BOOLEAN NOT NULL DEFAULT FALSE,
  tp_mismatch_detail TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
`;

try {
  await pool.query(sql);
  console.log("✅ Table 'analyses' créée (ou déjà existante).");
  const res = await pool.query("SELECT COUNT(*) FROM analyses");
  console.log(`📊 Lignes existantes : ${res.rows[0].count}`);
} catch (err) {
  console.error("❌ Erreur :", err.message);
} finally {
  await pool.end();
}
