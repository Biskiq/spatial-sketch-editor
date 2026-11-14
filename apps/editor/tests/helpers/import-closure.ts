/**
 * §2.2 import-closure resolver (PR #115, WP0).
 *
 * Computes the transitive import closure over *tracked source* files, without a
 * bundler. It resolves the four specifier families the plan names — static,
 * type-only, dynamic and CSS imports — plus the repo's own aliases:
 *
 *   `$lib/…`                     → `apps/editor/src/lib/…`
 *   `@portfolio/<pkg>`           → `packages/<pkg>/src/index.ts`
 *
 * Bare package specifiers (`three`, `svelte`, `@threlte/…`, `$app/…`, …) are
 * externals and never enter the closure, which is what makes the closure a
 * property of this repository rather than of `node_modules`.
 *
 * Owners: WP0 manifests (`docs/archive/roadmap/parallel-track-cutover/acceptance.md`),
 * the product-side `legacy/` isolation test, and WP3R's post-prune
 * reassessment. One implementation, so a count recorded at the baseline and a
 * count taken after pruning are the same measurement.
 *
 * WP3T retired the two stale constants WP3R's t1 finding named: `MUSEUM_APP_SRC`
 * (its `apps/museum/src` root was deleted at WP2, §3.5) and the
 * `virtual:museum-editor-entry` alias with its `MuseumEditorApp.svelte` target
 * (the plugin and `lib/editor/**` went with the WP2 prune). A resolver branch
 * that can only ever return a missing path is not a guarantee, so it is gone
 * rather than repointed. No surviving consumer referenced either name (only
 * `legacy-isolation.test.ts` imports from this module, and only
 * `parseModuleSpecifiers`/`stripComments`).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'svelte/compiler';
import ts from 'typescript';

/** Repository root, derived from this file's own location (never cwd). */
export const REPO_ROOT = fileURLToPath(new URL('../../../..', import.meta.url));
/** `apps/editor` */
export const EDITOR_ROOT = path.join(REPO_ROOT, 'apps/editor');
/** `apps/editor/src` */
export const EDITOR_SRC = path.join(EDITOR_ROOT, 'src');
/** `apps/editor/src/lib` — the editor's `$lib`. */
export const EDITOR_LIB = path.join(EDITOR_SRC, 'lib');
/** `packages` — the workspace kernel packages. */
export const PACKAGES_ROOT = path.join(REPO_ROOT, 'packages');
/** `apps/editor/tests` — the test population, measured by the test manifest. */
export const EDITOR_TESTS_ROOT = path.join(EDITOR_ROOT, 'tests');

/** Resolution order for extension-less relative and alias specifiers. */
const EXTENSIONS = ['.ts', '.svelte', '.js', '.mjs', '.css', '.json', '.tsx'];

/** Strip a Vite resource query (`?url`, `?raw`, `?worker`, …) before resolving. */
function stripQuery(specifier: string): string {
	const query = specifier.indexOf('?');
	return query === -1 ? specifier : specifier.slice(0, query);
}

function isFile(candidate: string): boolean {
	try {
		return fs.statSync(candidate).isFile();
	} catch {
		return false;
	}
}

/**
 * Resolve a base path to a concrete file, trying the path as written, then
 * extensions, then index files. TypeScript sources sometimes spell a relative
 * import with the emitted `.js` extension (`./foo.js` for `foo.ts`), so a
 * `.js`/`.mjs` base is also retried as a TypeScript/Svelte source stem.
 */
function resolveFile(base: string): string | null {
	if (isFile(base)) return base;
	const stems = [base];
	if (/\.(js|mjs)$/.test(base)) stems.push(base.replace(/\.(js|mjs)$/, ''));
	for (const stem of stems) {
		for (const extension of EXTENSIONS) {
			const candidate = `${stem}${extension}`;
			if (isFile(candidate)) return candidate;
		}
		for (const extension of EXTENSIONS) {
			const candidate = path.join(stem, `index${extension}`);
			if (isFile(candidate)) return candidate;
		}
	}
	return null;
}

/** Per-app resolution roots. `$lib` and `@portfolio/*` differ per SvelteKit app. */
export interface ClosureRoots {
	/** The `$lib` directory (default: `apps/editor/src/lib`). */
	libRoot?: string;
	/** The workspace `packages` directory (default: repo `packages`). */
	packagesRoot?: string;
}

