import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { briefChecks, evaluate } from '../src/model/evaluate';
import { parse } from '../src/model/file';

const load = (name: string) => {
  const r = parse(readFileSync(new URL(`../examples/${name}`, import.meta.url), 'utf8'));
  if ('error' in r) throw new Error(r.error);
  return r.doc;
};

describe('saved examples', () => {
  it('original and revised reopen and satisfy the checkable facts of the brief', () => {
    const original = load('original.json');
    const revised = load('revised.json');
    const mainOf = (doc: typeof original) => evaluate(doc).pieces.find((p) => p.id === 'piece-main')!.pose;
    expect(original.entrance).toBe('south');
    expect(revised.entrance).toBe('east');
    expect(briefChecks(original, evaluate(original), null).every((c) => c.ok)).toBe(true);
    expect(briefChecks(revised, evaluate(revised), mainOf(original)).every((c) => c.ok)).toBe(true);
    expect(revised.arrangement!.members.find((m) => m.pieceId === 'piece-main')!.following).toBe(false);
  });
});
