/**
 * X9 ownership guards: feature entry contract (EC1–EC4), compatibility phases,
 * meaningful workspace composition and the Material editor mount condition.
 *
 * These are positive checks over the manifest. They fail on a new responsibility
 * regardless of its name, which is what the retired route blacklists could not do.
 */
import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse as parseSvelte } from 'svelte/compiler';
import { importClosure, listSourceFiles, moduleBindingEdges, resolveSpecifier, scriptSources } from '../../helpers/import-closure';
import { AUTHORITIES, COMPAT_PHASES, FEATURES, REGION_MOUNTS, SINGLETONS, SPATIAL_ROUTE } from './integration-ownership.manifest';

const ROOT = process.cwd();
const HOST = 'src/lib/authoring/workspace/host/workspace-host.svelte.ts';
const HOST_COMPONENT = 'src/lib/authoring/workspace/host/WorkspaceHost.svelte';

function read(path: string): string {
	return readFileSync(join(ROOT, path), 'utf8');
}

function stripComments(source: string): string {
	return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
}

function parse(path: string) {
	return ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true, path.endsWith('.svelte') ? ts.ScriptKind.TS : undefined);
}

describe('feature entry contract', () => {
	it('exports exactly one create<Feature>Feature factory (EC1)', () => {
		for (const feature of FEATURES) {
			const source = parse(feature.entry);
			const factories = source.statements.filter(
				(statement): statement is ts.FunctionDeclaration =>
					ts.isFunctionDeclaration(statement) &&
					statement.name !== undefined &&
					/^create.+Feature$/.test(statement.name.text) &&
					statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) === true
			);
			expect(factories.map((factory) => factory.name?.text), feature.id).toEqual([
				`create${feature.id.split('-').map((part) => part[0]!.toUpperCase() + part.slice(1)).join('')}Feature`
			]);
		}
	});

	it('keeps runes, local state and browser globals out of entries (EC3)', () => {
		for (const feature of FEATURES) {
			const source = stripComments(read(feature.entry));
			expect(source, `${feature.id} runes`).not.toMatch(/\$state|\$derived|\$effect|untrack\(/);
			expect(source, `${feature.id} browser globals`).not.toMatch(/\bwindow\.|\bdocument\./);
			expect(source, `${feature.id} local let`).not.toMatch(/\blet\s+[A-Za-z_$]/);
			const functions = source.match(/\bfunction\s+[A-Za-z_$]/g) ?? [];
			expect(functions.length, `${feature.id} helper functions`).toBe(1);
		}
	});

	it('keeps every factory statement a construction or the one return (EC2)', () => {
		for (const feature of FEATURES) {
			const source = parse(feature.entry);
			const factory = source.statements.find(
				(statement): statement is ts.FunctionDeclaration =>
					ts.isFunctionDeclaration(statement) && statement.name?.text.startsWith('create') === true
			);
			expect(factory?.body, feature.id).toBeDefined();
			const statements = factory!.body!.statements;
			const returns = statements.filter(ts.isReturnStatement);
			expect(returns.length, `${feature.id} returns`).toBe(1);
			expect(statements.at(-1), `${feature.id} final statement`).toBe(returns[0]);
			for (const statement of statements) {
				expect(
					ts.isVariableStatement(statement) || ts.isReturnStatement(statement),
					`${feature.id} ${ts.SyntaxKind[statement.kind]}`
				).toBe(true);
				if (ts.isVariableStatement(statement)) {
					expect(statement.declarationList.flags & ts.NodeFlags.Let, `${feature.id} let`).toBe(0);
				}
			}
		}
	});

	it('keeps feature members isolated and sibling composition in the entry (EC4 and D2)', () => {
		for (const feature of FEATURES) {
			const ownMembers = new Set([feature.entry, ...feature.subOwners, ...feature.regions, feature.viewType]);
			const otherMembers = new Set(FEATURES.filter(({ id }) => id !== feature.id).flatMap((other) =>
				[other.entry, ...other.subOwners, ...other.regions, other.viewType]));
			for (const file of [feature.entry, ...feature.subOwners]) {
				for (const { target, typeOnly } of readSource(file).edges) {
					const permittedForeignType = file === feature.entry && typeOnly &&
						FEATURES.some((other) => other.entry === target);
					expect(!otherMembers.has(target) || permittedForeignType, `${file} → ${target}`).toBe(true);
					if (file === feature.entry || typeOnly) continue;
					expect(!ownMembers.has(target) || target === feature.viewType, `${file} → ${target}`).toBe(true);
				}
			}
		}
	});
});

