/**
 * T2.S8 E5 — the deterministic set grammar and the shared draft composer.
 *
 * The proposal never picks a winner by enumeration order, every guess it cannot
 * make stays blocking, and manual composition and a corrected proposal lower to
 * the same canonical recipe.
 */
import { describe, expect, it } from 'vitest';
import {
	composeDraft,
	draftFromCandidate,
	parseSetFileName,
	proposeMaterialSet,
	type DraftEdits,
	type SetFileFact
} from '@portfolio/project-model/material-authoring';
import { recipeHash } from '@portfolio/project-model/materials';

function fact(key: string, name: string, overrides: Partial<SetFileFact> = {}): SetFileFact {
	const hex = [...key].map((char) => char.charCodeAt(0).toString(16)).join('').padEnd(64, '0').slice(0, 64);
	return {
		key,
		name,
		hash: `sha256-${hex}`,
		mime: name.endsWith('.jpg') ? 'image/jpeg' : 'image/png',
		width: 1024,
		height: 1024,
		precision: 8,
		colour: { ok: true, lossy: name.endsWith('.jpg') },
		raw: { ok: true, lossy: name.endsWith('.jpg') },
		...overrides
	};
}

function shuffle<T>(items: readonly T[], seed: number): T[] {
	const out = [...items];
	let state = seed;
	for (let index = out.length - 1; index > 0; index -= 1) {
		state = (state * 1103515245 + 12345) % 2147483648;
		const swap = state % (index + 1);
		[out[index], out[swap]] = [out[swap]!, out[index]!];
	}
	return out;
}

const OAK = [
	fact('a', 'Oak_Floor_BaseColor_2k.png'),
	fact('b', 'oak-floor-roughness-2k.png'),
	fact('c', 'oak floor normal dx 2k.png'),
	fact('d', 'Oak.Floor.AO.2K.png'),
	fact('e', 'oak_floor_height_2k.png')
];

