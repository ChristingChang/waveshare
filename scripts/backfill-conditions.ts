import "dotenv/config";
import mysql, { type RowDataPacket } from "mysql2/promise";
import { conditionsForSession } from "../server/surfConditions";

if (!process.env.DATABASE_URL) throw new Error("需要 DATABASE_URL");
const dryRun = process.argv.includes("--dry-run");
const db = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT id, date, spotName, spotLat, spotLng, surfHour FROM surf_sessions WHERE conditions IS NULL ORDER BY id"
  );
  for (const row of rows) {
    if (dryRun) {
      console.log(
        JSON.stringify({
          id: row.id,
          date: row.date,
          spotName: row.spotName,
          surfHour: row.surfHour,
          dryRun: true,
        })
      );
      continue;
    }
    const conditions = await conditionsForSession(
      {
        date: row.date,
        spotName: row.spotName,
        spotLat: row.spotLat,
        spotLng: row.spotLng,
        surfHour: row.surfHour,
      },
      ""
    );
    if (conditions)
      await db.execute(
        "UPDATE surf_sessions SET conditions = ? WHERE id = ? AND conditions IS NULL",
        [conditions, row.id]
      );
    console.log(JSON.stringify({ id: row.id, updated: !!conditions }));
    await new Promise(resolve => setTimeout(resolve, 300));
  }
} finally {
  await db.end();
}
