import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const target = fileURLToPath(new URL('./.kernel/', import.meta.url));
const version = '3.5.4';
const integrity = 'WWsme5HabwLHVcWPHT9m+s7mdmDVSEvCny+uXH1E7jEc8FbFUgM75C3Dh6NVw57Eeh3Ow7+xHCuXfxDMOemi9A==';
mkdirSync(target, { recursive: true });
const archive = target + 'manifold-3d-' + version + '.tgz';
try {
  execFileSync('npm', ['pack', 'manifold-3d@' + version, '--pack-destination', target, '--silent']);
  const digest = createHash('sha512').update(readFileSync(archive)).digest('base64');
  if (digest !== integrity) throw new Error('Manifold tarball integrity mismatch');
  execFileSync('tar', ['-xzf', archive, '-C', target, '--strip-components=1',
    'package/manifold.js', 'package/manifold.wasm', 'package/LICENSE']);
  for (const file of ['manifold.js', 'manifold.wasm']) {
    console.log(file, createHash('sha256').update(readFileSync(target + file)).digest('hex'));
  }
} finally {
  rmSync(archive, { force: true });
}
