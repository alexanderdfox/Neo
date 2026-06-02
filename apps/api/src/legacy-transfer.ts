/**
 * Legacy transfer script: Oracle -> Neo Postgres (app_events).
 *
 * Two patterns:
 * 1) Direct Oracle connection (node-oracledb) to Postgres (pg)
 * 2) CSV exported from Oracle into Postgres
 *
 * This is intentionally conservative and streaming-friendly so you can move
 * millions of rows without blowing RAM.
 */

import fs from "node:fs";
import readline from "node:readline";
import pg from "pg";

const { Pool } = pg;

// Postgres target (Neo)
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

type LegacyRow = {
  ID: string | number;
  KIND: string;
  PAYLOAD: string | null;
  CREATED_AT: string;
};

async function insertIntoNeo(row: LegacyRow) {
  await pgPool.query(
    `INSERT INTO app_events (id, kind, payload, created_at)
     VALUES ($1, $2, $3::jsonb, $4)
     ON CONFLICT (id) DO UPDATE
       SET kind = EXCLUDED.kind,
           payload = EXCLUDED.payload,
           created_at = EXCLUDED.created_at`,
    [row.ID, row.KIND, row.PAYLOAD ?? "{}", row.CREATED_AT]
  );
}

/**
 * Pattern A: CSV-based transfer.
 *
 * Export from Oracle (example):
 *   SPOOL legacy_app_events.csv
 *   SET COLSEP ','
 *   SELECT id, kind, payload, created_at FROM app_events;
 *   SPOOL OFF
 *
 * Then run:
 *   DATABASE_URL=postgres://... \
 *     node dist/legacy-transfer.js csv ./legacy_app_events.csv
 */
async function importFromCsv(path: string) {
  const fileStream = fs.createReadStream(path);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let lineNo = 0;
  for await (const line of rl) {
    lineNo += 1;
    if (!line.trim() || lineNo === 1) continue; // assume header
    const [id, kind, payload, createdAt] = line.split(",");
    await insertIntoNeo({
      ID: id,
      KIND: kind,
      PAYLOAD: payload && payload.length > 0 ? payload : "{}",
      CREATED_AT: createdAt,
    });
  }
}

/**
 * Pattern B: Direct Oracle → Postgres (pseudocode).
 *
 * Requires adding `oracledb` dependency and env:
 *   ORACLE_USER, ORACLE_PASSWORD, ORACLE_CONNECT_STRING
 *
 * The body is left as a template so you can adapt it to your schema.
 */
async function importFromOracleDirect() {
  // Uncomment after `npm install oracledb` in this package.
  // const oracledb = await import("oracledb");
  //
  // const connection = await oracledb.default.getConnection({
  //   user: process.env.ORACLE_USER,
  //   password: process.env.ORACLE_PASSWORD,
  //   connectString: process.env.ORACLE_CONNECT_STRING,
  // });
  //
  // const stream = connection.queryStream(
  //   "SELECT id, kind, payload, created_at FROM app_events"
  // );
  //
  // stream.on("data", async (row: any[]) => {
  //   const [id, kind, payload, createdAt] = row;
  //   await insertIntoNeo({
  //     ID: id,
  //     KIND: kind,
  //     PAYLOAD: payload,
  //     CREATED_AT: createdAt,
  //   });
  // });
  //
  // stream.on("end", () => {
  //   stream.destroy();
  // });
  //
  // stream.on("close", async () => {
  //   await connection.close();
  // });
}

async function main() {
  const mode = process.argv[2];
  if (mode === "csv") {
    const path = process.argv[3];
    if (!path) {
      throw new Error("Usage: legacy-transfer csv <path-to-csv>");
    }
    await importFromCsv(path);
  } else if (mode === "oracle") {
    await importFromOracleDirect();
  } else {
    throw new Error("Usage: legacy-transfer <csv|oracle> [...args]");
  }
}

main()
  .then(async () => {
    await pgPool.end();
  })
  .catch(async (err) => {
    console.error(err);
    await pgPool.end();
    process.exit(1);
  });

