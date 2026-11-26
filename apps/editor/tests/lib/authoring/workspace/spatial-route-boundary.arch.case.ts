/**
 * Spatial route composition — the route constructs its owners and shell.
 *
 * The retired X1–X3 route blacklists now live in the manifest-driven
 * `integration-ownership.test.ts` (Appendix B replay + controller fold), so this
 * file keeps the positive construction and import checks only:
 *
 * - the route constructs the epoch, asset, input, keyboard, Artwork and
 *   Experience controllers;
 * - one press tracker is created and injected into the three input owners;
 * - the route has no direct host-acceptance import and no executable
 *   stage-adapter-host import; those belong to the epoch controller.
 */
import fs from 'node:fs';
import path from 'node:path';
import { LIFECYCLE_ORDER } from '$lib/authoring/workspace/lifecycle-order';
import { describe, expect, it } from 'vitest';

import {
	EDITOR_LIB,
	EDITOR_SRC,
	moduleBindingEdges,
	resolveSpecifier,
	stripComments
} from '../../../helpers/import-closure';

const ROUTE = path.join(EDITOR_LIB, 'authoring/workspace/host/workspace-host.svelte.ts');
const CORE_LIFECYCLE = path.join(EDITOR_LIB, 'authoring/stage/route/core-lifecycle-steps.svelte.ts');
const CORE_REGIONS = path.join(EDITOR_LIB, 'authoring/stage/route/core-region-views.ts');
const CANVAS_VIEWS = path.join(EDITOR_LIB, 'authoring/workspace/host/wiring/stage-canvas-views.svelte.ts');
const HISTORY = path.join(EDITOR_LIB, 'authoring/stage/route/stage-history-command.ts');
const LISTENERS = path.join(EDITOR_LIB, 'authoring/stage/route/stage-window-listeners.ts');
const EPOCH = path.join(EDITOR_LIB, 'authoring/stage/route/stage-project-epoch.svelte.ts');
const ASSETS = path.join(EDITOR_LIB, 'authoring/stage/route/stage-asset-leases.svelte.ts');
const APPEARANCE = path.join(EDITOR_LIB, 'authoring/look/appearance-feature.svelte.ts');
const INPUT = path.join(EDITOR_LIB, 'authoring/stage/route/stage-input.svelte.ts');
const KEYBOARD = path.join(EDITOR_LIB, 'authoring/stage/route/stage-keyboard.ts');
const READINGS = path.join(EDITOR_LIB, 'authoring/stage/readings/layout-readings-feature.svelte.ts');
const UNFOLD_HOST = path.join(EDITOR_LIB, 'authoring/stage/readings/unfold-host.svelte.ts');
const UNFOLD = path.join(EDITOR_LIB, 'authoring/stage/route/stage-unfold-gestures.svelte.ts');
const ARTWORK_ENTRY = path.join(EDITOR_LIB, 'authoring/artwork/artwork-feature.svelte.ts');
const ARTWORK_HOST = path.join(EDITOR_LIB, 'authoring/artwork/artwork-host.svelte.ts');
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


const COMPONENT = path.join(EDITOR_LIB, 'authoring/workspace/host/WorkspaceHost.svelte');
const WIRING = path.join(EDITOR_LIB, 'authoring/workspace/host/wiring');
const wiringFiles = fs.readdirSync(WIRING).filter((file) => file.endsWith('.ts')).map((file) => path.join(WIRING, file));
const wiringCode = wiringFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
/** The host's edges plus its wiring layer's edges: the composition root is both. */
function compositionTargets(): string[] {
	return [ROUTE, ...wiringFiles].flatMap((file) => {
		const content = file === ROUTE ? source : fs.readFileSync(file, 'utf8');
		return moduleBindingEdges(file, content).flatMap((edge) => {
			if (!('specifier' in edge)) return [];
			const target = resolveSpecifier(file, edge.specifier);
			return target === null ? [] : [target];
		});
	});
}
const source = fs.readFileSync(ROUTE, 'utf8');
const code = stripComments(source);
const markup = stripComments(fs.readFileSync(COMPONENT, 'utf8'));

