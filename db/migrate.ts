import { spawnSync } from "node:child_process";

const databaseName = "bolton-madrasat";
const useRemote = process.argv.includes("--remote");

const command = process.platform === "win32" ? "npx.cmd" : "npx";

const args = [
  "wrangler",
  "d1",
  "migrations",
  "apply",
  databaseName,
  useRemote ? "--remote" : "--local",
];

console.log(
  `Applying Cloudflare D1 migrations to ${databaseName} (${useRemote ? "remote" : "local"})...`,
);

const result = spawnSync(command, args, {
  stdio: "inherit",
  cwd: process.cwd(),
});

if (result.error) {
  console.error("Unable to start Wrangler migration:", result.error);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(
    `Cloudflare D1 migration failed with exit code ${result.status ?? "unknown"}.`,
  );
  process.exit(result.status ?? 1);
}

console.log("Cloudflare D1 migration completed successfully.");