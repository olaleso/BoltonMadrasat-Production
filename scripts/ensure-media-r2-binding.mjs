import fs from "node:fs";
import path from "node:path";

const configPath = path.resolve("dist/server/wrangler.json");
if (!fs.existsSync(configPath)) {
  console.warn("Generated Wrangler config not found; MEDIA R2 binding was not injected.");
  process.exit(0);
}

const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const bindings = Array.isArray(config.r2_buckets) ? config.r2_buckets : [];

if (!bindings.some((item) => item?.binding === "MEDIA")) {
  bindings.push({ binding: "MEDIA", bucket_name: "bnmc-media" });
  config.r2_buckets = bindings;
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
  console.log("Added MEDIA R2 binding to generated Wrangler config.");
} else {
  console.log("MEDIA R2 binding already present in generated Wrangler config.");
}
