import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { ApiError, boolean, cookie, integer, required, sha256 } from "../lib/backend";

test("the PostgreSQL migration creates every Version 1 table", async () => {
  const database = new PGlite();
  const migrationsDirectory = new URL("../drizzle/", import.meta.url);
  const migrations = (await readdir(migrationsDirectory)).filter(name => name.endsWith(".sql")).sort();
  for (const name of migrations) {
    const migration = await readFile(new URL(name, migrationsDirectory), "utf8");
    for (const statement of migration.split("--> statement-breakpoint").map(value => value.trim()).filter(Boolean)) await database.exec(statement);
  }
  const result = await database.query<{ table_name: string }>("select table_name from information_schema.tables where table_schema='public' order by table_name");
  const names = result.rows.map(row => row.table_name);
  for (const table of ["users","sessions","students","guardians","applications","classes","enrolments","attendance","progress","fees","payments","announcements","staff_compliance","audit_log"]) assert.ok(names.includes(table), `${table} should exist`);
  await database.close();
});

test("request validation rejects invalid required values and integers", () => {
  assert.equal(required("  Maryam  ", "Name"), "Maryam");
  assert.throws(() => required("", "Name"), ApiError);
  assert.equal(integer("25", "Capacity", 1), 25);
  assert.throws(() => integer("0", "Capacity", 1), ApiError);
  assert.equal(boolean("true"), true);
});

test("session helpers parse cookies and create deterministic hashes", async () => {
  const request = new Request("http://localhost", { headers: { cookie: "theme=green; madrasat_session=abc123" } });
  assert.equal(cookie(request, "madrasat_session"), "abc123");
  assert.equal(await sha256("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});