describe('T2.S8 E5 set grammar', () => {
	it('parses the plan grammar: NFC, ASCII fold, separators, resolution tokens and longest alias', () => {
		expect(parseSetFileName('Oak_Floor_BaseColor_2k.png')).toMatchObject({ stem: 'oak floor', family: 'color', resolution: '2k' });
		expect(parseSetFileName('oak floor base color.jpg')).toMatchObject({ stem: 'oak floor', family: 'color' });
		expect(parseSetFileName('oak_floor_4k_albedo.webp')).toMatchObject({ stem: 'oak floor', family: 'color', resolution: '4k' });
		expect(parseSetFileName('brick-NormalGL.png')).toMatchObject({ stem: 'brick', family: 'normal-gl' });
		expect(parseSetFileName('brick_normal_gl.png')).toMatchObject({ stem: 'brick', family: 'normal-gl' });
		expect(parseSetFileName('brick_Normal_DX.png')).toMatchObject({ stem: 'brick', family: 'normal-dx' });
		expect(parseSetFileName('brick_normal.png')).toMatchObject({ stem: 'brick', family: 'normal' });
		expect(parseSetFileName('brick_glossiness.png')).toMatchObject({ stem: 'brick', family: 'gloss' });
		expect(parseSetFileName('brick_ORM.png')).toMatchObject({ stem: 'brick', family: 'orm' });
		expect(parseSetFileName('brick_rma.png')).toMatchObject({ stem: 'brick', family: 'rma' });
		expect(parseSetFileName('brick_bump.png')).toMatchObject({ stem: 'brick', family: 'unsupported' });
		expect(parseSetFileName('brick_diffuse.png')).toMatchObject({ stem: 'brick', family: null, suffix: 'diffuse' });
		// Only ASCII case folds; a composed accent stays exactly as typed (NFC).
		expect(parseSetFileName('Café_Roughness.png').stem).toBe('café');
	});

	it('is order-independent: shuffled input produces a byte-identical proposal', () => {
		const reference = JSON.stringify(proposeMaterialSet(OAK, 'rev-1'));
		for (const seed of [1, 7, 42, 99, 1234]) {
			expect(JSON.stringify(proposeMaterialSet(shuffle(OAK, seed), 'rev-1'))).toBe(reference);
		}
	});

	it('proposes components, conventions and conversions, and leaves height unassigned with a reason', () => {
		const [candidate] = proposeMaterialSet(OAK, 'rev-1').candidates;
		expect(candidate!.stem).toBe('oak floor');
		expect(candidate!.roleChoices.map((choice) => [choice.role, choice.file, choice.component ?? choice.convention ?? null])).toEqual([
			['color', 'a', null],
			['normal', 'c', '-Y'],
			['occlusion', 'd', 'r'],
			['roughness', 'b', 'r']
		]);
		expect(candidate!.unassigned).toEqual([
			expect.objectContaining({ file: 'e', reason: 'unsupported-signal' })
		]);
		expect(candidate!.conflicts).toEqual([]);
	});

	it('maps ORM and RMA channels, gloss inversion and a generic normal needing acknowledgement', () => {
		const orm = proposeMaterialSet([fact('o', 'steel_orm.png')], 'r').candidates[0]!;
		expect(orm.roleChoices.map((choice) => [choice.role, choice.component])).toEqual(
			expect.arrayContaining([['occlusion', 'r'], ['roughness', 'g'], ['metalness', 'b']])
		);
		const rma = proposeMaterialSet([fact('m', 'steel_rma.png')], 'r').candidates[0]!;
		expect(rma.roleChoices.map((choice) => [choice.role, choice.component])).toEqual(
			expect.arrayContaining([['roughness', 'r'], ['metalness', 'g'], ['occlusion', 'b']])
		);
		const gloss = proposeMaterialSet([fact('g', 'steel_gloss.png')], 'r').candidates[0]!;
		expect(gloss.roleChoices).toEqual([expect.objectContaining({ role: 'roughness', invert: true, source: 'gloss' })]);
		const normal = proposeMaterialSet([fact('n', 'steel_normal.png')], 'r').candidates[0]!;
		expect(normal.roleChoices).toEqual([
			expect.objectContaining({ role: 'normal', convention: '+Y', acknowledge: 'normal-convention' })
		]);
	});

	it('reports packed/loose collisions and duplicate roles without picking a winner', () => {
		const files = [fact('p', 'steel_orm.png'), fact('l', 'steel_roughness.png'), fact('x', 'steel_normalgl.png'), fact('y', 'steel_normaldx.png')];
		const candidate = proposeMaterialSet(files, 'r').candidates[0]!;
		expect(candidate.conflicts).toEqual([
			expect.objectContaining({ code: 'duplicate-role', role: 'normal', files: ['x', 'y'] }),
			expect.objectContaining({ code: 'packed-loose-collision', role: 'roughness', files: ['l', 'p'] })
		]);
		expect(candidate.roleChoices.map((choice) => choice.role)).toEqual(['metalness', 'occlusion']);
		expect(draftFromCandidate(candidate)).toEqual({
			ok: false,
			issues: [
				expect.objectContaining({ code: 'unresolved-role', role: 'normal' }),
				expect.objectContaining({ code: 'unresolved-role', role: 'roughness' })
			]
		});
	});

	it('collapses identical digests for one role and warns on resolutions, dimensions, lossy data and empty stems', () => {
		const same = fact('s1', 'tile_roughness.png');
		const twin = { ...fact('s2', 'tile_rough.png'), hash: same.hash };
		expect(proposeMaterialSet([same, twin], 'r').candidates[0]!.conflicts).toEqual([]);
		const mixed = proposeMaterialSet([
			fact('c', 'tile_basecolor_2k.png'),
			fact('r', 'tile_roughness_4k.jpg', { width: 2048, height: 2048 })
		], 'r').candidates[0]!;
		expect(mixed.warnings.map((warning) => warning.code)).toEqual(['dimension-mismatch', 'lossy-data', 'multiple-resolutions']);
		expect(proposeMaterialSet([fact('z', 'roughness.png')], 'r').candidates[0]!.warnings.map((warning) => warning.code)).toEqual(['empty-stem']);
	});

	it('keeps an unsupported encoding unassigned for that role instead of guessing', () => {
		const deep = fact('d', 'tile_roughness.png', {
			raw: { ok: false, reason: '16-bit PNG', action: 'Export an 8-bit PNG.' }
		});
		const candidate = proposeMaterialSet([deep], 'r').candidates[0]!;
		expect(candidate.roleChoices).toEqual([]);
		expect(candidate.unassigned).toEqual([
			expect.objectContaining({ reason: 'unsupported-image-encoding', role: 'roughness', action: 'Export an 8-bit PNG.' })
		]);
	});
});

