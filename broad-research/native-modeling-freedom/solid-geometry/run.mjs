import { brotliCompressSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { run, timings } from './experiments.mjs';

const start = performance.now();
const { default: Module } = await import('./.kernel/manifold.js');
const api = await Module();
api.setup();
const initMs = Number((performance.now() - start).toFixed(3));
const result = await run(api);
if (process.argv.includes('--verify')) {
  const golden = JSON.parse(readFileSync(new URL('./goldens.json', import.meta.url)));
  if (JSON.stringify(result.exact) !== JSON.stringify(golden)) throw new Error('Exact golden mismatch');
}
const assets = Object.fromEntries(['manifold.js', 'manifold.wasm'].map(file => {
  const bytes = readFileSync(new URL('./.kernel/' + file, import.meta.url));
  return [file, { bytes: bytes.length, brotliBytes: brotliCompressSync(bytes).length }];
}));
const environment = { node: process.version, engine: process.versions.v8, platform: process.platform, arch: process.arch };
console.log(JSON.stringify({ environment, initMs, assets, ...result,
  performance: process.argv.includes('--timings') ? timings(api) : undefined }, null, 2));
