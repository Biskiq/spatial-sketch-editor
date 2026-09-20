import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LIB_DIR, readLibSource, readRouteSource } from '../../../helpers/lib-source';

const SRC = fileURLToPath(new URL('../../../../src/lib/editor', import.meta.url));

function read(relative: string): string {
	return fs.readFileSync(path.join(SRC, relative), 'utf8');
}

/** Body of a svelte `{#if …}` block, nested blocks included. */
function ifBlock(source: string, opener: string, from = 0): string {
	const start = source.indexOf(opener, from);
	expect(start, `${opener} must exist`).toBeGreaterThanOrEqual(0);
	const token = /\{#if\b|\{\/if\}/g;
	token.lastIndex = start;
	let depth = 0;
	let match: RegExpExecArray | null;
	while ((match = token.exec(source))) {
		if (match[0] === '{#if') depth += 1;
		else {
			depth -= 1;
			if (depth === 0) return source.slice(start, match.index);
		}
	}
	throw new Error(`unterminated ${opener}`);
}

/**
 * P23.14 §14 — one fact, one authoritative control owner.
 *
 * The 3D views mount the SAME toolbar component twice (View Bar in its
 * `ribbon` form, Tool Tray in its `tray` form), so ownership has to be decided
 * by the host or the shell grows two live writers for one fact. These are the
 * acceptance assertions for the seam that produced View menus in both hosts,
 * and duplicated panel / grid / camera-helper / preview-mode controls.
 */
describe('P23.14 §14 — one writable owner per fact in the 3D chrome', () => {
	const toolbar = read('EditorViewportToolbar.svelte');
	const ribbon = read('app/WorkspaceRibbon.svelte');
	const trayHost = read('app/Workspace3DView.svelte');
	const gridControls = read('EditorViewportGridControls.svelte');
	const drawer = read('camera/EditorCameraTimelineFrame.svelte');
	const previewControls = read('camera/EditorCameraPreviewControls.svelte');
	const flat = (source: string) => source.replace(/\s+/g, ' ');

	it('the View menu renders exactly once, for a host that owns it', () => {
		// The tray renders the same component, so the menu is gated on the HOST:
		// the tray never paints it, and the camera ribbon's own site (inside its
		// group order) suppresses the shared one instead of stacking a second
		// menu beside it.
		expect(toolbar).toContain(
			'const viewMenuHost = $derived(!tray && !(ribbon && isCameraContext));'
		);
		const menuHost = ifBlock(toolbar, '{#if viewMenuHost}');
		expect(menuHost).toContain('{@render viewMenu()}');
		expect(toolbar.match(/\{@render viewMenu\(\)\}/g) ?? []).toHaveLength(2);
	});

	it('the tray host paints the tool vocabulary and mounts no bar utility', () => {
		expect(trayHost).toContain('<EditorViewportToolbar tray');
		expect(trayHost).not.toContain('<EditorViewportGridControls');
		expect(ribbon).toContain('<EditorViewportToolbar ribbon');
	});

	it('panel visibility is written only by the View Bar utilities', () => {
		for (const write of ['toggleLeftSidePanel', 'toggleRightSidePanel', 'toggleFocusMode']) {
			expect(ribbon, `${write} must be reachable from the View Bar`).toContain(`store.${write}()`);
			expect(toolbar, `${write} must not have a second writer in the toolbar`).not.toContain(write);
		}
	});

	it('grid visibility and opacity are written only by the grid control the bar mounts', () => {
		expect(gridControls).toContain('store.toggleGrid()');
		expect(ribbon).toContain('<EditorViewportGridControls {store} />');
		// The menu used to carry a second Grid row for the same fact.
		expect(toolbar).not.toContain('store.gridVisible');
		expect(toolbar).not.toContain('store.toggleGrid()');
	});

	it('camera helper visibility has exactly one owner per host', () => {
		// Where a bar exists it paints Path and Frame as direct toggles, so the
		// menu must not also offer them.
		expect(toolbar).toContain('>Path</button>');
		expect(toolbar).toContain('>Frame</button>');
		const tourPaths = toolbar.indexOf('<span>Tour paths</span>');
		expect(tourPaths).toBeGreaterThanOrEqual(0);
		const barOnlyRows = ifBlock(
			toolbar,
			'{#if !ribbon}',
			toolbar.lastIndexOf('{#if !ribbon}', tourPaths)
		);
		expect(barOnlyRows).toContain('<span>Tour paths</span>');
		expect(barOnlyRows).toContain('Framing &amp; FOV');
		// …while the two rows with no other owner anywhere stay outside that gate.
		expect(barOnlyRows).not.toContain('Node handles');
		expect(barOnlyRows).not.toContain('Retained paths');
		expect(toolbar).toContain('<span>Node handles</span>');
		expect(toolbar).toContain('<span>Retained paths</span>');
	});

	it('the camera preview mode is written only by the Camera Drawer transport', () => {
		// The drawer carries the switch in both its states and in both camera
		// views (collapsed mini-player always; the expanded panel while a
		// preview is live), so it is the owner and the bar keeps no copy.
		expect(drawer).toContain('function choosePreviewMode(');
		expect(drawer).toContain('<span>POV</span>');
		expect(previewControls).toContain("store.setCameraPreviewMode('visitor')");
		expect(toolbar).not.toContain('chooseCameraPreviewMode');
		expect(toolbar).not.toContain('setCameraPreviewMode');
		expect(toolbar).not.toContain('previewMode');
	});
});

// Moved verbatim from the dismantled `contracts.test.ts` accumulator (T3a).
describe('P21.1 shared shell', () => {
	it('splits the domain axis onto the Spine and the view axis onto the View Bar', () => {
		// P23.14 §3/§8/§10 — the perpendicular signature: Scene/Camera vertical,
		// Plan/3D horizontal. The retired ribbon Zone A cluster is gone; each
		// axis has exactly one control owner (no dual domain controls).
		const spine = readLibSource('editor/app/DomainSpine.svelte');
		expect(spine).toContain('aria-label="Editor domain"');
		expect(spine).toContain('viewState.setDomain');
		// The domain switch keeps its editor-interaction guard, fed from the shell.
		expect(spine).toContain('canSwitch');
		expect(readLibSource('editor/app/EditorApp.svelte')).toContain(
			'canSwitch={!store.isEditorInteractionActive}'
		);
		// The active station marks itself with a 3 px inboard edge-light in the
		// domain accent — never a full-surface domain fill.
		expect(spine).toContain('--editor-domain-scene');
		expect(spine).toContain('--editor-domain-camera');
		expect(spine).toContain('inset-block: 10px');
		const ribbon = readLibSource('editor/app/WorkspaceRibbon.svelte');
		expect(ribbon).not.toContain('setDomain');
		expect(ribbon).toContain('aria-label="Editor views"');
		expect(ribbon).toContain('viewState.setView(viewState.domain, view as');
		expect(ribbon).toContain('class="view-tab"');
		// The View Bar is a central-column band, not a shell row.
		expect(ribbon).toContain('aria-label="View bar"');
		expect(ribbon).toContain('grid-area:viewbar;');
		const app = readLibSource('editor/app/EditorApp.svelte');
		expect(app).toContain('<DomainSpine');
		expect(app).toContain("'spine head head head'");
		expect(app).not.toContain("'ribbon ribbon ribbon'");
	});
	it('mounts the tool vocabulary on the Paper-attached Tool Tray, never floating', () => {
		// P23.14 §10/§11 — ownership split: each work surface mounts its own
		// 44 px Tool Tray at the Paper edge (in the toolbar's `tray`
		// presentation), while the View Bar keeps only subordinate utilities.
		const plan = readLibSource('editor/app/PlanWorkspace.svelte');
		expect(plan).toContain('<ToolTray label="Scene Plan tools">');
		expect(plan).toContain('<LayoutDraftToolbar');
		expect(plan).toContain('tray');
		expect(plan).toContain('class="paper-column"');
		const cameraPlan = readLibSource('editor/app/CameraPlanWorkspace.svelte');
		expect(cameraPlan).toContain('<ToolTray label="Camera Plan tools">');
		expect(cameraPlan).toContain('<CameraPlanToolbar tray {store} {cameraPlan} />');
		const ws3d = readLibSource('editor/app/Workspace3DView.svelte');
		expect(ws3d).toContain('<ToolTray label="3D tools">');
		expect(ws3d).toContain('.viewport-shell');
		// No floating toolbar resurrects: the trays carry no floating chrome.
		expect(plan).not.toMatch(/LayoutDraftToolbar[\s\S]{0,120}showViewToggle/);
		const trayCss = readLibSource('editor/styles/controls.css');
		expect(trayCss).toContain('.project-editor .tool-tray {');
		expect(trayCss).toContain('width: var(--editor-tray-width, 44px);');
		// R3 — the rail follows the type knob, so it stays the ratified 44 px at
		// scale 1 and grows with its labels rather than breaking them.
		expect(readLibSource('editor/styles/tokens.css')).toContain(
			'--editor-tray-width: calc(44px * var(--editor-type-scale));'
		);
		// The View Bar hosts the utility projection and never the tools.
		const ribbon = readLibSource('editor/app/WorkspaceRibbon.svelte');
		expect(ribbon).toContain('<LayoutDraftToolbar ribbon');
		expect(ribbon).toContain('<CameraPlanToolbar ribbon {store} {cameraPlan} />');
		expect(readLibSource('editor/app/EditorApp.svelte')).toContain('<WorkspaceRibbon');
	});
	it('paints MODE as a muted caption beside two plain buttons — no enclosure', () => {
		// Owner review: `MODE` read as a third control inside the same capsule as
		// Layout|Arrange, because the ribbon component's enclosed segmented trough
		// (padding 1 px, subtle border, 6 px radius, control fill) kept applying
		// in the shell scope. The wrapper clears it completely and the caption is
		// the muted engraved tier — a caption, not a segment (Atlas `.mode`).
		const css = readLibSource('editor/styles/controls.css');
		const slice = (selector: string): string => {
			const start = css.indexOf(selector);
			expect(start, `${selector} must exist`).toBeGreaterThanOrEqual(0);
			const open = css.indexOf('{', start);
			return css.slice(open + 1, css.indexOf('}', open));
		};
		// The group divider is the same leak class: space separates groups.
		const group = slice('.project-editor .view-bar .tool-group {');
		expect(group).toContain('padding: 0;');
		expect(group).toContain('border: 0;');
		const segmented = slice('.project-editor .view-bar .segmented {');
		for (const cleared of ['padding: 0;', 'border: 0;', 'border-radius: 0;', 'background: transparent;']) {
			expect(segmented, `MODE group keeps ${cleared}`).toContain(cleared);
		}
		const caption = slice('.project-editor .view-bar .segmented::before {');
		expect(caption).toContain("content: 'MODE';");
		expect(caption).toContain('color: var(--editor-text-muted);');
		const button = slice('.project-editor .view-bar .segmented > button {');
		expect(button).toContain('font: var(--editor-type-mode);');
		expect(button).toContain('min-height: var(--editor-control-sm-height);');
		// The ribbon's own `button { height: 28px }` must not size a 24 px tier.
		expect(button).toContain('height: auto;');
		// Pressed takes the Atlas's recessive surface + edge rule, never a wash.
		expect(slice('.project-editor .view-bar .segmented > button.active {')).toContain(
			'background-color: var(--editor-bg-recess);'
		);
	});
	it('keeps the Timeline docked, never in Row 2', () => {
		const ribbon = readLibSource('editor/app/WorkspaceRibbon.svelte');
		expect(ribbon).not.toContain('Timeline');
		expect(readLibSource('editor/app/EditorApp.svelte')).toContain('<EditorCameraTimelineFrame');
	});
	it('renders no deferred Wall/Measure controls (walls stay room-derived)', () => {
		for (const source of [
			readLibSource('editor/layout/LayoutDraftToolbar.svelte'),
			readLibSource('editor/app/WorkspaceRibbon.svelte'),
			readLibSource('editor/app/ProjectRow.svelte'),
			readLibSource('editor/app/EditorApp.svelte')
		]) {
			expect(source).not.toMatch(/>Wall</);
			expect(source).not.toMatch(/>Measure</);
		}
	});
	it('deletes the legacy preview link (Preview arrives in P21.4)', () => {
		for (const source of [
			readLibSource('editor/app/ProjectRow.svelte'),
			readLibSource('editor/app/WorkspaceRibbon.svelte'),
			readLibSource('editor/app/EditorApp.svelte')
		]) {
			expect(source).not.toContain('Preview Museum');
			expect(source).not.toContain('href="/museum"');
		}
		// P21.4 — Row 1 Preview entry is wired (no dead route, no placeholder).
		const row = readLibSource('editor/app/ProjectRow.svelte');
		expect(row).not.toContain('Visitor Preview is not available yet');
		expect(row).toContain('onPreview');
		expect(readLibSource('editor/app/EditorApp.svelte')).toContain('requestPreviewEntry');
	});
	it('leads Scene Plan Zone B with the Layout|Arrange switch', () => {
		const ribbon = readLibSource('editor/app/WorkspaceRibbon.svelte');
		expect(ribbon).toContain('showPlanModeToggle onPlanModeChange={choosePlanMode}');
		expect(ribbon).toContain("viewState.activeView === 'plan' && viewState.domain === 'scene'");
		const toolbar = readLibSource('editor/layout/LayoutDraftToolbar.svelte');
		expect(toolbar).toContain('aria-label="Scene Plan mode"');
		expect(toolbar).toContain('>Layout</button>');
		expect(toolbar).toContain('>Arrange</button>');
	});
});

// Moved verbatim from the dismantled `contracts.test.ts` accumulator (T3a).
describe('P21.2 scene reconciliation', () => {
	it('exposes exactly the supported Layout tools in Row 2 (no Wall/Measure)', () => {
		const toolbar = readLibSource('editor/layout/LayoutDraftToolbar.svelte');
		// P21.5 §1.4 — labels pair with 14px Lucide icons, so match on the
		// label text before the closing tag rather than a bare `>Label`. The
		// tool set itself is unchanged.
		for (const label of ['Select</button>', 'Rect Room</button>', 'Poly Room</button>', 'Door</button>', 'Window</button>']) {
			expect(toolbar).toContain(label);
		}
		expect(toolbar).not.toMatch(/>Wall</);
		expect(toolbar).not.toMatch(/>Measure</);
		expect(toolbar).toContain("interaction.planViewMode === 'layout'");
	});
	it('routes Arrange Delete through the active owner only (one gesture, one entry)', () => {
		const toolbar = readLibSource('editor/layout/LayoutDraftToolbar.svelte');
		expect(toolbar).toContain('onDeleteArrange');
		expect(toolbar).toContain('aria-label="Delete arrange selection"');
		expect(toolbar).toContain('Delete</button>');
		// P23.14 §11 — the Delete control rides the Scene Plan tray (mounted by
		// PlanWorkspace), not the View Bar.
		const plan = readLibSource('editor/app/PlanWorkspace.svelte');
		expect(plan).toContain('onDeleteArrange');
		expect(plan).toContain('{onDeleteArrange}');
		expect(readLibSource('editor/app/WorkspaceRibbon.svelte')).not.toContain('onDeleteArrange');
		const app = readLibSource('editor/app/EditorApp.svelte');
		expect(app).toContain('function deleteArrangeSelection');
		expect(app).toContain('runArrangeDelete');
		expect(app).toContain('onDeleteArrange={deleteArrangeSelection}');
	});
	it('reports per-workspace status strings without touching behavior contracts', () => {
		const status = readLibSource('editor/app/StatusBar.svelte');
		expect(status).toContain('X/Z Grid Orthogonal WallSnap Angle Scene>Plan>Layout');
		expect(status).toContain('Yaw Snap 15°');
		expect(status).toContain('Y Preserved');
		expect(status).toContain('workspaceStatus');
		expect(status).toContain("transformSpace?: 'local' | 'world'");
		// P23.14 §14 — the rail is READOUT-ONLY: the work-state string is
		// announced (role=status) and uses the AA-compliant secondary ink, and
		// the retired keyboard-hint band is gone (no control duplication).
		expect(status).toContain('role="status">{workspaceStatus}');
		expect(status).toContain('.workspace-status { color: var(--editor-text-secondary);');
		expect(status).not.toContain('aria-hidden');
		expect(status).not.toContain('Middle + Drag pan');
		// domain · view · local-mode readout + grid/snap/metric echo.
		expect(status).toContain('{domainLabel} · {viewLabel}{modeLabel}');
		expect(status).toContain('Grid on');
		expect(status).toContain('Metric (m)');
		const app = readLibSource('editor/app/EditorApp.svelte');
		expect(app).toContain('transformSpace={interactionStore.space}');
	});
	it('keeps panels edge-to-edge in the project shell only', () => {
		const css = readLibSource('editor/styles/editor-shell.css');
		expect(css).toContain('.project-editor :is(.panel, .sidebar, .outliner, .inspector)');
		expect(css).toContain('border-radius:0');
	});
});

// Moved verbatim from the dismantled `contracts.test.ts` accumulator (T3a).
describe('P21.3 camera reconciliation', () => {
	it('exposes Camera 3D Path/Frame in the ribbon and the preview mode in the drawer', () => {
		const toolbar = readLibSource('editor/EditorViewportToolbar.svelte');
		expect(toolbar).toContain('aria-label="Camera helper visibility"');
		expect(toolbar).toContain('store.toggleViewportShowPaths()');
		expect(toolbar).toContain('store.toggleViewportShowFraming()');
		// P23.14 §14 / F5 — the Observer↔POV switch has exactly ONE writer: the
		// camera preview transport in the Camera Drawer, which carries it in both
		// camera views (collapsed mini-player always, expanded panel while a
		// preview is live). The bar used to paint a second copy in Camera 3D.
		expect(toolbar).not.toContain('aria-label="Camera preview mode"');
		expect(toolbar).not.toContain('>Observer</button>');
		expect(toolbar).not.toContain('>POV</button>');
		// Both drawer switches share one idle-capable chooser (solo node, else
		// Sequence scope) — never a dead click, no new state.
		const timelineFrame = readLibSource('editor/camera/EditorCameraTimelineFrame.svelte');
		expect(timelineFrame).toContain('store.chooseCameraPreviewMode(mode)');
		const previewControls = readLibSource('editor/camera/EditorCameraPreviewControls.svelte');
		expect(previewControls).toContain("store.setCameraPreviewMode('visitor')");
		// Ribbon-only helper toggles: the relic mount (no context) keeps its legacy menu.
		expect(toolbar).toContain('{#if ribbon && isCameraContext}');
	});
	it('orders the Camera 3D ribbon Path Frame View Snap', () => {
		const toolbar = readLibSource('editor/EditorViewportToolbar.svelte');
		// Source order is render order: Path/Frame group, the shared View menu
		// (snippet), then shared Snap last. Observer/POV is not in the bar at all
		// (P23.14 §14 / F5) — the Camera Drawer transport owns it.
		const helperStart = toolbar.indexOf('aria-label="Camera helper visibility"');
		const renderStart = toolbar.indexOf('{@render viewMenu()}', helperStart);
		const snapStart = toolbar.indexOf('<summary class="ribbon-btn">Snap</summary>');
		for (const position of [helperStart, renderStart, snapStart]) {
			expect(position).toBeGreaterThanOrEqual(0);
		}
		expect(renderStart).toBeGreaterThan(helperStart);
		expect(snapStart).toBeGreaterThan(renderStart);
		expect(toolbar).not.toContain('aria-label="Camera preview mode"');
		// One View menu definition and one live render site PER HOST: the camera
		// ribbon paints it in its own group order, the shared site stands down
		// there, and the Tool Tray never paints it — so a 3D view never mounts
		// two menus (P23.14 §10/§14).
		expect(toolbar).toContain('{#snippet viewMenu()}');
		expect(toolbar).toContain(
			'const viewMenuHost = $derived(!tray && !(ribbon && isCameraContext));'
		);
		expect(toolbar).toContain('{#if viewMenuHost}');
	});
});

// Moved verbatim from the dismantled `contracts.test.ts` accumulator (T3a).
describe('P21.5 Slice 3 inspector density + selection isolation', () => {
	it('relocates viewport session controls into the Scene 3D View menu (never the status bar)', () => {
		const toolbar = readLibSource('editor/EditorViewportToolbar.svelte');
		expect(toolbar).toContain('showSceneViewOptions');
		expect(toolbar).toContain("context === 'scene'");
		// Grid / floor / lighting rows live in the Scene branch only.
		const sceneStart = toolbar.indexOf('{#if showSceneViewOptions}');
		expect(sceneStart).toBeGreaterThanOrEqual(0);
		const sceneBlock = toolbar.slice(sceneStart);
		expect(sceneBlock).toContain('store.toggleCameraPan()');
		// P23.14 §14 — grid visibility/opacity belong to the dedicated
		// `EditorViewportGridControls` the View Bar mounts for every 3D view, so
		// the menu no longer carries a second Grid row for the same fact.
		const ribbon = readLibSource('editor/app/WorkspaceRibbon.svelte');
		expect(sceneBlock).toContain('aria-label="Editor floor color picker"');
		expect(sceneBlock).toContain('store.sessionView.setFloorColor');
		expect(sceneBlock).toContain('EDITOR_BRIGHT_LIGHTING');
		expect(sceneBlock).toContain('EDITOR_VISITOR_LIGHTING');
		expect(sceneBlock).toContain('store.applyLightingPreset');
		expect(sceneBlock).toContain('store.sessionView.setAmbientIntensity');
		expect(sceneBlock).toContain('store.sessionView.setDirectionalIntensity');
		expect(sceneBlock).toContain('store.sessionView.setFogEnabled');
		// The Camera branch keeps its pinned rows; the relic (no context) is untouched.
		expect(toolbar).toContain('{#if showCameraHelperRows}');
		expect(toolbar).toContain('{#if showCeilingRow}');
		// Status bar stays strings/hints only — no relocated authoring control lands there.
		const status = readLibSource('editor/app/StatusBar.svelte');
		expect(status).not.toContain('setFloorColor');
		expect(status).not.toContain('setAmbientIntensity');
		expect(status).not.toContain('applyLightingPreset');
		expect(status).not.toContain('toggleGrid');
	});
});

// Moved verbatim from the dismantled `contracts.test.ts` accumulator (T3a).
describe('camera context contracts', () => {
	it('threads the explicit context seam through the editor shell; the relic keeps its absent-prop fallback', () => {
		const app = readLibSource('editor/app/EditorApp.svelte');
		const ws3d = readLibSource('editor/app/Workspace3DView.svelte');
		const toolbar = readLibSource('editor/EditorViewportToolbar.svelte');
		const viewport = readLibSource('editor/EditorViewport.svelte');

		// P1.1 — the editor derives the 3D context from the domain axis and passes
		// it down; the toolbar split is context-prop-driven.
		expect(app).toContain('context={viewState.domain}');
		expect(ws3d).toMatch(/context: 'scene' \| 'camera'/);
		expect(toolbar).toMatch(/context\?: 'scene' \| 'camera'/);
		// The editor-only camera-agnostic escape hatch is removed.
		expect(ws3d).not.toContain('cameraAgnosticViewMenu');
		expect(toolbar).not.toContain('cameraAgnosticViewMenu');
		// The relic mount passes no context and keeps the legacy camera-only
		// View menu via currentWorkspace.
		expect(viewport).not.toContain('context=');
		expect(toolbar).toContain("context === undefined && store.currentWorkspace === 'camera'");
	});
	it('splits the View-menu rows: Scene exposes Ceiling only, Camera exposes the three camera-helper rows', () => {
		const toolbar = readLibSource('editor/EditorViewportToolbar.svelte');

		// The camera-helper rows are gated behind the camera branch; the Ceiling
		// row is gated behind the scene branch.
		expect(toolbar).toContain('showCameraHelperRows');
		expect(toolbar).toContain("context === 'camera'");
		expect(toolbar).toContain('showCeilingRow');
		expect(toolbar).toContain("context === 'scene' && onToggleCeilings !== undefined");
		// Row markers stay distinct: helper rows inside the camera branch, Ceiling
		// inside the scene branch (slice from the template usage, not the script
		// deriveds, so the rows themselves are what is asserted).
		const cameraBranch = toolbar.slice(
			toolbar.indexOf('{#if showCameraHelperRows}'),
			toolbar.indexOf('{#if showCeilingRow}')
		);
		expect(cameraBranch).toContain('Node handles');
		expect(cameraBranch).toContain('Tour paths');
		expect(cameraBranch).not.toContain('Ceiling');
		const sceneBranch = toolbar.slice(toolbar.indexOf('showCeilingRow'));
		expect(sceneBranch).toContain('Ceiling');
	});
	it('mounts both plan workspaces keep-mounted in the Plan cell (P1.7 review fix — 2D parity with 3D)', () => {
		const app = readLibSource('editor/app/EditorApp.svelte');
		// Both plan surfaces stay mounted across Scene ⇄ Camera (the G3
		// pattern): each keeps its pan/zoom and component-local state, the
		// hidden one is `inert` + faded by class, and only the sidebar/menu
		// functionality swaps — mirroring how the single Workspace3DView cell
		// serves both domains without remounting.
		expect(app).toContain('<PlanWorkspace');
		expect(app).toContain('<CameraPlanWorkspace');
		expect(app).toContain("class:plan-cell--hidden={viewState.domain !== 'scene'}");
		expect(app).toContain("class:plan-cell--hidden={viewState.domain !== 'camera'}");
		expect(app).toContain("inert={viewState.domain !== 'scene'}");
		expect(app).toContain("inert={viewState.domain !== 'camera'}");
		expect(app).toContain('cameraPlan={cameraPlanState}');
		expect(
			fs.existsSync(path.join(LIB_DIR, 'editor/app/CameraPlanPlaceholder.svelte'))
		).toBe(false);
	});
	it('keeps Scene-only sidebar controls out of the Camera domain and mounts no empty camera rail', () => {
		const app = readLibSource('editor/app/EditorApp.svelte');
		const sidebar = readLibSource('editor/app/EditorSidebar.svelte');
		expect(sidebar).toContain("domain === 'scene'");
		expect(sidebar).toContain("onAddRoom={domain === 'scene' && !wallFirstLayout ? startRoomDraft : undefined}");
		expect(sidebar).toContain('{#if showScenePanelTabs}');
		expect(app).not.toContain('CameraDomainRail');
	});
	it('keeps Plan free of camera mutation surfaces and the relic route frozen', () => {
		const planView = readLibSource('editor/app/PlanWorkspace.svelte');
		const relicRoute = readRouteSource('museum/editor/+page.svelte');
		expect(planView).not.toContain('connectNavigationNodes');
		expect(planView).not.toContain('closeGuidedTourLoop');
		expect(planView).not.toContain('beginCameraPlacement');
	});
	it('composes the Camera toolbar with Rotate + Add camera and unmounts Scale', () => {
		const toolbar = readLibSource('editor/EditorViewportToolbar.svelte');
		// Select | Move | Rotate | Scale are icon + label transform tools.
		// P3.2 — §5 pins RotateCw for the Rotate tool.
		expect(toolbar).toContain('<MousePointer2 size={14}');
		expect(toolbar).toContain('<Move size={14}');
		expect(toolbar).toContain('<RotateCw size={14}');
		expect(toolbar).toContain('<Scaling size={14}');
		expect(toolbar).toContain('Select');
		expect(toolbar).toContain('Rotate');
		// Scale and the scale-chain toggle unmount in the Camera context.
		expect(toolbar).toContain('{#if showScaleTool}');
		expect(toolbar).toContain('const showScaleTool = $derived(!isCameraContext)');
		// Add camera lives in the Camera toolbar (relocated from the app bar).
		expect(toolbar).toContain('isCameraContext');
		expect(toolbar).toContain('Add camera');
		expect(toolbar).toContain('<Video size={14}');
		expect(toolbar).toContain('store.beginCameraPlacement()');
	});
	it('removed the relocated Place-camera action from the app bar', () => {
		const appBar = readLibSource('editor/app/ProjectRow.svelte');
		expect(appBar).not.toContain('beginCameraPlacement');
		expect(appBar).not.toContain('Place camera');
	});
});

// Moved verbatim from the dismantled `contracts.test.ts` accumulator (T3a).
describe('P21.14 shell context seam — the ceiling toggle is a Scene 3D fact', () => {
	it('restores the layout ceiling toggle into the editor 3D View menu (S10 context contract), relic untouched', () => {
		const toolbar = readLibSource('editor/EditorViewportToolbar.svelte');
		const ws3d = readLibSource('editor/app/Workspace3DView.svelte');
		const viewport = readLibSource('editor/EditorViewport.svelte');

		// S10 — the editor camera-agnostic escape hatch is gone: the shared toolbar
		// takes the explicit context prop, Workspace3DView threads it, and the relic
		// mount passes neither (legacy camera-only fallback).
		expect(toolbar).toContain('onToggleCeilings');
		expect(toolbar).toContain('context?: \'scene\' | \'camera\'');
		expect(toolbar).not.toContain('cameraAgnosticViewMenu');
		expect(toolbar).toMatch(/role="menuitemcheckbox"[^]*?<span>Ceiling<\/span>/);
		expect(ws3d).toContain('context: \'scene\' | \'camera\'');
		expect(ws3d).not.toContain('cameraAgnosticViewMenu');
		expect(readLibSource('editor/app/WorkspaceRibbon.svelte')).toContain('onToggleCeilings={');
		expect(readLibSource('editor/app/WorkspaceRibbon.svelte')).toContain('toggleLayoutCeilings');
		// The relic mount feeds neither prop, keeping its LayoutDraftToolbar
		// Ceiling button as the single surface there.
		expect(viewport).not.toContain('onToggleCeilings');
		expect(viewport).not.toContain('context=');
	});
});
