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

	it('renders one geometry set and takes Plan eligibility from the representation, not a second renderer', () => {
		// The Plan representation (`evaluateLayoutPlan`) is Layout-owned **data**: cut,
		// projected, hidden and symbol streams with membership and Reveal. The Stage's
		// Plan *reading* is the same canonical geometry under the exact orthographic
		// endpoint, so the representation must reach the host as eligibility and
		// membership, never as a second renderer, a clipped geometry copy or a 2D
		// transform of the same mesh. A defect here is invisible in a lane report: the
		// drawing would simply disagree with what the hit path calls selectable.
		const route = stripComments(readFileSync(ROUTE, 'utf8'));
		const canvas = codeOf(CANVAS_FILE);

		// One geometry set: the Canvas takes the compiled domain geometry and the
		// renderer components take that and nothing else.
		expect(canvas).toContain('geometry: CompiledLayoutGeometry');
		expect(route).toContain('<StageCanvas');
		expect(route).toContain('geometry={boot.snapshot.domain.geometry}');
		expect(canvas).not.toMatch(/planView|PlanFragment|PlanEvaluation|planParameters/);

		// The representation drives eligibility and the Index, through the facade's
		// own evaluation — the same call the hit path makes.
		expect(route).toContain('stage.setPlanParameters(parameters)');
		expect(route).toContain('stage.plan()');
		expect(route).toContain('planView.membership');
		expect(route).toContain('stage.resolveSourceHit(');
	});

	it('binds the project read to the session, so a stale load cannot install', () => {
		// The route used to hold a private `AbortController` nobody cancelled: an
		// older GET or admission completing after a replacement (or after teardown)
		// installed itself over the newer source and mounted a stage no one would
		// dispose. The mechanism is the session's own cancellation registry, so the
		// call site — not the helper's unit test — is what proves the host uses it.
		const route = stripComments(readFileSync(ROUTE, 'utf8'));
		expect(route).toContain('runBoundLoad(session,');
		expect(route).toContain('session.isCurrent(token)');
		expect(route).not.toMatch(/new AbortController\(/);
		expect(route).not.toMatch(/loadProject\([^)]*controller\.signal/);
	});

	it('holds the gesture contract at the route: refusals and every ending release once', () => {
		// `acquireGesture` and the transition policies were tested at the session while
		// the route ignored both: a refused acquisition still started the drag, a
		// browser-cancelled pointer left the lease held, and a reading flip left a
		// cancelled gesture's samples panning. The policy run itself is the facade's
		// (behavioural in `stage-facade`); what only the route can prove is that it
		// acts on the answer and ends the gesture at every ending.
		const route = stripComments(readFileSync(ROUTE, 'utf8'));
		expect(route).toContain("acquisition.kind !== 'granted'");
		expect(route).toContain('onpointercancel={onPointerCancel}');
		expect(route).toContain('onlostpointercapture={onLostPointerCapture}');
		// A reading change can end the lease before the flip is drawn; the samples the
		// gesture took belong to the reading that is ending.
		expect(route).toContain('session.gesture() === null) abortGesture()');
		// One ending, used by every path, so a policy- released lease is not released
		// twice and no ending is forgotten.
		expect((route.match(/function endGesture\(\)/g) ?? []).length).toBe(1);

		// The click that follows pointerup still has to know how far the pointer travelled,
		// so a normal ending **ends** the press decision while an interruption aborts it.
		// Collapsing the two is how every drag came to select what it was dropped on.
		const pointerUp = route.slice(route.indexOf('function onPointerUp('));
		const pointerUpBody = pointerUp.slice(0, pointerUp.indexOf('}'));
		expect(pointerUpBody).toContain('press.end(event.pointerId)');
		expect(pointerUpBody).not.toContain('press.abort(');
		expect(route).toContain('press.decide(');
		expect(route).toContain('createStagePressTracker()');

		// Pointer ownership: a refused second pointer cannot end the holder's press, and its
		// own click is marked so it cannot select either.
		expect(route).toContain('press.refuse(event.pointerId)');
		expect(route).toContain('press.abort(event.pointerId)');

		// …and its **movement** is refused too, before any sample is consumed. Movement is
		// the one event a refused pointer keeps producing, and the owner's drag origin is
		// not where that pointer is, so taking its coordinates pans by the distance between
		// two fingers.
		const pointerMove = route.slice(route.indexOf('function onPointerMove('));
		const pointerMoveBody = pointerMove.slice(0, pointerMove.indexOf('function onPointerUp('));
		expect(pointerMoveBody).toContain('if (!press.ownsPointer(event.pointerId)) return;');
		expect(pointerMoveBody.indexOf('press.ownsPointer(event.pointerId)')).toBeLessThan(
			pointerMoveBody.indexOf('pan(')
		);
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
