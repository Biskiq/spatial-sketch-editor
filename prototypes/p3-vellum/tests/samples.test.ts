import { describe, it, expect } from 'vitest';
import { SAMPLES } from '../src/samples/samples';
import { derive } from '../src/model/derive';

describe('samples build natively', () => {
  for (const s of SAMPLES) {
    it(s.title, () => {
      const p = s.make();
      const d = derive(p);
      console.log(s.id, 'rooms:', d.rooms.map((r) => `${r.name}@${r.floorY.toFixed(1)}-${r.topY.toFixed(1)}`).join(', '));
      console.log('  issues:', d.issues.map((i) => `${i.kind}: ${i.text}${i.acknowledged ? ' (ack)' : ''}`).join(' | ') || 'none');
      console.log('  openings misfit:', [...d.walls.values()].flatMap((w) => w.openings.filter((o) => !o.fits).map((o) => o.why)).join(', ') || 'none');
      expect(d.rooms.length).toBeGreaterThan(1);
    });
  }
});

describe('levels revise honestly', () => {
  it('raising a ceiling carries the floor above — and the room standing on it', async () => {
    const { runTxn, opRoom } = await import('../src/model/ops');
    const p = SAMPLES.find((x) => x.id === 'wings')!.make();
    const studio = p.rooms.find((r) => r.name === 'Studio')!;
    const r = runTxn(p, opRoom(studio.id, { height: studio.height + 0.8 }));
    const q = r.after;
    const deck = q.decks.find((d) => d.restsOn === studio.id)!;
    expect(deck.y).toBeCloseTo(studio.floorY + studio.height + 0.8, 3);
    const d = derive(q);
    const classroom = d.rooms.find((x) => x.name === 'Classroom')!;
    expect(classroom).toBeTruthy();
    expect(classroom.floorY).toBeCloseTo(deck.y, 3);
    expect(d.issues.filter((i) => i.kind === 'headroom')).toHaveLength(0);
    expect(r.notes.some((n) => n.text.includes('Classroom'))).toBe(true);
  });
});
