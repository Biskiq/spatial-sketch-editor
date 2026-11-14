/**
 * X1/X2 / schedule guarantee — route composes; controllers own effects.
 *
 * X1 removes the route's project-epoch and approved-asset ownership; X2 removes
 * its input, keyboard, Unfold-sheet and Artwork gesture ownership. This guard
 * proves the responsibilities are actually gone rather than shadowed by a
 * second implementation:
 *
 * - the route constructs the epoch, asset and X2 controllers;
 * - one press tracker is created and injected into the three input owners;
 * - no acceptance host, adapter mount loop, model lease map, route Undo/Redo
 *   implementation or replacement call remains in the route;
 * - no pointer/keyboard/Unfold/Artwork handler map or planner call remains in
 *   the route, and the camera/artwork/Unfold owners are no longer imported;
 * - the route has no direct host-acceptance import and no executable
 *   stage-adapter-host import; those belong to the epoch controller.
 *
 * The negative control applies the same predicate to a synthetic source, so a
 * pattern that can no longer detect the old defect fails here.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
	EDITOR_LIB,
	EDITOR_SRC,
	moduleBindingEdges,
	resolveSpecifier,
	stripComments
} from '../../helpers/import-closure';

const ROUTE = path.join(EDITOR_SRC, 'routes/project/[projectId]/spatial/+page.svelte');
const EPOCH = path.join(EDITOR_LIB, 'authoring/stage/route/stage-project-epoch.svelte.ts');
const ASSETS = path.join(EDITOR_LIB, 'authoring/stage/route/stage-asset-leases.svelte.ts');
const INPUT = path.join(EDITOR_LIB, 'authoring/stage/route/stage-input.svelte.ts');
const KEYBOARD = path.join(EDITOR_LIB, 'authoring/stage/route/stage-keyboard.ts');
const UNFOLD = path.join(EDITOR_LIB, 'authoring/stage/route/stage-unfold-gestures.svelte.ts');
const ARTWORK = path.join(EDITOR_LIB, 'authoring/stage/route/stage-artwork-interaction.svelte.ts');
const EXPERIENCE_BINDING = path.join(EDITOR_LIB, 'authoring/stage/route/stage-experience-binding.svelte.ts');
const SHELL_STATE = path.join(EDITOR_LIB, 'authoring/stage/route/stage-shell-state.svelte.ts');
const SHELL_COMMANDS = path.join(EDITOR_LIB, 'authoring/stage/route/stage-shell-commands.ts');
const SELECTION_VIEW = path.join(EDITOR_LIB, 'authoring/stage/route/stage-selection-view.ts');
const CONTRIBUTION_VIEW = path.join(EDITOR_LIB, 'authoring/stage/route/stage-contribution-view.ts');
const NOTICES = path.join(EDITOR_LIB, 'authoring/stage/shell/StageProjectNotices.svelte');
const VIEWPORT_REGION = path.join(EDITOR_LIB, 'authoring/stage/shell/StageViewportRegion.svelte');
const PANELS = path.join(EDITOR_LIB, 'authoring/stage/shell/StagePanels.svelte');
const TOOLBARS = path.join(EDITOR_LIB, 'authoring/stage/shell/StageToolbars.svelte');
const EXPERIENCE_LENS = path.join(EDITOR_LIB, 'authoring/experience/experience-lens.svelte.ts');
const STAGE_FACADE = path.join(EDITOR_LIB, 'authoring/stage/stage-facade.ts');
const PROJECT_SESSION = path.join(EDITOR_LIB, 'authoring/project-session/project-session.svelte.ts');

const OWNERSHIP_SITES = [
	{ id: 'acceptance-host', pattern: /\bcreateStageAcceptanceHost\s*\(/ },
	{ id: 'adapter-mount', pattern: /\bmountStageAdapter\s*\(/ },
	{ id: 'adapter-services', pattern: /\bcreateStageAdapterServices\s*\(/ },
	{ id: 'replacement', pattern: /\bsession\.replace\s*\(/ },
	{ id: 'model-resolution', pattern: /\b(async function resolveModels|modelPinSignature|modelResolution|approvedModelPins|resolveApprovedModels)\b/ },
	{ id: 'route-history', pattern: /\basync function (undo|redo)\s*\(/ },
	{ id: 'artwork-lease', pattern: /\bstageArtworkScope\b/ },
	{ id: 'subscriptions', pattern: /\bunsubscribe(Contributions|Acceptance)\b/ },
	{ id: 'adapter-loop', pattern: /\bfor \(const factory of stageAdapterFactories\)/ }
] as const;

function ownershipSites(source: string): string[] {
	return OWNERSHIP_SITES.filter(({ pattern }) => pattern.test(source)).map(({ id }) => id);
}

/**
 * X2's old route-owned implementations. These are names and calls, not generic
 * words: a template handler that delegates to `stageInput` must still pass.
 */
