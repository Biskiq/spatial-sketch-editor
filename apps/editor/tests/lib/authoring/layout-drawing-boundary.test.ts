/**
 * X5 — Layout drawing and Opening placement ownership (`layout-drawing-boundary`).
 *
 * The Ink drawing controller and the Opening placement controller own the
 * one-operation state machines (draft, capture, in-flight guard, press lease,
 * preview, typed entry, re-arm). The adapter owns registration and dispatch and
 * the adapter-lifetime defaults; it must not grow the state machine back, and
 * the controllers must not grow an authority of their own.
 *
 * Source-level facts, because a second copy of an in-flight guard or capture
 * compiles, passes the type checker and only fails at runtime, in a stranded
 * lease or a doubled write. Direct imports are read with the shared AST reader,
 * so aliases, namespaces, re-exports and dynamic imports all count.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
	EDITOR_LIB,
	moduleBindingEdges,
	relativeToRepo,
	stripComments,
	type ModuleBindingEdge
} from '../../helpers/import-closure';

const ADAPTERS = path.join(EDITOR_LIB, 'authoring/adapters');
const LAYOUT_DIR = path.join(ADAPTERS, 'layout');
const ADAPTER = path.join(ADAPTERS, 'layout.adapter.ts');
const INK = path.join(LAYOUT_DIR, 'ink-session.ts');
const OPENING = path.join(LAYOUT_DIR, 'opening-placement-session.ts');
const PORTS = path.join(LAYOUT_DIR, 'session-ports.ts');
const POINTER = path.join(LAYOUT_DIR, 'stage-pointer.ts');

/** What each extracted module may execute or name; everything else is a new dependency. */
const ALLOWED_IMPORTS: Readonly<Record<string, ReadonlySet<string>>> = {
	[INK]: new Set([
		'@portfolio/layout-core',
		'$lib/authoring/stage/stage-adapter-host',
		'./candidate-preview',
		'./chain',
		'./drawing-planners',
		'./ink',
		'./opening-placement-session',
		'./precision',
		'./session-ports',
		'./snap',
		'./stage-pointer'
	]),
	[OPENING]: new Set([
		'@portfolio/layout-core',
		'$lib/authoring/stage/stage-adapter-host',
		'./candidate-preview',
		'./ink',
		'./opening-planners',
		'./layout-subjects',
		'./precision',
		'./session-ports',
		'./stage-pointer'
	]),
	[PORTS]: new Set([
		'@portfolio/layout-core',
		'$lib/authoring/stage/stage-adapter-host',
		'./candidate-preview',
		'./candidate-presenter',
		'./ink'
	]),
	[POINTER]: new Set(['@portfolio/layout-core', '$lib/authoring/stage/stage-adapter-host', './ink'])
};

/**
 * Identifiers that name the retired in-adapter state machine. Each is now owned by
 * exactly one controller, so a re-declaration in the adapter is a second owner.
 */
const RETIRED_IN_ADAPTER = [
	'chainCommitInFlight',
	'openingCommitInFlight',
	'chainCapture',
	'openingCapture',
	'inkPress',
	'openingPress',
	'inkProposal',
	'inkPreview',
	'openingPreview',
	'openingCandidate',
	'rearmInkAfterInstall',
	'rearmEpoch',
	'commitChainOnce',
	'commitOpening',
	'inkTargetAt',
	'refreshInkPreview',
	'openingCandidateAt',
	'planOpeningCandidate',
	'snapshotForPalette',
	'inkReading',
	'inkWallMode',
	'inkThickness',
	'inkHeight',
	'openingOptions',
	'openingOptionsValid',
	'openingHostId'
] as const;

/** Planner entries the controllers alone call to author a drawing or an Opening. */
const CONTROLLER_ONLY_PLANNERS = ['wallChainCommitIntent', 'circleRoomCreateIntent', 'openingCreateIntent'] as const;

const read = (file: string) => fs.readFileSync(file, 'utf8');
const edgesOf = (file: string, source = read(file)): readonly ModuleBindingEdge[] => moduleBindingEdges(file, source);
/** The edges that name another module; a local re-export names none. */
const moduleEdgesOf = (file: string, source = read(file)) =>
	edgesOf(file, source).flatMap((edge) => (edge.kind === 'export-local' ? [] : [edge]));
const wordIn = (source: string, word: string) => new RegExp(`\\b${word}\\b`).test(stripComments(source));

/** Every edge, executable or type-only, that names a module outside the allowance. */
function disallowedImports(file: string, source: string, allowed: ReadonlySet<string>): string[] {
	return moduleEdgesOf(file, source)
		.filter((edge) => !allowed.has(edge.specifier))
		.map((edge) => `${edge.kind} '${edge.specifier}'`);
}

