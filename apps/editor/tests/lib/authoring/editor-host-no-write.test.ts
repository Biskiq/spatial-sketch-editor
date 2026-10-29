/**
 * T1.P01.S02/S04 — **the editor host reaches exactly one write path**.
 *
 * The cloud API client can save a project (`PUT`), and the platform layer exports
 * pending-cloud-save helpers. T1.P01.S02's contract was a read-only boot. T1.P01.S04
 * is the owner-authorized exception: the Head mounts `T3.P01.S02`'s conditional Save,
 * so the **authorized saved-source writer** is `api.saveAcceptedSource`, and it must
 * be reached only through the Save transport (`save/api-transport.ts`). T3.P01.S04
 * adds TD-9: a Save captured before the sign-in redirect is persisted, read and
 * cleared only through the Save-owned `save/pending-capture.ts` seam, because the
 * capture must outlive a page load without becoming an automatic write. Both seams
 * are excluded from the host call-site walk and asserted positively below; the raw
 * helpers, `saveProject` and every other write path stay forbidden in host modules.
 *
 * Nothing executable can prove an absence. The writer is *reachable* (the API
 * client is a single module), an imported name is not a call, and no lane, build or
 * type check breaks when a host file stops calling the reader or starts calling a
 * writer. So this is a call-site proof over the host's real module graph — the same
 * walk `f4-public-isolation.test.ts` resolves with the shared closure reader
 * (`tests/helpers/import-closure.ts`, `tests/README.md` rule 7) — and it belongs to
 * the unconditional arch lane for the same reason that suite does.
 *
 * **Scope.** Every editor-source member of the route host's closure except the two
 * transport homes and `lib/platform/project-persistence.ts` itself. Persistence is
 * the writer's own home: the client interface declares `saveProject`, and the
 * module exports the pending-save helpers. The two Save-owned seams call those
 * helpers so no host module has to. Those modules matching the write predicate are
 * therefore expected and asserted below — the *exclusion* is deliberate, not the
 * absence.
 */
import { readFileSync, readdirSync } from 'node:fs';
import ts from 'typescript';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
	EDITOR_SRC,
	REPO_ROOT,
	importClosure,
	relativeToRepo,
	stripComments
} from '../../helpers/import-closure';

/** The stage route host — the editor's one authoring entry point. */
const ROUTE_ROOT = join(EDITOR_SRC, 'routes', 'project', '[projectId]', 'spatial', '+page.svelte');
const ROUTE_MEMBER = 'apps/editor/src/routes/project/[projectId]/spatial/+page.svelte';
const PLATFORM_PERSISTENCE_MEMBER = 'apps/editor/src/lib/platform/project-persistence.ts';
const EDITOR_SOURCE_PREFIX = 'apps/editor/src/';

/** The two Save-owned transports: the only modules that may call a raw writer. */
const AUTHORIZED_SAVE = 'saveAcceptedSource';
const SAVE_TRANSPORT_MEMBER = 'apps/editor/src/lib/authoring/save/api-transport.ts';
const PENDING_CAPTURE_MEMBER = 'apps/editor/src/lib/authoring/save/pending-capture.ts';
const TRANSPORT_MEMBERS = new Set([SAVE_TRANSPORT_MEMBER, PENDING_CAPTURE_MEMBER]);

/** The host's closure, as repository-relative paths. */
const REACHED = [...importClosure([ROUTE_ROOT])].map(relativeToRepo);

/** The members whose call sites are judged (everything editor-side but the writer's homes). */
const HOST_MEMBERS = REACHED.filter(
	(member) =>
		member.startsWith(EDITOR_SOURCE_PREFIX) &&
		member !== PLATFORM_PERSISTENCE_MEMBER &&
		!TRANSPORT_MEMBERS.has(member)
);

/** The write paths the host must never reach, even with conditional Save mounted. */
const WRITE_PATHS = ['saveProject', 'writePendingCloudSave', 'clearPendingCloudSave'] as const;

/**
 * Which write paths this source *calls*. Comments are blanked first: the host's own
 * docblock names these paths in prose, and a commented-out call is not a call.
 */
function callsIn(source: string): string[] {
	const code = stripComments(source);
	return WRITE_PATHS.filter((name) => new RegExp(`\\b${name}\\s*\\(`).test(code));
}

function sourceOf(member: string): string {
	return readFileSync(join(REPO_ROOT, member), 'utf8');
}

