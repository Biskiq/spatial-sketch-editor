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
import { join, posix, relative } from 'node:path';
import { parse as parseSvelte } from 'svelte/compiler';
import { existsSync } from 'node:fs';
import { importClosure, listSourceFiles, moduleBindingEdges, relativeToRepo, resolveSpecifier, scriptSources } from '../../helpers/import-closure';
import { ESCAPE_LADDER } from '$lib/authoring/workspace/escape-ladder';
import { LIFECYCLE_ORDER } from '$lib/authoring/workspace/lifecycle-order';
import {
	AUTHORITIES, CALL_OWNERS, COMPAT_PHASES, CONTROLLER_BOUNDARIES, CONTROLLER_FORBIDDEN_PACKAGES,
	CONTROLLER_FORBIDDEN_PREFIXES, DEPENDENCY_EXCEPTIONS, FEATURES, IMPORT_OWNERS, MEMBER_CALL_OWNERS,
	REGION_MOUNTS, ROOT_BINDINGS, ROOT_IMPORTS, SINGLETONS, SINGLETON_MEMBERS, SPATIAL_ROUTE,
	STRUCTURAL_ELEMENTS, WIRING_PRESENTERS, WORKSPACE_COMPONENT
} from './integration-ownership.manifest';
import { DOMAIN_TO_CORE } from './integration-domain-dependencies';

const ROOT = process.cwd();
const HOST = 'src/lib/authoring/workspace/host/workspace-host.svelte.ts';
const HOST_COMPONENT = WORKSPACE_COMPONENT;
const HOST_INSTALLERS = new Set([
	'installPerfWorkObserver', 'onDestroy', 'installStageCardRenameGuard',
	'installLeaveProject', 'projectSession.bindNavigation', 'installStageMount', 'lifecycleCell.set'
]);

function read(path: string): string {
	return readFileSync(join(ROOT, path), 'utf8');
}

function stripComments(source: string): string {
	return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
}