const X2_OWNERSHIP_SITES = [
	{ id: 'route-pointer-handler', pattern: /\bfunction onPointer(Down|Move|Up|Cancel)\s*\(/ },
	{ id: 'route-lost-capture', pattern: /\bfunction (onLostPointerCapture|lostPointerCapture)\s*\(/ },
	{ id: 'route-wheel-handler', pattern: /\bfunction (onWheel|wheel)\s*\(/ },
	{ id: 'route-keyboard-map', pattern: /\bstage(KeyAction|KeyFromTextEntry|KeyFromControl)\s*\(/ },
	{ id: 'route-artwork-gesture', pattern: /\b(startArtworkResize|readArtworkResize|finishArtworkResize|cancelArtworkResize|artworkResize)\b/ },
	{ id: 'route-artwork-planner', pattern: /\b(resizeArtworkAtRay|artworkPlanePoint|artworkPlacement)\s*\(/ },
	{ id: 'route-unfold-drag', pattern: /\b(sheetPinDrag|sheetEdgeDrag|sheetOpeningDrag)\b/ },
	{ id: 'route-unfold-planner', pattern: /\b(pickWallUnfold|mapSheetOpeningDrag|sheetOpeningDragWidth|wallUnfoldTopPoint)\s*\(/ }
] as const;

function x2OwnershipSites(source: string): string[] {
	return X2_OWNERSHIP_SITES.filter(({ pattern }) => pattern.test(source)).map(({ id }) => id);
}

/**
 * X3's old route-owned presentation. These are the state declarations, DOM
 * regions and Experience wiring that moved to the approved controllers and
 * shell components; naming their new owners is not an ownership site.
 */
const X3_OWNERSHIP_SITES = [
	{ id: 'route-lens-construction', pattern: /\bcreateExperienceLens\s*\(/ },
	{ id: 'route-lens-install', pattern: /\bexperienceLens\.install\s*\(/ },
	{ id: 'route-disclosure-state', pattern: /\blet (indexOpen|narrowShell|coarsePointer|showMarkers|showFrustums|showPaths|showLabels|showMode|paletteOpen|keysOpen|viewLine|lowerColumnHeight)\b/ },
	{ id: 'route-task-state', pattern: /\blet (task|eraseHover|heightMeters|heightSheetOpen|notice|previewProblem)\b/ },
	{ id: 'route-selection-projection', pattern: /\b(function|const) (cardForSelection|selectionCard|indexRowsFor|selectedEntry|sourceLocatorFor)\b/ },
	{ id: 'route-contribution-projection', pattern: /\b(function|const) (dockEntriesFor|findEntriesFor|hostToolEntries|contributedInstrumentFor)\b/ },
	{ id: 'route-shell-frame', pattern: /class="(stage-frame|lower-column|index-scrim)"/ },
	{ id: 'route-index-markup', pattern: /<EditorIndex\b/ },
	{ id: 'route-card-markup', pattern: /<EditorCard\b/ },
	{ id: 'route-guide-markup', pattern: /<ExperienceGuide\b/ },
	{ id: 'route-dock-markup', pattern: /<ExperienceDock\b/ },
	{ id: 'route-drafting-markup', pattern: /<StageDraftingControl\b/ },
	{ id: 'route-scale-markup', pattern: /<StageScaleBar\b/ },
	{ id: 'route-height-sheet-markup', pattern: /<StageHeightSheet\b/ }
] as const;

function x3OwnershipSites(source: string): string[] {
	return X3_OWNERSHIP_SITES.filter(({ pattern }) => pattern.test(source)).map(({ id }) => id);
}

const source = fs.readFileSync(ROUTE, 'utf8');
const code = stripComments(source);

describe('spatial route composition boundary (X1)', () => {
	it('constructs the extracted epoch and asset controllers', () => {
		expect(code).toContain('createStageProjectEpoch({');
		expect(code).toContain('createStageAssetLeases({');
		expect(code).toContain('stageEpoch.activate(snapshot)');
		expect(code).toContain('stageEpoch.markTornDown()');
		expect(code).toContain('stageEpoch.dispose()');
		expect(code).toContain('onUndo={() => void stageEpoch.undo()}');
		expect(code).toContain('onRedo={() => void stageEpoch.redo()}');
		expect(code).toMatch(/get artworkScope\(\)\s*\{\s*return stageAssets\.artworkScope\s*;/);
	});

	it('keeps no second epoch, history or asset-lease owner in the route', () => {
		expect(ownershipSites(code)).toEqual([]);
	});

	it('constructs the one input arbiter, keyboard leaf, Unfold and Artwork owners', () => {
		expect(code).toContain('createStageInputArbiter({');
		expect(code).toContain('createStageKeyboard({');
		expect(code).toContain('createStageUnfoldGestures({');
		expect(code).toContain('createStageArtworkInteraction({');
		// One drag/click authority, injected into every input owner.
		expect(code.match(/createStagePressTracker\(\)/g) ?? []).toHaveLength(1);
		expect(code).toContain('pointerDown: (event: PointerEvent) => stageInput.pointerDown(event)');
		expect(code).toContain('pointerMove: (event: PointerEvent) => stageInput.pointerMove(event)');
		expect(code).toContain('pointerUp: (event: PointerEvent) => stageInput.pointerUp(event)');
		expect(code).toContain('pointerCancel: (event: PointerEvent) => stageInput.pointerCancel(event)');
		expect(code).toContain('lostPointerCapture: (event: PointerEvent) => stageInput.lostPointerCapture(event)');
		expect(code).toContain('wheel: (event: WheelEvent) => stageInput.wheel(event)');
		expect(code).toContain('stageKeyboard.handleKey(event);');
	});

	it('keeps no second pointer, keyboard, Unfold or Artwork gesture implementation', () => {
		expect(x2OwnershipSites(code)).toEqual([]);
	});

	it('imports the controllers directly and stops importing their owners', () => {
		const edges = moduleBindingEdges(ROUTE, source);
		const resolved = edges.flatMap((edge) => {
			if (!('specifier' in edge)) return [];
			const target = resolveSpecifier(ROUTE, edge.specifier);
			return target === null ? [] : [{ edge, target }];
		});
		const direct = resolved.map(({ target }) => target);
		expect(direct).toContain(EPOCH);
		expect(direct).toContain(ASSETS);
		expect(direct).toContain(INPUT);
		expect(direct).toContain(KEYBOARD);
		expect(direct).toContain(UNFOLD);
		expect(direct).toContain(ARTWORK);
		expect(resolved.filter(({ target }) => target.endsWith('host-acceptance.ts'))).toEqual([]);

		const executableAdapterHost = resolved.filter(
			({ edge, target }) =>
				target.endsWith('stage-adapter-host.ts') &&
				(!('typeOnly' in edge) || !edge.typeOnly)
		);
		expect(executableAdapterHost).toEqual([]);

		// The facade factory is the one permitted construction input to the epoch;
		// there is no second acceptance writer or adapter mount path.
		const facadeCreates = edges.filter(
			(edge) => edge.kind === 'import-named' && edge.imported === 'createStageFacade' && !edge.typeOnly
		);
		expect(facadeCreates).toHaveLength(1);
	});

	it('detects every old ownership site in a synthetic route source', () => {
		const synthetic = [
			"import { createStageAcceptanceHost } from '$lib/authoring/stage/host-acceptance';",
			'const mounted = createStageAcceptanceHost({});',
			'mountStageAdapter(facade, mounted, factory);',
			'createStageAdapterServices(facade, mounted);',
			'session.replace(snapshot);',
			'async function resolveModels(snapshot) { return modelPinSignature; }',
			'async function undo() {}',
			'async function redo() {}',
			'stageArtworkScope.dispose();',
			'unsubscribeContributions?.();',
			'for (const factory of stageAdapterFactories) {}'
		].join('\n');
		expect(ownershipSites(stripComments(synthetic))).toEqual([
			'acceptance-host',
			'adapter-mount',
			'adapter-services',
			'replacement',
			'model-resolution',
			'route-history',
			'artwork-lease',
			'subscriptions',
			'adapter-loop'
		]);
	});

	it('detects every old X2 ownership site in a synthetic route source', () => {
		const synthetic = [
			'function onPointerDown(event) { artworkResize = null; }',
			'function onPointerMove(event) {}',
			'function onLostPointerCapture(event) {}',
			'function onWheel(event) {}',
			'const action = stageKeyAction(event.key, { pressing });',
			'if (stageKeyFromTextEntry(event.target)) return;',
			'function startArtworkResize(event) {}',
			'const candidate = resizeArtworkAtRay(ray, artworkPlanePoint, drag);',
			'function unfoldedPointerPress(event) { sheetOpeningDrag = null; }',
			'if (sheetPinDrag !== null) return pickWallUnfold(wall, state, point);',
			'mapSheetOpeningDrag(source, grab, event);'
		].join('\n');
		expect(x2OwnershipSites(stripComments(synthetic))).toEqual([
			'route-pointer-handler',
			'route-lost-capture',
			'route-wheel-handler',
			'route-keyboard-map',
			'route-artwork-gesture',
			'route-artwork-planner',
			'route-unfold-drag',
			'route-unfold-planner'
		]);
	});

	it('composes the X3 presentation controllers and shell regions', () => {
		expect(code).toContain('createStageExperienceBinding({');
		expect(code).toContain('createStageShellState({');
		expect(code).toContain('createStageShellCommands({');
		expect(code).toContain('createStageSelectionView()');
		expect(code).toContain('stageDockView({');
		expect(code).toContain('stageFindView({');
		expect(code).toContain('hostTools: shell.hostToolOverlay');
		for (const region of ['StageProjectNotices', 'StageViewportRegion', 'StagePanels', 'StageToolbars']) {
			expect(code.match(new RegExp(`<${region}\\b`, 'g')) ?? [], region).toHaveLength(1);
		}
	});

	it('keeps no old X3 presentation ownership in the route', () => {
		expect(x3OwnershipSites(code)).toEqual([]);
	});

	it('detects every old X3 ownership site in a synthetic route source', () => {
		const synthetic = [
			'const lens = createExperienceLens({});',
			'experienceLens.install();',
			'let indexOpen = false;',
			'let task = null;',
			'const cardForSelection = options.selection;',
			'const dockEntriesFor = () => [];',
			'<div class="stage-frame"></div>',
			'<EditorIndex {...index} />',
			'<EditorCard {...card} />',
			'<ExperienceGuide {...guide} />',
			'<ExperienceDock {...dock} />',
			'<StageDraftingControl {...drafting} />',
			'<StageScaleBar {...bar} />',
			'<StageHeightSheet {...sheet} />'
		].join('\n');
		expect(x3OwnershipSites(stripComments(synthetic))).toEqual([
			'route-lens-construction',
			'route-lens-install',
			'route-disclosure-state',
			'route-task-state',
			'route-selection-projection',
			'route-contribution-projection',
			'route-shell-frame',
			'route-index-markup',
			'route-card-markup',
			'route-guide-markup',
			'route-dock-markup',
			'route-drafting-markup',
			'route-scale-markup',
			'route-height-sheet-markup'
		]);
	});

	it('imports the X3 controllers and regions directly, and no region reaches a route owner', () => {
		const direct = moduleBindingEdges(ROUTE, source).flatMap((edge) => {
			if (!('specifier' in edge)) return [];
			const target = resolveSpecifier(ROUTE, edge.specifier);
			return target === null ? [] : [target];
		});
		for (const target of [EXPERIENCE_BINDING, SHELL_STATE, SHELL_COMMANDS, SELECTION_VIEW, CONTRIBUTION_VIEW, NOTICES, VIEWPORT_REGION, PANELS, TOOLBARS]) {
			expect(direct).toContain(target);
		}
		const forbidden = new Set([
			EXPERIENCE_BINDING,
			SHELL_STATE,
			SHELL_COMMANDS,
			SELECTION_VIEW,
			CONTRIBUTION_VIEW,
			EXPERIENCE_LENS,
			STAGE_FACADE,
			PROJECT_SESSION
		]);
		for (const file of [NOTICES, VIEWPORT_REGION, PANELS, TOOLBARS]) {
			const imports = moduleBindingEdges(file, fs.readFileSync(file, 'utf8')).flatMap((edge) => {
				if (!('specifier' in edge)) return [];
				const target = resolveSpecifier(file, edge.specifier);
				return target === null ? [] : [target];
			});
			expect(imports.filter((target) => forbidden.has(target)), file).toEqual([]);
		}
	});
});