describe('the editor host reaches only authorized write paths', () => {
	it('walks the route host and the editor modules it mounts', () => {
		// Positive controls: the walk is real, and it is the host's own graph.
		expect(REACHED).toContain(ROUTE_MEMBER);
		expect(REACHED).toContain(PLATFORM_PERSISTENCE_MEMBER);
		expect(REACHED).toContain(SAVE_TRANSPORT_MEMBER);
		expect(REACHED).toContain(PENDING_CAPTURE_MEMBER);
		expect(REACHED).toContain('apps/editor/src/lib/authoring/stage/boot-state.ts');
		expect(REACHED).toContain('apps/editor/src/lib/authoring/stage/shell/StageCanvas.svelte');
		expect(HOST_MEMBERS.length).toBeGreaterThan(8);
		// Exactly one route is in the graph, and it is the host: route files are entry
		// points, so a second one would mean a peer route was imported.
		expect(REACHED.filter((member) => member.endsWith('+page.svelte'))).toEqual([ROUTE_MEMBER]);
	});

	it('calls no forbidden write path from the host or any editor module it mounts', () => {
		// The reader is the host's whole interaction with persistence, so a rename of it
		// cannot leave this suite approving an otherwise empty host.
		expect(/\bloadProject\s*\(/.test(stripComments(sourceOf(ROUTE_MEMBER)))).toBe(true);

		const offenders = HOST_MEMBERS.filter((member) => callsIn(sourceOf(member)).length > 0).map(
			(member) => `${member}: ${callsIn(sourceOf(member)).join(', ')}`
		);
		expect(offenders).toEqual([]);
	});

	it('mounts the one authorized Save controller on the Head', () => {
		const route = stripComments(sourceOf(ROUTE_MEMBER));
		// The exception is scoped to the Head Save mount: the route builds the epoch's
		// state machine and passes it to the Head. It must not grow a second writer.
		expect(/\bcreateSaveState\s*\(/.test(route)).toBe(true);
		expect(/\bcreateHeadSave\s*\(/.test(route)).toBe(true);
		expect(/save=\{headSave\}/.test(route)).toBe(true);
		// An accepted edit is what makes the project dirty, and the Head re-reads its
		// Save state only when that controller refreshes. The refresh must sit in the
		// acceptance subscription: without it the Head keeps reporting the pre-edit
		// status, so the unsaved-work exit and replacement guards never fire.
		expect(/mounted\.onChanged\(\(\) => \{[\s\S]{0,800}?headSave\?\.refresh\(\)/.test(route)).toBe(true);
	});

	it('reaches the authorized Save writer only through its transport module', () => {
		const calls = (member: string) =>
			new RegExp(`\\b${AUTHORIZED_SAVE}\\s*\\(`).test(stripComments(sourceOf(member)));
		// Conditional Save is mounted, so the transport must call the writer; and no
		// other host module may reach it directly.
		expect(calls(SAVE_TRANSPORT_MEMBER)).toBe(true);
		expect(HOST_MEMBERS.filter(calls)).toEqual([]);
		expect(REACHED).toContain(SAVE_TRANSPORT_MEMBER);
	});

	it('reaches the TD-9 capture only through the Save-owned pending transport', () => {
		// The route must not call the raw helpers; the capture seam is the only
		// editor module that does, and it must reach all three operations.
		expect(callsIn(sourceOf(ROUTE_MEMBER))).toEqual([]);
		expect(callsIn(sourceOf(PENDING_CAPTURE_MEMBER))).toEqual([
			'writePendingCloudSave',
			'clearPendingCloudSave'
		]);
		const route = stripComments(sourceOf(ROUTE_MEMBER));
		expect(/\bpersistPendingCapture\s*\(/.test(route)).toBe(true);
		expect(/\breadPendingCapture\s*\(/.test(route)).toBe(true);
		expect(/\bdiscardPendingCapture\s*\(/.test(route)).toBe(true);
	});

	it('would flag a write call, and does flag the writer module the walk reaches', () => {
		// The predicate detects real writer code in a module this walk reaches, so the
		// host exclusion above is a scope decision rather than a hole. `saveProject`
		// moved out of this module with T3's conditional Save; the pending-cloud-save
		// writers are still here, and both must be detected.
		expect(callsIn(sourceOf(PLATFORM_PERSISTENCE_MEMBER))).toEqual([
			'writePendingCloudSave',
			'clearPendingCloudSave'
		]);
		expect(sourceOf(PLATFORM_PERSISTENCE_MEMBER)).not.toMatch(/\bsaveProject\s*\(/);
		// And it flags a call site, which is the defect this suite exists to catch.
		expect(callsIn('await api.saveProject(project, signal)')).toEqual(['saveProject']);
		expect(callsIn('clearPendingCloudSave();')).toEqual(['clearPendingCloudSave']);
		expect(callsIn('writePendingCloudSave(storage, pending)')).toEqual(['writePendingCloudSave']);
		// Prose is not a call.
		expect(callsIn('// saveProject(project);\n/* writePendingCloudSave(storage, pending) */')).toEqual(
			[]
		);
	});
});

/** Adapter-local chronological stacks and history imports bypass F4. */
function adapterHistoryViolations(source: string, file = 'adapter.ts'): string[] {
 const code = file.endsWith('.svelte') ? [...source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((match) => match[1]).join('\n') : source;
 const tree = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
 const violations: string[] = [];
 function unwrap(expression: ts.Expression): ts.Expression {
  while (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression) || ts.isSatisfiesExpression(expression) || ts.isNonNullExpression(expression)) expression = expression.expression;
  return expression;
 }
 function arrayInitializer(expression: ts.Expression): boolean {
  const value = unwrap(expression);
  return ts.isArrayLiteralExpression(value) ||
   (ts.isNewExpression(value) && value.expression.getText(tree) === 'Array') ||
   (ts.isCallExpression(value) && value.arguments.some((argument) => ts.isArrayLiteralExpression(unwrap(argument))));
 }
 function visit(node: ts.Node): void {
  if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) && /(?:^|\/)f4\/history(?:\.ts)?$/.test(node.moduleSpecifier.text)) violations.push('history import');
  if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText(tree) === 'require') && node.arguments[0] && ts.isStringLiteral(node.arguments[0]) && /(?:^|\/)f4\/history(?:\.ts)?$/.test(node.arguments[0].text)) violations.push('history import');
  if (ts.isPropertyAssignment(node) && /(?:undo|redo)/i.test(node.name.getText(tree)) && arrayInitializer(node.initializer)) violations.push('history stack');
  if (ts.isVariableDeclaration(node) || ts.isPropertyDeclaration(node)) {
   const name = node.name.getText(tree);
   const type = node.type?.getText(tree) ?? '';
   const array = (node.initializer && arrayInitializer(node.initializer)) || /\[\]|\b(?:Readonly)?Array\s*<|(?:undo|redo)\w*stack/i.test(type);
   if (array && /(?:undo|redo)/i.test(name + ' ' + type)) violations.push('history stack');
  }
  ts.forEachChild(node, visit);
 }
 visit(tree);
 return violations;
}

describe('adapter history boundary', () => {
 it('detects private stacks and F4 history imports across adapters', () => {
  expect(adapterHistoryViolations('const undoStack = [];')).toContain('history stack');
  expect(adapterHistoryViolations('let entries: RedoEntry[] = [];')).toContain('history stack');
  expect(adapterHistoryViolations('const binding = { redoStack: [] };')).toContain('history stack');
  expect(adapterHistoryViolations('let undoStack = $state([]);')).toContain('history stack');
  expect(adapterHistoryViolations('const undoStack = [] as Entry[];')).toContain('history stack');
  expect(adapterHistoryViolations('const redoStack = $state([] as Entry[]);')).toContain('history stack');
  expect(adapterHistoryViolations('const binding = { undoStack: (([] as Entry[])) };')).toContain('history stack');
  expect(adapterHistoryViolations('const redoStack = ($state((<Entry[]>[])));')).toContain('history stack');
  expect(adapterHistoryViolations('const undoLabel = ("Undo" as string);')).toEqual([]);
  expect(adapterHistoryViolations("import { history } from '../../f4/history';")).toContain('history import');
  const root = join(EDITOR_SRC, 'lib/authoring/adapters');
  function walk(dir: string): string[] {
   return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(join(dir, entry.name)) : /\.(?:ts|svelte)$/.test(entry.name) ? [join(dir, entry.name)] : []);
  }
  for (const file of walk(root)) expect(adapterHistoryViolations(readFileSync(file, 'utf8'), file), file).toEqual([]);
 });
});
