// Deletes the database named by DATABASE_URL and migrates a new one (used by the e2e server).
import fs from 'node:fs';
import { databaseFile, openDb } from './client.ts';

const file = databaseFile();
if (file !== ':memory:') {
  for (const suffix of ['', '-wal', '-shm', '-journal']) fs.rmSync(file + suffix, { force: true });
}
openDb().$client.close();
console.log(`Fresh database: ${file}`);
