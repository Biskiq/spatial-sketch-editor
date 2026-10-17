/**
 * The Stage shell's **composition boundary** (T1.P01.S02).
 *
 * Three architecture invariants live here, and none of them is observable from a
 * lane report, a build or a type check:
 *
 * 1. **One Canvas and no second spatial authority.** The Stage renders canonical
 *    Layout and the existing Scene through the visitor's own renderers, so editor
 *    and visitor geometry cannot drift apart; a second renderer, a second compiler
 *    or a second scene graph would be a silent duplication of spatial truth.
 * 2. **The shadow-map type is explicit.** The landed r186 upgrade removed the
 *    PCFSoft filtering path, so a boolean `shadows` would resolve to the removed
 *    behaviour; the new Canvas must name `PCFShadowMap`.
 * 3. **No camera authority outside the realizer.** Every realized matrix comes from
 *    an evaluated `ViewportEvaluation`; an `OrbitControls` object, a shell tween or
 *    an `fov` authored at a call site would be a second controller writing pose,
 *    and overlays or rays drawn from a different camera would then disagree with
 *    the meshes.
 *
 * Source inspection is the right proof because these are composition facts: nothing
 * imports an `OrbitControls`, no test fails when a second renderer appears, and the
 * shell is mountable only in a browser. It belongs to the arch lane for the same
 * reason `wall-mesh-shell-boundary` does — it guards a boundary, not a behaviour.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
	EDITOR_SRC,
	REPO_ROOT,
	listSourceFiles,
	parseModuleSpecifiers,
	relativeToRepo,
	stripComments
} from '../../helpers/import-closure';

const STAGE_DIR = join(EDITOR_SRC, 'lib', 'authoring', 'stage');
const SHELL_DIR = join(STAGE_DIR, 'shell');
const ROUTE = join(EDITOR_SRC, 'routes', 'project', '[projectId]', 'spatial', '+page.svelte');

function readSource(relative: string): string {
	return readFileSync(join(REPO_ROOT, relative), 'utf8');
}

/**
 * The same source with comments blanked: the modules name the very things they
 * forbid in prose ("`tween`, OrbitControls and a second camera state do not exist
 * here"), and a comment is not a call, an import or an attribute.
 */
function codeOf(relative: string): string {
	return stripComments(readSource(relative));
}

/** Every module of the stage host: the shell components plus the host half beside them. */
const STAGE_FILES = listSourceFiles(STAGE_DIR)
	.filter((file) => file.endsWith('.svelte') || file.endsWith('.ts'))
	.map(relativeToRepo);

const CANVAS_FILE = 'apps/editor/src/lib/authoring/stage/shell/StageCanvas.svelte';

