/**
 * E4 / I2 — one canonical session-less read of compiled Layout geometry.
 *
 * `compileWallFirstLayoutGeometry(document)` returns the result recorded for
 * that exact frozen document object instead of compiling again; an unfrozen or
 * a distinct (even equal) document compiles. Records with issues are read back
 * but never seed a store. `compileWallFirstLayoutGeometryFresh` is the cold
 * oracle and never reads a record. Counts come from the production `countWork`
 * seam.
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
	clearWallSamplingObserverForTest,
	compileWallFirstLayoutGeometry,
	compileWallFirstLayoutGeometryFresh,
	createLayoutCompileSession,
	readPassiveCompiledGeometry,
	setWallSamplingObserverForTest,
	type LayoutDocumentWallFirst
} from '@portfolio/layout-core';

import { addOpenings, buildGrid, sequentialCaptures } from '../../../perf/lib/workloads/grid';
import { startStageCounting, type StageCounting } from '../../helpers/stage-counts';

let counting: StageCounting | null = null;
afterEach(() => {
	counting?.stop();
	counting = null;
	clearWallSamplingObserverForTest();
});

function grid(prefix: string): LayoutDocumentWallFirst {
	const captures = sequentialCaptures(prefix);
	return addOpenings(buildGrid(2, captures), captures);
}

function deepFreeze<T>(value: T): T {
	if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
		for (const child of Object.values(value)) deepFreeze(child);
		Object.freeze(value);
	}
	return value;
}

/** A document with an issue: one Opening placed beyond its Wall. */
function issueBearing(prefix: string): LayoutDocumentWallFirst {
	const document = structuredClone(grid(prefix)) as { openings: { offset: number }[] };
	document.openings[0]!.offset = 1000;
	return document as unknown as LayoutDocumentWallFirst;
}

describe('E4/I2 — canonical session-less read', () => {
	it('a frozen document compiles once; the second read returns the same geometry and a fresh issue array', () => {
		const document = deepFreeze(grid('e4-read-frozen'));
		counting = startStageCounting();
		const first = compileWallFirstLayoutGeometry(document);
		expect(counting.count('compile:walls')).toBe(document.walls.length);
		counting.reset();
		const second = compileWallFirstLayoutGeometry(document);
		expect(counting.count('compile:walls')).toBe(0);
		expect(counting.count('compile:passive-read')).toBe(1);
		expect(second.geometry).toBe(first.geometry);
		expect(second.issues).not.toBe(first.issues);
		expect(second.issues).toEqual(first.issues);
	});

	it('a record written before the document was frozen is never served', () => {
		const document = grid('e4-read-late-freeze');
		compileWallFirstLayoutGeometry(document);
		deepFreeze(document);
		counting = startStageCounting();
		compileWallFirstLayoutGeometry(document);
		expect(counting.count('compile:walls')).toBe(document.walls.length);
		counting.reset();
		compileWallFirstLayoutGeometry(document);
		expect(counting.count('compile:walls')).toBe(0);
	});

	it('a shallow-frozen document is never served: only a deep immutable proof seals a record', () => {
		const document = grid('e4-read-shallow');
		const authored = document.walls[0]!.thickness;
		const changed = authored === 0.5 ? 0.6 : 0.5;
		// `Object.isFrozen` is shallow: this says nothing about the Walls it holds.
		Object.freeze(document);
		const first = compileWallFirstLayoutGeometry(document);
		expect(readPassiveCompiledGeometry(document)?.sealed).toBe(false);
		expect(first.geometry.walls!.every((wall) => wall.thickness === authored)).toBe(true);
		document.walls[0]!.thickness = changed;
		counting = startStageCounting();
		const second = compileWallFirstLayoutGeometry(document);
		expect(counting.count('compile:walls')).toBe(document.walls.length);
		expect(counting.count('compile:passive-read')).toBe(0);
		expect(second.geometry).not.toBe(first.geometry);
		expect(second.geometry.walls!.some((wall) => wall.thickness === changed)).toBe(true);
		expect(
			compileWallFirstLayoutGeometryFresh(document).geometry.walls!.some((wall) => wall.thickness === changed)
		).toBe(true);
	});

	it('an unfrozen document, or a distinct equal frozen document, compiles', () => {
		const open = grid('e4-read-open');
		counting = startStageCounting();
		compileWallFirstLayoutGeometry(open);
		counting.reset();
		compileWallFirstLayoutGeometry(open);
		expect(counting.count('compile:walls')).toBe(open.walls.length);
		expect(counting.count('compile:passive-read')).toBe(0);

		const a = deepFreeze(grid('e4-read-equal'));
		const b = deepFreeze(grid('e4-read-equal'));
		expect(JSON.stringify(a)).toBe(JSON.stringify(b));
		compileWallFirstLayoutGeometry(a);
		counting.reset();
		const fromB = compileWallFirstLayoutGeometry(b);
		expect(counting.count('compile:walls')).toBe(b.walls.length);
		expect(fromB.geometry).not.toBe(compileWallFirstLayoutGeometry(a).geometry);
	});

	it('reuses an issue-bearing frozen document but never seeds a store from it', () => {
		const document = deepFreeze(issueBearing('e4-read-issues'));
		const first = compileWallFirstLayoutGeometry(document);
		expect(first.issues.length).toBeGreaterThan(0);
		counting = startStageCounting();
		const second = compileWallFirstLayoutGeometry(document);
		expect(counting.count('compile:walls')).toBe(0);
		expect(second.geometry).toBe(first.geometry);
		expect(second.issues).toEqual(first.issues);

		const session = createLayoutCompileSession();
		expect(session.seedFromCompiled(document)).toBe(false);
		expect(session.retained().walls).toBe(0);
	});

	it('a sampling test observer bypasses the record', () => {
		const document = deepFreeze(grid('e4-read-observer'));
		compileWallFirstLayoutGeometry(document);
		setWallSamplingObserverForTest(() => undefined);
		counting = startStageCounting();
		compileWallFirstLayoutGeometry(document);
		expect(counting.count('compile:walls')).toBe(document.walls.length);
		expect(counting.count('compile:passive-read')).toBe(0);
	});

	it('the fresh entry is a cold oracle: it never reads a session record', () => {
		const document = deepFreeze(grid('e4-read-oracle'));
		const session = createLayoutCompileSession();
		const fromSession = session.compile(document);
		expect(compileWallFirstLayoutGeometry(document).geometry).toBe(fromSession.geometry);
		counting = startStageCounting();
		const cold = compileWallFirstLayoutGeometryFresh(document);
		expect(counting.count('compile:walls')).toBe(document.walls.length);
		expect(cold.geometry).not.toBe(fromSession.geometry);
		expect(JSON.stringify(cold.geometry)).toBe(JSON.stringify(fromSession.geometry));
	});
});
