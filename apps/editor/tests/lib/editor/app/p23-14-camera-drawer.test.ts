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