/**
 * Resolve one module specifier to an absolute source path, or `null` for an
 * external (a bare package specifier, a SvelteKit runtime virtual, …).
 */
export function resolveSpecifier(
	importer: string,
	specifier: string,
	roots: ClosureRoots = {}
): string | null {
	const libRoot = roots.libRoot ?? EDITOR_LIB;
	const packagesRoot = roots.packagesRoot ?? PACKAGES_ROOT;
	const target = stripQuery(specifier);
	if (target === '$lib') return resolveFile(libRoot);
	if (target.startsWith('$lib/')) {
		return resolveFile(path.join(libRoot, target.slice('$lib/'.length)));
	}
	if (target.startsWith('.')) {
		return resolveFile(path.resolve(path.dirname(importer), target));
	}
	if (target.startsWith('@portfolio/')) {
		const packageName = target.slice('@portfolio/'.length).split('/')[0] ?? '';
		return resolveFile(path.join(packagesRoot, packageName, 'src/index.ts'));
	}
	return null;
}

/**
 * Blank comments while leaving string and template literals intact, so a
 * multi-line `import { … } from '…'` whose member list carries `//` notes still
 * parses, while a commented-out import does not create an edge. Newlines are
 * preserved so offsets stay usable in diagnostics.
 */
export function stripComments(source: string): string {
	const out = source.split('');
	type Frame = 'code' | 'single' | 'double' | 'template' | 'line' | 'block';
	let frame: Frame = 'code';
	let i = 0;
	while (i < source.length) {
		const char = source[i]!;
		const next = source[i + 1] ?? '';
		if (frame === 'line') {
			if (char === '\n') frame = 'code';
			else out[i] = ' ';
			i += 1;
			continue;
		}
		if (frame === 'block') {
			out[i] = char === '\n' ? '\n' : ' ';
			if (char === '*' && next === '/') {
				out[i + 1] = ' ';
				frame = 'code';
				i += 2;
			} else {
				i += 1;
			}
			continue;
		}
		if (frame === 'single' || frame === 'double' || frame === 'template') {
			if (char === '\\') {
				i += 2;
				continue;
			}
			if ((frame === 'single' && char === "'") || (frame === 'double' && char === '"') || (frame === 'template' && char === '`')) {
				frame = 'code';
			}
			i += 1;
			continue;
		}
		if (char === '/' && next === '/') {
			out[i] = ' ';
			frame = 'line';
			i += 1;
			continue;
		}
		if (char === '/' && next === '*') {
			out[i] = ' ';
			out[i + 1] = ' ';
			frame = 'block';
			i += 2;
			continue;
		}
		if (char === "'") frame = 'single';
		else if (char === '"') frame = 'double';
		else if (char === '`') frame = 'template';
		i += 1;
	}
	return out.join('');
}

/**
 * Module specifiers of a source file: static `import`/`export … from`
 * (including `import type`/`export type`), bare side-effect `import '…'`,
 * literal dynamic `import('…')` and CSS `@import`. Comments are stripped
 * first, so a commented-out import is not an edge and a member list carrying
 * inline notes still parses.
 */
const STATIC_SPECIFIER =
	/(?:^|[\s;}])import\s+(?:type\s+)?(?:[\w*{},\s$]+\s+from\s+)?['"]([^'"]+)['"]/gm;
const EXPORT_SPECIFIER =
	/(?:^|[\s;}])export\s+(?:type\s+)?(?:\*(?:\s+as\s+[\w$]+)?|\{[^}]*\})\s+from\s*['"]([^'"]+)['"]/gm;
