import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const databaseName = "bolton-madrasat";
const remote = process.argv.includes("--remote");
const locationFlag = remote ? "--remote" : "--local";

const password = "Madrasah2026!";
const passwordHash = await bcrypt.hash(password, 12);

const users = [
  {
    email: "admin@boltonmadrasat.local",
    displayName: "Amina Yusuf",
    role: "admin",
  },
  {
    email: "teacher@boltonmadrasat.local",
    displayName: "Teacher User",
    role: "teacher",
  },
  {
    email: "finance@boltonmadrasat.local",
    displayName: "Finance User",
    role: "finance",
  },
  {
    email: "safeguarding@boltonmadrasat.local",
    displayName: "Safeguarding User",
    role: "safeguarding",
  },
  {
    email: "parent@boltonmadrasat.local",
    displayName: "Parent User",
    role: "parent",
  },
];

function escapeSql(value: string) {
  return value.replaceAll("'", "''");
}

const userSql = users
  .map(
    (user) => `
INSERT INTO users (
  id,
  email,
  display_name,
  role,
  password_hash,
  status,
  created_at,
  updated_at
)
VALUES (
  '${randomUUID()}',
  '${escapeSql(user.email)}',
  '${escapeSql(user.displayName)}',
  '${escapeSql(user.role)}',
  '${escapeSql(passwordHash)}',
  'active',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT(email) DO UPDATE SET
  display_name = excluded.display_name,
  role = excluded.role,
  password_hash = excluded.password_hash,
  status = 'active',
  updated_at = CURRENT_TIMESTAMP;
`,
  )
  .join("\n");

const settingsSql = `
INSERT INTO app_settings (
  key,
  value,
  created_at,
  updated_at
)
VALUES
  (
    'application_fee_pence',
    '0',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'application_fee_required',
    'false',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'default_monthly_fee_pence',
    '0',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'default_billing_day',
    '1',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'sibling_discount_pence',
    '0',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'late_grace_days',
    '7',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'stripe_enabled',
    'false',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'direct_debit_enabled',
    'false',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
ON CONFLICT(key) DO UPDATE SET
  value = excluded.value,
  updated_at = CURRENT_TIMESTAMP;
`;

const sql = `
PRAGMA foreign_keys = ON;

${userSql}

${settingsSql}
`;

const seedFile = join(
  process.cwd(),
  remote ? ".d1-seed-remote.sql" : ".d1-seed-local.sql",
);

writeFileSync(seedFile, sql, "utf8");

console.log(
  `Seeding Cloudflare D1 database ${databaseName} (${remote ? "remote" : "local"})...`,
);

try {
  // Running through cmd.exe avoids Node/Windows spawnSync issues with npx.cmd.
  const command =
  `npx wrangler d1 execute ${databaseName} ${locationFlag} ` +
  `--file ${seedFile}`;

  const result = spawnSync(
    process.env.ComSpec ?? "cmd.exe",
    ["/d", "/s", "/c", command],
    {
      cwd: process.cwd(),
      stdio: "inherit",
      env: process.env,
      shell: false,
    },
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `Wrangler exited with code ${result.status ?? "unknown"}`,
    );
  }

  console.log("");
  console.log("D1 seed completed successfully.");
  console.log("");
  console.log("Local login accounts:");
  console.log("  admin@boltonmadrasat.local");
  console.log("  teacher@boltonmadrasat.local");
  console.log("  finance@boltonmadrasat.local");
  console.log("  safeguarding@boltonmadrasat.local");
  console.log("  parent@boltonmadrasat.local");
  console.log("");
  console.log(`Password: ${password}`);
} finally {
  try {
    unlinkSync(seedFile);
  } catch {
    // Ignore cleanup failure.
  }
}