type Source = {
	readonly file: string;
	readonly code: string;
	readonly scripts: readonly ts.SourceFile[];
	readonly bindings: ReturnType<typeof moduleBindingEdges>;
	readonly edges: readonly ResolvedBinding[];
};

type ResolvedBinding = {
	readonly binding: ReturnType<typeof moduleBindingEdges>[number];
	readonly target: string;
	readonly typeOnly: boolean;
};

function readSource(file: string, code = read(file)): Source {
	const bindings = moduleBindingEdges(file, code);
	return {
		file, code,
		scripts: scriptSources(file, code).map((script) =>
			ts.createSourceFile(file + '.ts', script, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)),
		bindings,
		edges: bindings.flatMap((binding) => {
			if (!('specifier' in binding)) return [];
			const target = moduleTarget(file, binding.specifier);
			return target === null ? [] : [{ binding, target, typeOnly: 'typeOnly' in binding && binding.typeOnly }];
		})
	};
}

let sources: Source[];
function sourceTree() {
	return sources ??= listSourceFiles(join(ROOT, 'src')).map((file) => readSource(relative(ROOT, file)));
}

function moduleTarget(importer: string, specifier: string): string | null {
	const target = resolveSpecifier(join(ROOT, importer), specifier);
	return target === null ? null : relative(ROOT, target);
}


function unwrap(node: ts.Expression): ts.Expression {
	while (ts.isParenthesizedExpression(node) || ts.isNonNullExpression(node) ||
		ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) node = node.expression;
	return node;
}

function walkScripts(source: Source, visit: (node: ts.Node) => void): void {
	function walk(node: ts.Node) {
		visit(node);
		ts.forEachChild(node, walk);
	}
	for (const script of source.scripts) walk(script);
}

/** Resolve the imported symbol using the shared binding reader, including named barrels. */
function bindingNames(
	source: Source, owner: string, exportedName: string, graph: ReadonlyMap<string, Source>
) {
	function exportsSymbol(file: string, name: string, seen: Set<string>): boolean {
		if (file === owner) return name === exportedName;
		const key = `${file}:${name}`;
		if (seen.has(key)) return false;
		seen.add(key);
		const module = graph.get(file);
		if (!module) return false;
		const edges = module.edges;
		return edges.some(({ binding, target, typeOnly }) => {
			if (typeOnly) return false;
			if (binding.kind === 'export-all') return exportsSymbol(target, name, seen);
			if (binding.kind === 'export-named' && binding.exported === name) {
				return exportsSymbol(target, binding.imported, seen);
			}
			if (binding.kind === 'import-named' && module.bindings.some((edge) =>
				edge.kind === 'export-local' && edge.local === binding.local && edge.exported === name
			)) return exportsSymbol(target, binding.imported, seen);
			return false;
		});
	}

	const names = new Set<string>(source.file === owner ? [exportedName] : []);
	for (const { binding, target, typeOnly } of source.edges) {
		if (typeOnly) continue;
		if (binding.kind === 'import-named' && exportsSymbol(target, binding.imported, new Set())) {
			names.add(binding.local);
		}
		if (binding.kind === 'import-namespace' && exportsSymbol(target, exportedName, new Set())) {
			names.add(`${binding.local}.${exportedName}`);
		}
	}
	if (names.size === 0) return names;

	function matches(expression: ts.Expression): boolean {
		return names.has(referenceName(unwrap(expression)) ?? '');
	}

	// A local const alias or a destructured namespace member has the same authority.
	let added = true;
	while (added) {
		added = false;
		walkScripts(source, (node) => {
			if (!ts.isVariableDeclaration(node) || node.initializer === undefined ||
				(node.parent.flags & ts.NodeFlags.Const) === 0) return;
			const add = (name: string) => {
				if (!names.has(name)) {
					names.add(name);
					added = true;
				}
			};
			const initializer = unwrap(node.initializer);
			if (ts.isIdentifier(node.name) && (matches(initializer) ||
				(ts.isBinaryExpression(initializer) && initializer.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken &&
					(matches(initializer.left) || matches(initializer.right))))) add(node.name.text);
			if (!ts.isObjectBindingPattern(node.name)) return;
			const namespace = referenceName(unwrap(node.initializer));
			for (const member of node.name.elements) {
				if (!ts.isIdentifier(member.name)) continue;
				const property = member.propertyName ?? member.name;
				if (names.has(`${namespace}.${property.getText()}`)) add(member.name.text);
			}
		});
	}
	return names;
}

