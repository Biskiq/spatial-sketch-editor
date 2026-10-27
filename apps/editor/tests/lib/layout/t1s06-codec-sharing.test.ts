import { describe, expect, it } from 'vitest';
import { setWorkObserver, validateWallFirstLayoutDocument } from '@portfolio/layout-core';
import { freezeF4Data, immutableF4Data } from '@portfolio/project-model';
import { buildScaleFixture, SCALE_FIXTURE_SEEDS } from './__fixtures__/layout-scale-fixtures';

describe('immutable normalized Layout elements', () => {
 it('shares only normalized immutable values and retains whole-document reference checks', () => {
  const first = validateWallFirstLayoutDocument(buildScaleFixture(SCALE_FIXTURE_SEEDS.small));
  if (!first.success) throw new Error('fixture did not validate');
  const frozen = immutableF4Data(first.document);
  const seeded = validateWallFirstLayoutDocument(frozen);
  if (!seeded.success) throw new Error('frozen fixture did not validate');
  expect(seeded.document.walls[0]).toBe(frozen.walls[0]);
  const counts = new Map<string, number>();
  const prior = setWorkObserver({ span() {}, count(name, n) { counts.set(name, (counts.get(name) ?? 0) + n); } });
  try {
   const again = validateWallFirstLayoutDocument(frozen);
   if (!again.success) throw new Error('cached fixture did not validate');
   expect(again.canonicalJson).toBe(first.canonicalJson);
   expect(counts.get('validation:frozen-element-hit')).toBeGreaterThanOrEqual(frozen.walls.length + frozen.junctions.length);
   expect(counts.get('validation:frozen-element-compare-property') ?? 0).toBe(0);
  } finally { setWorkObserver(prior); }
  // Cached Walls are still checked against this document's current directory.
  const deleted = validateWallFirstLayoutDocument({ ...frozen, junctions: frozen.junctions.slice(1) });
  expect(deleted.success).toBe(false);
 });
 it('does not certify a mutable parser output before its later freeze', () => {
  const parsed = validateWallFirstLayoutDocument(buildScaleFixture(SCALE_FIXTURE_SEEDS.small));
  if (!parsed.success) throw new Error('fixture did not validate');
  parsed.document.junctions[0]!.point[0] = NaN;
  freezeF4Data(parsed.document);
  expect(validateWallFirstLayoutDocument(parsed.document).success).toBe(false);
  const reversed = immutableF4Data({ ...buildScaleFixture(SCALE_FIXTURE_SEEDS.small), junctions: [{ point: [0, 0] as [number, number], id: 'unattached' }] });
  // Normalization key order remains exactly the parser's own order.
  const raw = buildScaleFixture({ ...SCALE_FIXTURE_SEEDS.small, roomCount: 0 });
  raw.junctions = reversed.junctions;
  const normalized = validateWallFirstLayoutDocument(raw);
  if (!normalized.success) throw new Error('isolated Junction did not validate');
  expect(Object.keys(normalized.document.junctions[0]!)).toEqual(['id', 'point']);
 });
});
