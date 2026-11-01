/**
 * R217.S21 — the Index's display labels.
 *
 * A label is the subject's authored name, else a session-stable `Kind n` numbered by
 * canonical identity. These are presentation facts only: the tests pin what the creator
 * reads, and that a generated number never depends on insertion order or on a search.
 */
import { describe, expect, it } from 'vitest';
import {
	indexLabels,
	layoutKindWord,
	membershipLabel,
	sceneKindWord,
	type IndexLabelInput
} from '$lib/authoring/stage/shell/index-labels';

const wall = (identity: string, name: string | null = null): IndexLabelInput => ({
	identity,
	kind: 'Wall',
	name
});

describe('Index labels: authored name first', () => {
	it('shows an authored name verbatim and marks it authored', () => {
		const labels = indexLabels([wall('layout:wall:a', 'Kitchen north')]);
		expect(labels.get('layout:wall:a')).toEqual({ label: 'Kitchen north', authored: true });
	});

	it('trims an authored name and treats a blank one as no name', () => {
		const labels = indexLabels([
			wall('layout:wall:a', '  Hall  '),
			wall('layout:wall:b', '   '),
			wall('layout:wall:c', '')
		]);
		expect(labels.get('layout:wall:a')?.label).toBe('Hall');
		expect(labels.get('layout:wall:b')).toEqual({ label: 'Wall 2', authored: false });
		expect(labels.get('layout:wall:c')).toEqual({ label: 'Wall 3', authored: false });
	});

	it('keeps a long authored name whole; the Index clips it and titles it, the label does not', () => {
		const long = 'The long exterior wall of the east range, with its later-added return to the courtyard';
		const labels = indexLabels([wall('layout:wall:a', long)]);
		expect(labels.get('layout:wall:a')?.label).toBe(long);
	});
});

describe('Index labels: a generated Kind n', () => {
	it('numbers unnamed subjects of one kind by sorted canonical identity, not insertion order', () => {
		const forward = indexLabels([wall('layout:wall:b'), wall('layout:wall:a'), wall('layout:wall:c')]);
		const reversed = indexLabels([wall('layout:wall:c'), wall('layout:wall:b'), wall('layout:wall:a')]);
		for (const labels of [forward, reversed]) {
			expect(labels.get('layout:wall:a')?.label).toBe('Wall 1');
			expect(labels.get('layout:wall:b')?.label).toBe('Wall 2');
			expect(labels.get('layout:wall:c')?.label).toBe('Wall 3');
		}
		expect(forward.get('layout:wall:a')?.authored).toBe(false);
	});

	it('does not renumber the other subjects when one is named', () => {
		const before = indexLabels([wall('layout:wall:a'), wall('layout:wall:b'), wall('layout:wall:c')]);
		const after = indexLabels([wall('layout:wall:a'), wall('layout:wall:b', 'Party wall'), wall('layout:wall:c')]);
		expect(after.get('layout:wall:a')?.label).toBe(before.get('layout:wall:a')?.label);
		expect(after.get('layout:wall:c')?.label).toBe(before.get('layout:wall:c')?.label);
		expect(after.get('layout:wall:b')?.label).toBe('Party wall');
	});

	it('numbers each kind on its own', () => {
		const labels = indexLabels([
			wall('layout:wall:a'),
			{ identity: 'layout:opening:a', kind: 'Door', name: null },
			{ identity: 'layout:opening:b', kind: 'Window', name: null },
			{ identity: 'layout:opening:c', kind: 'Door', name: null }
		]);
		expect(labels.get('layout:wall:a')?.label).toBe('Wall 1');
		expect(labels.get('layout:opening:a')?.label).toBe('Door 1');
		expect(labels.get('layout:opening:b')?.label).toBe('Window 1');
		expect(labels.get('layout:opening:c')?.label).toBe('Door 2');
	});
});

describe('Index labels: repeated names', () => {
	it('keeps a repeated authored name and adds its Kind n, so both rows stay distinguishable', () => {
		const labels = indexLabels([
			wall('layout:wall:a', 'Party wall'),
			wall('layout:wall:b', 'Party wall'),
			wall('layout:wall:c', 'Gable')
		]);
		expect(labels.get('layout:wall:a')).toEqual({ label: 'Party wall (Wall 1)', authored: true });
		expect(labels.get('layout:wall:b')).toEqual({ label: 'Party wall (Wall 2)', authored: true });
		expect(labels.get('layout:wall:c')).toEqual({ label: 'Gable', authored: true });
	});

	it('does not disambiguate a name shared across different kinds, which the kind word already separates', () => {
		const labels = indexLabels([
			wall('layout:wall:a', 'Hall'),
			{ identity: 'layout:opening:a', kind: 'Door', name: 'Hall' }
		]);
		expect(labels.get('layout:wall:a')?.label).toBe('Hall');
		expect(labels.get('layout:opening:a')?.label).toBe('Hall');
	});
});

describe('Index labels: totality and purity', () => {
	it('labels every input and returns nothing for an empty list', () => {
		expect(indexLabels([]).size).toBe(0);
		const labels = indexLabels([wall('layout:wall:a'), wall('scene:entity:x', 'Plinth')]);
		expect(labels.size).toBe(2);
	});

	it('is a function of the list it is given, so a caller that filters first changes nothing it names', () => {
		const all = [wall('layout:wall:a'), wall('layout:wall:b'), wall('layout:wall:c')];
		const whole = indexLabels(all);
		// Labels come from the whole located list. A caller searches over these labels
		// and never re-numbers, so the subject that was "Wall 2" stays "Wall 2".
		expect(whole.get('layout:wall:b')?.label).toBe('Wall 2');
		expect(indexLabels(all).get('layout:wall:b')?.label).toBe('Wall 2');
	});
});

describe('Index labels: kind words and membership', () => {
	it('names a Layout kind, reading an Opening\'s own door or window', () => {
		expect(layoutKindWord('wall')).toBe('Wall');
		expect(layoutKindWord('opening', 'door')).toBe('Door');
		expect(layoutKindWord('opening', 'window')).toBe('Window');
		expect(layoutKindWord('room-floor')).toBe('Floor');
		expect(layoutKindWord('object')).toBe('Object');
	});

	it('names a Scene entity by its kind', () => {
		expect(sceneKindWord('model')).toBe('Model');
		expect(sceneKindWord('primitive')).toBe('Primitive');
		expect(sceneKindWord('form')).toBe('Form');
		expect(sceneKindWord('light')).toBe('Light');
	});

	it('states a Plan membership in words, and falls back to the raw reason only for an unknown one', () => {
		expect(membershipLabel('included')).toBe('In the current Plan');
		expect(membershipLabel('outside-depth')).toBe('Below the Plan depth');
		expect(membershipLabel('some-future-reason')).toBe('some-future-reason');
	});
});