function referenceName(expression: ts.Expression): string | undefined {
	if (ts.isIdentifier(expression)) return expression.text;
	if (ts.isPropertyAccessExpression(expression)) {
		return `${referenceName(unwrap(expression.expression))}.${expression.name.text}`;
	}
	if (ts.isElementAccessExpression(expression) && ts.isStringLiteralLike(expression.argumentExpression)) {
		return `${referenceName(unwrap(expression.expression))}.${expression.argumentExpression.text}`;
	}
	return undefined;
}

function calls(source: Source, names: ReadonlySet<string>): number {
	if (names.size === 0) return 0;
	let count = 0;
	walkScripts(source, (node) => {
		if ((ts.isCallExpression(node) || ts.isNewExpression(node)) &&
			names.has(referenceName(unwrap(node.expression)) ?? '')) count += 1;
	});
	return count;
}

function mounts(source: Source, names: ReadonlySet<string>): number {
	if (!source.file.endsWith('.svelte') || names.size === 0) return 0;
	let count = 0;
	const visit = (node: unknown): void => {
		if (node === null || typeof node !== 'object') return;
		if (Array.isArray(node)) {
			node.forEach(visit);
			return;
		}
		const candidate = node as Record<string, unknown>;
		if (candidate.type === 'Component' && typeof candidate.name === 'string' && names.has(candidate.name)) {
			count += 1;
		}
		Object.values(candidate).forEach(visit);
	};
	visit(parseSvelte(source.code, { modern: true }).fragment);
	return count;
}

function sites(
	graph: readonly Source[], owner: string, name: string, countUse: typeof calls
): string[] {
	const files = new Map(graph.map((source) => [source.file, source]));
	return graph.flatMap((source) => Array.from(
		{ length: countUse(source, bindingNames(source, owner, name, files)) }, () => source.file
	));
}

