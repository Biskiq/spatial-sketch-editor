import { describe, expect, it } from 'vitest';
import {
	newRootSince,
	pickScopeOf,
	resolveStudioOpening,
	reviewReturnView,
	studioRoots,
	type StudioViewRecord
} from '../../../../src/lib/authoring/studio/studio-model';
import { studioEntryFromSearch, studioProjectUrl } from '../../../../src/lib/platform/studio-entry';

const form = (id: string) => ({ id, name: `Form ${id}`, kind: 'form' });
const model = (id: string) => ({ id, name: `Model ${id}`, kind: 'model' });

describe('studio roots', () => {
	it('admits native forms only, in source order', () => {
		expect(studioRoots([model('m'), form('b'), form('a')]).map((root) => root.id)).toEqual(['b', 'a']);
	});
});

describe('studio opening', () => {
	it('honors an explicit valid root and never falls back by name or order', () => {
		const entities = [form('a'), form('b')];
		expect(resolveStudioOpening({ entities, requestedId: 'b', minted: false })).toEqual({ kind: 'enter', rootId: 'b' });
		expect(resolveStudioOpening({ entities, requestedId: 'zz', minted: false })).toEqual({
			kind: 'unavailable', requestedId: 'zz', reason: 'missing'
		});
	});
	it('names an unsupported target (a model) instead of editing it', () => {
		expect(resolveStudioOpening({ entities: [model('m'), form('a')], requestedId: 'm', minted: false })).toEqual({
			kind: 'unavailable', requestedId: 'm', reason: 'unsupported'
		});
	});
	it('enters a single root, asks for several, and distinguishes new from saved-empty', () => {
		expect(resolveStudioOpening({ entities: [form('a')], requestedId: null, minted: false })).toEqual({ kind: 'enter', rootId: 'a' });
		expect(resolveStudioOpening({ entities: [form('a'), form('b')], requestedId: null, minted: false }).kind).toBe('choose');
		expect(resolveStudioOpening({ entities: [], requestedId: null, minted: true })).toEqual({ kind: 'empty' });
		expect(resolveStudioOpening({ entities: [model('m')], requestedId: null, minted: false })).toEqual({ kind: 'no-objects' });
	});
});

describe('studio pick scope', () => {
	it('scopes the root when active and reaches nothing otherwise, except inactive', () => {
		expect(pickScopeOf({ kind: 'inactive' })).toBeNull();
		expect(pickScopeOf({ kind: 'active', rootId: 'a' })).toEqual({ entityId: 'a' });
		expect(pickScopeOf({ kind: 'empty' })).toEqual({ entityId: null });
		expect(pickScopeOf({ kind: 'no-objects' })).toEqual({ entityId: null });
		expect(pickScopeOf({ kind: 'unavailable', requestedId: 'x', reason: 'missing', lost: false })).toEqual({ entityId: null });
	});
});

describe('creation recovery', () => {
	it('finds the newest form that was not in the baseline', () => {
		expect(newRootSince([form('a'), form('b')], new Set(['a']))?.id).toBe('b');
		expect(newRootSince([form('a')], new Set(['a']))).toBeNull();
	});
});

describe('return view revalidation', () => {
	const record: StudioViewRecord = {
		reading: '3d', eye: [5, 4, 5], target: [0, 1, 0], fovYDegrees: 45, targetPlaneHeightMeters: 0
	};
	const bounds = { min: [-2, 0, -2] as const, max: [2, 2, 2] as const };
	it('accepts a view that still looks at the work', () => {
		expect(reviewReturnView(record, bounds)).toEqual({ valid: true });
	});
	it('refuses a missing, non-finite or stranded view', () => {
		expect(reviewReturnView(null, bounds).valid).toBe(false);
		expect(reviewReturnView({ ...record, eye: [Number.NaN, 0, 0] }, bounds).valid).toBe(false);
		expect(reviewReturnView({ ...record, target: [500, 0, 0] }, bounds).valid).toBe(false);
	});
});

describe('studio entry addresses', () => {
	it('builds the existing project route with the posture flag', () => {
		expect(studioProjectUrl('p1', { create: true })).toBe('/project/p1/spatial?create=1&entry=studio');
		expect(studioProjectUrl('p1', { load: true, object: 'a b' })).toBe('/project/p1/spatial?load=1&entry=studio&object=a%20b');
	});
	it('reads the posture only when entry=studio, and the object only with it', () => {
		expect(studioEntryFromSearch(new URLSearchParams('entry=studio&object=x'))).toEqual({ studio: true, objectId: 'x', copyId: null });
		expect(studioEntryFromSearch(new URLSearchParams('object=x'))).toEqual({ studio: false, objectId: null, copyId: null });
		expect(studioEntryFromSearch(new URLSearchParams('entry=other'))).toEqual({ studio: false, objectId: null, copyId: null });
	});
});

describe('studioAdmitsCardAction', () => {
	it('keeps the protected root and every non-Scene owner out, and admits nothing without a root', async () => {
		const { studioAdmitsCardAction } = await import('../../../../src/lib/authoring/studio/studio-model');
		expect(studioAdmitsCardAction('root', 'scene', 'root')).toBe(false);
		expect(studioAdmitsCardAction('root', 'light', 'other')).toBe(false);
		expect(studioAdmitsCardAction('root', 'scene', 'other')).toBe(true);
		expect(studioAdmitsCardAction(null, 'scene', 'other')).toBe(false);
	});
});