describe('spatial route composition boundary (X1)', () => {
	it('constructs the extracted epoch and asset controllers', () => {
		expect(code + wiringCode).toContain('createStageProjectEpoch({');
		expect(code).toContain('createStageAssetLeases({');
		expect(code).toContain('stageEpoch.activate(snapshot)');
		const core = stripComments(fs.readFileSync(CORE_LIFECYCLE, 'utf8'));
		expect(core).toContain("'mark-torn-down': input.stageEpoch.markTornDown");
		expect(core).toContain("'dispose-epoch': input.stageEpoch.dispose");
		// U4 drops a live Finish Card gesture before delegating to the same epoch history owner.
		const regions = stripComments(fs.readFileSync(CORE_REGIONS, 'utf8'));
		expect(markup).toContain('{...coreRegions.head}');
		expect(regions).toContain('onUndo: input.history.undo');
		expect(regions).toContain('onRedo: input.history.redo');
		const history = stripComments(fs.readFileSync(HISTORY, 'utf8'));
		expect(history).toContain("undo: () => input.lifecycle().historyStep('undo')");
		expect(history).toContain("redo: () => input.lifecycle().historyStep('redo')");
		expect(LIFECYCLE_ORDER.historyStep).toEqual(['appearance:cancel-card-gesture', 'core:run-history']);
		// String retarget (Appendix B B.3): the step's handler now lives in its owner.
		expect(stripComments(fs.readFileSync(APPEARANCE, 'utf8'))).toMatch(/historyStep:\s*\{\s*'cancel-card-gesture': card\.cancelCardGesture\s*\}/);
		expect(core).toContain("'run-history': input.history.run");
		expect(history).toMatch(/run\(direction:[\s\S]*?if \(direction === 'undo'\) void input\.epoch\.undo\(\);\s*else void input\.epoch\.redo\(\);/);
		expect(code).toContain('artworkScope: () => stageAssets.artworkScope');
		expect(stripComments(fs.readFileSync(ARTWORK_HOST, 'utf8'))).toMatch(/get artworkScope\(\)\s*\{\s*return input\.artworkScope\(\)\s*;/);
		// String retarget: the Canvas assembly lives in the host's canvas-view owner.
		expect(stripComments(fs.readFileSync(CANVAS_VIEWS, 'utf8'))).toContain('Object.getOwnPropertyDescriptors(input.artwork.regions.canvas)');
	});

	it('constructs the one input arbiter, keyboard leaf, Unfold and Artwork owners', () => {
		expect(code + wiringCode).toContain('createStageInputArbiter({');
		expect(code + wiringCode).toContain('createStageKeyboard({');
		expect(code).toContain('createLayoutReadingsFeature({');
		expect(stripComments(fs.readFileSync(READINGS, 'utf8'))).toContain('createUnfoldHost(deps.unfold)');
		expect(stripComments(fs.readFileSync(UNFOLD_HOST, 'utf8'))).toContain('createStageUnfoldGestures({');
		expect(code).toContain('createArtworkFeature({');
		expect(stripComments(fs.readFileSync(ARTWORK_ENTRY, 'utf8'))).toContain('createStageArtworkInteraction({');
		// One drag/click authority, injected into every input owner.
		expect(code.match(/createStagePressTracker\(\)/g) ?? []).toHaveLength(1);
		expect(stripComments(fs.readFileSync(CORE_REGIONS, 'utf8'))).toContain('pointerDown: (event: PointerEvent) => stageInput.pointerDown(event)');
		expect(stripComments(fs.readFileSync(CORE_REGIONS, 'utf8'))).toContain('pointerMove: (event: PointerEvent) => stageInput.pointerMove(event)');
		expect(stripComments(fs.readFileSync(CORE_REGIONS, 'utf8'))).toContain('pointerUp: (event: PointerEvent) => stageInput.pointerUp(event)');
		expect(stripComments(fs.readFileSync(CORE_REGIONS, 'utf8'))).toContain('pointerCancel: (event: PointerEvent) => stageInput.pointerCancel(event)');
		expect(stripComments(fs.readFileSync(CORE_REGIONS, 'utf8'))).toContain('lostPointerCapture: (event: PointerEvent) => stageInput.lostPointerCapture(event)');
		expect(stripComments(fs.readFileSync(CORE_REGIONS, 'utf8'))).toContain('wheel: (event: WheelEvent) => stageInput.wheel(event)');
		expect(code).toMatch(/createStageWindowListeners\(\{\s*keyboard: stageKeyboard,/);
		expect(stripComments(fs.readFileSync(LISTENERS, 'utf8'))).toContain('input.keyboard.handleKey(event);');
	});

	it('imports the controllers directly and stops importing their owners', () => {
		const edges = moduleBindingEdges(ROUTE, source);
		const resolved = edges.flatMap((edge) => {
			if (!('specifier' in edge)) return [];
			const target = resolveSpecifier(ROUTE, edge.specifier);
			return target === null ? [] : [{ edge, target }];
		});
		const direct = [...new Set([...resolved.map(({ target }) => target), ...compositionTargets()])];
		expect(direct).toContain(EPOCH);
		expect(direct).toContain(ASSETS);
		expect(direct).toContain(INPUT);
		expect(direct).toContain(KEYBOARD);
		expect(direct).toContain(READINGS);
		expect(resolveSpecifier(READINGS, './unfold-host.svelte')).toBe(UNFOLD_HOST);
		expect(moduleBindingEdges(UNFOLD_HOST, fs.readFileSync(UNFOLD_HOST, 'utf8')).some((edge) =>
			edge.kind === 'import-named' && edge.imported === 'createStageUnfoldGestures' &&
			resolveSpecifier(UNFOLD_HOST, edge.specifier) === UNFOLD
		)).toBe(true);
		expect(direct).toContain(ARTWORK_ENTRY);
		expect(moduleBindingEdges(ARTWORK_ENTRY, fs.readFileSync(ARTWORK_ENTRY, 'utf8')).some((edge) =>
			edge.kind === 'import-named' && edge.imported === 'createStageArtworkInteraction' &&
			resolveSpecifier(ARTWORK_ENTRY, edge.specifier) === ARTWORK
		)).toBe(true);
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

	it('composes the X3 presentation controllers and shell regions', () => {
		expect(code).toContain('createStageExperienceBinding({');
		expect(code + wiringCode).toContain('createStageShellState({');
		expect(code + wiringCode).toContain('createStageShellCommands({');
		expect(code).toContain('createStageSelectionReadout({');
		expect(stripComments(fs.readFileSync(path.join(EDITOR_SRC, 'lib/authoring/stage/route/stage-selection-presentation.svelte.ts'), 'utf8'))).toContain('createStageSelectionView()');
		expect(stripComments(fs.readFileSync(path.join(EDITOR_SRC, 'lib/authoring/stage/route/stage-contribution-views.svelte.ts'), 'utf8'))).toContain('stageDockView({');
		expect(stripComments(fs.readFileSync(path.join(EDITOR_SRC, 'lib/authoring/stage/route/stage-contribution-views.svelte.ts'), 'utf8'))).toContain('stageFindView({');
		expect(stripComments(fs.readFileSync(CORE_REGIONS, 'utf8'))).toMatch(/get hostTools\(\) \{\s*return shell\.hostToolOverlay;\s*\}/);
		for (const region of ['StageProjectNotices', 'StageViewportRegion', 'StagePanels', 'StageToolbars']) {
			expect(markup.match(new RegExp(`<${region}\\b`, 'g')) ?? [], region).toHaveLength(1);
		}
	});

	it('imports the X3 controllers and regions directly, and no region reaches a route owner', () => {
		const direct = compositionTargets();
		const regionFiles = [NOTICES, VIEWPORT_REGION, PANELS, TOOLBARS];
		const regionDependencies = moduleBindingEdges(path.join(EDITOR_LIB, 'authoring/workspace/host/WorkspaceHost.svelte'),
			fs.readFileSync(path.join(EDITOR_LIB, 'authoring/workspace/host/WorkspaceHost.svelte'), 'utf8'))
			.flatMap((edge) => 'specifier' in edge ? [resolveSpecifier(ROUTE, edge.specifier)] : []);
		direct.push(...regionDependencies.filter((file): file is string => file !== null));
		for (const target of [EXPERIENCE_BINDING, SHELL_STATE, SHELL_COMMANDS,
			path.join(EDITOR_LIB, 'authoring/stage/route/stage-selection-presentation.svelte.ts'),
			path.join(EDITOR_LIB, 'authoring/stage/route/stage-contribution-views.svelte.ts'),
			...regionFiles]) {
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
