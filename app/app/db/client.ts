import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";

const file = process.env.CKA_DB ?? path.join(process.cwd(), "data", "progress.db");
fs.mkdirSync(path.dirname(file), { recursive: true });

export const db = drizzle(new Database(file), { schema });
migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