const DYNAMIC_SPECIFIER = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const CSS_IMPORT_SPECIFIER = /@import\s+(?:url\(\s*)?['"]([^'"]+)['"]/g;

/** Every module specifier written in a source string, in file order. */
export function parseModuleSpecifiers(source: string): string[] {
	const code = stripComments(source);
	const specifiers: string[] = [];
	for (const pattern of [
		STATIC_SPECIFIER,
		EXPORT_SPECIFIER,
		DYNAMIC_SPECIFIER,
		CSS_IMPORT_SPECIFIER
	]) {
		pattern.lastIndex = 0;
		for (const match of code.matchAll(pattern)) {
			if (match[1]) specifiers.push(match[1]);
		}
	}
	return specifiers;
}

/**
 * The transitive import closure of `roots`, as absolute file paths.
 *
 * The roots themselves are always members, so a closure is never empty. Only
 * files that resolve to a real path on disk are followed; externals stop the
 * walk at the boundary.
 *
 * The walk does not descend into `apps/editor/tests/**`: the test population is
 * measured separately (the WP0 test manifest), and one `/dev` perf route
 * imports a test fixture builder that is not part of the product source graph.
 */
export function importClosure(
	roots: readonly string[],
	options: ClosureRoots = {}
): Set<string> {
	const seen = new Set<string>();
	const pending = [...roots];
	while (pending.length > 0) {
		const file = pending.pop()!;
		if (seen.has(file)) continue;
		seen.add(file);
		if (!isFile(file)) continue;
		let source: string;
		try {
			source = fs.readFileSync(file, 'utf8');
		} catch {
			continue;
		}
		for (const specifier of parseModuleSpecifiers(source)) {
			const resolved = resolveSpecifier(file, specifier, options);
			if (!resolved || seen.has(resolved)) continue;
			if (resolved === EDITOR_TESTS_ROOT || resolved.startsWith(`${EDITOR_TESTS_ROOT}${path.sep}`)) continue;
			pending.push(resolved);
		}
	}
	return seen;
}

/**
 * A conservative source-level check that a directly imported controller is
 * constructed and called during initialization. It does not prove that a
 * particular behavior is wired to a live event; that requires a call-site or
 * mounted behavioral test. Svelte markup is excluded from TypeScript parsing.
 */
export function constructsImportedOwner(importer: string, source: string, owner: string, exportedName: string): boolean {
	let code = source;
	if (importer.endsWith('.svelte')) {
		const script = parse(source, { modern: true }).instance;
		if (script == null) return false;
		// The parser provides offsets on its ESTree Program at runtime, though
		// ESTree's public Program type does not require them.
		const content: typeof script.content & { start?: number; end?: number } = script.content;
		if (content.start === undefined || content.end === undefined) return false;
		code = source.slice(content.start, content.end);
	}
	const virtualFile = 'spatial-host.ts';
	const tree = ts.createSourceFile(virtualFile, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
	const options: ts.CompilerOptions = { noLib: true, noResolve: true };
	const host = ts.createCompilerHost(options);
	host.getSourceFile = (file) => file === virtualFile ? tree : undefined;
	host.fileExists = (file) => file === virtualFile;
	host.readFile = (file) => file === virtualFile ? code : undefined;
	const checker = ts.createProgram([virtualFile], options, host).getTypeChecker();
	const factories = new Set<ts.Symbol>();
	for (const statement of tree.statements) {
		if (!ts.isImportDeclaration(statement) || !statement.importClause || statement.importClause.isTypeOnly ||
			!ts.isStringLiteral(statement.moduleSpecifier) || resolveSpecifier(importer, statement.moduleSpecifier.text) !== owner) continue;
		const bindings = statement.importClause.namedBindings;
		if (!bindings || !ts.isNamedImports(bindings)) continue;
		for (const element of bindings.elements) {
			if (!element.isTypeOnly && (element.propertyName?.text ?? element.name.text) === exportedName) {
				const symbol = checker.getSymbolAtLocation(element.name);
				if (symbol) factories.add(symbol);
			}
		}
	}
	// Require an unconditional top-level construction rather than a call hidden
	// in a callback, dead branch, or short-circuit expression.
	function callsFactory(expression: ts.Expression): boolean {
		while (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isNonNullExpression(expression)) expression = expression.expression;
		return ts.isCallExpression(expression) && !expression.questionDotToken && ts.isIdentifier(expression.expression) &&
			factories.has(checker.getSymbolAtLocation(expression.expression)!);
	}
	for (const [index, statement] of tree.statements.entries()) {
		if (!ts.isVariableStatement(statement)) continue;
		for (const declaration of statement.declarationList.declarations) {
			if (!ts.isIdentifier(declaration.name) || !declaration.initializer || !callsFactory(declaration.initializer)) continue;
			const symbol = checker.getSymbolAtLocation(declaration.name);
			if (!symbol) continue;
			// A property read inside an unused callback, a conditional branch, or a
			// short circuit is not evidence the controller is invoked. Accept only a
			// direct top-level method call after the controller was constructed.
			for (const later of tree.statements.slice(index + 1)) {
				if (!ts.isExpressionStatement(later) || !ts.isCallExpression(later.expression) || later.expression.questionDotToken) continue;
				const method = later.expression.expression;
				if (!ts.isPropertyAccessExpression(method) || method.questionDotToken || !ts.isIdentifier(method.expression)) continue;
				if (checker.getSymbolAtLocation(method.expression) === symbol) return true;
			}
		}
	}
	return false;
}

/** Spatial route and its explicitly constructed extracted controllers. */
export function composedSpatialHost(): { file: string; code: string }[] {
	const route = path.join(EDITOR_SRC, 'routes/project/[projectId]/spatial/+page.svelte');
	const code = fs.readFileSync(route, 'utf8');
	const reachable = importClosure([route]);
	const controllers = [
		[path.join(EDITOR_LIB, 'authoring/experience/experience-lens.svelte.ts'), 'createExperienceLens'],
		[path.join(EDITOR_LIB, 'authoring/project-session/project-session.svelte.ts'), 'createProjectSession']
	] as const;
	const sources = [{ file: route, code }];
	for (const [file, factory] of controllers) {
		if (!reachable.has(file)) continue;
		if (!constructsImportedOwner(route, code, file, factory)) throw new Error(`Route must construct ${factory} from ${file}`);
		sources.push({ file, code: fs.readFileSync(file, 'utf8') });
	}
	// X1's controllers are constructed as typed owners and passed into the
	// existing session/epoch composition, so they have no later top-level method
	// call of their own. Require the direct factory construction and include their
	// sources in every host-wide negative check.
	const constructed = [
		[path.join(EDITOR_LIB, 'authoring/stage/route/stage-project-epoch.svelte.ts'), 'createStageProjectEpoch'],
		[path.join(EDITOR_LIB, 'authoring/stage/route/stage-asset-leases.svelte.ts'), 'createStageAssetLeases']
	] as const;
	for (const [file, factory] of constructed) {
		if (!reachable.has(file)) throw new Error(`Route must import ${factory} from ${file}`);
		if (!new RegExp(`const\\s+[\\w$]+\\s*=\\s*${factory}\\s*\\(`).test(code)) {
			throw new Error(`Route must construct ${factory} from ${file}`);
		}
		if (!sources.some((source) => source.file === file)) {
			sources.push({ file, code: fs.readFileSync(file, 'utf8') });
		}
	}
	// Markup and helpers reached by either extracted owner remain inside host-wide
	// negative checks, even when they are not controller factories. Do not add
	// a named controller twice if it was already included above.
	const ownerDirs = [
		path.join(EDITOR_LIB, 'authoring/experience'),
		path.join(EDITOR_LIB, 'authoring/project-session')
	];
	for (const file of reachable) {
		if (ownerDirs.some((dir) => file.startsWith(`${dir}${path.sep}`)) && /\.(svelte|ts)$/.test(file) &&
			!sources.some((source) => source.file === file)) {
			sources.push({ file, code: fs.readFileSync(file, 'utf8') });
		}
	}
	return sources;
}

/** Recursively collect files under `root` (skips dotfiles). */
export function listSourceFiles(root: string): string[] {
	const files: string[] = [];
	const pending = [root];
	while (pending.length > 0) {
		const entry = pending.pop()!;
		let stat: fs.Stats;
		try {
			stat = fs.statSync(entry);
		} catch {
			continue;
		}
		if (stat.isDirectory()) {
			for (const child of fs.readdirSync(entry)) {
				if (child.startsWith('.')) continue;
				pending.push(path.join(entry, child));
			}
		} else if (stat.isFile()) {
			files.push(entry);
		}
	}
	return files;
}

/** Repository-relative path, useful for manifest rows and diagnostics. */
export function relativeToRepo(absolutePath: string): string {
	return path.relative(REPO_ROOT, absolutePath).split(path.sep).join('/');
}

/** Line count of a file, matching `wc -l` (a trailing newline is not a line). */
export function lineCount(file: string): number {
	const source = fs.readFileSync(file, 'utf8');
	if (source.length === 0) return 0;
	let lines = 0;
	for (let i = 0; i < source.length; i += 1) if (source[i] === '\n') lines += 1;
	// `wc -l` counts newlines; a non-empty file without a trailing newline has
	// one final partial line.
	return source.endsWith('\n') ? lines : lines + 1;
}

/**
 * One module-level binding edge, read from the TypeScript AST (E4).
 *
 * `named` imports and re-exports keep the exported name they read; a namespace
 * import, `export *` and a dynamic `import()` cannot be narrowed to names, so a
 * boundary must treat them as reaching every export of their target.
 *
 * A namespace edge also carries the **local** name it binds (`import * as THREE
 * from 'three'`), because a caller-qualified construction such as
 * `new THREE.MeshBasicMaterial(...)` is only matchable through that name. An
 * aliased namespace is the same edge with a different `local`.
 */
export type ModuleBindingEdge =
	| { readonly kind: 'import-named'; readonly specifier: string; readonly imported: string; readonly local: string; readonly typeOnly: boolean }
	| { readonly kind: 'import-namespace'; readonly specifier: string; readonly local: string; readonly typeOnly: boolean }
	| { readonly kind: 'export-named'; readonly specifier: string; readonly imported: string; readonly exported: string; readonly typeOnly: boolean }
	| { readonly kind: 'export-local'; readonly local: string; readonly exported: string }
	| { readonly kind: 'export-all'; readonly specifier: string }
	| { readonly kind: 'dynamic'; readonly specifier: string };

/** The script of a `.svelte` file (instance and module), or the source of a TS module. */
function scriptSources(file: string, source: string): string[] {
	if (!file.endsWith('.svelte')) return [source];
	const parsed = parse(source, { modern: true });
	const scripts: string[] = [];
	for (const script of [parsed.module, parsed.instance]) {
		// The parser provides offsets on its ESTree Program at runtime (see above).
		const content = script?.content as { start?: number; end?: number } | undefined;
		if (content?.start !== undefined && content.end !== undefined) scripts.push(source.slice(content.start, content.end));
	}
	return scripts;
}

/** Every import/re-export edge a module declares, with the names it binds. */
export function moduleBindingEdges(file: string, source: string): ModuleBindingEdge[] {
	const edges: ModuleBindingEdge[] = [];
	for (const code of scriptSources(file, source)) {
		const tree = ts.createSourceFile('module.ts', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
		const visit = (node: ts.Node): void => {
			if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
				const specifier = node.moduleSpecifier.text;
				const clause = node.importClause;
				const clauseTypeOnly = clause?.isTypeOnly ?? false;
				if (clause?.name) edges.push({ kind: 'import-named', specifier, imported: 'default', local: clause.name.text, typeOnly: clauseTypeOnly });
				const bindings = clause?.namedBindings;
				if (bindings && ts.isNamespaceImport(bindings)) {
					edges.push({ kind: 'import-namespace', specifier, local: bindings.name.text, typeOnly: clauseTypeOnly });
				}
				if (bindings && ts.isNamedImports(bindings)) {
					for (const element of bindings.elements) {
						edges.push({
							kind: 'import-named',
							specifier,
							imported: element.propertyName?.text ?? element.name.text,
							local: element.name.text,
							typeOnly: clauseTypeOnly || element.isTypeOnly
						});
					}
				}
			} else if (ts.isExportDeclaration(node)) {
				const specifier = node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) ? node.moduleSpecifier.text : null;
				const clause = node.exportClause;
				if (specifier !== null && clause === undefined) edges.push({ kind: 'export-all', specifier });
				else if (specifier !== null && clause && ts.isNamespaceExport(clause)) edges.push({ kind: 'export-all', specifier });
				else if (clause && ts.isNamedExports(clause)) {
					for (const element of clause.elements) {
						const imported = element.propertyName?.text ?? element.name.text;
						if (specifier === null) edges.push({ kind: 'export-local', local: imported, exported: element.name.text });
						else edges.push({ kind: 'export-named', specifier, imported, exported: element.name.text, typeOnly: node.isTypeOnly || element.isTypeOnly });
					}
				}
			} else if (
				ts.isCallExpression(node) &&
				node.expression.kind === ts.SyntaxKind.ImportKeyword &&
				node.arguments[0] !== undefined &&
				ts.isStringLiteralLike(node.arguments[0])
			) {
				edges.push({ kind: 'dynamic', specifier: node.arguments[0].text });
			}
			ts.forEachChild(node, visit);
		};
		visit(tree);
	}
	return edges;
}
