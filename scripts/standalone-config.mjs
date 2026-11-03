import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
const id = process.env.FINN_D1_DATABASE_ID;
if (!id || !/^[a-f0-9-]{36}$/i.test(id))
  throw new Error(
    "Set FINN_D1_DATABASE_ID to the real Cloudflare D1 database UUID first.",
  );
const config = JSON.parse(await readFile("dist/server/wrangler.json", "utf8"));
config.name = "finn-investor";
config.main = resolve("dist/server/index.js");
config.assets = { directory: resolve("dist/client") };
config.d1_databases = [
  {
    binding: "DB",
    database_name: "finn-investor",
    database_id: id,
    migrations_dir: resolve("drizzle"),
  },
];
config.triggers = { crons: ["*/15 3-13 * * 1-5"] };
await mkdir(".wrangler", { recursive: true });
await writeFile(".wrangler/finn-deploy.json", JSON.stringify(config, null, 2));
console.log(
  "Wrote .wrangler/finn-deploy.json with your D1 binding and weekday monitoring schedule.",
);
