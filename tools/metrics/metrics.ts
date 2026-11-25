/**
 * Locality metrics and the shrink-only budget check (LOC-0).
 *
 * One reader produces the section 3 tables — file and function sizes, `export *`
 * statements, exported test seams, cross-package re-exports, package import
 * cycles and the representative read sets — and one checker compares a
 * measurement with `budgets.json`. The arch test calls the checker; the CLI
 * reports the tables.
 *
 * Shrink-only means the budget is also a proof that it was updated: an entry
 * whose subject no longer offends fails the check until it is removed, and a
 * count below the budget fails until the budget is lowered. A packet can
 * therefore delete an exception but never add one silently.
 *
 * Usage:
 *   npx vite-node tools/metrics/metrics.ts                 # section 3 tables
 *   npx vite-node tools/metrics/metrics.ts --check          # budget only
 *   npx vite-node tools/metrics/metrics.ts --json out.json
 *   npx vite-node tools/metrics/metrics.ts --write-budget   # regenerate allowlist
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const BUDGET_PATH = path.join(REPO_ROOT, 'tools/metrics/budgets.json');
const PRODUCTION_EXTENSIONS = new Set(['.ts', '.tsx', '.svelte', '.js', '.mjs']);

/** The editor app and both kernel package roots; tests and tools stay out. */
function productionRoots(): string[] {
	return [
		path.join(REPO_ROOT, 'apps/editor/src'),
		path.join(REPO_ROOT, 'apps/api/src'),
		...readdirSync(path.join(REPO_ROOT, 'packages'))
			.map((name) => path.join(REPO_ROOT, 'packages', name, 'src'))
			.filter((root) => {
				try {
					return statSync(root).isDirectory();
				} catch {
					return false;
				}
			})
	];
}

function walk(root: string): string[] {
	const files: string[] = [];
	const pending = [root];
	while (pending.length > 0) {
		const entry = pending.pop()!;
		let stat;
		try {
			stat = statSync(entry);
		} catch {
			continue;
		}
		if (stat.isDirectory()) {
			for (const child of readdirSync(entry)) {
				if (child.startsWith('.') || child === 'node_modules') continue;
				pending.push(path.join(entry, child));
			}
		} else if (stat.isFile() && PRODUCTION_EXTENSIONS.has(path.extname(entry))) {
			files.push(entry);
		}
	}
	return files.sort();
}

export function relative(file: string): string {
	return path.relative(REPO_ROOT, file).split(path.sep).join('/');
}

/** `wc -l`: newlines count, and a final unterminated line counts once. */
export function lineCount(source: string): number {
	if (source.length === 0) return 0;
	let lines = 0;
	for (const char of source) if (char === '\n') lines += 1;
	return source.endsWith('\n') ? lines : lines + 1;
}

/**
 * Top-level function spans, measured to the closing brace at the same indent.
 * Declarations and `const` arrow/function assignments both count; a closure
 * factory is one function, as section 5 rule 2 requires.
 */
export function functionSizes(source: string): { name: string; line: number; lines: number }[] {
	const lines = source.split('\n');
	const results: { name: string; line: number; lines: number }[] = [];
	const declaration =
		/^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*(?:<[^>]*>)?\s*\(/;
	const assignment =
		/^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*(?::[^=]+)?=>|[A-Za-z_$][\w$]*\s*=>)/;
	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index]!;
		if (/^\s/.test(line)) continue;
		const match = declaration.exec(line) ?? assignment.exec(line);
		if (!match) continue;
		const body = collectBody(lines, index);
		if (body === null) continue;
		const linesInBody = body.end - index + 1;
		if (linesInBody >= 120) results.push({ name: match[1]!, line: index + 1, lines: linesInBody });
		index = Math.max(index, body.end);
	}
	return results;
}

/** Find the statement's brace-balanced end, ignoring strings and comments. */
function collectBody(lines: string[], start: number): { end: number } | null {
	let depth = 0;
	let opened = false;
	for (let index = start; index < lines.length; index += 1) {
		const code = stripLine(lines[index]!);
		for (const char of code) {
			if (char === '{') {
				depth += 1;
				opened = true;
			} else if (char === '}') {
				depth -= 1;
				if (opened && depth === 0) {
					// A one-line declaration is the whole function.
					return { end: index };
				}
				if (depth < 0) return null;
			}
		}
		// A one-line `const x = () => value;` has no body braces and is not a
		// long function; stop rather than absorbing the rest of the file.
		if (!opened && index > start + 40) return null;
	}
	return null;
}

