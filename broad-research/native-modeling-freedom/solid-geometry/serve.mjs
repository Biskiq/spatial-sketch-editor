import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const allowed = new Map([
  ['/browser.html', 'text/html'], ['/goldens.json', 'application/json'],
  ...['browser', 'worker', 'experiments', 'candidate', 'fixtures', 'issue-1888', 'oracle', 'direct'].map(
    name => ['/' + name + '.mjs', 'text/javascript']),
  ['/.kernel/manifold.js', 'text/javascript'],
  ['/.kernel/manifold.wasm', 'application/wasm'],
]);
const server = createServer(async (request, response) => {
  response.setHeader('Content-Security-Policy',
    "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self'; connect-src 'self'");
  const path = new URL(request.url, 'http://localhost').pathname;
  if (path === '/report' && request.method === 'POST') {
    let text = '';
    for await (const part of request) {
      text += part.toString();
      if (text.length > 10000) {
        response.writeHead(413).end();
        return;
      }
    }
    console.log(text);
    response.writeHead(204).end();
    return;
  }
  if (request.method !== 'GET' || !allowed.has(path)) {
    response.writeHead(404).end();
    return;
  }
  try {
    const file = await readFile(new URL('.' + path, import.meta.url));
    response.writeHead(200, { 'Content-Type': allowed.get(path) }).end(file);
  } catch {
    response.writeHead(404).end();
  }
});
server.listen(Number(process.argv[2] ?? 0), '127.0.0.1', () => {
  console.log('http://127.0.0.1:' + server.address().port + '/browser.html');
});
