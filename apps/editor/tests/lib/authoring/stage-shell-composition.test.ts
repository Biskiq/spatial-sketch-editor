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
	composedSpatialHost,
	constructsImportedOwner,
	importClosure,
	listSourceFiles,
	parseModuleSpecifiers,
	resolveSpecifier,
	relativeToRepo,
	stripComments
} from '../../helpers/import-closure';

const STAGE_DIR = join(EDITOR_SRC, 'lib', 'authoring', 'stage');
const SHELL_DIR = join(STAGE_DIR, 'shell');
const ROUTE = join(EDITOR_SRC, 'routes', 'project', '[projectId]', 'spatial', '+page.svelte');
const PROJECT_SESSION_DIR = join(EDITOR_SRC, 'lib', 'authoring', 'project-session');
const EXPERIENCE_LENS = join(EDITOR_SRC, 'lib', 'authoring', 'experience', 'experience-lens.svelte.ts');
// R217.S28's offscreen snapshot host (fixed capture rect, not a viewport measurement).
const SNAPSHOT_HOST = 'apps/editor/src/lib/authoring/stage/shell/StageSnapshotRenderer.svelte';

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

/** The route and its one constructed posture controller, never all dependencies. */
function postureSources(): { file: string; code: string }[] {
	const route = readFileSync(ROUTE, 'utf8');
	const files = [ROUTE];
	if (importClosure([ROUTE]).has(EXPERIENCE_LENS)) {
		expect(constructsImportedOwner(ROUTE, route, EXPERIENCE_LENS, 'createExperienceLens')).toBe(true);
		files.push(EXPERIENCE_LENS);
	}
	return files.map((file) => ({ file, code: stripComments(readFileSync(file, 'utf8')) }));
}

