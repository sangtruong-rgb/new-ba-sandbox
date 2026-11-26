// `npm run db:migrate`: creates or updates the tables in the file named by DATABASE_URL.
import { databaseFile, openDb } from './client.ts';

const db = openDb();
db.$client.close();
console.log(`Database ready: ${databaseFile()}`);
