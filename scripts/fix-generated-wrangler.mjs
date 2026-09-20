import fs from "node:fs";
const path = "dist/server/wrangler.json";
if (!fs.existsSync(path)) {
  console.error(`Generated Wrangler config not found: ${path}`);
  process.exit(1);
}
const config = JSON.parse(fs.readFileSync(path, "utf8"));
delete config.legacy_env;
fs.writeFileSync(path, JSON.stringify(config), "utf8");
console.log("Removed obsolete legacy_env from generated Wrangler config.");
