import { resetDb, getDbPath } from '../src/store.js';
import { seedData } from '../src/seed-data.js';

await resetDb(seedData);

console.log(`Demo SQLite data reset at ${getDbPath()}`);