function stripLine(line: string): string {
	return line
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.replace(/\/\/.*$/, '')
		.replace(/'(?:[^'\\]|\\.)*'/g, "''")
		.replace(/"(?:[^"\\]|\\.)*"/g, '""')
		.replace(/`(?:[^`\\]|\\.)*`/g, '``');
}

// ---------------------------------------------------------------------------
// Import edges

const IMPORT_PATTERN =
	/(?:^|[\s;}])import\s+(?:type\s+)?(?:[\w*{},\s$]+\s+from\s+)?['"]([^'"]+)['"]|(?:^|[\s;}])export\s+(?:type\s+)?(?:\*(?:\s+as\s+[\w$]+)?|\{[^}]*\})\s*from\s*['"]([^'"]+)['"]/gm;

function specifiers(source: string): string[] {
	const found: string[] = [];
	for (const match of source.matchAll(IMPORT_PATTERN)) found.push(match[1] ?? match[2]!);
	return found;
}

function resolveLocal(importer: string, specifier: string): string | null {
	const target = specifier.replace(/\?.*$/, '');
	const base = target.startsWith('$lib/')
		? path.join(REPO_ROOT, 'apps/editor/src/lib', target.slice(5))
		: target.startsWith('.')
			? path.resolve(path.dirname(importer), target)
			: null;
	if (base === null) return null;
	for (const candidate of [base, `${base}.ts`, `${base}.svelte`, `${base}.js`, `${base}/index.ts`]) {
		try {
			if (statSync(candidate).isFile()) return candidate;
		} catch {
			// try the next candidate
		}
	}
	return null;
}

// ---------------------------------------------------------------------------

export type Measurement = {
	files: { path: string; lines: number }[];
	functions: { file: string; name: string; line: number; lines: number }[];
	exportStars: number;
	crossPackageReexports: number;
	seams: string[];
	cycles: string[][];
};

export function measure(): Measurement {
	const files: { path: string; lines: number }[] = [];
	const functions: { file: string; name: string; line: number; lines: number }[] = [];
	let exportStars = 0;
	let crossPackageReexports = 0;
	const seams = new Set<string>();
	const graph = new Map<string, Set<string>>();
	const packageRoot = path.join(REPO_ROOT, 'packages') + path.sep;

	for (const file of productionRoots().flatMap(walk)) {
		const source = readFileSync(file, 'utf8');
		const rel = relative(file);
		files.push({ path: rel, lines: lineCount(source) });
		for (const entry of functionSizes(source)) functions.push({ file: rel, ...entry });

		const edges = specifiers(source);
		for (const specifier of edges) {
			const resolved = resolveLocal(file, specifier);
			if (resolved) {
				const set = graph.get(file) ?? new Set<string>();
				set.add(resolved);
				graph.set(file, set);
			}
		}
		if (file.startsWith(packageRoot)) {
			for (const match of source.matchAll(/^export\s+(?:type\s+)?\*\s*(?:as\s+[\w$]+\s*)?from\s*['"]([^'"]+)['"]/gm)) {
				exportStars += 1;
				if (match[1]!.startsWith('@portfolio/')) crossPackageReexports += 1;
			}
		}
		if (file.startsWith(packageRoot)) {
			for (const name of exportedNames(source)) {
				if (/(?:ForTest|ForTests)$/.test(name) || /^__.*Tests?$/.test(name)) seams.add(`${rel}#${name}`);
			}
		}
	}
	functions.sort((a, b) => b.lines - a.lines);
	// Family cycles are cycles between a package's subpath entry modules. A
	// same-package file pair that imports in both directions is not a family
	// cycle; LOC-1 gives families their own entry points, and this check then
	// guards the registry that joins them.
	const entries = new Map([...graph].filter(([file]) => file.endsWith('index.ts')));
	return { files, functions, exportStars, crossPackageReexports, seams: [...seams].sort(), cycles: findCycles(entries) };
}

function exportedNames(source: string): string[] {
	const names: string[] = [];
	for (const match of source.matchAll(/^export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/gm)) {
		names.push(match[1]!);
	}
	return names;
}

function findCycles(graph: Map<string, Set<string>>): string[][] {
	const cycles: string[][] = [];
	const state = new Map<string, 'active' | 'done'>();
	const stack: string[] = [];
	const visit = (node: string): void => {
		if (state.get(node) === 'done') return;
		if (state.get(node) === 'active') {
			const start = stack.indexOf(node);
			if (start >= 0) cycles.push(stack.slice(start).map(relative));
			return;
		}
		state.set(node, 'active');
		stack.push(node);
		for (const next of graph.get(node) ?? []) visit(next);
		stack.pop();
		state.set(node, 'done');
	};
	for (const node of graph.keys()) visit(node);
	return cycles;
}

// ---------------------------------------------------------------------------

