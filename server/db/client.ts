import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema.ts';

export type Db = BetterSQLite3Database<typeof schema> & { $client: Database.Database };

export const DEFAULT_DATABASE_URL = 'data/app.db';
const MIGRATIONS = path.resolve(process.cwd(), 'server/db/migrations');

/** The file named by DATABASE_URL (a `file:` prefix is allowed), or `:memory:`. */
export function databaseFile(url = process.env.DATABASE_URL || DEFAULT_DATABASE_URL): string {
  const file = url.startsWith('file:') ? url.slice('file:'.length) : url;
  return file === ':memory:' ? file : path.resolve(process.cwd(), file);
}

/** Opens the database and applies every pending migration. */
export function openDb(url?: string): Db {
  const file = databaseFile(url);
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('busy_timeout = 5000');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle({ client: sqlite, schema }) as Db;
  migrate(db, { migrationsFolder: MIGRATIONS });
  return db;
}

let current: Db | null = null;

/** The shared database of this process, opened on first use. */
export function getDb(): Db {
  if (!current) current = openDb();
  return current;
}

/** Closes the shared database; the next getDb() opens it again. */
export function closeDb(): void {
  current?.$client.close();
  current = null;
}

export const nowIso = (): string => new Date().toISOString();
