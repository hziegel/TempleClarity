import pg from "pg";

// Thin wrapper over a pg connection pool.
//   db.query(sql, params)        -> { rows }
//   db.tx(async (q) => { ... })  -> runs q(sql, params) calls in one transaction
export function createDb({ databaseUrl, databaseSsl }) {
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    ssl: databaseSsl ? { rejectUnauthorized: false } : undefined,
    max: 10,
    idleTimeoutMillis: 30_000,
  });
  pool.on("error", (e) => console.error("[db] idle client error:", e.message));
  return {
    query: (sql, params) => pool.query(sql, params),
    async tx(fn) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const out = await fn((sql, params) => client.query(sql, params));
        await client.query("COMMIT");
        return out;
      } catch (e) {
        try { await client.query("ROLLBACK"); } catch { /* ignore */ }
        throw e;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}