/** The reviewed exception key, exactly as `forbiddenDependency` reports it. */
function exceptionKey(from: string, to: string, typeOnly: boolean): string {
	return `${from.slice(authoringRoot.length)} → ${to.slice(authoringRoot.length)}${typeOnly ? ' (type)' : ''}`;
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

	it('returns only owner references and records in the entry shape (EC2)', () => {
		for (const feature of FEATURES) {
			expect(entryShapeViolations(feature), feature.id).toEqual([]);
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

function propertyName(name: ts.PropertyName): string | null {
	return ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name)
		? name.text : null;
}

function memberChain(expression: ts.Expression): boolean {
	const value = unwrap(expression);
	if (ts.isIdentifier(value)) return true;
	if (ts.isPropertyAccessExpression(value)) return memberChain(value.expression);
	if (ts.isElementAccessExpression(value) && ts.isStringLiteralLike(value.argumentExpression)) {
		return memberChain(value.expression);
	}
	return false;
}

/** A record leaf is an owner member or a one-call delegation. */
function entryLeafViolation(expression: ts.Expression): string | null {
	const value = unwrap(expression);
	if (memberChain(value) || ts.isStringLiteralLike(value) || ts.isNumericLiteral(value) ||
		value.kind === ts.SyntaxKind.NullKeyword || value.kind === ts.SyntaxKind.TrueKeyword ||
		value.kind === ts.SyntaxKind.FalseKeyword) return null;
	if (ts.isObjectLiteralExpression(value)) return null;
	if (ts.isArrowFunction(value)) {
		if (ts.isBlock(value.body)) {
			const statements = value.body.statements;
			if (statements.length === 1 && ts.isIfStatement(statements[0]!) && statements[0]!.elseStatement === undefined &&
				ts.isReturnStatement(statements[0]!.thenStatement) &&
				statements[0]!.thenStatement.expression !== undefined &&
				ts.isCallExpression(unwrap(statements[0]!.thenStatement.expression))) return null;
			return 'multi-statement lifecycle delegation';
		}
		const body = unwrap(value.body);
		if (memberChain(body)) return null;
		if (ts.isCallExpression(body)) return null;
		if (ts.isBinaryExpression(body) && [ts.SyntaxKind.QuestionQuestionToken,
			ts.SyntaxKind.BarBarToken, ts.SyntaxKind.AmpersandAmpersandToken].includes(body.operatorToken.kind)) {
			return entryLeafViolation(body.left) ?? entryLeafViolation(body.right);
		}
		if (ts.isConditionalExpression(body)) {
			return entryLeafViolation(body.condition) ?? entryLeafViolation(body.whenTrue) ?? entryLeafViolation(body.whenFalse);
		}
		return `lifecycle expression ${ts.SyntaxKind[body.kind]}`;
	}
	return `record value ${ts.SyntaxKind[value.kind]}`;
}

function recordViolations(expression: ts.Expression, depth = 0): string[] {
	const value = unwrap(expression);
	if (!ts.isObjectLiteralExpression(value)) return [`record is ${ts.SyntaxKind[value.kind]}`];
	const violations: string[] = [];
	for (const property of value.properties) {
		if (ts.isPropertyAssignment(property)) {
			if (ts.isObjectLiteralExpression(unwrap(property.initializer)) && depth < 2) {
				violations.push(...recordViolations(property.initializer, depth + 1));
				continue;
			}
			const violation = entryLeafViolation(property.initializer);
			if (violation !== null) violations.push(`${propertyName(property.name) ?? '?'}: ${violation}`);
		} else if (ts.isGetAccessorDeclaration(property)) {
			const body = property.body?.statements;
			if (body?.length !== 1 || !ts.isReturnStatement(body[0]!) || body[0]!.expression === undefined ||
				!memberChain(body[0]!.expression)) violations.push(`${propertyName(property.name) ?? '?'}: getter`);
		} else if (ts.isMethodDeclaration(property)) {
			const body = property.body?.statements;
			const singleCall = body?.length === 1 && (ts.isReturnStatement(body[0]!) || ts.isExpressionStatement(body[0]!)) &&
				('expression' in body[0]! && body[0]!.expression !== undefined && ts.isCallExpression(unwrap(body[0]!.expression)));
			if (!singleCall) violations.push(`${propertyName(property.name) ?? '?'}: method`);
		} else if (!ts.isShorthandPropertyAssignment(property)) {
			violations.push(`member ${ts.SyntaxKind[property.kind]}`);
		}
	}
	return violations;
}

function entryShapeViolations(feature: (typeof FEATURES)[number]): string[] {
	const source = parse(feature.entry);
	const factory = source.statements.find(
		(statement): statement is ts.FunctionDeclaration =>
			ts.isFunctionDeclaration(statement) && statement.name?.text.startsWith('create') === true
	);
	const returned = factory?.body?.statements.at(-1);
	if (returned === undefined || !ts.isReturnStatement(returned) || returned.expression === undefined) {
		return ['entry has no return'];
	}
	const object = unwrap(returned.expression);
	if (!ts.isObjectLiteralExpression(object)) return ['entry return is not an object literal'];
	const violations: string[] = [];
	const allowed = new Set(['id', 'lifecycle', 'rungs', 'escapeRungs', 'ports', 'regions', 'escape', 'view']);
	const lifecycleKeys = new Map<string, string[]>();
	for (const property of object.properties) {
		const name = ts.isPropertyAssignment(property) || ts.isGetAccessorDeclaration(property)
			? propertyName(property.name) : null;
		if (name === null) {
			violations.push(`member ${ts.SyntaxKind[property.kind]}`);
			continue;
		}
		if (ts.isGetAccessorDeclaration(property)) {
			const body = property.body?.statements;
			if (body?.length !== 1 || !ts.isReturnStatement(body[0]!) || body[0]!.expression === undefined ||
				!memberChain(body[0]!.expression)) violations.push(`${name}: getter`);
			continue;
		}
		if (!allowed.has(name)) {
			violations.push(`unexpected member ${name}`);
			continue;
		}
		if (!ts.isPropertyAssignment(property)) {
			violations.push(`${name}: member ${ts.SyntaxKind[property.kind]}`);
			continue;
		}
		if (name === 'id') {
			const id = unwrap(property.initializer);
			if (!ts.isStringLiteral(id) || id.text !== feature.id) violations.push(`id: ${id.getText()}`);
			continue;
		}
		if (name === 'lifecycle') {
			const steps = unwrap(property.initializer);
			if (!ts.isObjectLiteralExpression(steps)) {
				violations.push('lifecycle: not a record');
				continue;
			}
			for (const event of steps.properties) {
				if (!ts.isPropertyAssignment(event)) {
					violations.push(`lifecycle member ${ts.SyntaxKind[event.kind]}`);
					continue;
				}
				const eventName = propertyName(event.name);
				const table = unwrap(event.initializer);
				if (eventName === null || !ts.isObjectLiteralExpression(table)) {
					violations.push(`lifecycle ${eventName ?? '?'}: not a step record`);
					continue;
				}
				lifecycleKeys.set(eventName, table.properties.map((step) =>
					ts.isPropertyAssignment(step) ? propertyName(step.name) ?? '?' : '?').sort());
			}
			continue;
		}
		// A record may be delegated wholesale (`ports: library.ports`).
		if (memberChain(property.initializer)) continue;
		violations.push(...recordViolations(property.initializer).map((violation) => `${name}: ${violation}`));
	}
	const expected = new Map<string, string[]>();
	for (const [event, steps] of Object.entries(LIFECYCLE_ORDER)) {
		const owned = (steps as readonly string[]).filter((step) => step.startsWith(`${feature.id}:`))
			.map((step) => step.slice(feature.id.length + 1)).sort();
		if (owned.length > 0) expected.set(event, owned);
	}
	for (const [event, steps] of expected) {
		if (JSON.stringify(lifecycleKeys.get(event)) !== JSON.stringify(steps)) {
			violations.push(`lifecycle ${event}: ${JSON.stringify(lifecycleKeys.get(event))} ≠ ${JSON.stringify(steps)}`);
		}
	}
	for (const event of lifecycleKeys.keys()) {
		if (!expected.has(event)) violations.push(`lifecycle ${event}: not in LIFECYCLE_ORDER for ${feature.id}`);
	}
	return violations;
}

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
		const object = referenceName(unwrap(expression.expression));
		return object === undefined ? undefined : `${object}.${expression.name.text}`;
	}
	if (ts.isElementAccessExpression(expression) && ts.isStringLiteralLike(expression.argumentExpression)) {
		const object = referenceName(unwrap(expression.expression));
		return object === undefined ? undefined : `${object}.${expression.argumentExpression.text}`;
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

function walkMarkup(source: Source, onNode: (node: Record<string, unknown>, parent: Record<string, unknown> | null) => void) {
	if (!source.file.endsWith('.svelte')) return;
	const visit = (node: unknown, parent: Record<string, unknown> | null): void => {
		if (node === null || typeof node !== 'object') return;
		if (Array.isArray(node)) {
			node.forEach((child) => visit(child, parent));
			return;
		}
		const candidate = node as Record<string, unknown>;
		onNode(candidate, parent);
		for (const value of Object.values(candidate)) {
			if (Array.isArray(value)) value.forEach((child) => visit(child, candidate));
			else visit(value, candidate);
		}
	};
	visit(parseSvelte(source.code, { modern: true }).fragment, null);
}

function mounts(source: Source, names: ReadonlySet<string>): number {
	if (names.size === 0) return 0;
	let count = 0;
	walkMarkup(source, (node) => {
		if (node.type === 'Component' && typeof node.name === 'string' && names.has(node.name)) count += 1;
	});
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
	it('lets only the spatial route import the host factory (D4)', { timeout: 30_000 }, () => {
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
	if (/^src\/lib\/(render|content)\//.test(file)) return 'domain';
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

const reviewedExceptions = new Set(DEPENDENCY_EXCEPTIONS.map((exception) =>
	exceptionKey(authoringRoot + exception.from, authoringRoot + exception.to, exception.typeOnly)
));
const usedExceptions = new Set<string>();

function forbiddenDependency(source: Source, edge: ResolvedBinding): string | null {
	const from = layerOf(source.file);
	const to = layerOf(edge.target);
	if (from === null || to === null) return null;
	const key = exceptionKey(source.file, edge.target, edge.typeOnly);
	if (reviewedExceptions.has(key)) {
		usedExceptions.add(key);
		return null;
	}
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
	if (from === 'domain' && to === 'core' && edge.target !== authoringRoot + 'stage/stage-adapter-host.ts' &&
		!DOMAIN_TO_CORE.has(key)) return `D10 ${source.file} → ${edge.target}`;
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
		expect(specifiers).toEqual(ROOT_IMPORTS[SPATIAL_ROUTE]);
	});

	it('checks actual resolved dependencies (D1, D3, D6, D8–D10) and uses every exception', { timeout: 30_000 }, () => {
		usedExceptions.clear();
		const violations = sourceTree().flatMap((source) =>
			source.edges.flatMap((edge) => forbiddenDependency(source, edge) ?? []));
		expect([...new Set(violations)].sort()).toEqual([]);
		// A reviewed exception that no longer suppresses a live edge is dead policy.
		expect([...reviewedExceptions].filter((key) => !usedExceptions.has(key))).toEqual([]);
	});

	it('rejects an unrelated domain caller of a legacy core bridge (D10 control)', () => {
		const source = readSource(authoringRoot + 'layout/quux.ts', `
			export { resolvedSliceNow } from '$lib/authoring/stage/slice/slice-resolved';
			type Core = typeof import('$lib/authoring/stage/stage-facade').createStageFacade;
		`);
		expect(source.edges.map((edge) => forbiddenDependency(source, edge)?.split(' ')[0])).toEqual(['D10', 'D10']);
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

/**
 * The host's callbacks are wiring, not policy: they may read owners and adapt
 * their arguments, but they may not hold local runes, mutable local state,
 * nested functions, loops, try/catch, timers or new objects. DOM *reads* are
 * allowed because the host owns the Stage element and the keyboard focus seam;
 * subscriptions and writes remain with their owners.
 */
function callbackViolations(source: Source, factoryName?: string, allowedCalls: ReadonlySet<string> = new Set(),
	allowedFunctions = false): string[] {
	const violations = new Set<string>();
	const forbiddenCalls = new Set([
		'$state', '$derived', '$effect', '$props', '$inspect', 'untrack',
		'queueMicrotask', 'setTimeout', 'setInterval', 'requestAnimationFrame', 'requestIdleCallback'
	].filter((name) => !allowedCalls.has(name)));
	walkScripts(source, (node) => {
		if (ts.isFunctionDeclaration(node)) {
			const isFactory = ts.isSourceFile(node.parent) && node.name?.text === factoryName;
			if (!isFactory && !allowedFunctions) violations.add('nested function');
		}
		if (ts.isFunctionExpression(node) || ts.isClassExpression(node) || ts.isClassDeclaration(node)) {
			violations.add('nested function');
		}
		if (ts.isVariableDeclarationList(node) && (node.flags & ts.NodeFlags.Const) === 0) {
			violations.add('mutable local');
		}
		if (ts.isForStatement(node) || ts.isForOfStatement(node) || ts.isForInStatement(node) ||
			ts.isWhileStatement(node) || ts.isDoStatement(node) || ts.isTryStatement(node) || ts.isSwitchStatement(node)) {
			violations.add(`control flow ${ts.SyntaxKind[node.kind]}`);
		}
		if (ts.isNewExpression(node) && referenceName(node.expression) !== 'Error') violations.add('new object');
		if (ts.isCallExpression(node) && forbiddenCalls.has(referenceName(node.expression) ?? '')) {
			violations.add(`reactivity or timer ${referenceName(node.expression)}`);
		}
	});
	return [...violations];
}

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
	for (const violation of callbackViolations(source, factoryName)) violations.add(violation);
	return [...violations];
}

const READ_OPERATORS = new Set<ts.SyntaxKind>([
	ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.AmpersandAmpersandToken,
	ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken,
	ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken,
	ts.SyntaxKind.LessThanToken, ts.SyntaxKind.GreaterThanToken,
	ts.SyntaxKind.LessThanEqualsToken, ts.SyntaxKind.GreaterThanEqualsToken
]);

function nodeCount(node: ts.Node): number {
	let count = 1;
	ts.forEachChild(node, (child) => { count += nodeCount(child); });
	return count;
}

/** A wiring value is a read of its input, a closed-set projection, or a callback. */
function wiringLiteralViolations(node: ts.Expression): string[] {
	const violations: string[] = [];
	const visit = (child: ts.Expression, count: boolean): void => {
		const value = unwrap(child);
		if (ts.isArrowFunction(value)) return;
		if (count && !ts.isObjectLiteralExpression(value) && !ts.isArrayLiteralExpression(value) &&
			nodeCount(value) > 12) violations.push('projection is longer than 12 nodes');
		if (ts.isObjectLiteralExpression(value)) {
			for (const property of value.properties) {
				if (ts.isPropertyAssignment(property)) visit(property.initializer, true);
				else if (ts.isShorthandPropertyAssignment(property) || ts.isSpreadAssignment(property)) continue;
				else if (ts.isGetAccessorDeclaration(property) || ts.isSetAccessorDeclaration(property)) {
					if (property.body?.statements.length !== 1) violations.push('accessor body');
				}
				else violations.push(`literal member ${ts.SyntaxKind[property.kind]}`);
			}
			return;
		}
		if (ts.isArrayLiteralExpression(value)) {
			value.elements.forEach((element) => visit(element, true));
			return;
		}
		if (ts.isIdentifier(value) || ts.isStringLiteralLike(value) || ts.isNumericLiteral(value) ||
			value.kind === ts.SyntaxKind.TrueKeyword || value.kind === ts.SyntaxKind.FalseKeyword ||
			value.kind === ts.SyntaxKind.NullKeyword) return;
		if (ts.isPropertyAccessExpression(value)) return visit(value.expression, false);
		if (ts.isElementAccessExpression(value)) {
			if (!ts.isStringLiteralLike(value.argumentExpression) && !ts.isNumericLiteral(value.argumentExpression)) {
				violations.push('computed access');
			}
			return visit(value.expression, false);
		}
		if (ts.isCallExpression(value)) {
			value.arguments.forEach((argument) => visit(argument, false));
			return;
		}
		if (ts.isConditionalExpression(value)) {
			visit(value.condition, false); visit(value.whenTrue, false); visit(value.whenFalse, false);
			return;
		}
		if (ts.isBinaryExpression(value) && READ_OPERATORS.has(value.operatorToken.kind)) {
			visit(value.left, false); visit(value.right, false);
			return;
		}
		if (ts.isPrefixUnaryExpression(value) &&
			(value.operator === ts.SyntaxKind.ExclamationToken || value.operator === ts.SyntaxKind.MinusToken)) {
			return visit(value.operand, false);
		}
		violations.push(`literal expression ${ts.SyntaxKind[value.kind]}`);
	};
	visit(node, true);
	return violations;
}

/** A wiring module is one exported function returning one factory call. */
function wiringViolations(source: Source): string[] {
	const violations: string[] = [];
	const functions = source.scripts.flatMap((script) => script.statements.filter(
		(statement): statement is ts.FunctionDeclaration =>
			ts.isFunctionDeclaration(statement) && statement.name?.text.startsWith('wire') === true
	));
	if (functions.length !== 1) return ['wiring module needs exactly one wire function'];
	const factory = functions[0]!;
	if (!factory.body || factory.body.statements.length !== 1 || !ts.isReturnStatement(factory.body.statements[0]!)) {
		return ['wiring body is not one return'];
	}
	const returned = unwrap(factory.body.statements[0]!.expression!);
	if (!ts.isCallExpression(returned) || !/^create[A-Z]/.test(referenceName(returned.expression) ?? '') ||
		returned.arguments.length !== 1 || !ts.isObjectLiteralExpression(unwrap(returned.arguments[0]!))) {
		return ['wiring return is not createX({…})'];
	}
	violations.push(...wiringLiteralViolations(returned.arguments[0]!));
	violations.push(...callbackViolations(source, factory.name!.text));
	return violations;
}

/**
 * A reactive cross-feature presenter: one factory of `const` projections and a
 * return. It may use `$derived.by` (canvas/region assembly is reactive), but it
 * holds no state, effect, local function or policy.
 */
function presenterViolations(source: Source): string[] {
	const functions = source.scripts.flatMap((script) => script.statements.filter(
		(statement): statement is ts.FunctionDeclaration =>
			ts.isFunctionDeclaration(statement) && statement.name?.text.startsWith('create') === true
	));
	if (functions.length !== 1) return ['presenter needs exactly one factory'];
	const factory = functions[0]!;
	if (!factory.body) return ['presenter has no body'];
	for (const statement of factory.body.statements) {
		if (ts.isReturnStatement(statement) && statement === factory.body.statements.at(-1)) continue;
		if (ts.isVariableStatement(statement) && (statement.declarationList.flags & ts.NodeFlags.Const) !== 0) continue;
		// A local pure projection helper is presenter code; it holds no state.
		if (ts.isFunctionDeclaration(statement)) continue;
		return [`presenter statement ${ts.SyntaxKind[statement.kind]}`];
	}
	return callbackViolations(source, factory.name!.text, new Set(['$derived']), true);
}

describe('construction boundaries', () => {
	it('keeps the host as a construction sequence (CR1, CR2, CR4)', () => {
		expect(constructionViolations(readSource(HOST), 'createWorkspaceHost', HOST_INSTALLERS)).toEqual([]);
	});

	it('keeps every wiring module one factory call with a bounded literal (CR4)', () => {
		const directory = 'src/lib/authoring/workspace/host/wiring';
		const presenters = new Set<string>(WIRING_PRESENTERS);
		for (const file of readdirSync(join(ROOT, directory)).filter((name) => name.endsWith('.ts'))) {
			const path = `${directory}/${file}`;
			expect(presenters.has(path) ? presenterViolations(readSource(path)) : wiringViolations(readSource(path)), path).toEqual([]);
		}
	});

	it('detects a fresh local owner and a side effect in a root', () => {
		const source = readSource(HOST, `export function createWorkspaceHost() {
			const quux = $state(false);
			function fresh() {}
			window.addEventListener('focus', fresh);
			return { quux };
		}`);
		expect(constructionViolations(source, 'createWorkspaceHost', HOST_INSTALLERS)).toEqual([
			'factory FunctionDeclaration', 'factory ExpressionStatement', 'reactivity belongs to an owner',
			'reactivity or timer $state', 'nested function'
		]);
	});

	it('detects a fresh multi-statement callback and an unbounded wiring literal (CR4 control)', () => {
		const host = readSource(HOST, `export function createWorkspaceHost() {
			const quux = make({
				run: () => { let count = 0; for (;;) count += 1; },
			});
			return { quux };
		}`);
		const hostViolations = constructionViolations(host, 'createWorkspaceHost', HOST_INSTALLERS);
		expect(hostViolations).toContain('mutable local');
		expect(hostViolations).toContain('control flow ForStatement');
		const wiring = readSource('src/lib/authoring/workspace/host/wiring/quux.ts', `
			import { createQuux } from './quux-owner';
			export function wireQuux(input: { a: number; b: number; c: number; d: number; e: number; f: number }) {
				return createQuux({ value: input.a ?? input.b ?? input.c ?? input.d ?? input.e ?? input.f });
			}
		`);
		expect(wiringViolations(wiring)).toEqual(['projection is longer than 12 nodes']);
	});
});

function rootScriptViolations(source: Source) {
	const violations = new Set<string>();
	const effectNames = new Set([
		'window', 'document', 'untrack', 'queueMicrotask', 'setTimeout', 'setInterval', 'requestAnimationFrame'
	]);
	const props = new Set<ts.Node>();
	for (const { statements } of source.scripts) {
		for (const statement of statements) {
			if (ts.isImportDeclaration(statement) || ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement)) continue;
			if (ts.isVariableStatement(statement)) {
				const { flags, declarations } = statement.declarationList;
				if (flags & ts.NodeFlags.Const) {
					// A root const is a construction call, a delivered identifier or a
					// literal. A projection (`const card = options.selection`) is owner logic.
					for (const declaration of declarations) {
						const init = declaration.initializer === undefined ? undefined : unwrap(declaration.initializer);
						if (init === undefined || ts.isCallExpression(init) || ts.isIdentifier(init) ||
							ts.isStringLiteralLike(init) || ts.isNumericLiteral(init) ||
							init.kind === ts.SyntaxKind.TrueKeyword || init.kind === ts.SyntaxKind.FalseKeyword ||
							init.kind === ts.SyntaxKind.NullKeyword) continue;
						violations.add(`root const ${declaration.name.getText()}`);
					}
					continue;
				}
				const init = declarations.length === 1 ? declarations[0]!.initializer : undefined;
				if (props.size === 0 && flags & ts.NodeFlags.Let && init && ts.isCallExpression(init) &&
					ts.isIdentifier(init.expression) && init.expression.text === '$props' && init.arguments.length === 0) {
					props.add(init.expression);
					continue;
				}
			}
			violations.add(`root statement ${ts.SyntaxKind[statement.kind]}`);
		}
	}
	walkScripts(source, (node) => {
		if (ts.isFunctionDeclaration(node)) violations.add('local function');
		if (ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression) &&
			referenceName(unwrap(node.expression)) === 'globalThis' && effectNames.has(node.argumentExpression.text)) {
			violations.add(`root reference ${node.argumentExpression.text}`);
		}
		if (!ts.isIdentifier(node)) return;
		if (effectNames.has(node.text) ||
			(/^\$(?:state|derived|effect|props|inspect)$/.test(node.text) && !props.has(node))) {
			violations.add(`root reference ${node.text}`);
		}
	});
	return [...violations];
}

const MARKUP_BINARY = new Set<ts.SyntaxKind>([
	ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken,
	ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken,
	ts.SyntaxKind.LessThanToken, ts.SyntaxKind.GreaterThanToken,
	ts.SyntaxKind.LessThanEqualsToken, ts.SyntaxKind.GreaterThanEqualsToken
]);

function parseMarkupExpression(text: string): ts.Expression | null {
	const file = ts.createSourceFile('markup.ts', `const __markup = ${text};`, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
	const statement = file.statements[0];
	if (!statement || !ts.isVariableStatement(statement)) return null;
	const initializer = statement.declarationList.declarations[0]?.initializer;
	return initializer === undefined ? null : unwrap(initializer);
}

/** The closed expression set a composition root's markup may use. */
function projectionViolation(node: ts.Expression, allowTemplate = false): string | null {
	const value = unwrap(node);
	if (ts.isIdentifier(value) || ts.isStringLiteralLike(value) || ts.isNumericLiteral(value) ||
		value.kind === ts.SyntaxKind.TrueKeyword || value.kind === ts.SyntaxKind.FalseKeyword ||
		value.kind === ts.SyntaxKind.NullKeyword) return null;
	if (ts.isPropertyAccessExpression(value)) return projectionViolation(value.expression, allowTemplate);
	if (ts.isElementAccessExpression(value)) {
		if (!ts.isStringLiteralLike(value.argumentExpression) && !ts.isNumericLiteral(value.argumentExpression)) {
			return 'computed access';
		}
		return projectionViolation(value.expression, allowTemplate);
	}
	if (ts.isConditionalExpression(value)) {
		return projectionViolation(value.condition, allowTemplate) ??
			projectionViolation(value.whenTrue, allowTemplate) ?? projectionViolation(value.whenFalse, allowTemplate);
	}
	if (ts.isBinaryExpression(value) && MARKUP_BINARY.has(value.operatorToken.kind)) {
		return projectionViolation(value.left, allowTemplate) ?? projectionViolation(value.right, allowTemplate);
	}
	if (ts.isPrefixUnaryExpression(value) && value.operator === ts.SyntaxKind.ExclamationToken) {
		return projectionViolation(value.operand, allowTemplate);
	}
	if (allowTemplate && ts.isTemplateExpression(value)) {
		for (const span of value.templateSpans) {
			const violation = projectionViolation(span.expression, false);
			if (violation !== null) return violation;
		}
		return null;
	}
	return `unexpected expression ${ts.SyntaxKind[value.kind]}`;
}

function markupViolations(source: Source, allowedMounts: ReadonlySet<string>) {
	const violations: string[] = [];
	const expression = (value: unknown) => {
		if (value === null || typeof value !== 'object') return '';
		const { start, end } = value as { start?: number; end?: number };
		return typeof start === 'number' && typeof end === 'number'
			? source.code.slice(start, end).trim() : '';
	};
	const isReference = (value: unknown) => /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(expression(value));
	const isDelegation = (value: Record<string, unknown>) => {
		if (value.type !== 'ArrowFunctionExpression' || value.async) return false;
		let body = value.body as Record<string, unknown>;
		if (body.type === 'UnaryExpression' && body.operator === 'void') body = body.argument as Record<string, unknown>;
		return body.type === 'CallExpression' && isReference(body.callee) &&
			(body.arguments as Record<string, unknown>[]).every(({ type }) => type === 'Identifier' || type === 'Literal');
	};
	const consts = new Set<string>();
	const snippets = new Set<string>();
	const structure = STRUCTURAL_ELEMENTS[source.file as keyof typeof STRUCTURAL_ELEMENTS] ?? [];
	const seenClasses = new Set<string>();
	const attribute = (name: string, value: unknown, structural: boolean, structuralName: string | undefined) => {
		if (structural && structuralName !== undefined) {
			const spec = structure.find(({ element }) => element === structuralName);
			if (spec === undefined || (name !== 'class' && !(spec.attributes as readonly string[]).includes(name))) {
				violations.push(`unexpected attribute ${name}`);
				return;
			}
		}
		if (value === true) {
			if (!snippets.has(name)) violations.push(`unexpected shorthand ${name}`);
			return;
		}
		const parts = Array.isArray(value) ? value as { type: string; data?: string; expression?: unknown }[] : [];
		if (parts.length === 0) return;
		for (const part of parts) {
			if (part.type === 'Text') {
				if (name === 'class' && !structure.some(({ classes }) => (classes as readonly string[]).includes(part.data ?? ''))) {
					violations.push(`unexpected class ${part.data ?? ''}`);
				}
				continue;
			}
			if (part.type !== 'ExpressionTag') {
				violations.push(`unexpected attribute value ${part.type}`);
				continue;
			}
			const parsed = parseMarkupExpression(expression(part.expression));
			const violation = parsed === null ? 'unparsed expression' : projectionViolation(parsed, name === 'style');
			if (violation !== null) violations.push(`${name}: ${violation}`);
		}
	};
	walkMarkup(source, (node, parent) => {
		if (node.type === 'ConstTag') {
			const declaration = node.declaration as { declarations?: { id?: { type: string; name?: string }; init?: unknown }[] };
			const entry = declaration.declarations?.[0];
			if (!entry || entry.id?.type !== 'Identifier' || typeof entry.id.name !== 'string') {
				violations.push('unexpected const declaration');
				return;
			}
			const init = expression(entry.init);
			if (!/^host(?:\.[A-Za-z_$][\w$]*)*$/.test(init)) violations.push(`const source ${init}`);
			consts.add(entry.id.name);
			return;
		}
		if (node.type === 'SnippetBlock') {
			const name = node.expression as { type?: string; name?: string } | undefined;
			if (name?.type !== 'Identifier' || typeof name.name !== 'string' ||
				((node.parameters as unknown[] | undefined)?.length ?? 0) !== 0) {
				violations.push('unexpected snippet');
			} else snippets.add(name.name);
			return;
		}
		if (node.type === 'RegularElement') {
			const name = node.name as string;
			const spec = structure.find(({ element }) => element === name);
			if (spec === undefined) {
				violations.push(`unexpected element ${name}`);
				return;
			}
			for (const attr of (node.attributes ?? []) as { type: string; name?: string; value?: unknown }[]) {
				if (attr.type !== 'Attribute' || typeof attr.name !== 'string') {
					violations.push(`unexpected element attribute ${attr.type}`);
					continue;
				}
				attribute(attr.name, attr.value, true, name);
				if (attr.name === 'class') {
					const value = (attr.value as { data?: string }[] | undefined)?.[0]?.data ?? '';
					if (seenClasses.has(value)) violations.push(`duplicate class ${value}`);
					seenClasses.add(value);
				}
			}
			return;
		}
		if (node.type === 'Component') {
			if (!allowedMounts.has(node.name as string)) violations.push(`unexpected component ${node.name as string}`);
			for (const attr of (node.attributes ?? []) as Record<string, unknown>[]) {
				if (attr.type === 'SpreadAttribute') {
					if (!isReference(attr.expression)) violations.push(`unexpected spread ${expression(attr.expression)}`);
				} else if (attr.type === 'BindDirective') {
					const bindings = ROOT_BINDINGS[source.file] ?? [];
					if (!bindings.includes(attr.name as string) || !/^host(?:\.[A-Za-z_$][\w$]*)+$/.test(expression(attr.expression))) {
						violations.push(`unexpected binding ${attr.name as string}`);
					}
				} else if (attr.type === 'Attribute') {
					const name = attr.name as string;
					if (/^on[A-Za-z]/.test(name)) {
						const value = attr.value as Record<string, unknown> | { expression?: Record<string, unknown> }[] | undefined;
						const part = (Array.isArray(value) && value.length === 1 ? value[0] : value) as
							{ expression?: Record<string, unknown> } | undefined;
						const payload = part?.expression;
						if (name === 'onUndo' || name === 'onRedo') {
							if (expression(payload) !== (name === 'onUndo' ? 'history.undo' : 'history.redo')) {
								violations.push(`unexpected history binding ${name}`);
							}
						} else if (payload === undefined || (!isReference(payload) && !isDelegation(payload))) {
							violations.push(`unexpected event binding ${name}`);
						}
					} else {
						attribute(name, attr.value, false, undefined);
					}
				} else if (attr.type === 'StyleDirective') {
					violations.push(`unexpected style directive ${attr.name as string}`);
				} else {
					violations.push(`unexpected component attribute ${attr.type}`);
				}
			}
			return;
		}
		if (node.type === 'IfBlock') {
			const condition = expression(node.test);
			const parsed = parseMarkupExpression(condition);
			const hostRead = /^host(?:\.[A-Za-z_$][\w$]*)*$/.test(condition);
			const left = parsed !== null && ts.isBinaryExpression(parsed) ? unwrap(parsed.left) : undefined;
			const right = parsed !== null && ts.isBinaryExpression(parsed) ? unwrap(parsed.right) : undefined;
			const nullConst = parsed !== null && ts.isBinaryExpression(parsed) &&
				(parsed.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken ||
					parsed.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken) &&
				left !== undefined && right !== undefined &&
				((ts.isIdentifier(left) && consts.has(left.text) && right.kind === ts.SyntaxKind.NullKeyword) ||
					(ts.isIdentifier(right) && consts.has(right.text) && left.kind === ts.SyntaxKind.NullKeyword));
			if (!hostRead && !nullConst) violations.push(`compound condition ${condition}`);
			return;
		}
		if (node.type === 'KeyBlock') {
			const condition = expression(node.expression);
			if (!/^host(?:\.[A-Za-z_$][\w$]*)*$/.test(condition)) violations.push(`compound key ${condition}`);
			return;
		}
		if (node.type === 'ExpressionTag' && parent?.type !== 'Attribute') {
			violations.push('unexpected markup ExpressionTag');
		}
		if (node.type === 'EachBlock' || node.type === 'AwaitBlock' || node.type === 'SvelteComponent' ||
			node.type === 'SvelteWindow' || node.type === 'SvelteDocument' || node.type === 'SvelteBody' ||
			node.type === 'SvelteElement' || node.type === 'HtmlTag' || node.type === 'UseDirective' ||
			node.type === 'RenderTag') {
			violations.push(`unexpected markup ${node.type}`);
		}
		if (node.type === 'OnDirective') violations.push(`unexpected event directive ${node.name as string}`);
	});
	for (const spec of structure) {
		for (const name of spec.classes) {
			if (!seenClasses.has(name)) violations.push(`missing element ${spec.element}.${name}`);
		}
	}
	return violations;
}

describe('root markup ownership', () => {
	const hostMounts = new Set([
		...REGION_MOUNTS.filter(([, , mount]) => mount === HOST_COMPONENT).map(([name]) => name),
		...FEATURES.flatMap(({ regions }) => regions.map((file) => file.split('/').at(-1)!.replace(/\.svelte$/, ''))),
		'StageBootPanels', 'StageReplaceDialog', 'WorldLeading', 'WorldTrailing'
	]);
	const placementMounts: Readonly<Record<string, ReadonlySet<string>>> = {
		[authoringRoot + 'workspace/world/WorldLeading.svelte']: new Set(['StudioWorldRegions']),
		[authoringRoot + 'workspace/world/WorldTrailing.svelte']: new Set(['LibraryWorldRegion', 'AppearanceWorldRegions'])
	};
	it('limits route and placement scripts to composition (CR1 and CR2)', () => {
		for (const file of [SPATIAL_ROUTE, HOST_COMPONENT, ...Object.keys(placementMounts)]) {
			expect(rootScriptViolations(readSource(file)), file).toEqual([]);
		}
	});
	it('rejects the former disclosure and gesture declarations under fresh names (CR1 and CR2 control)', () => {
		const source = readSource(SPATIAL_ROUTE, `<script>
			let current = false;
			const tracked = $state(false);
			function start() {}
			const deferred = globalThis['queueMicrotask'];
			window.addEventListener('blur', start);
		</script>`);
		expect(rootScriptViolations(source)).toEqual([
			'root statement FirstStatement', 'root statement FunctionDeclaration', 'root const deferred',
			'root statement ExpressionStatement', 'root reference $state', 'local function',
			'root reference queueMicrotask', 'root reference window'
		]);
	});
	it('limits shared roots to composition markup (CR5)', () => {
		expect(markupViolations(readSource(SPATIAL_ROUTE), new Set(['WorkspaceHost']))).toEqual([]);
		expect(markupViolations(readSource(HOST_COMPONENT), hostMounts)).toEqual([]);
		for (const [file, mounts] of Object.entries(placementMounts)) {
			expect(markupViolations(readSource(file), mounts), file).toEqual([]);
		}
	});
	it('rejects the retired inline shell and region placements (Appendix B.4 control)', () => {
		const synthetic = [
			'<div class="stage-frame"></div>', '<EditorIndex {...index} />', '<EditorCard {...card} />',
			'<ExperienceGuide {...guide} />', '<ExperienceDock {...dock} />',
			'<StageDraftingControl {...drafting} />', '<StageScaleBar {...bar} />',
			'<StageHeightSheet {...sheet} />'
		].join('\n');
		for (const [file, mounts] of [[SPATIAL_ROUTE, new Set(['WorkspaceHost'])], [HOST_COMPONENT, hostMounts]] as const) {
			expect(markupViolations(readSource(file, synthetic), mounts).length).toBeGreaterThanOrEqual(8);
		}
	});
	it('rejects fresh inline event policy and browser listeners in roots (CR5 control)', () => {
		const source = readSource(HOST_COMPONENT, `
			<EditorHead onUndo={() => history.undo()} onLens={(lens) => { choose(lens); reset(); }} />
			<svelte:window onkeydown={handler} />
		`);
		const violations = markupViolations(source, hostMounts);
		expect(violations).toContain('unexpected history binding onUndo');
		expect(violations).toContain('unexpected event binding onLens');
		expect(violations).toContain('unexpected markup SvelteWindow');
	});
	it('rejects a fresh element, class, const source and compound condition (CR5 control)', () => {
		const source = readSource(HOST_COMPONENT, `
			<div class="quux-shell"></div>
			<section></section>
			{@const quux = shell.value}
			{#if preview !== null && shell.indexOpen}<StagePanels {...coreRegions.panels} />{/if}
		`);
		const violations = markupViolations(source, hostMounts);
		expect(violations).toContain('unexpected class quux-shell');
		expect(violations).toContain('unexpected element section');
		expect(violations).toContain('const source shell.value');
		expect(violations).toContain('compound condition preview !== null && shell.indexOpen');
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
const artworkInteraction = stageRoute + 'stage-artwork-interaction.svelte.ts';
const unfoldGestures = stageRoute + 'stage-unfold-gestures.svelte.ts';

const functionOwners = CALL_OWNERS;

function memberCallViolations(source: Source): string[] {
	const violations: string[] = [];
	walkScripts(source, (node) => {
		if (!ts.isCallExpression(node)) return;
		const call = referenceName(unwrap(node.expression));
		if (call === undefined) return;
		let owners: readonly string[] | undefined;
		if (call === 'window.addEventListener' && node.arguments[0] &&
			ts.isStringLiteralLike(node.arguments[0]) && ['keydown', 'keyup', 'blur'].includes(node.arguments[0].text)) {
			// Other editor/visitor lifetimes have their own keyboard surfaces.
			if (source.file.startsWith(authoringRoot + 'workspace/') || source.file.startsWith(stageRoute)) {
				owners = [stageRoute + 'stage-window-listeners.ts'];
			}
		} else {
			owners = MEMBER_CALL_OWNERS.find(({ member }) => call === member || call.endsWith(`.${member}`))?.callers;
		}
		if (owners && !owners.includes(source.file)) violations.push(`${source.file}: ${call}`);
	});
	return violations;
}

/** Importers of a named composition value, from the shared binding reader. */
function importersOf(graph: readonly Source[], name: string, owner: string): string[] {
	return graph.filter((source) => source.edges.some(({ binding, target, typeOnly }) =>
		!typeOnly && target === owner && 'imported' in binding && binding.imported === name &&
		(binding.kind === 'import-named' || binding.kind === 'export-named')
	)).map(({ file }) => file);
}

describe('call ownership', () => {
	it('keeps the listed engine operations with their declared callers (CO)', { timeout: 30_000 }, () => {
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
	it('keeps named composition values with one importer (CO)', () => {
		for (const { name, owner, callers } of IMPORT_OWNERS) {
			expect([...new Set(importersOf(sourceTree(), name, owner))].sort(), name).toEqual([...callers].sort());
		}
	});

	it('detects the former root gesture calls through renamed imports (Appendix B.2 control)', () => {
		const source = readSource(SPATIAL_ROUTE, `<script>
			import { stageKeyAction as key } from '$lib/authoring/stage/stage-input';
			import { resizeArtworkAtRay as resize } from '$lib/authoring/artwork/artwork-resize';
			import * as unfold from '$lib/layout/wall-unfold-opening-drag';
			key(event.key, { pressing });
			const candidate = resize(ray, artworkPlanePoint, drag);
			unfold['mapSheetOpeningDrag'](source, grab, event);
		</script>`);
		for (const name of ['stageKeyAction', 'resizeArtworkAtRay', 'mapSheetOpeningDrag']) {
			const [, owner] = functionOwners.find(([operation]) => operation === name)!;
			expect(sites([source], owner, name, calls), name).toEqual([SPATIAL_ROUTE]);
		}
	});
});

type Singleton = (typeof SINGLETONS)[number];

function singletonViolations(source: Source, singleton: Singleton, graph: ReadonlyMap<string, Source>) {
	if (source.file === singleton.module) return [];
	const names = bindingNames(source, singleton.module, singleton.name, graph);
	if (names.size === 0) return [];
	const owners: readonly string[] = singleton.owners;
	const isOwner = owners.includes(source.file);
	const consumers: Readonly<Record<string, readonly string[]>> = singleton.consumers;
	const permitted = consumers[source.file];
	const classes = SINGLETON_MEMBERS[singleton.name];
	const classOf = new Map<string, 'lifecycle' | 'sync' | 'intent' | 'read'>();
	for (const [kind, members] of Object.entries(classes)) {
		for (const member of members) classOf.set(member, kind as 'lifecycle' | 'sync' | 'intent' | 'read');
	}
	const violations = new Set<string>();
	const check = (object: string | undefined, member: string | undefined) => {
		if (object === undefined || !names.has(object)) return;
		if (!isOwner && (permitted === undefined || member === undefined || !permitted.includes(member))) {
			violations.add(`${source.file}: ${singleton.name}.${member ?? '*'}`);
			return;
		}
		if (member === undefined) return;
		const kind = classOf.get(member);
		if (kind === undefined) {
			violations.add(`${source.file}: ${singleton.name}.${member}`);
			return;
		}
		if (!isOwner && (kind === 'lifecycle' || kind === 'sync')) {
			violations.add(`${source.file}: ${singleton.name}.${member}`);
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
	walkMarkup(source, (node) => {
		if (node.type !== 'MemberExpression') return;
		const object = node.object as { type: string; name?: string };
		const property = node.property as { value?: unknown; name?: unknown };
		const member = node.computed ? property.value : property.name;
		if (object.type === 'Identifier') check(object.name, typeof member === 'string' ? member : undefined);
	});
	return [...violations];
}

describe('shared reading lifetimes', () => {
	it('keeps the stores private to their owners and declared member consumers (S1–S4)', { timeout: 30_000 }, () => {
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
		expect(singletonViolations(readSource(quux, code), wall, new Map())).toEqual([
			`${quux}: wallFace.clear`, `${quux}: wallFace.reframe`
		]);
	});

	it('rejects an unclassified singleton member from an owner or consumer', () => {
		const cutaway = SINGLETONS.find(({ name }) => name === 'nearWallCutaway')!;
		const owner = authoringRoot + 'stage/readings/cutaway-host.svelte.ts';
		const code = `import { nearWallCutaway } from '$lib/authoring/stage/cutaway/near-wall-cutaway.svelte';
			nearWallCutaway.quuxMember();`;
		expect(singletonViolations(readSource(owner, code), cutaway, new Map())).toEqual([
			`${owner}: nearWallCutaway.quuxMember`
		]);
	});
});

const X2_CONTROLLERS = new Set([
	stageRoute + 'stage-input.svelte.ts',
	keyboard,
	stageRoute + 'stage-unfold-gestures.svelte.ts',
	artworkInteraction
]);
const CONTROLLER_ROUTE = 'apps/editor/' + SPATIAL_ROUTE;
const posixPath = (value: string) => value.split(/[\\/]/).join('/');
const absolutePolicyPath = (entry: string): string => entry.startsWith('@portfolio/')
	? join(ROOT, '..', '..', 'packages', entry.slice('@portfolio/'.length).split('/')[0]!, 'src/index.ts')
	: entry.startsWith('packages/') ? join(ROOT, '..', '..', entry) : join(ROOT, entry);

function controllerTargets(controller: string, approved: ReadonlySet<string>): string[] {
	const root = join(ROOT, controller);
	const seen = new Set([root]);
	const pending = [root];
	const reached = new Set<string>();
	while (pending.length > 0) {
		const file = pending.pop()!;
		for (const edge of moduleBindingEdges(file, readFileSync(file, 'utf8'))) {
			if (!('specifier' in edge) || ('typeOnly' in edge && edge.typeOnly)) continue;
			const target = resolveSpecifier(file, edge.specifier);
			if (target === null || seen.has(target)) continue;
			seen.add(target);
			if (approved.has(target)) continue;
			reached.add(target);
			pending.push(target);
		}
	}
	return [...reached];
}

function forbiddenControllerEdge(controller: string, target: string): boolean {
	const editorRelative = posixPath(relative(ROOT, target));
	const repoRelative = posixPath(relativeToRepo(target));
	if (repoRelative === CONTROLLER_ROUTE) return true;
	if (CONTROLLER_FORBIDDEN_PREFIXES.some((prefix) => editorRelative.startsWith(prefix))) return true;
	if (CONTROLLER_FORBIDDEN_PACKAGES.some((entry) => repoRelative === entry)) return true;
	if (controller === epoch) return editorRelative.startsWith('src/lib/render/');
	if (controller === stageRoute + 'stage-asset-leases.svelte.ts') {
		if (editorRelative.startsWith('src/lib/render/')) return true;
		return /(?:host-acceptance|stage-adapter-host|stage-facade)\.ts$/.test(editorRelative);
	}
	if (X2_CONTROLLERS.has(controller)) {
		if (/(?:host-acceptance|stage-adapter-host|stage-facade)\.ts$/.test(editorRelative)) return true;
		if (editorRelative.startsWith('src/lib/render/')) return true;
	}
	return false;
}

/** Virtual transitive walker control, with the same edge shapes as the reader. */
function reaches(sources: Record<string, string>, root: string, forbidden: string): boolean {
	const seen = new Set<string>();
	const pending = [root];
	while (pending.length > 0) {
		const file = pending.pop()!;
		if (seen.has(file)) continue;
		seen.add(file);
		if (file === forbidden) return true;
		for (const edge of moduleBindingEdges(file, sources[file] ?? '')) {
			if (!('specifier' in edge) || ('typeOnly' in edge && edge.typeOnly === true)) continue;
			const target = posix.normalize(posix.join(posix.dirname(file), edge.specifier));
			const resolved = target in sources ? target : `${target}.ts`;
			if (resolved in sources) pending.push(resolved);
		}
	}
	return false;
}

describe('controller boundaries (Appendix B.1/B.2)', () => {
	it('keeps every extracted controller on its approved owner set', { timeout: 30_000 }, () => {
		for (const { controller, approved } of CONTROLLER_BOUNDARIES) {
			const allowed = new Set(approved.map(absolutePolicyPath));
			for (const path of allowed) expect(existsSync(path), path).toBe(true);
			expect(controllerTargets(controller, allowed).filter((target) =>
				forbiddenControllerEdge(controller, target)), controller).toEqual([]);
		}
	});

	it('cannot hide a forbidden controller edge behind a barrel, alias, namespace or dynamic import', () => {
		const sources: Record<string, string> = {
			'owner/route.ts': '',
			'owner/barrel.ts': "export { createStageAcceptanceHost as mount } from './route';",
			'owner/alias.ts': "import { createStageAcceptanceHost as mount } from './route';",
			'owner/namespace.ts': "import * as route from './route';",
			'owner/star.ts': "export * from './barrel';",
			'owner/via-star.ts': "import { mount as m } from './star';",
			'owner/dynamic.ts': "export async function load() { return import('./route'); }",
			'owner/control.ts': "import { unrelated } from './other';"
		};
		for (const file of ['owner/barrel.ts', 'owner/alias.ts', 'owner/namespace.ts', 'owner/via-star.ts', 'owner/dynamic.ts']) {
			expect(reaches(sources, file, 'owner/route.ts'), file).toBe(true);
		}
		expect(reaches(sources, 'owner/control.ts', 'owner/route.ts')).toBe(false);
	});
});

describe('Appendix B replay', () => {
	it('replays every retired route ownership control (B.1)', () => {
		const host = readSource(HOST, `import { createStageAcceptanceHost } from '$lib/authoring/stage/host-acceptance';
			export function createWorkspaceHost() {
			const acceptance = createStageAcceptanceHost({});
			async function resolveModels() { return modelPinSignature; }
			session.replace(snapshot);
			artworkScope.dispose();
			unsubscribeContributions?.();
			for (const factory of stageAdapterFactories) {}
			return { acceptance };
		}`);
		const violations = constructionViolations(host, 'createWorkspaceHost', HOST_INSTALLERS);
		expect(violations).toEqual(expect.arrayContaining([
			'factory FunctionDeclaration', 'factory ExpressionStatement', 'factory ForOfStatement'
		]));
		expect(memberCallViolations(host)).toEqual([`${HOST}: session.replace`, `${HOST}: artworkScope.dispose`]);
		expect(sites([host], stage + 'host-acceptance.ts', 'createStageAcceptanceHost', calls)).toEqual([HOST]);
	});

	it('replays the retired pointer, keyboard, Artwork and Unfold controls (B.2)', () => {
		const route = readSource(SPATIAL_ROUTE, `<script>
			import { createExperienceLens } from '$lib/authoring/experience/experience-lens.svelte';
			import { stageKeyAction } from '$lib/authoring/stage/stage-input';
			import { resizeArtworkAtRay, artworkPlanePoint } from '$lib/authoring/artwork/artwork-resize';
			import { pickWallUnfold } from '$lib/layout/wall-unfold-pick';
			import { mapSheetOpeningDrag } from '$lib/layout/wall-unfold-opening-drag';
			function onPointerDown(event) { artworkResize = null; }
			function onLostPointerCapture(event) {}
			function onWheel(event) {}
			const action = stageKeyAction(event.key, { pressing });
			function startArtworkResize(event) {}
			const candidate = resizeArtworkAtRay(ray, artworkPlanePoint, drag);
			function unfoldedPointerPress(event) { sheetOpeningDrag = null; }
			const picked = pickWallUnfold(wall, state, point);
			mapSheetOpeningDrag(source, grab, event);
			async function undo() {}
		</script>`);
		const scripts = rootScriptViolations(route);
		for (const name of ['onPointerDown', 'onLostPointerCapture', 'onWheel', 'startArtworkResize', 'unfoldedPointerPress', 'undo']) {
			expect(scripts, name).toContain('local function');
		}
		expect(sites([route], inputModule, 'stageKeyAction', calls)).toEqual([SPATIAL_ROUTE]);
		expect(sites([route], authoringRoot + 'artwork/artwork-resize.ts', 'resizeArtworkAtRay', calls)).toEqual([SPATIAL_ROUTE]);
		expect(sites([route], 'src/lib/layout/wall-unfold-pick.ts', 'pickWallUnfold', calls)).toEqual([SPATIAL_ROUTE]);
		expect(sites([route], 'src/lib/layout/wall-unfold-opening-drag.ts', 'mapSheetOpeningDrag', calls)).toEqual([SPATIAL_ROUTE]);
	});

	it('replays the retired inline Undo/Redo control (B.3)', () => {
		const component = readSource(HOST_COMPONENT, `<EditorHead onUndo={() => { finishes.card.cancel(); void stageEpoch.undo(); }} />`);
		expect(markupViolations(component, new Set(['EditorHead']))).toContain('unexpected history binding onUndo');
		const script = readSource(HOST_COMPONENT, `<script>stageEpoch.undo();</script>`);
		expect(memberCallViolations(script)).toContain(`${HOST_COMPONENT}: stageEpoch.undo`);
	});

	it('replays the retired X3 presentation controls (B.4)', () => {
		const route = readSource(SPATIAL_ROUTE, `<script>
			import { createExperienceLens } from '$lib/authoring/experience/experience-lens.svelte';
			const lens = createExperienceLens({});
			experienceLens.install();
			let indexOpen = false;
			const cardForSelection = options.selection;
			const dockEntriesFor = () => [];
		</script>
		<div class="stage-frame"></div>
		<EditorIndex {...index} /><EditorCard {...card} /><ExperienceGuide {...guide} />
		<ExperienceDock {...dock} /><StageDraftingControl {...drafting} /><StageScaleBar {...bar} />
		<StageHeightSheet {...sheet} />`);
		const scripts = rootScriptViolations(route);
		expect(scripts).toContain('root statement FirstStatement');
		expect(scripts).toContain('root const cardForSelection');
		expect(scripts).toContain('root const dockEntriesFor');
		expect(sites([route], authoringRoot + 'experience/experience-lens.svelte.ts', 'createExperienceLens', calls)).toEqual([SPATIAL_ROUTE]);
		expect(memberCallViolations(route)).toContain(`${SPATIAL_ROUTE}: experienceLens.install`);
		const markup = markupViolations(route, new Set(['WorkspaceHost']));
		expect(markup).toContain('unexpected element div');
		expect(markup.filter((violation) => violation.startsWith('unexpected component'))).toHaveLength(7);
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

function entryLifecycleSteps(file: string, core = false): Map<string, string[]> {
	const result = new Map<string, string[]>();
	const source = parse(file);
	const factory = source.statements.find(
		(statement): statement is ts.FunctionDeclaration =>
			ts.isFunctionDeclaration(statement) && statement.name?.text.startsWith('create') === true
	);
	const returned = factory?.body?.statements.at(-1);
	if (returned === undefined || !ts.isReturnStatement(returned) || returned.expression === undefined) return result;
	const object = unwrap(returned.expression);
	if (!ts.isObjectLiteralExpression(object)) return result;
	const lifecycle = object.properties.find((property): property is ts.PropertyAssignment =>
		ts.isPropertyAssignment(property) && propertyName(property.name) === 'lifecycle');
	// A feature entry nests its steps under `lifecycle`; the core owner returns
	// the step record directly.
	const steps = lifecycle === undefined ? (core ? object : undefined) : unwrap(lifecycle.initializer);
	if (steps === undefined) return result;
	if (!ts.isObjectLiteralExpression(steps)) return result;
	for (const event of steps.properties) {
		if (!ts.isPropertyAssignment(event) || propertyName(event.name) === null) continue;
		const table = unwrap(event.initializer);
		if (!ts.isObjectLiteralExpression(table)) continue;
		result.set(propertyName(event.name)!, table.properties.flatMap((step) =>
			ts.isPropertyAssignment(step) && propertyName(step.name) !== null ? [propertyName(step.name)!] : []));
	}
	return result;
}

describe('feature admission', () => {
	it('resolves every lifecycle table step to exactly one owner handler', () => {
		const declared = Object.entries(LIFECYCLE_ORDER).flatMap(([event, steps]) =>
			(steps as readonly string[]).map((step) => `${event}:${step}`));
		expect(declared.length, 'duplicate table step').toBe(new Set(declared).size);
		const registered = new Map<string, string[]>();
		for (const feature of FEATURES) {
			for (const [event, steps] of entryLifecycleSteps(feature.entry)) {
				for (const step of steps) {
					const key = `${event}:${feature.id}:${step}`;
					registered.set(key, [...(registered.get(key) ?? []), feature.id]);
				}
			}
		}
		for (const [event, steps] of entryLifecycleSteps(stageRoute + 'core-lifecycle-steps.svelte.ts', true)) {
			for (const step of steps) {
				const key = `${event}:core:${step}`;
				registered.set(key, [...(registered.get(key) ?? []), 'core']);
			}
		}
		const missing = declared.filter((step) => !registered.has(step));
		const extra = [...registered.keys()].filter((step) => !declared.includes(step));
		const duplicate = [...registered].filter(([, owners]) => owners.length !== 1).map(([step]) => step);
		expect({ missing, extra, duplicate }).toEqual({ missing: [], extra: [], duplicate: [] });
	});

	it('resolves every feature Escape rung to one entry registration', () => {
		const featureRows = ESCAPE_LADDER.filter((row) => 'feature' in row);
		for (const row of featureRows) {
			const feature = FEATURES.find(({ id }) => id === row.owner);
			expect(feature, row.rung).toBeDefined();
			const source = parse(feature!.entry);
			const factory = source.statements.find(
				(statement): statement is ts.FunctionDeclaration =>
					ts.isFunctionDeclaration(statement) && statement.name?.text.startsWith('create') === true
			);
			const returned = factory?.body?.statements.at(-1);
			const object = returned !== undefined && ts.isReturnStatement(returned) && returned.expression !== undefined
				? unwrap(returned.expression) : undefined;
			const record = object !== undefined && ts.isObjectLiteralExpression(object)
				? object.properties.find((property): property is ts.PropertyAssignment =>
					ts.isPropertyAssignment(property) && propertyName(property.name) === 'escapeRungs') : undefined;
			const rungs = record === undefined ? undefined : unwrap(record.initializer);
			const keys = rungs !== undefined && ts.isObjectLiteralExpression(rungs)
				? rungs.properties.flatMap((property) => ts.isPropertyAssignment(property) && propertyName(property.name) !== null
					? [propertyName(property.name)!] : []) : [];
			expect(keys, row.rung).toEqual([row.rung]);
		}
	});

	it('declares a handler for every built-in ladder rung in the keyboard owner', () => {
		const keyboardSource = stripComments(read(keyboard));
		for (const row of ESCAPE_LADDER) {
			if ('feature' in row) continue;
			expect(keyboardSource, row.rung).toContain(row.rung);
		}
	});

	it('declares no compatibility phases for a new capability', () => {
		expect(COMPAT_PHASES).toEqual([]);
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
