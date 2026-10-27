import { createHash } from 'node:crypto';

/** Hash exact ordered JSON a record at a time. This is a verification digest,
 * never a replacement for the product's canonical content identity. */
export function outputDigest(value: unknown): string {
 const hash = createHash('sha256');
 const stream = (value: any): void => {
  if (Array.isArray(value)) { hash.update('['); for (let i = 0; i < value.length; i += 1) { if (i) hash.update(','); hash.update(JSON.stringify(value[i]) ?? 'null'); } hash.update(']'); }
  else if (value !== null && typeof value === 'object') { hash.update('{'); let first = true; for (const key of Object.keys(value)) { const child = value[key]; if (child === undefined) continue; if (!first) hash.update(','); first = false; hash.update(JSON.stringify(key) + ':'); stream(child); } hash.update('}'); }
  else hash.update(JSON.stringify(value));
 };
 stream(value); return hash.digest('hex');
}
