import { Pool } from 'pg';
import { createApp } from './dist/app.js';
import { runMigrations } from './dist/migrate.js';
import { memoryObjectStore, SESSION_KEY } from './tests/test-support.mjs';
const pool = new Pool({ connectionString: 'postgresql://tony@127.0.0.1:55432/biskiq' });
await runMigrations(pool);
const app = createApp({ pool, apiOrigin: 'http://localhost:55434', editorOrigin: 'http://localhost:55433',
	sessionKey: SESSION_KEY, testAuth: { secret: 'a1-local-browser-only' }, objectStore: memoryObjectStore(), logger: false });
await app.listen({ host: '127.0.0.1', port: 55434 });