describe('composition and authority', () => {
	it('lets only the spatial route import the host factory (D4)', () => {
		const importers = sourceTree().filter((source) => source.edges.some(({ binding, target, typeOnly }) =>
			target === HOST && (!typeOnly || binding.kind !== 'import-named' || binding.imported !== 'WorkspaceHost')
		));
		expect(importers.map(({ file }) => file)).toEqual([SPATIAL_ROUTE]);
	});

	it('mounts each shared region once at its declared site (RM)', () => {
		for (const [name, owner, site] of REGION_MOUNTS) {
			expect(sites(sourceTree(), owner, 'default', mounts), name).toEqual([site]);
		}
	});

	it('constructs each authority once at its declared site (AU)', () => {
		for (const [name, owner, site] of AUTHORITIES) {
			expect(sites(sourceTree(), owner, name, calls), name).toEqual([site]);
		}
	});

	it('counts alias, namespace, bracket and barrel calls independently (AU control)', () => {
		const owner = 'src/lib/authoring/stage/stage-input.ts';
		const barrel = 'tests/lib/authoring/quux-x9-barrel.ts';
		const consumer = 'tests/lib/authoring/quux-x9-consumer.ts';
		const sources = [
			readSource(consumer, `
				import { createStagePressTracker as make } from '$lib/authoring/stage/stage-input';
				import * as stage from '$lib/authoring/stage/stage-input';
				const again = make;
				const { createStagePressTracker: third } = stage;
				make(); again(); third(); stage['createStagePressTracker']();
			`),
			readSource(barrel, `
				export { createStagePressTracker as forwarded } from '$lib/authoring/stage/stage-input';
				import { createStagePressTracker as direct } from '$lib/authoring/stage/stage-input';
				direct(); direct();
			`)
		];
		expect(sites(sources, owner, 'createStagePressTracker', calls)).toEqual([
			consumer, consumer, consumer, consumer, barrel, barrel
		]);
	});

	it('counts a renamed duplicate component mount even inside an inactive branch (RM control)', () => {
		const owner = 'src/lib/authoring/stage/shell/EditorHead.svelte';
		const file = 'tests/lib/authoring/QuuxMount.svelte';
		const source = readSource(file, `
			<script>import DifferentName from '$lib/authoring/stage/shell/EditorHead.svelte';</script>
			{#if false}<DifferentName />{:else}<DifferentName />{/if}
		`);
		expect(sites([source], owner, 'default', mounts)).toEqual([file, file]);
	});
});

const authoringRoot = 'src/lib/authoring/';
const memberFeature = new Map(FEATURES.flatMap((feature) =>
	[feature.entry, ...feature.subOwners, ...feature.regions, feature.viewType]
		.filter((file): file is string => file !== undefined)
		.map((file) => [file, feature.id] as const)
));
const presentations = new Set([
	...REGION_MOUNTS.map(([, file]) => file),
	...FEATURES.flatMap(({ regions }) => regions),
	authoringRoot + 'look/FinishCardSection.svelte',
	authoringRoot + 'workspace/world/WorldLeading.svelte',
	authoringRoot + 'workspace/world/WorldTrailing.svelte'
]);
const domainRoots = new Set([
	'a11y', 'adapters', 'artwork', 'camera', 'environment', 'experience', 'f4', 'layout',
	'library', 'look', 'materials', 'project-session', 'save', 'scene', 'studio', 'world-toolbar'
]);
const domainFiles = new Set(['exact-number.ts', 'material-proof.ts', 'model-contact.ts']);

function layerOf(file: string) {
	if (!file.startsWith(authoringRoot)) return null;
	if (file === HOST || file === HOST_COMPONENT) return 'host';
	if (presentations.has(file)) return 'presentation';
	if (memberFeature.has(file)) return 'feature';
	const path = file.slice(authoringRoot.length);
	if (path.startsWith('workspace/host/wiring/')) return 'wiring';
	if (path.startsWith('workspace/world/')) return 'workspace';
	if (['workspace/lifecycle-runner.ts', 'workspace/lifecycle-order.ts', 'workspace/protocol.ts',
		'workspace/escape-ladder.ts', 'workspace/region-ownership.ts'].includes(path)) return 'protocol';
	if (path.startsWith('stage/')) return 'core';
	if (domainFiles.has(path) || domainRoots.has(path.split('/')[0]!)) return 'domain';
	return 'unclassified';
}

const exceptions = new Set([
	// The input arbiter reads the Artwork gesture port and never constructs it.
	'stage/route/stage-input.svelte.ts → stage/route/stage-artwork-interaction.svelte.ts (type)',
	// The frame arbitrates two inspection views. Narrow its read to the View methods it calls.
	'stage/route/look-through-frame.svelte.ts → stage/route/stage-experience-binding.svelte.ts (type)'
]);

