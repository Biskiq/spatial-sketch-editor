/**
 * X9 ownership guards: feature entry contract (EC1–EC4), compatibility phases,
 * meaningful workspace composition and the Material editor mount condition.
 *
 * These are positive checks over the manifest. They fail on a new responsibility
 * regardless of its name, which is what the retired route blacklists could not do.
 */
import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { COMPAT_PHASES, FEATURES } from './integration-ownership.manifest';

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

	it('never imports a sibling sub-owner at runtime (EC4)', () => {
		for (const feature of FEATURES) {
			const siblings = new Set(feature.subOwners.map((path) => join(ROOT, path)));
			for (const owner of feature.subOwners) {
				if (!existsSync(join(ROOT, owner)) || !owner.endsWith('.ts') || owner.endsWith('.svelte.ts')) {
					// Svelte modules are parsed as their script content by svelte-check;
					// runtime sibling imports there are caught by the entry's imports.
				}
				const source = parse(owner);
				for (const statement of source.statements) {
					if (!ts.isImportDeclaration(statement) || statement.importClause?.isTypeOnly) continue;
					if (!statement.moduleSpecifier || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
					const specifier = statement.moduleSpecifier.text;
					if (!specifier.startsWith('.')) continue;
					const base = resolve(ROOT, dirname(owner), specifier);
					for (const resolved of [base, `${base}.ts`, `${base}.svelte.ts`]) {
						if (siblings.has(resolved) && resolved !== join(ROOT, owner)) {
							expect.fail(`${feature.id}: ${owner} imports sibling ${resolved} at runtime`);
						}
					}
				}
			}
		}
	});
});

describe('authority uniqueness', () => {
	const AUTHORITIES = [
		'createStageProjectEpoch',
		'createStageAssetLeases',
		'createStageSession',
		'createStageFacade',
		'createStagePressTracker',
		'createStageInputArbiter',
		'createStageKeyboard',
		'createStageUnfoldGestures',
		'createStageArtworkInteraction',
		'createStageExperienceBinding',
		'createExperienceLens',
		'createExperiencePlayback',
		'createStageSelectionView',
		'createStageHistoryCommand',
		'createStageWindowListeners',
		'createFeatureLifecycle',
		'createStudioController',
		'createFinishAuthoring'
	];

	function sourceFiles(path: string): string[] {
		return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
			const next = join(path, entry.name);
			if (entry.isDirectory()) return sourceFiles(next);
			return entry.name.endsWith('.ts') || entry.name.endsWith('.svelte') ? [next] : [];
		});
	}

	it('constructs each authority exactly once anywhere in src', () => {
		const files = sourceFiles(join(ROOT, 'src'));
		for (const authority of AUTHORITIES) {
			const pattern = new RegExp(`(?:=\\s*|=>\\s*|return\\s+)${authority}\\s*\\(`, 'g');
			const sites = files.flatMap((file) => {
				const count = readFileSync(file, 'utf8').match(pattern)?.length ?? 0;
				return count === 0 ? [] : [`${file.slice(ROOT.length + 1)} ×${count}`];
			});
			expect(sites, authority).toHaveLength(1);
		}
	});

	it('keeps every feature entry out of another feature at runtime (D2)', () => {
		const members = FEATURES.flatMap((feature) => [
			feature.entry,
			...feature.subOwners,
			...feature.regions,
			feature.viewType
		]);
		for (const feature of FEATURES) {
			const source = parse(feature.entry);
			for (const statement of source.statements) {
				if (!ts.isImportDeclaration(statement) || statement.importClause?.isTypeOnly) continue;
				if (!statement.moduleSpecifier || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
				const specifier = statement.moduleSpecifier.text;
				if (!specifier.startsWith('.')) continue;
				const base = resolve(ROOT, dirname(feature.entry), specifier);
				for (const resolved of [base, `${base}.ts`, `${base}.svelte.ts`]) {
					const other = members.find((member) => resolve(ROOT, member) === resolved && !feature.subOwners.includes(member) && member !== feature.entry);
					if (other !== undefined) expect.fail(`${feature.id} imports ${other} at runtime`);
				}
			}
		}
	});
});

const PHASE_OWNERS: Record<string, string> = {
	appearance: 'appearance',
	readings: 'layout-readings',
	artwork: 'artwork'
};

function phaseCalls(host: string, owners: Record<string, string> = PHASE_OWNERS) {
	return [...host.matchAll(/\b([A-Za-z_$][\w$]*)\.(attach[A-Z][\w$]*)\(\);/g)].map((match) => ({
		owner: owners[match[1]!] ?? match[1]!,
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

	it('names the mounted proof and Appendix A row for each phase', () => {
		for (const phase of COMPAT_PHASES) {
			expect(phase.appendix).toMatch(/^A\d+[a-z]?$/);
			expect(phase.proof.length).toBeGreaterThan(20);
		}
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
			'canShowEditor: () => preview === null && experience.lensState === \'world\' && adapterServices !== null'
		);
	});
});
