/**
 * T2.S8 U2 — Paint's consequence line: one wording, read on the Stage view bar
 * (the accepted appearance prototype's top bar), never in the tray.
 */
import { describe, expect, it } from 'vitest';
import { paintConsequence } from '$lib/authoring/stage/paint-consequence';

const base = { stroke: null, dropper: false, picked: true, tab: 'materials' as const, candidate: null };
const candidate = (refusal: string | null, consequence: string | null) => ({ refusal, consequence }) as never;

describe('T2.S8 U2 — Paint consequence', () => {
	it('words the next press, the stroke, the dropper and a refusal', () => {
		expect(paintConsequence({ ...base, picked: false })).toEqual({ tool: 'Paint', text: 'Choose a material', refused: false });
		expect(paintConsequence({ ...base, picked: false, tab: 'colours' }).text).toBe('Choose a colour');
		expect(paintConsequence(base).text).toBe('Point at a surface or an object');
		expect(paintConsequence({ ...base, candidate: candidate(null, 'Terrazzo replaces Oak on this floor') }).text).toBe(
			'Terrazzo replaces Oak on this floor'
		);
		expect(paintConsequence({ ...base, candidate: candidate('Lights have no Finish.', null) })).toEqual({
			tool: 'Paint',
			text: 'Lights have no Finish.',
			refused: true
		});
		expect(paintConsequence({ ...base, stroke: { kind: 'surface', count: 3 } as never }).text).toBe('3 surfaces · release to paint');
		expect(paintConsequence({ ...base, dropper: true })).toEqual({ tool: 'Sample', text: 'Click to sample a Finish', refused: false });
	});
});