function forbiddenDependency(source: Source, edge: ResolvedBinding): string | null {
	const from = layerOf(source.file);
	const to = layerOf(edge.target);
	if (from === null || to === null) return null;
	const key = `${source.file.slice(authoringRoot.length)} → ${edge.target.slice(authoringRoot.length)}${edge.typeOnly ? ' (type)' : ''}`;
	if (exceptions.has(key)) return null;
	const isWorkspacePlacement = source.file.startsWith(authoringRoot + 'workspace/world/');
	if (isWorkspacePlacement && to !== 'presentation' && to !== 'protocol' && to !== 'workspace') return `D3 ${key}`;
	const ownViewType = edge.typeOnly && FEATURES.some(({ viewType, regions }) =>
		viewType === edge.target && regions.includes(source.file));
	if (from === 'presentation' && !ownViewType && (to === 'feature'  || to === 'host' || to === 'wiring' ||
		edge.target.startsWith(authoringRoot + 'stage/route/'))) return `D9 ${key}`;
	if ((from === 'core' || from === 'domain') && (to === 'feature' || to === 'host' ||
		to === 'wiring' || to === 'workspace')) return `D1 ${key}`;
	if (source.file.startsWith(authoringRoot + 'adapters/') && edge.target.startsWith(authoringRoot + 'stage/route/')) return `D8 ${key}`;
	if (memberFeature.get(source.file) === 'studio' && (isWorldOnly(edge.target) || to === 'workspace')) return `D6 ${key}`;
	return null;
}

function isWorldOnly(file: string): boolean {
	const feature = memberFeature.get(file);
	return feature === 'appearance' || feature === 'library' || feature === 'layout-readings';
}

describe('dependency direction', () => {
	it('classifies every authoring module reached by the spatial route (D7)', () => {
		const reachable = [...importClosure([join(ROOT, SPATIAL_ROUTE)])].map((file) => relative(ROOT, file));
		expect(reachable.filter((file) => layerOf(file) === 'unclassified')).toEqual([]);
	});

	it('admits only the route imports needed for the mount (D5)', () => {
		const specifiers = readSource(SPATIAL_ROUTE).bindings.flatMap((edge) => 'specifier' in edge ? [edge.specifier] : []);
		expect(specifiers).toEqual([
			'$app/state',
			'$lib/authoring/workspace/host/workspace-host.svelte',
			'$lib/authoring/workspace/host/WorkspaceHost.svelte'
		]);
	});

	it('checks actual resolved dependencies (D1, D3, D6, D8, D9)', () => {
		const violations = sourceTree().flatMap((source) =>
			source.edges.flatMap((edge) => forbiddenDependency(source, edge) ?? []));
		expect([...new Set(violations)].sort()).toEqual([]);
	});

	it('refuses fresh relative, alias, type-query and dynamic controller edges', () => {
		const file = authoringRoot + 'stage/shell/EditorHead.svelte';
		const source = readSource(file, `<script lang="ts">
			import type { StageShellState as Quux } from '$lib/authoring/stage/route/stage-shell-state.svelte';
			type Fresh = typeof import('../route/stage-shell-commands').createStageShellCommands;
			const wrong = () => import('../../look/appearance-feature.svelte');
		</script>`);
		expect(source.edges.map((edge) => forbiddenDependency(source, edge)?.slice(0, 2))).toEqual(['D9', 'D9', 'D9']);
	});
});