/** The retired identifiers a source still mentions. */
function retiredMentions(source: string): string[] {
	return RETIRED_IN_ADAPTER.filter((word) => wordIn(source, word));
}

describe('layout-drawing-boundary', () => {
	it('keeps each controller to its named dependencies', () => {
		const offenders = Object.entries(ALLOWED_IMPORTS).flatMap(([file, allowed]) =>
			disallowedImports(file, read(file), allowed).map((edge) => `${relativeToRepo(file)} — ${edge}`)
		);
		expect(offenders).toEqual([]);
	});

	it('never lets Opening placement reach the Ink controller, nor Ink execute the Opening controller', () => {
		expect(moduleEdgesOf(OPENING).some((edge) => edge.specifier === './ink-session')).toBe(false);
		const inkToOpening = moduleEdgesOf(INK).filter((edge) => edge.specifier === './opening-placement-session');
		expect(inkToOpening.length).toBeGreaterThan(0);
		expect(inkToOpening.every((edge) => 'typeOnly' in edge && edge.typeOnly === true)).toBe(true);
	});

	it('leaves no retired drawing or Opening state machine in the adapter', () => {
		expect(retiredMentions(read(ADAPTER))).toEqual([]);
	});

	it('keeps the in-flight guards and captures each in exactly one controller', () => {
		const inkSource = stripComments(read(INK));
		const openingSource = stripComments(read(OPENING));
		const declares = (source: string, name: string) => new RegExp(`\\blet ${name}\\b`).test(source);
		expect(declares(inkSource, 'chainCommitInFlight')).toBe(true);
		expect(declares(inkSource, 'chainCapture')).toBe(true);
		expect(declares(inkSource, 'inkPress')).toBe(true);
		expect(declares(openingSource, 'openingCommitInFlight')).toBe(true);
		expect(declares(openingSource, 'openingCapture')).toBe(true);
		expect(declares(openingSource, 'openingPress')).toBe(true);
		for (const name of ['chainCommitInFlight', 'chainCapture', 'inkPress', 'inkProposal']) {
			expect(declares(openingSource, name)).toBe(false);
		}
		for (const name of ['openingCommitInFlight', 'openingCapture', 'openingPress', 'rearmEpoch']) {
			expect(declares(inkSource, name)).toBe(false);
		}
	});

	it('leaves the planner entries to the controllers and keeps registration in the adapter', () => {
		const adapterEdges = edgesOf(ADAPTER);
		const named = new Set(adapterEdges.flatMap((edge) => (edge.kind === 'import-named' ? [edge.imported] : [])));
		expect(CONTROLLER_ONLY_PLANNERS.filter((name) => named.has(name))).toEqual([]);
		const adapterSource = stripComments(read(ADAPTER));
		expect(adapterSource.match(/\bcreateInkSession\(/g)?.length).toBe(1);
		expect(adapterSource.match(/\bcreateOpeningPlacementSession\(/g)?.length).toBe(1);
	});

	it('keeps adapter-lifetime defaults in the adapter and captured state in the bindings', () => {
		const adapterSource = stripComments(read(ADAPTER));
		const memoryAt = adapterSource.indexOf('createInkMemory()');
		const bindAt = adapterSource.indexOf('bind(context');
		expect(memoryAt).toBeGreaterThan(-1);
		expect(bindAt).toBeGreaterThan(memoryAt);
		expect(adapterSource.match(/\bcreateInkMemory\(/g)?.length).toBe(1);
		for (const file of [INK, OPENING]) expect(wordIn(read(file), 'createInkMemory')).toBe(false);
		// The sessions are created per binding, so each is built after `bind(`.
		expect(adapterSource.indexOf('createInkSession(')).toBeGreaterThan(bindAt);
		expect(adapterSource.indexOf('createOpeningPlacementSession(')).toBeGreaterThan(bindAt);
	});

	it('fails a regrown state machine, a stray import and a controller that executes its sibling', () => {
		expect(retiredMentions('let chainCommitInFlight = false;\nfunction commitOpening() {}')).toEqual([
			'chainCommitInFlight',
			'commitOpening'
		]);
		expect(retiredMentions('// let chainCommitInFlight = false; documented only')).toEqual([]);
		const stray = "import { acceptIntent } from '../stage/host-acceptance';\nexport const x = acceptIntent;";
		expect(disallowedImports(OPENING, stray, ALLOWED_IMPORTS[OPENING]!)).toEqual(["import-named '../stage/host-acceptance'"]);
		const barrel = "export * from '../layout.adapter';";
		expect(disallowedImports(INK, barrel, ALLOWED_IMPORTS[INK]!)).toEqual(["export-all '../layout.adapter'"]);
		const dynamic = "export const load = () => import('./ink-session');";
		expect(disallowedImports(OPENING, dynamic, ALLOWED_IMPORTS[OPENING]!)).toEqual(["dynamic './ink-session'"]);
	});
});
