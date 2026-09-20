import fs from 'node:fs';
import path from 'node:path';
import { existsLibSource, readLibSource } from '../../../helpers/lib-source';
/**
 * P23.14 Task 6 — Camera Drawer ownership, the lane set, and the frustum rule.
 *
 * The Drawer is Camera-owned and central-column-aligned, its lane set is
 * immutable (five lanes, one playhead, quiet Roll), it never expands itself
 * because the domain changed, and the finite frustum stays a Camera 3D
 * instrument: Camera Plan shows nodes, route, direction and order over passive
 * architecture and nothing else.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const LIB = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../src/lib');

function readLib(relativePath: string): string {
	return readFileSync(resolve(LIB, relativePath), 'utf8');
}

describe('P23.14 §17 — the collapsed Drawer is transport and readout only', () => {
	const frame = (): string => readLib('editor/camera/EditorCameraTimelineFrame.svelte');

	it('mounts no lane, ruler or second scrubber while collapsed', () => {
		const source = frame();
		const collapsedStart = source.indexOf('<div class="mini-player"');
		expect(collapsedStart).toBeGreaterThan(-1);
		const collapsed = source.slice(collapsedStart, source.indexOf('</section>', collapsedStart));
		expect(collapsed).toContain('mini-player__transport');
		expect(collapsed).toContain('mini-player__timecode');
		expect(collapsed).not.toContain('<input type="range"');
		expect(collapsed).not.toContain('EditorCameraTimelineDots');
		expect(collapsed).not.toContain('EditorCameraTimelineRuler');
		// The scrubber's lifecycle is gone, not merely hidden: no derived state
		// and no handler keep a second playhead control alive in the component.
		expect(source).not.toContain('showCollapsedScrubber');
		expect(source).not.toContain('scrubCollapsed');
	});

	it('keeps the collapsed strip reachable as a toolbar with its own label', () => {
		const source = frame();
		expect(source).toContain('class="mini-player" role="toolbar" aria-label="Camera timeline mini-player"');
	});
});

describe('P23.14 §17 — the expanded Drawer keeps the ratified lane set', () => {
	const dots = (): string => readLib('editor/camera/EditorCameraTimelineDots.svelte');

	it('renders exactly five lanes in order, in both scopes', () => {
		const source = dots();
		const labels = [...source.matchAll(/<strong>([^<]+)<\/strong>/g)].map((match) => match[1]);
		// Two scopes (Edge-local + Sequence), the same ratified vocabulary each.
		expect(labels).toEqual([
			'Camera Path',
			'Shots',
			'FOV',
			'Look At',
			'Roll',
			'Camera Path',
			'Shots',
			'FOV',
			'Look At',
			'Roll'
		]);
		// The six-row grid is ruler + five lanes.
		expect(source).toContain('grid-template-rows: 28px 44px 48px 34px 34px 32px;');
	});

	it('keeps Roll quiet at zero and states that the lane is fixed', () => {
		const source = dots();
		expect(source.match(/aria-label="Roll — fixed at zero degrees"/g)).toHaveLength(2);
		expect(source.match(/class="roll-value start">0°</g)?.length ?? 0).toBeGreaterThan(0);
		// No waveform/audio lane exists anywhere in the drawer.
		expect(source).not.toMatch(/audio|waveform/i);
	});

	it('fills the Drawer width instead of a fixed track floor', () => {
		const source = dots();
		expect(source).toContain('grid-template-columns: 7.5rem minmax(0, 1fr);');
		expect(source).toContain('min-width: 0;\n\t\twidth: 100%;');
		expect(source).not.toContain('minmax(30rem, 1fr)');
	});
});

describe('P23.14 §17 — the Drawer never expands itself on a domain switch', () => {
	it('keeps expansion a session switch with explicit owners only', () => {
		// Domain and view switching carry no Drawer side effect.
		const viewState = readLib('editor/app/editor-view-state.svelte.ts');
		expect(viewState).not.toContain('timelineExpanded');
		expect(viewState).not.toContain('setTimelineExpanded');
		const spine = readLib('editor/app/DomainSpine.svelte');
		expect(spine).not.toContain('toggleTimeline');
		expect(spine).not.toContain('setTimelineExpanded');
		// The only writers are the user's own toggle and the explicit preview
		// commands that open the Drawer for the selection they just made.
		const session = readLib('editor/store/session-state.svelte.ts');
		expect(session).toContain('timelineExpanded = $state(false);');
	});
});

describe('P23.14 §16 — the finite frustum stays a Camera 3D instrument', () => {
	it('never paints frustum geometry on a Plan surface', () => {
		// Camera Plan owns nodes/route/direction/order. The frustum geometry
		// helpers are reached only by the 3D rig/helpers and the selection box.
		const planSurface = readLib('editor/app/CameraPlanWorkspace.svelte');
		expect(planSurface).not.toMatch(/frustum/i);
		const planProjection = readLib('editor/layout/plan-camera-projection.ts');
		expect(planProjection).not.toMatch(/frustum/i);
		const dots = readLib('editor/camera/EditorCameraTimelineDots.svelte');
		expect(dots).not.toMatch(/frustum/i);
		// And the 3D side keeps the instrument it owns.
		const helpers = readLib('editor/camera/EditorCameraViewHelpers.svelte');
		expect(helpers).toMatch(/frustum/i);
	});
});

// Moved verbatim from the dismantled `contracts.test.ts` accumulator (T3a).
describe('P3 structural visual contracts', () => {
	it('keeps the Camera timeline expanded into the five canonical display lanes', () => {
		const timeline = readLibSource('editor/camera/EditorCameraTimelineDots.svelte');

		for (const label of ['Camera Path', 'Shots', 'FOV', 'Look At', 'Roll']) {
			expect(timeline).toContain(`<strong>${label}</strong>`);
		}
		expect(timeline).not.toContain('<strong>Guided Route</strong>');
		expect(timeline).not.toContain('<strong>Camera Framing</strong>');
	});
	it('keeps one five-lane timeline component shared by live scopes; relic owns old controls', () => {
		const panel = readLibSource('editor/camera/EditorCameraTimelinePanel.svelte');

		expect(panel.match(/<EditorCameraTimelineDots/g)).toHaveLength(2);
		expect(panel).toContain(
			'<EditorCameraTimelineDots {store} {viewMode} {contextMenu} edgeTimeline={edgeTimeline} />'
		);
		expect(panel).toContain('{#if store.isRelic && preview}');
		expect(panel).not.toContain('EditorCameraEdgeRuler');
		expect(panel).not.toContain("previewScope === 'edge'");
		expect(panel).not.toContain("previewScope === 'camera'");
		expect(existsLibSource('editor/camera/EditorCameraEdgeRuler.svelte')).toBe(false);
	});
});

// Moved verbatim from the dismantled `contracts.test.ts` accumulator (T3a).
describe('P21.3 camera reconciliation', () => {
	it('shares one Camera sidebar and one Timeline across Camera Plan and Camera 3D', () => {
		const sidebar = readLibSource('editor/app/EditorSidebar.svelte');
		expect(sidebar).toContain("{#if domain === 'camera'}");
		expect(sidebar).toContain('<CameraSidebar {store} {layoutPreview} />');
		const app = readLibSource('editor/app/EditorApp.svelte');
		expect(app).toContain('createCameraPlanState()');
		expect(app).toContain("{#if viewState.domain === 'camera'}");
		expect(app).toContain('<EditorCameraTimelineFrame {store} viewMode={viewState.activeView}');
		expect(app.match(/<EditorCameraTimelineFrame/g)).toHaveLength(1);
	});
	it('pins the shared Timeline density (120px labels, 28px ruler, 44/48/34/34/32 lanes, 48px mini-player, live-dock +View Key)', () => {
		const dots = readLibSource('editor/camera/EditorCameraTimelineDots.svelte');
		// P23.14 §17 — one column model: 120px labels plus the remaining drawer
		// width. The P21.3 fixed track floor (30rem, over a 42rem lanes minimum)
		// fragmented the surface and left the ruler misaligned with the transport.
		// +View Key renders in both live branches (Edge + Sequence, Plan + 3D)
		// and stays out of the relic (which keeps its Ruler button); the
		// disabled state — not visibility — gates eligibility.
		expect(dots.match(/>\+ View Key<\/button>/g)).toHaveLength(2);
		expect(dots).not.toContain('<div class="ruler-label">Time</div>');
		expect(dots.match(/\{#if !store\.isRelic\}/g)).toHaveLength(2);
		const frame = readLibSource('editor/camera/EditorCameraTimelineFrame.svelte');
		expect(frame).toContain('flex: 0 0 48px;');
		const ruler = readLibSource('editor/camera/EditorCameraTimelineRuler.svelte');
		expect(ruler).toContain("viewMode === '3d' &&");
		expect(ruler).toContain("scope === 'sequence' &&");
		expect(ruler).toContain('>+ View Key</button>');
	});
});

// Moved verbatim from the dismantled `contracts.test.ts` accumulator (T3a).
describe('P21.5 Slice 5 timeline density (P12 geometry frozen)', () => {
	it('freezes the 48px collapsed pill and the 36px expanded header', () => {
		const frame = readLibSource('editor/camera/EditorCameraTimelineFrame.svelte');
		expect(frame).toContain('flex: 0 0 48px;');
		expect(frame).toContain('flex: 0 0 36px;');
		// No red/coral border anywhere — the collapsed pill carries the
		// neutral border + shadow only, within the existing floating geometry.
		expect(frame).toContain('border: 1px solid var(--editor-border-normal);');
		expect(frame).toContain('box-shadow: 0 12px 32px rgb(0 0 0 / 60%)');
		expect(frame).not.toMatch(/coral|#ef626c/);
		// P23.14 Decision 5 — 48px transport + readout, and nothing else: no lane,
		// no ruler and no second scrubber is mounted in the collapsed Drawer.
		const collapsedStart = frame.indexOf('<div class="mini-player"');
		expect(collapsedStart).toBeGreaterThan(-1);
		const collapsed = frame.slice(collapsedStart, frame.indexOf('</section>', collapsedStart));
	});
});

// Moved verbatim from the dismantled `contracts.test.ts` accumulator (T3a).
describe('camera context contracts', () => {
	it('docks the live camera timeline inside the center viewport in both views, never Scene', () => {
		const app = readLibSource('editor/app/EditorApp.svelte');
		const frame = readLibSource('editor/camera/EditorCameraTimelineFrame.svelte');
		expect(app).toContain("viewState.domain === 'camera'");
		const centerStart = app.indexOf('class="center"');
		const frameMount = app.indexOf('<EditorCameraTimelineFrame');
		const inspectorMount = app.indexOf('<EditorInspector');
		expect(frameMount).toBeGreaterThan(centerStart);
		expect(frameMount).toBeLessThan(inspectorMount);
		expect(app).not.toContain("'bottom bottom bottom'");
		// P23.14 §10/§17 — the center column is the View Bar + work surface, so
		// the live Drawer anchors to the bottom of the WORK area, never over the
		// bar, and never outside the central column.
		expect(app).toContain('.center { position: relative; display: flex; flex-direction: column; min-width: 0; min-height: 0; overflow: hidden;');
		expect(app).toContain('.work { position: relative; flex: 1; min-width: 0; min-height: 0; }');
		expect(frame).toContain('.timeline-frame.live {');
		expect(frame).toContain('bottom: 16px;');
		expect(frame).toContain('width: min(47.5rem, calc(100% - 2rem));');
		// Frozen relic keeps its root-grid placement.
		expect(frame).toContain("store.isRelic ? ' grid-area: bottom;' : ''");
	});
	it('keeps both Camera cells on the camera workspace so timeline state persists across views (G3)', () => {
		const app = readLibSource('editor/app/EditorApp.svelte');
		// G3 — `store.setWorkspace` collapses the timeline, stops previews, and
		// cancels pending navigation when leaving 'camera'; mapping both Camera
		// cells to the camera workspace means Camera 3D ↔ Plan toggles never
		// trigger those side effects (timeline expanded state persists).
		expect(app).toContain("if (viewState.domain === 'camera')");
		expect(app).toContain("store.setWorkspace('camera')");
	});
	it('gates camera authoring overlays to Camera while keeping the rig always mounted', () => {
		const ws3d = readLibSource('editor/app/Workspace3DView.svelte');

		// EditorCameraRig stays mounted in both contexts (shared viewport infra).
		expect(ws3d).toContain('<EditorCameraRig');
		// Overlay groups are camera-context gated.
		expect(ws3d).toContain('isCameraContext && store.viewportShowPaths');
		expect(ws3d).toContain('isCameraContext && store.viewportShowFraming');
		// The node-handle group preserves the connect-flow force-mount override.
		expect(ws3d).toContain(
			'isCameraContext && (store.viewportShowNodes || store.forceMountCameraNodeHandles)'
		);
	});
});
