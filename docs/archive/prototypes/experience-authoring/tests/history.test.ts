import { describe, expect, it } from 'vitest';
import { emptyDocument } from '../src/fixture';
import { emptyHistory, pushEdit, redo, undo } from '../src/history';
import type { Document } from '../src/model';
const make = (counter: number): Document => { const d = emptyDocument(); d.counter = counter; return d; };
describe('undo history coalescing', () => {
  it('treats a continuous drag as one edit', () => {
    const [a, b, c, e] = [make(0), make(1), make(2), make(3)];
    let h = emptyHistory(a);
    h = pushEdit(h, b, 'use-dist:use-1', 1000);
    h = pushEdit(h, c, 'use-dist:use-1', 1100);
    h = pushEdit(h, e, 'use-dist:use-1', 1200);
    expect(h.doc).toBe(e); expect(h.past).toHaveLength(1);
    const back = undo(h); expect(back.doc).toBe(a); expect(back.past).toHaveLength(0);
  });
  it('keeps different fields and unkeyed actions separate', () => {
    const [a, b, c, e] = [make(0), make(1), make(2), make(3)];
    let h = emptyHistory(a);
    h = pushEdit(h, b, 'use-name:use-1', 1000);
    h = pushEdit(h, c, 'use-dist:use-1', 1050);
    h = pushEdit(h, e, null, 1100);
    expect(h.past).toHaveLength(3);
  });
  it('starts a new step once the coalescing window lapses', () => {
    const [a, b, c] = [make(0), make(1), make(2)];
    let h = emptyHistory(a);
    h = pushEdit(h, b, 'use-name:use-1', 1000);
    h = pushEdit(h, c, 'use-name:use-1', 2500);
    expect(h.past).toHaveLength(2);
  });
  it('does not merge a new edit into the step that was just undone', () => {
    const [a, b, c] = [make(0), make(1), make(2)];
    let h = pushEdit(emptyHistory(a), b, 'use-name:use-1', 1000);
    h = undo(h);
    h = pushEdit(h, c, 'use-name:use-1', 1100);
    expect(h.past).toHaveLength(1); expect(undo(h).doc).toBe(a);
  });
  it('redo restores the latest state after a coalesced burst', () => {
    const [a, b, c] = [make(0), make(1), make(2)];
    let h = pushEdit(emptyHistory(a), b, 'use-dist:use-1', 1000);
    h = pushEdit(h, c, 'use-dist:use-1', 1100);
    h = redo(undo(h));
    expect(h.doc).toBe(c);
  });
});