describe('Stage shell composition', () => {

	it('lets adapters reach Stage modules only through the adapter host', () => {
		const adapters = join(EDITOR_SRC, 'lib', 'authoring', 'adapters');
		const host = join(STAGE_DIR, 'stage-adapter-host.ts');
		const imports = (file: string, source: string) => parseModuleSpecifiers(source)
			.map((specifier) => ({ specifier, target: resolveSpecifier(file, specifier) }))
			.filter(({ target }) => target !== null && target.startsWith(`${STAGE_DIR}/`) && target !== host)
			.map(({ specifier }) => specifier);
		const probe = join(adapters, 'scene.adapter.ts');
		expect(imports(probe, "import { createStageFacade } from '$lib/authoring/stage/stage-facade';")).toEqual(['$lib/authoring/stage/stage-facade']);
		expect(imports(probe, "export { evaluationIdOf } from '../stage/camera-session';")).toEqual(['../stage/camera-session']);
		expect(imports(probe, "import('../stage/stage-session');")).toEqual(['../stage/stage-session']);
		expect(imports(probe, "import type { StageAdapterServices } from '../stage/stage-adapter-host';")).toEqual([]);
		const files = listSourceFiles(adapters).filter((file) => /\.(ts|svelte)$/.test(file));
		for (const name of ['layout.adapter.ts', 'scene.adapter.ts', 'experience.adapter.ts']) {
			expect(files).toContain(join(adapters, name));
		}
		// Studio and extension modules will be held to the same boundary when added.
		const futureConsumers = ['studio', 'extensions'].flatMap((name) =>
			listSourceFiles(join(EDITOR_SRC, 'lib', 'authoring', name)).filter((file) => /\.(ts|svelte)$/.test(file))
		);
		const offenders = [...files, ...futureConsumers].flatMap((file) => imports(file, readFileSync(file, 'utf8'))
			.map((specifier) => `${relativeToRepo(file)}: ${specifier}`));
		expect(offenders).toEqual([]);
	});

	it('requires an actual call to the specifically imported controller', () => {
		const owner = join(EDITOR_SRC, 'lib', 'authoring', 'experience', 'playback.svelte.ts');
		const source = (script: string) => `<script lang="ts">${script}</script>`;
		const specifier = '$lib/authoring/experience/playback.svelte';
		const check = (script: string) => constructsImportedOwner(ROUTE, source(script), owner, 'createExperiencePlayback');
		expect(check(`import { createExperiencePlayback } from '${specifier}'; const playback = createExperiencePlayback(); playback.play();`)).toBe(true);
		expect(check(`import { createExperiencePlayback as make } from '${specifier}'; const playback = make(); playback.play();`)).toBe(true);
		expect(check(`import { createExperiencePlayback } from '${specifier}';`)).toBe(false);
		expect(check(`import { createExperiencePlayback } from '${specifier}'; createExperiencePlayback();`)).toBe(false);
		expect(check(`import { createExperiencePlayback } from '${specifier}'; const playback = createExperiencePlayback();`)).toBe(false);
		expect(check(`import { createExperiencePlayback } from '${specifier}'; const playback = createExperiencePlayback(); other.playback;`)).toBe(false);
		expect(check(`import { createExperiencePlayback } from '${specifier}'; const playback = createExperiencePlayback(); function unused() { playback.play(); }`)).toBe(false);
		expect(check(`import { createExperiencePlayback } from '${specifier}'; const playback = createExperiencePlayback(); function unused(playback: any) { playback.play(); }`)).toBe(false);
		expect(check(`import { createExperiencePlayback } from '${specifier}'; const playback = createExperiencePlayback(); if (false) playback.play();`)).toBe(false);
		expect(check(`import { createExperiencePlayback } from '${specifier}'; const playback = createExperiencePlayback(); false && playback.play();`)).toBe(false);
		expect(check(`import { createExperiencePlayback } from '${specifier}'; const playback = createExperiencePlayback(); playback.play;`)).toBe(false);
		expect(check(`import { createExperiencePlayback } from '${specifier}'; const playback = createExperiencePlayback(); playback.play?.();`)).toBe(false);
		expect(check(`import { createExperiencePlayback } from '${specifier}'; playback.play(); const playback = createExperiencePlayback();`)).toBe(false);
		expect(constructsImportedOwner(ROUTE, `<script module lang="ts">import { createExperiencePlayback } from '${specifier}'; const playback = createExperiencePlayback(); playback.play();</script>`, owner, 'createExperiencePlayback')).toBe(false);
		expect(constructsImportedOwner(ROUTE, `<script context="module" lang="ts">import { createExperiencePlayback } from '${specifier}'; const playback = createExperiencePlayback(); playback.play();</script>`, owner, 'createExperiencePlayback')).toBe(false);
		expect(check(`import { createExperiencePlayback } from '${specifier}'; // createExperiencePlayback();`)).toBe(false);
		expect(check(`import { createExperiencePlayback } from '${specifier}'; function unused() { createExperiencePlayback(); }`)).toBe(false);
		expect(check(`import { createExperiencePlayback } from '${specifier}'; if (false) createExperiencePlayback();`)).toBe(false);
		expect(check(`import { createExperiencePlayback } from '${specifier}'; const value = false && createExperiencePlayback();`)).toBe(false);
		expect(check(`import type { createExperiencePlayback } from '${specifier}'; createExperiencePlayback();`)).toBe(false);
		expect(check(`import { createExperiencePlayback } from '$lib/authoring/experience/experience-homes'; createExperiencePlayback();`)).toBe(false);
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
		// already-rendered meshes, and R217.S19's mat ground with its per-pixel grid
		// material. None of them owns a camera or a pick root; they
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
			'apps/editor/src/lib/authoring/stage/shell/StageMatGround.svelte',
			'apps/editor/src/lib/authoring/stage/shell/stage-mat-grid.ts',
			'apps/editor/src/lib/authoring/stage/shell/StageFormGhost.svelte',
			// C3 checkpoint 5 — the unfolded Wall sheet. It draws the checkpoint-4
			// developed mesh on the existing Canvas and owns no camera or pick root.
			'apps/editor/src/lib/authoring/stage/shell/StageWallDevelopment.svelte',
			CANVAS_FILE,
			'apps/editor/src/lib/authoring/stage/shell/StageCamera.svelte',
			// R217.S28's snapshot host: an offscreen render target on the existing
			// renderer. It owns no camera authority and opens no second context.
			'apps/editor/src/lib/authoring/stage/shell/StageSnapshotRenderer.svelte',
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
		expect(camera).toContain('stage: renderStage');
		expect(camera).toContain('before: autoRenderTask');
		expect(camera).toContain('if (!shouldRender()) return;');
		expect(camera).toContain('invalidate();');

		// The snapshot target owns its viewport in target pixels; the renderer's
		// setViewport would apply the screen DPR even with a target bound.
		const snapshot = codeOf(SNAPSHOT_HOST);
		expect(snapshot).toContain('target.viewport.set(0, 0, WIDTH, height)');
		expect(snapshot).toContain('target.scissor.set(0, 0, WIDTH, height)');
		expect(snapshot).toContain('target.scissorTest = false');
		expect(snapshot).not.toContain('renderer.setViewport(0, 0, WIDTH, height)');
	});

	it('drives pose only through the host’s own inspection claim', () => {
		const sources = postureSources();
		const owners = sources.filter(({ code }) => code.includes('stage.requestViewingIntent(intent, stage.inspectionTicket()'));
		expect(owners).toHaveLength(1);
		expect(owners[0]!.code).toContain('stage.requestViewingIntent(intent, stage.inspectionTicket()');
		expect(owners[0]!.code).toContain('stage.acquireInspection(');
		// No direct pose write in the route or its posture layer: every viewing
		// intent stays owned by a claim after the layer is extracted.
		for (const { file, code } of composedSpatialHost()) expect(stripComments(code), file).not.toMatch(/\.applyIntent\s*\(/);
	});

	it('captures every pointer through a guarded helper, so a failed capture cannot strand a claim', () => {
		// `setPointerCapture` throws for a pointer that has already ended. Each press
		// claims a lease, a press or a session first; a throwing capture then left that
		// claim held and every later gesture refused. Only the helper and the pinch's
		// own try may call it.
		const sources = postureSources();
		const matches = (pattern: RegExp) => sources.filter(({ code }) => pattern.test(code));
		// ExperiencePaths already owns its own guarded path-point capture; include
		// every other composed component so extracting route markup cannot hide a
		// new, unguarded Stage capture in the lens layer.
		const pathsFile = join(EDITOR_SRC, 'lib', 'authoring', 'experience', 'ExperiencePaths.svelte');
		const guideFile = join(EDITOR_SRC, 'lib', 'authoring', 'experience', 'ExperienceGuide.svelte');
		const host = composedSpatialHost().map(({ file, code }) => ({ file, code: stripComments(code) }));
		const paths = host.filter(({ file }) => file === pathsFile);
		expect(paths).toHaveLength(1);
		expect(paths[0]!.code.match(/\.setPointerCapture(?:\?\.)?\(/g) ?? []).toHaveLength(1);
		// The Guide timeline already uses an optional capture of its own; it is
		// not a Stage gesture capture. Count it separately, without overlooking
		// additional optional captures in extracted host code.
		const guide = host.filter(({ file }) => file === guideFile);
		expect(guide).toHaveLength(1);
		expect(guide[0]!.code.match(/\.setPointerCapture(?:\?\.)?\(/g) ?? []).toHaveLength(1);
		expect(guide[0]!.code).toContain('(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)');
		const raw = host.filter(({ file }) => file !== pathsFile && file !== guideFile)
			.flatMap(({ code }) => code.match(/\.setPointerCapture(?:\?\.)?\(/g) ?? []);
		expect(raw).toHaveLength(2);
		expect(matches(/function capturePointer\([^)]*\): boolean \{\s*try \{\s*target\.setPointerCapture\(pointerId\);/)).toHaveLength(1);
		expect(matches(/try \{ surface\.setPointerCapture\(event\.pointerId\); \} catch/)).toHaveLength(1);
		const lens = stripComments(readFileSync(EXPERIENCE_LENS, 'utf8'));
		expect(lens).toMatch(/capture === null \|\| !host\.capturePointer\(capture, event\.pointerId\)/);
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
		const composed = [...importClosure([ROUTE])]
			.filter((file) => file === ROUTE || file.startsWith(`${PROJECT_SESSION_DIR}/`))
			.filter((file) => /\.(svelte|ts)$/.test(file))
			.map((file) => ({ file, code: stripComments(readFileSync(file, 'utf8')) }));
		// Model resolution has its own bound load; identify the project read rather
		// than confusing it with that independent, route-owned operation.
		const owners = composed.filter(({ code }) => code.includes('runBoundLoad(session, (signal) => fetchOutcome('));
		expect(owners).toHaveLength(1);
		const owner = owners[0]!.code;
		if (owners[0]!.file !== ROUTE) {
			expect(constructsImportedOwner(ROUTE, readFileSync(ROUTE, 'utf8'), owners[0]!.file, 'createProjectSession')).toBe(true);
		}
		expect(owner).toContain('runBoundLoad(session,');
		expect(owner).toContain('session.isCurrent(token)');
		// Project actions have their own request cancellation and register it with
		// the session writer registry. The project read itself must continue to use
		// `runBoundLoad`, not a private controller the session cannot cancel.
		expect(owner).toContain("session.writers().register('project-action', token, () => controller.abort())");
		for (const { file, code } of composed) expect(code, file).not.toMatch(/loadProject\([^)]*controller\.signal/);
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
		// R217.S28's snapshot host composes a fixed offscreen capture rect; its
		// `devicePixelRatio: 1` is a target definition, not a viewport measurement.
		// Blank exactly that one literal and prove it remains the only occurrence.
		const snapshotHost = codeOf(SNAPSHOT_HOST);
		const sanctionedSnapshotHost = snapshotHost.replace('devicePixelRatio: 1', '');
		// Existing Experience homes measure their own Guide/View rails and scale
		// their glyph artwork, not the Stage. Blank only those exact known reads and
		// transforms, and verify their counts; scan every reachable Experience
		// component so moving the lens markup cannot hide a new Stage measurement.
		const experienceDir = join(EDITOR_SRC, 'lib', 'authoring', 'experience');
		const allowed: Record<string, readonly (readonly [string, number])[]> = {
			'ExperienceGuide.svelte': [
				['element.getBoundingClientRect()', 1],
				['(rowEl ?? barEl).getBoundingClientRect()', 1],
				['barEl.getBoundingClientRect()', 2],
				['els[index]!.getBoundingClientRect()', 1],
				['scroller.getBoundingClientRect()', 1],
				['scroller.clientWidth', 6],
				[' scale(.9)', 1]
			],
			'ExperienceViewRail.svelte': [['(event.currentTarget as HTMLElement).getBoundingClientRect()', 1]],
			'ExperienceMarks.svelte': [[' scale(${scale})', 1]]
		};
		const hostLayers = composedSpatialHost()
			.filter(({ file }) => file.startsWith(`${experienceDir}/`) || file.startsWith(`${PROJECT_SESSION_DIR}/`))
			.map(({ file, code }) => {
				let checked = stripComments(code);
				for (const [literal, count] of allowed[file.slice(experienceDir.length + 1)] ?? []) {
					expect(checked.split(literal).length - 1, `${file}: ${literal}`).toBe(count);
					checked = checked.replaceAll(literal, '');
				}
				return { file, code: checked };
			});
		const sources: readonly (readonly [string, string])[] = [
			[ROUTE, route],
			...hostLayers.map(({ file, code }) => [file, stripComments(code)] as const),
			...STAGE_FILES.map(
				(file) =>
					[
						file,
						file === HEIGHT_SHEET
							? sanctionedHeightSheet
							: file === SNAPSHOT_HOST
								? sanctionedSnapshotHost
								: codeOf(file)
					] as const
			)
		];
		const measurers = sources
			.filter(([, source]) =>
				/getBoundingClientRect|clientWidth|clientHeight|devicePixelRatio/.test(source)
			)
			.map(([file]) => file);
		expect(measurers).toEqual([ROUTE]);
		expect((snapshotHost.match(/devicePixelRatio/g) ?? []).length).toBe(1);
		expect(snapshotHost).not.toMatch(/getBoundingClientRect|clientWidth|clientHeight/);
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
		// The cursor glyph source transforms only its embedded SVG artwork to orient
		// the pointer preview; it does not transform the Stage surface.
		const surfaceSources = sources.filter(([file]) =>
			file !== 'apps/editor/src/lib/authoring/stage/stage-glyphs.ts'
		);
		const scaling = surfaceSources
			.filter(([, source]) => /(?:^|[\s;{])(?:scale|scale3d|matrix|matrix3d)\s*\(/m.test(source))
			.map(([file]) => file);
		expect(scaling).toEqual([]);
	});
});

/**
 * R217.S22 — the lanes beside the Stage, the Card during a gesture and the Card's fold.
 * Source inspection is the proof here: the route is mounted only in a browser for the
 * Camera and layout facts, and the rules below are composition decisions, not behaviour a
 * jsdom layout could observe. The mounted route suite proves the behaviour they enable.
 */
describe('Stage shell lanes and the Card (R217.S22)', () => {
	it('never submits a Camera intent, fit or Plan change from a lane measurement', () => {
		// A lane observer changes placement only. Its effect bodies name no intent, no
		// framing, no Plan parameter and no Camera: layout never moves the Camera.
		const route = stripComments(readFileSync(ROUTE, 'utf8'));
		const start = route.indexOf('const element = sheetLaneEl;');
		const end = route.indexOf('const sheetLaneRight = $derived');
		expect(start).toBeGreaterThan(0);
		expect(end).toBeGreaterThan(start);
		const lanes = route.slice(start, end);
		expect(lanes.match(/new ResizeObserver/g) ?? []).toHaveLength(1);
		expect(lanes).not.toMatch(/submit\(|requestViewingIntent|acquireInspection|\bfit\(|bringIntoView|setPlanParameters|camera\./);
	});

	it('fades the Card and takes no pointer events while an authored gesture is live, never for navigation or a camera edit', () => {
		const card = codeOf('apps/editor/src/lib/authoring/stage/shell/EditorCard.svelte');
		expect(card).toMatch(/\.card\.gesturing \{[^}]*pointer-events: none;/);
		expect(card).toMatch(/\.card\.gesturing \{[^}]*opacity: 0\.2;/);
		const route = stripComments(readFileSync(ROUTE, 'utf8'));
		// The flag is the live lease the session holds; a navigation press is excluded, and
		// review round 3 (sheet §24, Card only) keeps the Card clear while a camera is edited.
		const owners = postureSources().filter(({ code }) => code.includes("const cameraEdit = lease !== null && (lease.owner === 'experience-view-edit' || lease.owner === 'experience-path-point');"));
		expect(owners).toHaveLength(1);
		expect(owners[0]!.code).toContain("const cameraEdit = lease !== null && (lease.owner === 'experience-view-edit' || lease.owner === 'experience-path-point');");
		expect(owners[0]!.code).toContain('const gesturing = lease !== null && lease.navigation !== true && !cameraEdit;');
		expect(route).toContain('gesturing={cardGesturing}');
	});

	it('states no plain "Nothing selectable there." for an ordinary empty click, but keeps the excluded-subjects reason', () => {
		const sources = postureSources();
		for (const { file, code } of composedSpatialHost()) expect(stripComments(code), file).not.toContain("'Nothing selectable there.'");
		expect(sources.filter(({ code }) => code.includes('Nothing selectable there — some subjects are excluded from this Plan; Reveal one from the Index.'))).toHaveLength(1);
	});

	it('keeps pin creation and jumps while leaving pin removal unexposed', () => {
		const route = stripComments(readFileSync(ROUTE, 'utf8'));
		expect(route).not.toContain('pinHintSeen');
		expect(route).toContain('addHeightPin');
		expect(route).toContain('onAddPin={addHeightPin}');
		expect(route).not.toContain('removeHeightPin');
		expect(route).not.toContain('onRemovePin');
		const sheet = codeOf(HEIGHT_SHEET);
		expect(sheet).not.toContain('PIN_HINT_MS');
		expect(sheet).not.toContain('pin-context');
		expect(sheet).not.toContain('numeric');
		expect(sheet).not.toContain('Remove pin');
		expect(sheet).toContain('onAddPin');
		expect(sheet).toContain("onSetHeight(pin, 'tick')");
	});
});

/**
 * R217.S23 — the Ink row, the constrained-width Index and its scrim. The row and the scrim
 * are composition decisions (a z-order, a bounded span, a material), so source inspection
 * is the proof. The mounted route suite proves the behaviour they enable, and the browser
 * record measures the rectangles and the ground.
 */
const SHELL_ROLES = readSource('apps/editor/src/lib/design/presentation-tokens.css');
const INSTRUMENT_HOST = 'apps/editor/src/lib/authoring/stage/shell/StageInstrumentHost.svelte';
const INK_PALETTE = 'apps/editor/src/lib/authoring/adapters/layout/LayoutInkPalette.svelte';
const OPENING_PALETTE = 'apps/editor/src/lib/authoring/adapters/layout/LayoutOpeningPalette.svelte';
const SCENE_INSTRUMENT = 'apps/editor/src/lib/authoring/adapters/scene/SceneTransformInstrument.svelte';
const CARD = 'apps/editor/src/lib/authoring/stage/shell/EditorCard.svelte';

/** One shell role's colour, read from the shipped map so the test cannot drift from it. */
function shellToken(name: string): string {
	const match = SHELL_ROLES.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6});`));
	if (match === null) throw new Error(`the shell roles define no --${name}`);
	return match[1]!;
}

/** WCAG 2.x relative luminance of an sRGB hex colour. */
function relativeLuminance(hex: string): number {
	const value = parseInt(hex.slice(1), 16);
	const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((channel) => {
		const srgb = channel / 255;
		return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

/** The WCAG contrast ratio between two hex colours. */
function contrastRatio(first: string, second: string): number {
	const [light, dark] = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a);
	return (light! + 0.05) / (dark! + 0.05);
}

/** `top` at `alpha` composited over `bottom`, as the hex the eye sees. */
function compositeOver(top: string, alpha: number, bottom: string): string {
	const mix = (index: number): string => {
		const a = parseInt(top.slice(1 + index * 2, 3 + index * 2), 16);
		const b = parseInt(bottom.slice(1 + index * 2, 3 + index * 2), 16);
		return Math.round(a * alpha + b * (1 - alpha)).toString(16).padStart(2, '0');
	};
	return `#${mix(0)}${mix(1)}${mix(2)}`;
}

describe('Ink row, constrained Index and scrim (R217.S23)', () => {
	it('draws the instrument as one dock-material row, with no caption or titled panel', () => {
		const host = codeOf(INSTRUMENT_HOST);
		expect(host).not.toContain('World Instrument');
		expect(host).not.toContain('eyebrow');
		expect(host).toContain('background: var(--shell-forest);');
		// The adapter's content is the body; its facts stay on the head's tooltip, not in a block.
		expect(host).not.toContain('contributed-facts');
		expect(host).not.toContain('contributed-summary');
		// A tall instrument scrolls inside its own body rather than growing over the Stage.
		expect(host).toMatch(/max-height: min\(24rem, 60vh\);/);
		expect(host).toMatch(/\.instrument-body \{[^}]*overflow: auto;/);
	});

	it('describes the instrument by its facts and offers an info control, not a hover title', () => {
		const host = codeOf(INSTRUMENT_HOST);
		expect(host).toContain('aria-describedby={facts.length > 0 ? descriptionId : undefined}');
		expect(host).toContain('aria-controls={aboutId}');
		expect(host).toContain('aria-expanded={aboutOpen}');
		expect(host).not.toMatch(/title=\{factsText/);
		// The header's own comment states the facts' reachable routes, as the code does.
		expect(host).toContain('aria-describedby={descriptionId}');
	});

	it('draws the palette, Opening and Objects instruments only from shell roles, with no retired literal', () => {
		for (const file of [INSTRUMENT_HOST, INK_PALETTE, OPENING_PALETTE, SCENE_INSTRUMENT]) {
			expect(codeOf(file), file).not.toMatch(/#8f8a99|#635a6f|#292632|#241f2b/);
		}
	});

	it('keeps the Stage rectangle fixed behind the Index at every width', () => {
		const route = stripComments(readFileSync(ROUTE, 'utf8'));
		expect(route).toMatch(/\.stage-frame \{[^}]*position: absolute;[^}]*inset: 0;/);
		expect(route).toMatch(/:global\(\.plate-index\) \{[^}]*position: absolute;[^}]*inset: 0 auto 0 0;/);
	});

	it('ends the constrained Index above the lower column and drops the viewport-sized shadow', () => {
		const route = stripComments(readFileSync(ROUTE, 'utf8'));
		// Extracted Experience markup cannot reintroduce the viewport-sized shadow.
		for (const { file, code } of composedSpatialHost()) expect(stripComments(code), file).not.toContain('100vmax');
		expect(route).toContain('bottom: calc(0.75rem + var(--lower-column-height, 0px) + 0.5rem);');
		expect(route).toMatch(/\.index-scrim \{[^}]*bottom: calc\(0\.75rem \+ var\(--lower-column-height, 0px\)\);/);
		// The lane variables are published on the body that holds the Index and the scrim.
		expect(route).toMatch(/class="editor-body"\s*\n\s*style=\{`--lower-column-height/);
	});

	it('stacks the scrim beneath the dock, the drafting controls and the Card, with the Index above all', () => {
		const route = stripComments(readFileSync(ROUTE, 'utf8'));
		const card = codeOf(CARD);
		const z = (source: string, selector: string): number => {
			const match = source.match(new RegExp(`${selector} \\{[^}]*z-index: (\\d+);`));
			if (match === null) throw new Error(`no z-index on ${selector}`);
			return Number(match[1]);
		};
		const scrim = z(route, '\\.index-scrim');
		const lower = z(route, '\\.lower-column');
		const cardLayer = z(card, '\\.card');
		const index = z(route, ':global\\(\\.plate-index\\)');
		expect(scrim).toBeLessThan(lower);
		expect(lower).toBeLessThan(cardLayer);
		expect(cardLayer).toBeLessThan(index);
	});

	it('renders the scrim only for an open constrained Index, as a pointer-only close target', () => {
		const route = stripComments(readFileSync(ROUTE, 'utf8'));
		expect(route).toContain('{#if preview === null && narrowShell && indexOpen}');
		expect(route).toContain('onclick={() => (indexOpen = false)}');
		expect(route).toContain('tabindex="-1"');
	});
});
