import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { EDITOR_LIB, listSourceFiles, moduleBindingEdges, relativeToRepo, resolveSpecifier } from '../../helpers/import-closure';

const stage = path.join(EDITOR_LIB, 'authoring/stage');
const owners = path.join(stage, 'facade');
const facade = path.join(stage, 'stage-facade.ts');
const owner = (name: string) => path.join(owners, `${name}.ts`);
const camera = '@portfolio/camera-core';

// Each leaf has explicit executable entry points. A package barrel is allowed
// only for the named operations the owner uses, so it cannot supply a second
// compiler, session or evaluator through another symbol.
const allowed = new Map<string, Record<string, readonly string[]>>([
	[facade, {
		[camera]: ['intersectWorkingPlane', 'pointerRay', 'projectWorld'],
		'@portfolio/project-model': ['requestCameraOutput'],
		'./camera-session': ['createCameraSession', 'evaluationIdOf'],
		'./facade/adapter-bindings': ['createAdapterBindings', 'HOST_STAGE_CAPABILITIES', 'SKIP_REBIND_CONTROL'],
		'./facade/contribution-view': ['createContributionView'],
		'./facade/plan-view': ['createPlanView'],
		'./facade/selection-pick': ['adapterForSelection', 'createSelectionPick', 'datumWorkingPlane'],
		'./plan-parameters': ['PLAN_DEFAULT_CUT_HEIGHT_METERS'],
		'./semantic-selection': ['primaryEntry']
	}],
	[owner('adapter-bindings'), {
		[camera]: ['intersectWorkingPlane', 'pointerRay', 'projectWorld'],
		'../semantic-selection': ['EMPTY_SELECTION'],
		'../stage-drafting': ['STAGE_DRAFTING_DEFAULTS']
	}],
	[owner('plan-view'), {
		'@portfolio/layout-core': ['createPlanRetainer', 'eligiblePlanFragments', 'planDependsOnTarget', 'planTargetsLiveView'],
		'../plan-parameters': ['planParameters']
	}],
	[owner('contribution-view'), {
		[camera]: ['projectWorld'],
		'../semantic-selection': ['primaryEntry', 'sameReference'],
		'../stage-handles': ['admitStageHandles', 'projectStageHandles'],
		'../stage-height-sheet': ['mergeStageHeightTicks']
	}],
	[owner('selection-pick'), {
		'$lib/platform/perf-marks': ['perfMark', 'perfMarksEnabled'],
		'../semantic-selection': ['sameReference'],
		'../stage-handles': ['hitStageMark'],
		'../stage-pick': ['resolveStagePick']
	}]
]);

const contracts = [owner('adapter-contract'), owner('view-contract')];
const leafFiles = () => listSourceFiles(owners).filter((file) => /\.(?:ts|js|svelte)$/.test(file));
const read = (file: string) => readFileSync(file, 'utf8');
const moduleTarget = (file: string, specifier: string) => resolveSpecifier(file, specifier) ?? specifier;

function executableEdges(file: string, source: string) {
	return moduleBindingEdges(file, source).flatMap((edge) => {
		if (!('specifier' in edge) || ('typeOnly' in edge && edge.typeOnly)) return [];
		return [{
			target: moduleTarget(file, edge.specifier),
			symbol: 'imported' in edge ? edge.imported : '*'
		}];
	});
}

function forbiddenDirectEdges(file: string, source = read(file)): string[] {
	const dependencies = new Map(
		Object.entries(allowed.get(file) ?? {}).map(([specifier, symbols]) => [moduleTarget(file, specifier), symbols])
	);
	return executableEdges(file, source)
		.filter(({ target, symbol }) => !dependencies.get(target)?.includes(symbol))
		.map(({ target, symbol }) => `${path.isAbsolute(target) ? relativeToRepo(target) : target}#${symbol}`);
}

// Follow executable edges through the helpers too. Package entry points are
// runtime-safe kernel boundaries covered by the named-edge check above.
const kernelEntries = new Set([
	camera, '@portfolio/layout-core', '@portfolio/project-model'
].map((specifier) => moduleTarget(facade, specifier)));
const sharedHelpers = new Set([
	'../plan-parameters', '../semantic-selection', '../stage-drafting', '../stage-handles',
	'../stage-height-sheet', '../stage-pick', '$lib/platform/perf-marks'
].map((specifier) => moduleTarget(owner('selection-pick'), specifier)));

function forbiddenClosure(root: string, sourceOf = read): string[] {
	const seen = new Set([root]);
	const pending = [root];
	const forbidden: string[] = [];
	while (pending.length > 0) {
		const file = pending.pop()!;
		for (const { target } of executableEdges(file, sourceOf(file))) {
			if (seen.has(target)) continue;
			seen.add(target);
			if (kernelEntries.has(target)) continue;
			if (sharedHelpers.has(target)) pending.push(target);
			else forbidden.push(path.isAbsolute(target) ? relativeToRepo(target) : target);
		}
	}
	return forbidden;
}

describe('Stage facade ownership', () => {
	it('keeps contract modules type-only', () => {
		for (const file of contracts) {
			const tree = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true);
			const runtime = tree.statements.filter((node) =>
				!ts.isTypeAliasDeclaration(node) &&
				!ts.isInterfaceDeclaration(node) &&
				!(ts.isImportDeclaration(node) && node.importClause?.isTypeOnly)
			);
			expect(runtime.map((node) => node.getText(tree)), relativeToRepo(file)).toEqual([]);
		}
	});

	it('limits each owner and the coordinator to named executable dependencies', () => {
		for (const file of [facade, ...leafFiles()]) {
			expect(forbiddenDirectEdges(file), relativeToRepo(file)).toEqual([]);
		}
	});

	it('keeps owner closures independent of each other, the facade, and external authoring or rendering state', () => {
		for (const file of leafFiles()) {
			expect(forbiddenClosure(file), relativeToRepo(file)).toEqual([]);
		}
	});

	it.each([
		"import { createStageFacade } from '../stage-facade';",
		"import { createStageFacade as host } from '$lib/authoring/stage/stage-facade';",
		"import '../stage-facade';",
		"export { createStageFacade } from '../stage-facade';",
		"export * from '../stage-facade';",
		"void import('../stage-facade');"
	])('rejects %s', (edge) => {
		expect(forbiddenDirectEdges(owner('plan-view'), edge)).toHaveLength(1);
	});

	it('distinguishes type-only contracts from executable dependencies', () => {
		const types = "import type { StageFacade } from './view-contract'; export type * from './adapter-contract';";
		expect(forbiddenDirectEdges(owner('plan-view'), types)).toEqual([]);
	});

	it('rejects a new compiler call through the already permitted Layout barrel', () => {
		const edge = "import { compileWallFirstLayoutGeometry as compile } from '@portfolio/layout-core';";
		expect(forbiddenDirectEdges(owner('plan-view'), edge)).toHaveLength(1);
	});

	it('finds a sibling runtime re-export behind a permitted helper', () => {
		const helper = path.join(stage, 'plan-parameters.ts');
		const sources = (file: string) => file === helper
			? `${read(file)}\nexport { createAdapterBindings } from './facade/adapter-bindings';`
			: read(file);
		expect(forbiddenClosure(owner('plan-view'), sources)).toEqual([relativeToRepo(owner('adapter-bindings'))]);
	});
});
