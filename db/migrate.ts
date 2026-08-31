import nextEnv from "@next/env";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());
const { db, sql } = await import("./index");

try {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("PostgreSQL migrations completed successfully.");
} catch (error) {
  console.error("PostgreSQL migration failed:", error);
  process.exitCode = 1;
} finally {
  await sql.end();
}