export type Budgets = {
	generatedFrom: string;
	counts: {
		filesOver600: number;
		filesOver1000: number;
		filesOver1500: number;
		functionsOver200: number;
		exportStars: number;
		crossPackageReexports: number;
		seams: number;
	};
	files: { path: string; lines: number; reason: string }[];
	functions: { file: string; name: string; line: number; lines: number; reason: string }[];
	seams: string[];
};

export function readBudgets(): Budgets {
	return JSON.parse(readFileSync(BUDGET_PATH, 'utf8')) as Budgets;
}

const REASON =
	'Baseline exception recorded by LOC-0; the owning split packet removes this entry.';

export function writeBudgets(measurement: Measurement, previous?: Budgets): Budgets {
	const oldFiles = new Map((previous?.files ?? []).map((entry) => [entry.path, entry.reason]));
	const oldFunctions = new Map((previous?.functions ?? []).map((entry) => [`${entry.file}#${entry.name}`, entry.reason]));
	const budgets: Budgets = {
		generatedFrom: 'LOC-0 baseline; shrink-only from here',
		counts: {
			filesOver600: measurement.files.filter((file) => file.lines > 600).length,
			filesOver1000: measurement.files.filter((file) => file.lines > 1000).length,
			filesOver1500: measurement.files.filter((file) => file.lines > 1500).length,
			functionsOver200: measurement.functions.filter((entry) => entry.lines > 200).length,
			exportStars: measurement.exportStars,
			crossPackageReexports: measurement.crossPackageReexports,
			seams: measurement.seams.length
		},
		files: measurement.files
			.filter((file) => file.lines > 600)
			.sort((a, b) => b.lines - a.lines || a.path.localeCompare(b.path))
			.map((file) => ({ ...file, reason: oldFiles.get(file.path) ?? REASON })),
		functions: measurement.functions
			.filter((entry) => entry.lines > 200)
			.map((entry) => ({ ...entry, reason: oldFunctions.get(`${entry.file}#${entry.name}`) ?? REASON })),
		seams: measurement.seams
	};
	return budgets;
}

export type BudgetFailure = { rule: string; detail: string };

export function check(measurement: Measurement, budgets: Budgets): BudgetFailure[] {
	const failures: BudgetFailure[] = [];
	const over600 = measurement.files.filter((file) => file.lines > 600);
	const over1000 = measurement.files.filter((file) => file.lines > 1000);
	const over1500 = measurement.files.filter((file) => file.lines > 1500);
	const over200 = measurement.functions.filter((entry) => entry.lines > 200);

	const allowedFiles = new Map(budgets.files.map((entry) => [entry.path, entry]));
	for (const file of over600) {
		const allowed = allowedFiles.get(file.path);
		if (!allowed) failures.push({ rule: 'files', detail: `${file.path} is ${file.lines} lines and is not budgeted` });
		else if (file.lines > allowed.lines) {
			failures.push({ rule: 'files', detail: `${file.path} grew from ${allowed.lines} to ${file.lines} lines` });
		}
	}
	for (const entry of budgets.files) {
		const measured = measurement.files.find((file) => file.path === entry.path);
		if (!measured) failures.push({ rule: 'files', detail: `budgeted file ${entry.path} no longer exists` });
		else if (measured.lines <= 600) {
			failures.push({ rule: 'files', detail: `${entry.path} is now ${measured.lines} lines; remove its budget entry` });
		} else if (measured.lines < entry.lines) {
			failures.push({ rule: 'files', detail: `${entry.path} shrank to ${measured.lines} lines; lower its budget` });
		}
	}

	const allowedFunctions = new Map(budgets.functions.map((entry) => [`${entry.file}#${entry.name}`, entry]));
	for (const entry of over200) {
		const allowed = allowedFunctions.get(`${entry.file}#${entry.name}`);
		if (!allowed) failures.push({ rule: 'functions', detail: `${entry.file}#${entry.name} is ${entry.lines} lines and is not budgeted` });
		else if (entry.lines > allowed.lines) {
			failures.push({ rule: 'functions', detail: `${entry.file}#${entry.name} grew from ${allowed.lines} to ${entry.lines} lines` });
		}
	}
	for (const entry of budgets.functions) {
		const measured = over200.find((candidate) => candidate.file === entry.file && candidate.name === entry.name);
		if (!measured) {
			failures.push({ rule: 'functions', detail: `${entry.file}#${entry.name} is no longer over 200 lines; remove its budget entry` });
		} else if (measured.lines < entry.lines) {
			failures.push({ rule: 'functions', detail: `${entry.file}#${entry.name} shrank to ${measured.lines} lines; lower its budget` });
		}
	}

	const counts: [keyof Budgets['counts'], number][] = [
		['filesOver600', over600.length],
		['filesOver1000', over1000.length],
		['filesOver1500', over1500.length],
		['functionsOver200', over200.length],
		['exportStars', measurement.exportStars],
		['crossPackageReexports', measurement.crossPackageReexports]
	];
	for (const [key, value] of counts) {
		if (value > budgets.counts[key]) failures.push({ rule: 'counts', detail: `${key} is ${value}, above the budget ${budgets.counts[key]}` });
		if (value < budgets.counts[key]) failures.push({ rule: 'counts', detail: `${key} is ${value}; lower the budget from ${budgets.counts[key]}` });
	}

	const seamSet = new Set(measurement.seams);
	const budgetSeams = new Set(budgets.seams);
	for (const seam of seamSet) if (!budgetSeams.has(seam)) failures.push({ rule: 'seams', detail: `new exported test seam ${seam}` });
	for (const seam of budgetSeams) if (!seamSet.has(seam)) failures.push({ rule: 'seams', detail: `seam ${seam} is gone; remove it from the budget` });
	if (measurement.cycles.length > 0) {
		for (const cycle of measurement.cycles) failures.push({ rule: 'cycles', detail: `import cycle: ${cycle.join(' -> ')}` });
	}
	return failures;
}

