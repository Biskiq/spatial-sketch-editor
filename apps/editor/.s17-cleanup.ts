import { Pool } from 'pg';
import { loginAs } from './tests/e2e/test-auth';

const projectId = 'e43cbb0f-9644-4054-9757-cb91c67ccc21';
const apiOrigin = process.env.PUBLIC_API_ORIGIN ?? 'http://127.0.0.1:8787';
const editorOrigin = process.env.PUBLIC_EDITOR_ORIGIN ?? 'http://127.0.0.1:5173';
const secret = process.env.E2E_TEST_AUTH_SECRET;
if (!secret) throw new Error('E2E_TEST_AUTH_SECRET is missing');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  const result = await pool.query<{ token: string }>('SELECT saved_base_token AS token FROM projects WHERE id = $1', [projectId]);
  const token = result.rows[0]?.token;
  if (!token) {
    console.log('project already absent');
  } else {
    const session = await loginAs({ user: 'agent-user-a', apiOrigin, secret, origin: editorOrigin });
    const response = await fetch(`${apiOrigin}/projects/${encodeURIComponent(projectId)}`, {
      method: 'DELETE',
      headers: new Headers({ Accept: 'application/json', 'Content-Type': 'application/json', Cookie: session.cookie, Origin: editorOrigin }),
      body: JSON.stringify({ precondition: { kind: 'expected-saved-base', token } })
    });
    console.log(`project cleanup HTTP ${response.status}`);
    if (!response.ok) throw new Error(`Project cleanup failed with HTTP ${response.status}`);
  }
} finally {
  await pool.end();
}