describe('Stage shell composition', () => {
	it('mounts exactly one Canvas, through the visitor’s own renderers', () => {
		// Positive control: the walk is real and non-trivial.
		expect(STAGE_FILES.length).toBeGreaterThan(4);
		expect(STAGE_FILES).toContain(CANVAS_FILE);

		const canvases = STAGE_FILES.filter((file) => /<Canvas[\s>]/.test(readSource(file)));
		expect(canvases).toEqual([CANVAS_FILE]);

		// That one Canvas renders the visitor's own wall and entity renderers — the
		// shared compile is what makes editor and visitor geometry agree, and a local
		// renderer beside them would be a second authority.
		const canvas = codeOf(CANVAS_FILE);
		expect(canvas).toContain("from '$lib/visitor/VisitorLayoutShell.svelte'");
		expect(canvas).toContain("from '$lib/visitor/VisitorEntities.svelte'");
		// Explicit shadow-map type; never the boolean that resolves to the removed
		// PCFSoft filtering path.
		expect(canvas).toContain('shadows={PCFShadowMap}');
		expect(canvas).not.toMatch(/shadows(\s*=\s*\{?\s*(true|false)|\s[^=])/);
		// Exactly one camera is mounted on it, and it is the realizer.
		expect((canvas.match(/<StageCamera/g) ?? []).length).toBe(1);
	});

	it('mounts no control object and no second camera outside the realizer', () => {
		const offenders = STAGE_FILES.filter((file) =>
			/OrbitControls|MapControls|TrackballControls|TransformControls/.test(codeOf(file))
		);
		expect(offenders).toEqual([]);

		// Only the two realizers touch Three at all, and only to copy evaluated output.
		const threeImporters = STAGE_FILES.filter((file) =>
			parseModuleSpecifiers(readSource(file)).some(
				(specifier) => specifier === 'three' || specifier.startsWith('three/')
			)
		);
		expect(threeImporters).toEqual([
			CANVAS_FILE,
			'apps/editor/src/lib/authoring/stage/shell/StageCamera.svelte'
		]);

		// The pose math lives in exactly one place: the realizer copies the
		// evaluation's own matrices instead of composing its own camera.
		const camera = codeOf('apps/editor/src/lib/authoring/stage/shell/StageCamera.svelte');
		expect(camera).toContain('camera.matrix.fromArray(evaluation.inverseViewMatrix');
		expect(camera).toContain('camera.projectionMatrix.fromArray(evaluation.projectionMatrix');
		// One `fov` literal, and it is the construction default Threlte needs before
		// the first evaluated frame; the realizer overwrites the projection from the
		// evaluation rather than letting that default shape what is drawn.
		expect((camera.match(/fov=\{/g) ?? []).length).toBe(1);
		expect(camera).toContain('camera.near = evaluation.near');
		expect(camera).toContain('camera.far = evaluation.far');
	});

	it('drives pose only through the host’s own inspection claim', () => {
		const route = stripComments(readFileSync(ROUTE, 'utf8'));
		expect(route).toContain('stage.requestViewingIntent(intent, stage.inspectionTicket()');
		expect(route).toContain('stage.acquireInspection(');
		// No direct pose write anywhere in the route host: every viewing intent is
		// owned by a claim, so a replaced output cannot keep being driven.
		expect(route).not.toMatch(/\.applyIntent\s*\(/);
	});

	it('measures the viewport in one place and never scales the stage with CSS', () => {
		// The CSS rect a pointer is reported in and the rect the evaluation was
		// computed for must be the same rectangle. A second measurement (a
		// `getBoundingClientRect` at a call site, a `clientWidth` read somewhere else)
		// or a CSS `scale` on the surface would make the drawn image, the ray the
		// pointer casts and every overlay land in different coordinate spaces — and
		// none of the three would look wrong on its own.
		const route = stripComments(readFileSync(ROUTE, 'utf8'));
		const sources: readonly (readonly [string, string])[] = [
			[ROUTE, route],
			...STAGE_FILES.map((file) => [file, codeOf(file)] as const)
		];
		const measurers = sources
			.filter(([, source]) =>
				/getBoundingClientRect|clientWidth|clientHeight|devicePixelRatio/.test(source)
			)
			.map(([file]) => file);
		expect(measurers).toEqual([ROUTE]);
		expect((route.match(/getBoundingClientRect\(\)/g) ?? []).length).toBe(2);
		// One function reads the element — one `clientWidth`/`clientHeight` pair and
		// one left/top pair — and both the mount and the per-frame refresh call it.
		expect((route.match(/clientWidth/g) ?? []).length).toBe(1);
		expect((route.match(/clientHeight/g) ?? []).length).toBe(1);
		expect((route.match(/measure\(\)/g) ?? []).length).toBeGreaterThanOrEqual(2);

		// Chrome may translate (that is layout of the chrome itself); nothing in the
		// Stage may scale or matrix-transform the surface. Comments are blanked
		// upstream, so this reads declarations only.
		const scaling = sources
			.filter(([, source]) => /(?:^|[\s;{])(?:scale|scale3d|matrix|matrix3d)\s*\(/m.test(source))
			.map(([file]) => file);
		expect(scaling).toEqual([]);
	});
});
