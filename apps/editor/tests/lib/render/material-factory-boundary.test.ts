/**
 * E6/R2a — `material-factory-boundary`: one place constructs a world material.
 *
 * `renderer-refactor.md` §2.4 makes `MaterialStore.acquire(descriptor)` the only
 * construction site for a world surface, and the T2 direction forbids any slice
 * from building one outside the shared factory. No build, type check or lane
 * report can see a second `new MeshStandardMaterial(...)` — the renderer draws it
 * happily — so the guarantee lives here.
 *
 * Two rules, both exact:
 *
 * 1. **The store constructs; nobody else does.** A `Mesh*Material`,
 *    `ShadowMaterial` or `T.Mesh*Material` constructor outside the store must
 *    appear in the allowlist below.
 * 2. **The allowlist is exact and shrink-only.** It fails when a new site
 *    appears *and* when a listed site disappears without its entry being removed,
 *    so moving a surface into the store always deletes its allowance. The two
 *    groups are the remaining RR-7 sites (each with the E packet that retires it)
 *    and editor ink, which is not a world surface and stays outside the store by
 *    design (§2.4).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { EDITOR_SRC, listSourceFiles } from '../../helpers/import-closure';
import { withoutComments } from '../../helpers/render-boundary-scan';

/**
 * The exact remaining construction sites, by `apps/editor/src`-relative path.
 * Returns the count per file, so adding a second constructor to an allowlisted
 * file is a failure rather than a silent pass.
 */
const RR7_REMAINDER: Record<string, { count: number; owner: string }> = {
	// R2c models — shared model remaps (E8).
	'lib/museum/assets/AssetModel.svelte': { count: 1, owner: 'E8/R2c models' },
	'lib/museum/assets/instance-material-remap.ts': { count: 1, owner: 'E8/R2c models' },
	// R2b — the Scene look and its material components (E7).
	'lib/museum/assets/FallbackMaterial.svelte': { count: 1, owner: 'E7/R2b' },
	'lib/museum/materials/MuseumMaterial.svelte': { count: 1, owner: 'E7/R2b' },
	'lib/museum/materials/SceneInstanceMaterial.svelte': { count: 1, owner: 'E7/R2b' },
	// R5 artwork, environment ground and plinth (E9).
	'lib/museum/entities/EntityArtwork.svelte': { count: 6, owner: 'E9/R5 artwork' },
	'lib/museum/layout/GroundPlinth.svelte': { count: 1, owner: 'E9/R2c plinth' },
	'lib/render/WorldEnvironment.svelte': { count: 2, owner: 'E9/R2c environment, E10/R6 lights' },
	'lib/visitor/VisitorPreviewSurface.svelte': { count: 1, owner: 'E9/R2c environment' },
	// R6 — the light entity's invisible hit proxy (E10).
	'lib/museum/entities/EntityLight.svelte': { count: 1, owner: 'E10/R6' }
};

/** Editor ink: Paper, the mat grid, selection and gizmos. Not a world surface (§2.4). */
const EDITOR_INK: Record<string, { count: number; owner: string }> = {
	'lib/authoring/stage/paper-marks.ts': { count: 3, owner: 'Paper ink' },
	'lib/authoring/stage/paper-scene.ts': { count: 3, owner: 'Paper scene' },
	'lib/authoring/stage/shell/StageCanvas.svelte': { count: 1, owner: 'mat ground overlay' },
	'lib/authoring/stage/shell/StageMatGround.svelte': { count: 2, owner: 'mat ground' },
	'lib/authoring/stage/shell/StageSelectionLayer.svelte': { count: 2, owner: 'selection ink' },
	'lib/authoring/stage/shell/StageWallDevelopment.svelte': { count: 1, owner: 'development overlay' },
	'lib/authoring/stage/shell/StageWallPin.svelte': { count: 1, owner: 'pin gizmo' },
	'routes/dev/assets/+page.svelte': { count: 1, owner: 'dev bench' },
	'routes/dev/materials/+page.svelte': { count: 1, owner: 'dev bench' }
};

