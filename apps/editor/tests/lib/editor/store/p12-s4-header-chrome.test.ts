import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createFixtureEditorStore, createRelicFixtureEditorStore } from '../editor-test-utils';
import fs from 'node:fs';
import path from 'node:path';

const LIB_DIR = fileURLToPath(new URL('../../../../src/lib', import.meta.url));

function readLibSource(relativePath: string): string {
	return readFileSync(LIB_DIR + '/' + relativePath, 'utf8');
}

describe('P12.4 S4 — live header chrome', () => {
	it('moves live transport into the fixed header and keeps the relic header frozen', () => {
		const frame = readLibSource('editor/camera/EditorCameraTimelineFrame.svelte');
		const liveStart = frame.indexOf('<header class="s4-header"');
		const live = frame.slice(liveStart, frame.indexOf('</section>', liveStart));

		// The frozen relic header (relic-header + tour-selector, and the relic
		// branch's own ruler + PreviewControls below) is asserted behaviourally by
		// `relic-smoke.test.ts` claim 4, which server-renders this frame with a
		// relic store and fails when the branch stops emitting (T3c).
		expect(live).toContain('<header class="s4-header">');
		expect(live).toContain('Previous camera node');
		expect(live).toContain('Next camera node');
		expect(live).toContain('Play camera flow');
		expect(live).toContain('timelineApi.playLabel');
		expect(live).toContain('aria-label="POV"');
		expect(live).toContain('aria-label="Observer"');
		expect(live).toContain('aria-label="Recenter camera"');
		expect(live).toContain('aria-label="Follow camera"');
		expect(live).toContain('class="timecode"');
		expect(live).toContain('class="more-tools"');
		expect(live).toContain('class="toggle s4-toggle"');
		expect(frame).toContain("return 'Sequence (Full Tour)'");
		expect(frame).toContain('`${endpoints.fromLabel} → ${endpoints.toLabel}`');
		expect(live).not.toContain('tour-selector');
		expect(live).not.toContain('EditorCameraPreviewControls');

		expect(frame).toContain('height: 36px;');
		expect(frame).toContain('height: 48px;');
		expect(frame).toContain('height: 1.8rem;');
		expect(frame).toContain('class="mini-player"');
		expect(frame).toContain('class="mini-player__timecode"');
		expect(frame).toContain('.mini-player .scope-switcher { width: 10rem; flex: 0 1 10rem;');
		expect(frame).toContain('.mini-player .mode-control { order: initial; flex: 0 0 auto; }');
		expect(frame).toContain('.mini-player__timecode { min-width: 6rem;');
		expect(live).toMatch(/\{#if scope !== 'camera'\}[\s\S]*class="header-icon edge-flip"/);
		expect(live).toMatch(/\{#if scope !== 'camera'\}[\s\S]*class="header-transport"/);
		expect(live).not.toContain('Repeat edge');
		expect(live).not.toContain('Replay');
		expect(frame).toContain('@media (max-width: 44rem)');
	});

	it('keeps the old ruler relic-only and moves live scrubbing plus View Key into Dots', () => {
		const frame = readLibSource('editor/camera/EditorCameraTimelineFrame.svelte');
		const panel = readLibSource('editor/camera/EditorCameraTimelinePanel.svelte');
		const ruler = readLibSource('editor/camera/EditorCameraTimelineRuler.svelte');
		const dots = readLibSource('editor/camera/EditorCameraTimelineDots.svelte');

		expect(panel).toContain('<EditorCameraTimelineRuler {store} {viewMode} />');
		// The relic branch's PreviewControls mounting is the smoke's claim 4
		// (rendered, relic store) — see the note in the header test above (T3c).
		expect(dots).toContain('+ View Key');
		// Owner 2026-09-07: +View Key renders live-dock-wide (Edge + Sequence,
		// Plan + 3D) — eligibility gates on disabled, not visibility — so the
		// old 3D-only gate is gone while the relic keeps its Ruler button.
		expect(dots).not.toContain("!store.isRelic && viewMode === '3d'");
		expect(dots.match(/>\+ View Key<\/button>/g)).toHaveLength(2);
		expect(ruler).toContain('+ Camera Key');
		expect(ruler).toContain('type="range"');
		expect(dots).toContain('class="timeline-playhead-overlay"');
		expect(dots).toContain('.timeline-playhead-overlay { position: absolute;');
		expect(dots).not.toContain('grid-column: 2; grid-row: 1 / -1');
		expect(dots).toContain('class="playhead-head"');
		expect(dots).toContain('role="slider"');
		expect(dots).toContain('aria-label="Sequence timeline playhead"');
		expect(dots).toContain("event.key === 'Home'");
		expect(dots).toContain("event.key === 'End'");
		expect(dots).toContain('[data-timeline-interactive]');
		expect(dots).toContain('timeTicksForDuration(timeline.durationSeconds)');
		expect(dots).toContain('durationSeconds / targetIntervals / 0.25');
		expect(dots).toContain('index * stepSeconds');
		expect(dots).not.toContain("replace(/\\.00$/, '')");
		expect(dots).not.toContain('.time-tick:nth-last-child(2)');
		expect(dots).toContain('@container (min-width: 52rem)');
		expect(dots).toContain('.shot-block.selected { border-color: var(--editor-accent);');
		expect(frame).toContain('.header-transport .header-icon.active,');
	});
});

describe('P12.4 S4 — idle mode and transport lifecycle', () => {
	it('lets idle POV install paused visitor Sequence and preserves scope/playhead on mode change', () => {
		const store = createFixtureEditorStore();

		expect(store.enterSequenceScope('visitor')).toBe(true);
		expect(store.cameraPreview).toMatchObject({
			kind: 'sequence',
			mode: 'visitor',
			transport: 'paused',
			playhead: 0
		});
		expect(store.setCameraPreviewPlayhead(0.35)).toBe(true);

		expect(store.setCameraPreviewMode('director')).toBe(true);
		expect(store.cameraPreview).toMatchObject({
			kind: 'sequence',
			mode: 'director',
			transport: 'paused',
			playhead: 0.35
		});

		expect(store.stepCameraNodeBoundary(1)).toBe(true);
		expect(store.cameraPreview?.transport).toBe('paused');
	});

	it('does not apply live header controls to the relic store surface', () => {
		const store = createRelicFixtureEditorStore();
		expect(store.isRelic).toBe(true);
		expect(store.enterSequenceScope('visitor')).toBe(true);
		expect(store.cameraPreview).toMatchObject({ kind: 'sequence', transport: 'paused' });
	});

	it('keeps Camera preview session alive when the 3D rig unmounts for Camera Plan', () => {
		const rig = readLibSource('editor/camera/EditorCameraRig.svelte');
		expect(rig).toContain("store.isRelic || store.currentWorkspace !== 'camera'");
		expect(rig).toContain('store.stopCameraPreview()');
	});
});

// Moved verbatim from the dismantled `contracts.test.ts` accumulator (T3a).
describe('P3 structural visual contracts', () => {
	it('pins the timeline shell to the documented expanded and collapsed heights', () => {
		const store = readLibSource('editor/editor-store.svelte.ts');

		expect(store).toContain('EDITOR_TIMELINE_COLLAPSED_HEIGHT = 48');
		expect(store).toContain('EDITOR_TIMELINE_MIN_HEIGHT = 240');
		expect(store).toContain('EDITOR_TIMELINE_MAX_HEIGHT = 300');
		expect(store).toContain('EDITOR_TIMELINE_DEFAULT_HEIGHT = 288');
	});
});

// Moved verbatim from the dismantled `contracts.test.ts` accumulator (T3a).
describe('P21.5 Slice 5 timeline density (P12 geometry frozen)', () => {
	it('keeps the expanded transport as quiet ghost buttons above the lanes', () => {
		const frame = readLibSource('editor/camera/EditorCameraTimelineFrame.svelte');
		// Resting tier is transparent; the accent cue arrives on hover/focus/active only.
		expect(frame).toContain('border: 1px solid transparent;');
		expect(frame).toContain('background: transparent;');
		expect(frame).toContain('.mode-control button:focus-visible,');
		// The frozen mini-player composition is never swapped for generic icons.
		// P23.14 Decision 5 replaces the collapsed scrubber with the timecode
		// readout: one playhead, owned by the expanded lanes.
		for (const fragment of [
			'scope-capsule',
			'swapEdgeReverse',
			'mini-player__transport',
			'>POV</span>',
			'>Observer</span>'
		]) {
			expect(frame, `missing frozen transport fragment ${fragment}`).toContain(fragment);
		}
	});
	it('reads ruler timecodes at 9px tabular with the playhead on current time', () => {
		const tokens = readLibSource('editor/styles/tokens.css');
		// Atlas `.ruler` — 9 px mono ticks, one ladder step under §7's 10 px floor.
		expect(tokens).toContain('--editor-font-size-ruler: var(--editor-font-size-2xs);');
		const dots = readLibSource('editor/camera/EditorCameraTimelineDots.svelte');
		expect(dots).toContain('font: var(--editor-timeline-ruler-font);');
		expect(dots).toContain('font-variant-numeric: tabular-nums;');
		expect(dots).toContain('left: var(--playhead-progress);');
		const ruler = readLibSource('editor/camera/EditorCameraTimelineRuler.svelte');
		expect(ruler).toContain('font-variant-numeric: tabular-nums;');
	});
	it('gives the collapsed pill full keyboard parity within its floating geometry', () => {
		const frame = readLibSource('editor/camera/EditorCameraTimelineFrame.svelte');
		expect(frame).toContain('.mini-player__icon:focus-visible,');
		// P23.14 Decision 5 — the collapsed strip holds no scrubber, so there is
		// no range control to focus; the transport buttons carry the parity.
		expect(frame).not.toContain('mini-player__scrubber');
		expect(frame).toContain('.toggle:focus-visible');
		// Geometry untouched: no resize, no re-dock, no new controls.
		expect(frame).toContain('bottom: 16px;');
		expect(frame).toContain('transform: translateX(-50%);');
	});
});

// Moved verbatim from the dismantled `contracts.test.ts` accumulator (T3a).
describe('camera context contracts', () => {
	it('keeps the single tour as a relic-only read-only selector in the timeline header (P1.7 §3)', () => {
		const frame = readLibSource('editor/camera/EditorCameraTimelineFrame.svelte');
		// The canonical tour is a read-only presentation — the skeleton has
		// exactly one guided tour, so the selector itself must carry zero
		// mutation path (no multi-tour semantics exist yet; order is authored
		// in the sidebar's Sequence Inspector).
		const selector = frame.match(/class="tour-selector"[\s\S]*?<\/button>/)?.[0];
		expect(selector).toBeTruthy();
		expect(frame).toContain('<header class="s4-header"');
		expect(selector!).toContain('Main Visitor Tour');
		expect(selector!).toContain('aria-disabled="true"');
		expect(selector!).not.toContain('onclick');
		// The interim dev phase label is gone from the header.
		expect(frame).not.toContain('exact shared motion');
	});
	it('shows the derived loop readout in the timeline panel with no Close-loop language', () => {
		const panel = readLibSource('editor/camera/EditorCameraTimelinePanel.svelte');
		expect(panel).toContain('Loops via:');
		expect(panel).toContain('Stops at');
		expect(panel).toContain('store.flowLoopConnectionId');
		expect(panel).toContain('showLoopRow = $derived(chain.length >= 3)');
		// The stale guided-cycle repair message is gone; the empty state names
		// the actual gap (no flow, or a missing transition).
		expect(panel).not.toContain('Guided timeline unavailable');
		expect(panel).not.toContain('Repair the guided camera cycle');
		// P11.3 §4 — the loop readout is Sequence-scope-only and the empty
		// state is a compact inline diagnostic, not a modal-like panel.
		expect(panel).toContain("scope === 'sequence' && chain.length > 0");
		expect(panel).toContain('No sequence yet');
		expect(panel).toContain('Gap at {nodeLabel(result.diagnostic.fromNodeId)}');
		expect(panel).not.toContain('closeGuidedTourLoop');
	});
});
