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
import { createViewportCameraState, evaluateViewport } from '@portfolio/camera-core';

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

/**
 * The Height Sheet is a control, not the Stage surface. Pointer travel on its
 * rail is mapped to a height against the rail's own rect; that rect is never
 * used as, or compared with, the evaluation rect, so it cannot put the drawn
 * image, the pointer ray and the overlays in different coordinate spaces. Its
 * two rail reads are sanitized below and nothing else in the file may measure:
 * another API or call site is a composition decision, not a test fix.
 */
const HEIGHT_SHEET = relativeToRepo(join(SHELL_DIR, 'StageHeightSheet.svelte'));
const HEIGHT_SHEET_RAIL_READ = 'track?.getBoundingClientRect()';

describe('Stage shell composition', () => {
	it('gives every dock key at least 44 × 44 px under a coarse pointer, icon-first (R217.S10)', () => {
		const dock = codeOf('apps/editor/src/lib/authoring/stage/shell/StageDock.svelte');
		expect(dock).toMatch(/@media \(pointer: coarse\)\s*\{\s*\.key\s*\{\s*width: 44px;\s*height: 44px;/);
		// Icon-first: every key is an inline 20 px SVG with its name as the label and
		// its name and key as the tooltip.
		expect(dock).toContain('width="20" height="20"');
		expect(dock).toContain('aria-label={key.label}');
		expect(dock).toContain('title={tooltip(key)}');
		// The armed key is ivory; tool colour is only a 2 px mark.
		expect(dock).toContain('background: #f3f0e4;');
		expect(dock).toContain('height: 2px;');
	});

	it('preserves Camera pose and vertical extent when the viewport height changes', () => {
		const camera = createViewportCameraState({
			outputId: 'output', sessionEpoch: 'session', sourceRevision: 'source',
			pose: { target: [0, 2, 0], azimuthRadians: 0, elevationRadians: 0.35, targetPlaneHeightMeters: 8 },
			sceneRadiusMeters: 6
		});
		const rect = { left: 0, top: 0, width: 1024, height: 768, devicePixelRatio: 1 };
		const before = evaluateViewport(camera, rect, 0, 1);
		const after = evaluateViewport(camera, { ...rect, height: 1024 }, 0, 2);
		expect(before.kind).toBe('evaluated');
		expect(after.kind).toBe('evaluated');
		if (before.kind !== 'evaluated' || after.kind !== 'evaluated') throw new Error('viewport unavailable');
		expect(after.evaluation.target).toEqual(before.evaluation.target);
		expect(after.evaluation.pose.azimuthRadians).toBe(before.evaluation.pose.azimuthRadians);
		expect(after.evaluation.pose.elevationRadians).toBe(before.evaluation.pose.elevationRadians);
		expect(after.evaluation.pose.targetPlaneHeightMeters).toBe(before.evaluation.pose.targetPlaneHeightMeters);
		expect(before.evaluation.targetPlaneMetersPerCssPixel).toBe(8 / 768);
		expect(after.evaluation.targetPlaneMetersPerCssPixel).toBe(8 / 1024);
	});
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
		// Entities keep the visitor's one grouping/material renderer; only the model
		// chunk is deferred, and only here.
		expect(canvas).toContain("from './StageEntities.svelte'");
		const stageEntities = codeOf('apps/editor/src/lib/authoring/stage/shell/StageEntities.svelte');
		expect(stageEntities).toContain("from '$lib/visitor/VisitorEntityGroups.svelte'");
		expect(stageEntities).toContain("import('$lib/museum/assets/AssetModel.svelte')");
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

		// The renderer boundary is explicit: the Canvas, the Camera that copies the
		// evaluated pose, Paper's drawing scene, its selection re-stroke/buffer batching, and the
		// selection-ink realizer that builds outlines and tint clones from the
		// already-rendered meshes. None of them owns a camera or a pick root; they
		// are listed here so another Three importer cannot appear unnoticed.
		const threeImporters = STAGE_FILES.filter((file) =>
			parseModuleSpecifiers(readSource(file)).some(
				(specifier) => specifier === 'three' || specifier.startsWith('three/')
			)
		);
		expect(threeImporters.sort()).toEqual([
			'apps/editor/src/lib/authoring/stage/shell/stage-grid-scene.ts',
			'apps/editor/src/lib/authoring/stage/shell/StageSelectionLayer.svelte',
			'apps/editor/src/lib/authoring/stage/shell/StagePrimitiveGhost.svelte',
			'apps/editor/src/lib/authoring/stage/shell/StageGrid.svelte',
			'apps/editor/src/lib/authoring/stage/shell/StageFormGhost.svelte',
			CANVAS_FILE,
			'apps/editor/src/lib/authoring/stage/shell/StageCamera.svelte',
			'apps/editor/src/lib/authoring/stage/paper-scene.ts',
			'apps/editor/src/lib/authoring/stage/paper-marks.ts',
			'apps/editor/src/lib/authoring/stage/paper-fill-geometry.ts'
		].sort());

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
		// T1.P02.S06 D.6 (H9) — the realizer must not ask for a frame just because
		// it ran: a task's default invalidates, which is what kept the Stage
		// rendering at rest (Bench 1: 120 of 120 idle frames). A new evaluation asks
		// for exactly one frame instead.
		expect(camera).toContain('autoInvalidate: false');
		expect(camera).toContain('invalidate();');
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
		// renderer components take that and nothing else. The retained Plan reaches it
		// as one typed value for the Paper layer; the Canvas itself never interprets a
		// fragment, groups streams or builds plan geometry.
		expect(canvas).toContain('geometry: CompiledLayoutGeometry');
		expect(route).toContain('<StageCanvas');
		expect(route).toContain('geometry={boot.snapshot.domain.geometry}');
		expect(canvas).toContain('plan?: PlanEvaluation | null');
		expect(canvas).toContain("from './StagePaper.svelte'");
		expect(canvas).not.toMatch(/PlanFragment|planParameters|buildPaperPlan/);
		// Paper is the one consumer of the Plan as a drawing, and it reads the same
		// evaluation the hit path uses.
		const paper = codeOf('apps/editor/src/lib/authoring/stage/shell/StagePaper.svelte');
		expect(paper).toContain("from '../paper-plan'");
		expect(paper).toContain('buildPaperPlan(plan, compiled, footprints');

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
		// Project actions have their own request cancellation and register it with
		// the session writer registry. The project read itself must continue to use
		// `runBoundLoad`, not a private controller the session cannot cancel.
		expect(route).toContain("session.writers().register('project-action', token, () => controller.abort())");
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
		// A reading change must end the route press after the lease policy runs.
		// The mounted spatial-route-gesture suite also proves the adapter receives
		// the interruption first and preserves its exact Resume/Discard proposal.
		const reading = route.slice(route.indexOf('function setReading('), route.indexOf('function fit('));
		expect(reading).toMatch(/if \(drag !== null && session\.gesture\(\) === null\) \{[\s\S]*interruptPress\('reading-change'\);/);
		// One ending, used by every path, so a policy- released lease is not released
		// twice and no ending is forgotten.
		expect((route.match(/function endGesture\(\)/g) ?? []).length).toBe(1);

		// The click that follows pointerup still has to know how far the pointer travelled,
		// so a normal ending **ends** the press decision while an interruption aborts it.
		// Collapsing the two is how every drag came to select what it was dropped on.
		const pointerUpBody = route.slice(route.indexOf('function onPointerUp('), route.indexOf('function interruptPress('));
		expect(pointerUpBody).toContain('press.end(event.pointerId)');
		expect(pointerUpBody).not.toContain('press.abort(');

		// Every environmental ending reaches the same interruption path, which
		// delivers cancel to the adapter before dropping the lease and capture.
		const interruption = route.slice(route.indexOf('function interruptPress('), route.indexOf('function onPointerCancel('));
		expect(interruption).toContain("phase: 'cancel'");
		expect(interruption).toContain('abortGesture()');
		const pointerCancel = route.slice(route.indexOf('function onPointerCancel('), route.indexOf('function onLostPointerCapture('));
		const lostCapture = route.slice(route.indexOf('function onLostPointerCapture('), route.indexOf('function pointerIdOf('));
		expect(pointerCancel).toContain("interruptPress('pointercancel')");
		expect(lostCapture).toContain("interruptPress('lostpointercapture')");
		expect(route).toContain('press.decide(');
		expect(route).toContain('createStagePressTracker()');

		// Pointer ownership: a refused second pointer cannot end the holder's press, and its
		// own click is marked so it cannot select either.
		expect(route).toContain('press.refuse(event.pointerId)');
		expect(route).toContain("interruptPress('second-pointer')");

		// …and its **movement** is refused too, before any sample is consumed. Movement is
		// the one event a refused pointer keeps producing, and the owner's drag origin is
		// not where that pointer is, so taking its coordinates pans by the distance between
		// two fingers.
		const pointerMove = route.slice(route.indexOf('function onPointerMove('));
		const pointerMoveBody = pointerMove.slice(0, pointerMove.indexOf('function onPointerUp('));
		expect(pointerMoveBody).toContain('if (!press.ownsPointer(event.pointerId)) return;');
		const singlePointerMove = pointerMoveBody.slice(pointerMoveBody.lastIndexOf('if (!press.ownsPointer(event.pointerId)) return;'));
		expect(singlePointerMove.indexOf('press.ownsPointer(event.pointerId)')).toBeLessThan(singlePointerMove.indexOf('pan('));
	});

	it('measures the viewport in one place and never scales the stage with CSS', () => {
		// The CSS rect a pointer is reported in and the rect the evaluation was
		// computed for must be the same rectangle. A second measurement (a
		// `getBoundingClientRect` at a call site, a `clientWidth` read somewhere else)
		// or a CSS `scale` on the surface would make the drawn image, the ray the
		// pointer casts and every overlay land in different coordinate spaces — and
		// none of the three would look wrong on its own.
		const route = stripComments(readFileSync(ROUTE, 'utf8'));
		const heightSheet = codeOf(HEIGHT_SHEET);
		// Blank only the two sanctioned rail reads, not the whole file: any other
		// measurement in the Sheet still has to fail the single-measurer rule.
		const sanctionedHeightSheet = heightSheet.replaceAll(HEIGHT_SHEET_RAIL_READ, '');
		const sources: readonly (readonly [string, string])[] = [
			[ROUTE, route],
			...STAGE_FILES.map(
				(file) =>
					[file, file === HEIGHT_SHEET ? sanctionedHeightSheet : codeOf(file)] as const
			)
		];
		const measurers = sources
			.filter(([, source]) =>
				/getBoundingClientRect|clientWidth|clientHeight|devicePixelRatio/.test(source)
			)
			.map(([file]) => file);
		expect(measurers).toEqual([ROUTE]);
		expect((heightSheet.match(/getBoundingClientRect/g) ?? []).length).toBe(2);
		expect(sanctionedHeightSheet).not.toMatch(
			/getBoundingClientRect|clientWidth|clientHeight|devicePixelRatio/
		);
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
