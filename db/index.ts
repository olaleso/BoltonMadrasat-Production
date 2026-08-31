import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalDb = globalThis as unknown as { sql?: ReturnType<typeof postgres> };
const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://madrasat:madrasat@localhost:5432/bolton_madrasat";
const sql =
  globalDb.sql ??
  postgres(connectionString, {
    max: process.env.NODE_ENV === "production" ? 10 : 3,
  });
if (process.env.NODE_ENV !== "production") globalDb.sql = sql;
export const db = drizzle(sql, { schema });
export { sql };