describe('T2.S8 E5 draft composition', () => {
	const files = [fact('c', 'steel_basecolor.png'), fact('o', 'steel_orm.png'), fact('n', 'steel_normal.png')];
	const facts = new Map(files.map((entry) => [entry.key, entry]));

	it('requires acknowledging a generic normal, then lowers to the same recipe as manual assembly', async () => {
		const candidate = proposeMaterialSet(files, 'r').candidates[0]!;
		expect(draftFromCandidate(candidate)).toMatchObject({ ok: false, issues: [{ code: 'unacknowledged-guess', role: 'normal' }] });
		const lowered = draftFromCandidate(candidate, { acknowledge: ['normal'] });
		if (!lowered.ok) throw new Error('acknowledged draft should lower');
		const manual: DraftEdits = {
			name: 'Steel',
			roles: {
				color: { role: 'color', file: 'c' },
				normal: { role: 'normal', file: 'n', convention: '+Y' },
				roughness: { role: 'roughness', file: 'o', component: 'g', invert: false },
				metalness: { role: 'metalness', file: 'o', component: 'b', invert: false },
				occlusion: { role: 'occlusion', file: 'o', component: 'r', invert: false }
			}
		};
		const automatic = composeDraft(lowered.edits, facts);
		const assembled = composeDraft(manual, facts);
		if (!automatic.ok || !assembled.ok) throw new Error('both drafts should compose');
		expect(automatic.draft.recipe).toEqual(assembled.draft.recipe);
		expect(await recipeHash(automatic.draft.recipe)).toBe(await recipeHash(assembled.draft.recipe));
		expect([...automatic.draft.files]).toEqual([...assembled.draft.files]);
		// A new composed recipe with roughness/metallic maps gets unit factors.
		expect(automatic.draft.recipe.roughness).toBe(1);
		expect(automatic.draft.recipe.metalness).toBe(1);
	});

	it('preserves an explicitly authored zero multiplier and never clamps', () => {
		const zero = composeDraft({
			name: '  Zero metal  ',
			factors: { metalness: 0, roughness: 0 },
			roles: { metalness: { role: 'metalness', file: 'o', component: 'b', invert: false } }
		}, facts);
		if (!zero.ok) throw new Error(JSON.stringify(zero.issues));
		expect(zero.draft.name).toBe('Zero metal');
		expect(zero.draft.recipe.metalness).toBe(0);
		expect(zero.draft.recipe.roughness).toBe(0);
		const over = composeDraft({ name: 'Over', factors: { roughness: 1.5 }, roles: {} }, facts);
		expect(over).toMatchObject({ ok: false, issues: [{ path: '$.roughness' }] });
	});

	it('refuses an empty or over-long name, an unknown file and a refused encoding', () => {
		expect(composeDraft({ name: '   ', roles: {} }, facts)).toMatchObject({ ok: false, issues: [{ code: 'invalid-name' }] });
		expect(composeDraft({ name: 'x'.repeat(121), roles: {} }, facts)).toMatchObject({ ok: false, issues: [{ code: 'invalid-name' }] });
		expect(composeDraft({ name: 'Ghost', roles: { color: { role: 'color', file: 'missing' } } }, facts)).toMatchObject({
			ok: false,
			issues: [{ code: 'unknown-file', role: 'color' }]
		});
		const refused = new Map([[
			'bad',
			fact('bad', 'bad.png', { colour: { ok: false, reason: 'CMYK JPEG', action: 'Export RGB.' } })
		]]);
		expect(composeDraft({ name: 'Bad', roles: { color: { role: 'color', file: 'bad' } } }, refused)).toMatchObject({
			ok: false,
			issues: [{ code: 'unsupported-image-encoding', role: 'color', action: 'Export RGB.' }]
		});
	});
});