// ---------------------------------------------------------------------------
// Representative read sets

const READ_SET_MODULES = [
	'packages/layout-core/src/precision/scalar-edits.ts',
	'packages/project-model/src/scene-planning/finish/index.ts',
	'packages/project-model/src/units/validate/camera.ts',
	'packages/project-model/src/units/planning/experience/stop.ts',
	'apps/editor/src/lib/authoring/look/finish-authoring.svelte.ts',
	'apps/editor/src/lib/authoring/adapters/layout/precision.ts',
	'apps/api/src/app.ts'
];

export function readSets(): { module: string; own: number; definers: number; definerFiles: number }[] {
	return READ_SET_MODULES.map((module) => {
		const absolute = path.join(REPO_ROOT, module);
		let source = '';
		try {
			source = readFileSync(absolute, 'utf8');
		} catch {
			return { module, own: 0, definers: 0, definerFiles: 0 };
		}
		const definers = new Set<string>();
		for (const specifier of specifiers(source)) {
			const resolved = resolveLocal(absolute, specifier);
			if (resolved) definers.add(resolved);
		}
		let definerLines = 0;
		for (const file of definers) definerLines += lineCount(readFileSync(file, 'utf8'));
		return { module, own: lineCount(source), definers: definerLines, definerFiles: definers.size };
	});
}

// ---------------------------------------------------------------------------

function report(measurement: Measurement): void {
	const over = (limit: number) => measurement.files.filter((file) => file.lines > limit);
	console.log(`production files: ${measurement.files.length}, ${measurement.files.reduce((sum, file) => sum + file.lines, 0)} lines`);
	console.log(`files > 600 / 1000 / 1500: ${over(600).length} / ${over(1000).length} / ${over(1500).length}`);
	console.log(`functions > 200 lines: ${measurement.functions.filter((entry) => entry.lines > 200).length}`);
	console.log(`export *: ${measurement.exportStars}; cross-package re-exports: ${measurement.crossPackageReexports}`);
	console.log(`exported test seams: ${measurement.seams.length}; import cycles: ${measurement.cycles.length}`);
	console.log('read sets (module, own, direct definers, definer files):');
	for (const row of readSets()) console.log(`  ${row.module} ${row.own} ${row.definers} ${row.definerFiles}`);
}

function main(): void {
	const argv = process.argv.slice(2);
	if (argv.includes('--check')) {
		const failures = check(measure(), readBudgets());
		if (failures.length > 0) {
			for (const failure of failures) console.error(`[${failure.rule}] ${failure.detail}`);
			process.exitCode = 1;
			return;
		}
		console.log('locality budgets: ok');
		return;
	}
	if (argv.includes('--write-budget')) {
		const previous = (() => {
			try {
				return readBudgets();
			} catch {
				return undefined;
			}
		})();
		writeFileSync(BUDGET_PATH, `${JSON.stringify(writeBudgets(measure(), previous), null, 2)}\n`);
		console.log(`locality budgets: wrote ${BUDGET_PATH}`);
		return;
	}
	const measurement = measure();
	report(measurement);
	const jsonIndex = argv.indexOf('--json');
	if (jsonIndex >= 0 && argv[jsonIndex + 1]) {
		writeFileSync(path.resolve(REPO_ROOT, argv[jsonIndex + 1]!), `${JSON.stringify(measurement, null, 2)}\n`);
	}
}

if (!process.env.VITEST) main();