function constructionViolations(source: Source, factoryName: string, permittedCalls: ReadonlySet<string>) {
	const violations = new Set<string>();
	for (const script of source.scripts) {
		for (const node of script.statements) {
			if (ts.isImportDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)) continue;
			if (!ts.isFunctionDeclaration(node) || node.name?.text !== factoryName || !node.body) {
				violations.add(`top-level ${ts.SyntaxKind[node.kind]}`);
				continue;
			}
			for (const statement of node.body.statements) {
				if (ts.isReturnStatement(statement) && statement === node.body.statements.at(-1)) continue;
				if (ts.isVariableStatement(statement) && (statement.declarationList.flags & ts.NodeFlags.Const) !== 0) continue;
				if (ts.isExpressionStatement(statement) && ts.isCallExpression(statement.expression) &&
					permittedCalls.has(referenceName(statement.expression.expression) ?? '')) continue;
				violations.add(`factory ${ts.SyntaxKind[statement.kind]}`);
			}
		}
	}
	walkScripts(source, (node) => {
		if (ts.isCallExpression(node) && /^\$(state|derived|effect)(\.|$)/.test(referenceName(node.expression) ?? '')) {
			violations.add('reactivity belongs to an owner');
		}
	});
	return [...violations];
}

describe('construction boundaries', () => {
	const installers = new Set([
		'installPerfWorkObserver', 'onDestroy', 'installStageCardRenameGuard',
		'installLeaveProject', 'projectSession.bindNavigation', 'installStageMount', 'lifecycleCell.set'
	]);

	it('keeps the host as a construction sequence (CR1, CR2, CR4)', () => {
		expect(constructionViolations(readSource(HOST), 'createWorkspaceHost', installers)).toEqual([]);
	});

	it('detects a fresh local owner and a side effect in a root', () => {
		const source = readSource(HOST, `export function createWorkspaceHost() {
			const quux = $state(false);
			function fresh() {}
			window.addEventListener('focus', fresh);
			return { quux };
		}`);
		expect(constructionViolations(source, 'createWorkspaceHost', installers)).toEqual([
			'factory FunctionDeclaration', 'factory ExpressionStatement', 'reactivity belongs to an owner'
		]);
	});
});

const stage = authoringRoot + 'stage/';
const stageRoute = stage + 'route/';
const epoch = stageRoute + 'stage-project-epoch.svelte.ts';
const facade = stage + 'stage-facade.ts';
const binding = stageRoute + 'stage-experience-binding.svelte.ts';
const history = stageRoute + 'stage-history-command.ts';
const keyboard = stageRoute + 'stage-keyboard.ts';
const inputModule = stage + 'stage-input.ts';

const functionOwners = [
	['createStageAcceptanceHost', stage + 'host-acceptance.ts', [epoch]],
	['mountStageAdapter', stage + 'stage-adapter-host.ts', [epoch]],
	['createStageAdapterServices', stage + 'stage-adapter-host.ts', [epoch, stage + 'stage-adapter-host.ts']],
	['resolveApprovedModels', authoringRoot + 'scene/model-bytes.ts', [stageRoute + 'stage-asset-leases.svelte.ts']],
	['stageKeyAction', inputModule, [keyboard]],
	['stageKeyFromTextEntry', inputModule, [keyboard]],
	['stageKeyFromControl', inputModule, [keyboard]],
	['setResolvedSlice', stage + 'slice/slice-resolved.ts', [stage + 'readings/slice-host.svelte.ts']],
	['setResolvedCutaway', stage + 'cutaway/cutaway-resolved.ts', [stage + 'readings/cutaway-host.svelte.ts']]
] as const;

function memberCallViolations(source: Source): string[] {
	const violations: string[] = [];
	walkScripts(source, (node) => {
		if (!ts.isCallExpression(node)) return;
		const call = referenceName(unwrap(node.expression));
		if (call === undefined) return;
		const parts = call.split('.');
		const member = parts.at(-1);
		let owners: readonly string[] | undefined;
		if (member === 'changeLens') owners = [facade, binding];
		if (call === 'window.addEventListener' && node.arguments[0] &&
			ts.isStringLiteralLike(node.arguments[0]) && ['keydown', 'keyup', 'blur'].includes(node.arguments[0].text)) {
			// Other editor/visitor lifetimes have their own keyboard surfaces.
			if (source.file.startsWith(authoringRoot + 'workspace/') || source.file.startsWith(stageRoute)) {
				owners = [stageRoute + 'stage-window-listeners.ts'];
			}
		}
		if (member === 'replace' && parts.at(-2) === 'session') owners = [epoch];
		if (member === 'leaveLens') owners = [HOST];
		if ((member === 'undo' || member === 'redo') && ['epoch', 'stageEpoch'].includes(parts.at(-2) ?? '')) {
			owners = [history];
		}
		if (member === 'requestViewingIntent' && parts.length > 1) owners = [
			facade, stageRoute + 'stage-viewing.ts', stage + 'readings/unfold-host.svelte.ts',
			authoringRoot + 'experience/experience-lens.svelte.ts'
		];
		if (owners && !owners.includes(source.file)) violations.push(`${source.file}: ${call}`);
	});
	return violations;
}

