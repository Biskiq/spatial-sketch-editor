/**
 * Stable text digest of one canonical form mesh.
 *
 * The digest covers exactly the values the evaluation contract pins for a
 * source: positions, triangle indices and per-triangle regions, in their fixed
 * order. It is a golden-test identity, not a cryptographic hash; two seeded
 * 32-bit FNV-1a passes give a 64-bit hex string with no BigInt arithmetic and
 * no engine-dependent formatting beyond ECMAScript's shortest round-trip
 * `Number#toString`.
 */
import type { FormMesh } from './extrude';

export function formMeshDigest(mesh: FormMesh): string {
  const parts: string[] = ['geometry-core/form-mesh/1'];
  parts.push(String(mesh.positions.length));
  for (let index = 0; index < mesh.positions.length; index += 1) {
    parts.push(mesh.positions[index]!.toString());
  }
  parts.push(String(mesh.indices.length));
  for (let index = 0; index < mesh.indices.length; index += 1) {
    parts.push(String(mesh.indices[index]!));
  }
  parts.push(String(mesh.regions.length));
  for (let index = 0; index < mesh.regions.length; index += 1) {
    parts.push(String(mesh.regions[index]!));
  }
  const text = parts.join('|');
  const first = fnv1a(text, 0x811c9dc5);
  const second = fnv1a(text, 0x01000193);
  return `gc1-${hex32(first)}${hex32(second)}`;
}

function fnv1a(text: string, seed: number): number {
  let hash = seed >>> 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash ^ text.charCodeAt(index)) >>> 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function hex32(value: number): string {
  let text = (value >>> 0).toString(16);
  while (text.length < 8) text = `0${text}`;
  return text;
}