const STORE = 'lib/render/resources/material-store.ts';

const RULES = [
	/\bnew\s+(?:Mesh|Shadow)\w*Material\s*\(/g,
	/<T\.(?:Mesh|Shadow)\w*Material\b/g
];

function sourceFiles(): { file: string; code: string }[] {
	return listSourceFiles(EDITOR_SRC)
		.filter((file) => /\.(ts|svelte)$/.test(file) && !/\.test\./.test(path.basename(file)))
		.map((file) => ({
			file: path.relative(EDITOR_SRC, file).split(path.sep).join('/'),
			code: withoutComments(readFileSync(file, 'utf8'))
		}));
}

function constructionSites(): Record<string, number> {
	const found: Record<string, number> = {};
	for (const { file, code } of sourceFiles()) {
		let count = 0;
		for (const rule of RULES) count += [...code.matchAll(rule)].length;
		if (count > 0) found[file] = count;
	}
	return found;
}

describe('material-factory-boundary: one factory for world materials', () => {
	it('constructs a world material only in the store', () => {
		const allowlist = new Set([STORE, ...Object.keys(RR7_REMAINDER), ...Object.keys(EDITOR_INK)]);
		const offenders = Object.keys(constructionSites()).filter((file) => !allowlist.has(file)).sort();
		expect(offenders).toEqual([]);
	});

	it('keeps the allowlist exact: a new site fails, and so does a stale entry', () => {
		const actual = constructionSites();
		const expected: Record<string, number> = { [STORE]: 3 };
		for (const [file, entry] of Object.entries({ ...RR7_REMAINDER, ...EDITOR_INK })) expected[file] = entry.count;
		expect(actual).toEqual(expected);
	});

	it('names an owning packet for every remaining world-material site', () => {
		for (const [file, entry] of Object.entries(RR7_REMAINDER)) {
			expect(entry.owner, file).toMatch(/^E(7|8|9|10)\//);
		}
		// The three Layout surfaces R2a moved are gone from the list entirely.
		expect(RR7_REMAINDER).not.toHaveProperty('lib/museum/layout/wall-material-factory.ts');
		expect(RR7_REMAINDER).not.toHaveProperty('lib/render/layout-wall-representation.ts');
		expect(RR7_REMAINDER).not.toHaveProperty('lib/render/layout-object-representation.ts');
		expect(RR7_REMAINDER).not.toHaveProperty('lib/render/layout-room-representation.ts');
		expect(RR7_REMAINDER).not.toHaveProperty('lib/visitor/VisitorLayoutShell.svelte');
	});

	it('the Layout representations acquire instead of constructing', () => {
		for (const file of [
			'lib/render/layout-wall-representation.ts',
			'lib/render/layout-object-representation.ts',
			'lib/render/layout-room-representation.ts'
		]) {
			const code = withoutComments(readFileSync(path.join(EDITOR_SRC, file), 'utf8'));
			expect(code, file).toContain('store.acquire(');
			expect(code, file).not.toMatch(/\bnew\s+(?:Mesh|Shadow)\w*Material\s*\(/);
			expect(code, file).not.toMatch(/<T\.(?:Mesh|Shadow)\w*Material\b/);
		}
	});

	it('the shell hands every representation the one Canvas store', () => {
		const shell = readFileSync(path.join(EDITOR_SRC, 'lib/visitor/VisitorLayoutShell.svelte'), 'utf8');
		expect(shell).toContain('createMaterialStore()');
		expect(shell).toContain('createWallRepresentation(materials)');
		expect(shell).toContain('createObjectRepresentation(materials)');
		expect(shell).toContain('createRoomRepresentation(materials)');
		expect(shell).toMatch(/materials\.dispose\(\)/);
	});
});