describe('call ownership', () => {
	it('keeps the listed engine operations with their declared callers (CO)', () => {
		for (const [name, owner, callers] of functionOwners) {
			expect([...new Set(sites(sourceTree(), owner, name, calls))].sort(), name).toEqual([...callers].sort());
		}
		expect(sourceTree().flatMap(memberCallViolations)).toEqual([]);
	});

	it('rejects session, history and viewing calls from a fresh presentation module', () => {
		const file = authoringRoot + 'workspace/host/Quux.svelte';
		expect(memberCallViolations(readSource(file, `<script>
			input.session['replace'](snapshot);
			input.epoch.undo();
			stage?.requestViewingIntent(intent, claim, time);
			window.addEventListener('blur', handler);
		</script>`))).toEqual([
			`${file}: input.session.replace`, `${file}: input.epoch.undo`,
			`${file}: stage.requestViewingIntent`, `${file}: window.addEventListener`
		]);
	});
});

type Singleton = (typeof SINGLETONS)[number];

function singletonViolations(source: Source, singleton: Singleton, graph: ReadonlyMap<string, Source>) {
	const owners: readonly string[] = singleton.owners;
	if (source.file === singleton.module || owners.includes(source.file)) return [];
	const names = bindingNames(source, singleton.module, singleton.name, graph);
	if (names.size === 0) return [];
	const consumers: Readonly<Record<string, readonly string[]>> = singleton.consumers;
	const permitted = consumers[source.file];
	if (!permitted) return [`${source.file}: ${singleton.name}`];
	const violations = new Set<string>();
	const check = (object: string | undefined, member: string | undefined) => {
		if (object !== undefined && names.has(object) && (member === undefined || !permitted.includes(member))) {
			violations.add(`${source.file}: ${singleton.name}.${member ?? '*'}`);
		}
	};
	walkScripts(source, (node) => {
		if (ts.isPropertyAccessExpression(node)) {
			check(referenceName(unwrap(node.expression)), node.name.text);
		}
		if (ts.isElementAccessExpression(node)) {
			check(referenceName(unwrap(node.expression)),
				ts.isStringLiteralLike(node.argumentExpression) ? node.argumentExpression.text : undefined);
		}
		if (ts.isVariableDeclaration(node) && node.initializer && ts.isObjectBindingPattern(node.name)) {
			const object = referenceName(unwrap(node.initializer));
			for (const property of node.name.elements) {
				const name = property.propertyName ?? property.name;
				check(object, ts.isIdentifier(name) || ts.isStringLiteralLike(name) ? name.text : undefined);
			}
		}
	});
	if (source.file.endsWith('.svelte')) {
		const visit = (node: unknown): void => {
			if (node === null || typeof node !== 'object') return;
			const part = node as Record<string, any>;
			if (part.type === 'MemberExpression' && part.object?.type === 'Identifier') {
				const member = part.computed ? part.property?.value : part.property?.name;
				check(part.object.name, typeof member === 'string' ? member : undefined);
			}
			Object.values(part).forEach(visit);
		};
		visit(parseSvelte(source.code, { modern: true }).fragment);
	}
	return [...violations];
}

describe('shared reading lifetimes', () => {
	it('keeps the stores private to their owners and declared member consumers (S1–S4)', () => {
		const sources = sourceTree();
		const graph = new Map(sources.map((source) => [source.file, source]));
		for (const singleton of SINGLETONS) {
			expect(sites(sources, singleton.module, singleton.constructor, calls), singleton.name).toEqual([singleton.module]);
			expect(sources.flatMap((source) => singletonViolations(source, singleton, graph)), singleton.name).toEqual([]);
		}
	});

	it('rejects a new consumer and a new member on a retained consumer', () => {
		const wall = SINGLETONS.find(({ name }) => name === 'wallFace')!;
		const code = `import { wallFace as reading } from '$lib/authoring/layout/wall-face-store';
			const same = reading; same['clear'](); const { reframe: resize } = reading;`;
		const appearance = authoringRoot + 'look/finish-align.svelte.ts';
		const quux = authoringRoot + 'stage/route/quux.ts';
		expect(singletonViolations(readSource(appearance, code), wall, new Map())).toEqual([
			`${appearance}: wallFace.clear`
		]);
		expect(singletonViolations(readSource(quux, code), wall, new Map())).toEqual([`${quux}: wallFace`]);
	});
});

function phaseCalls(host: string) {
	return [...host.matchAll(/\b([A-Za-z_$][\w$]*)\.(attach[A-Z][\w$]*)\(\);/g)].map((match) => ({
		owner: match[1]!,
		phase: match[2]!
	}));
}

describe('compatibility phases', () => {
	it('calls each declared phase exactly once and no undeclared phase', () => {
		const host = stripComments(read(HOST));
		const calls = phaseCalls(host);
		const declared = COMPAT_PHASES.map(({ feature, phase }) => ({ owner: feature, phase }));
		expect(calls).toEqual(declared);
		for (const phase of COMPAT_PHASES) {
			const feature = FEATURES.find(({ id }) => id === phase.feature);
			expect(feature, phase.feature).toBeDefined();
			expect(read(feature!.entry), `${phase.feature}.${phase.phase}`).toContain(`${phase.phase}:`);
		}
	});

	it('flags a fresh undeclared phase (negative control)', () => {
		expect(phaseCalls('quux.attachFreshThing();')).toEqual([{ owner: 'quux', phase: 'attachFreshThing' }]);
	});

});

describe('workspace composition', () => {
	it('has no comment-only workspace placeholders', () => {
		const directory = join(ROOT, 'src/lib/authoring/workspace');
		const walk = (path: string): string[] => readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
			const next = join(path, entry.name);
			return entry.isDirectory() ? walk(next) : entry.name.endsWith('.svelte') ? [next] : [];
		});
		for (const file of walk(directory)) {
			const body = readFileSync(file, 'utf8')
				.replace(/<!--[\s\S]*?-->/g, '')
				.replace(/<script[\s\S]*?<\/script>/g, '')
				.replace(/<style[\s\S]*?<\/style>/g, '')
				.trim();
			expect(body.length, `${file} is a comment-only placeholder`).toBeGreaterThan(0);
		}
	});

	it('composes World through one descriptor with both placements', () => {
		const descriptor = read('src/lib/authoring/workspace/world/world-workspace.ts');
		expect(descriptor).toContain("id: 'world'");
		expect(descriptor).toContain('leading: WorldLeading');
		expect(descriptor).toContain('trailing: WorldTrailing');
		expect(read(HOST_COMPONENT)).toContain("from '../world/world-workspace'");
	});
});

describe('Material editor mount condition', () => {
	it('matches the base route: draft first, otherwise the Finish editor', () => {
		const draft = read('src/lib/authoring/look/appearance/library-draft-session.svelte.ts');
		expect(draft).toContain(
			'input.finishes().libraryDraft !== null && input.canShowEditor() ? readDraft() : readFinish()'
		);
		const host = read(HOST);
		expect(host).toContain(
			'canShowEditor: () => !previewController.openState && experience.lensState === \'world\' && stageEpoch.services !== null'
		);
	});
});
