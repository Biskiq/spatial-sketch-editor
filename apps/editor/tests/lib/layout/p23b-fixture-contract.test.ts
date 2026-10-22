/**
 * P23B durable fixture contracts.
 *
 * The fixtures are deterministic constructors; what this suite pins is their
 * durable identity: the canonical Layout serialization digest, the document
 * shape, and the shipped codec/topology/compiler verdict of every committed
 * fixture.
 *
 * The expectations are test-owned data (`./__fixtures__/p23b-verdicts`). They
 * used to be read out of the P23B roadmap fixture ledger, which coupled the
 * suite to a measurement document: the ledger's class/role bookkeeping and its
 * machine/session provenance described a recorded measurement, not a product
 * guarantee (plan §7.6 area 4). Nothing here depends on `docs/` any more, so
 * WP4 can delete the ledger.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
	compileWallFirstLayoutGeometry,
	planDeleteWall,
	serializeWallFirstLayoutDocument,
	validateWallFirstLayoutDocument,
	validateWallFirstTopology
} from '@portfolio/layout-core';
import {
	buildP23BCorrectnessFixture,
	buildP23BMatrixFixture,
	P23B_CORRECTNESS_SPECS,
	P23B_MATRIX_SPECS
} from './__fixtures__/p23b-fixtures';
import {
	P23B_CORRECTNESS_VERDICTS,
	P23B_MATRIX_VERDICTS,
	p23bCorrectnessVerdict,
	p23bMatrixVerdict
} from './__fixtures__/p23b-verdicts';
import { freshCapture } from './__fixtures__/layout-id-capture';

function sha256(value: string | Uint8Array): string {
	return createHash('sha256').update(value).digest('hex');
}

function shape(document: ReturnType<typeof buildP23BMatrixFixture>) {
	const centerlineKinds = document.walls.reduce<Record<string, number>>((counts, wall) => {
		counts[wall.centerline.kind] = (counts[wall.centerline.kind] ?? 0) + 1;
		return counts;
	}, {});
	return {
		rooms: document.rooms.length,
		walls: document.walls.length,
		junctions: document.junctions.length,
		openings: document.openings.length,
		curvedWalls: document.walls.filter((wall) => wall.centerline.kind === 'cubic-chain').length,
		centerlineKinds
	};
}

describe('P23B durable fixture contracts', () => {
	it('constructs six stable CLASS 5 matrix cells with exact shape and clean shipped gates', () => {
		const ids: string[] = [];
		for (const spec of P23B_MATRIX_SPECS) {
			const document = buildP23BMatrixFixture(spec);
			const canonical = serializeWallFirstLayoutDocument(document);
			const compiled = compileWallFirstLayoutGeometry(document);
			const verdict = p23bMatrixVerdict(spec.id);
			ids.push(spec.id);
			// The shipped gates accept every matrix cell, and the expectation says
			// so too — a cell that started refusing would fail here.
			expect(validateWallFirstLayoutDocument(document).success, spec.id).toBe(true);
			expect(validateWallFirstTopology(document), spec.id).toBeUndefined();
			expect(compiled.issues, spec.id).toEqual([]);
			expect(verdict.topology, spec.id).toBe('admitted');
			expect(verdict.compilerIssues, spec.id).toEqual([]);
			// Exact document shape and canonical identity, not a subset match.
			expect(shape(document), spec.id).toEqual(verdict.shape);
			expect(sha256(canonical), spec.id).toBe(verdict.canonicalSha256);
			// Canonical serialization is a function of the document, not the call.
			expect(serializeWallFirstLayoutDocument(document), spec.id).toBe(canonical);
		}
		// Fixtures and expectations are one-to-one: a fixture with no expectation,
		// or a stale expectation with no fixture, fails here.
		expect(Object.keys(P23B_MATRIX_VERDICTS).sort()).toEqual(
			P23B_MATRIX_SPECS.map((spec) => spec.id).sort()
		);
		expect(ids).toHaveLength(6);
		expect(new Set(ids).size).toBe(6);
	});

	it('pins the CLASS 2/3/4 verdicts to the shipped codec, topology gate and compiler', () => {
		const visited: string[] = [];
		for (const spec of P23B_CORRECTNESS_SPECS) {
			const verdict = p23bCorrectnessVerdict(spec.id);
			const document = buildP23BCorrectnessFixture(spec);
			const canonical = serializeWallFirstLayoutDocument(document);
			const codec = validateWallFirstLayoutDocument(document);
			const topology = validateWallFirstTopology(document);
			const compiled = compileWallFirstLayoutGeometry(document);
			visited.push(spec.id);

			expect(codec.success, spec.id).toBe(true);
			expect(shape(document), spec.id).toEqual(verdict.shape);
			expect(sha256(canonical), spec.id).toBe(verdict.canonicalSha256);
			// The shipped gate this row pins: `admitted`, or the rejection code.
			expect(topology?.code ?? 'admitted', spec.id).toBe(verdict.topology);
			expect(compiled.issues.map((issue) => issue.code), spec.id).toEqual(verdict.compilerIssues);

			if (spec.id.startsWith('d12-')) {
				// D-12 identity: a role change keeps the unrelated Room's id, the
				// object's ownership and the Opening's host.
				expect(topology, spec.id).toBeUndefined();
				const changed = planDeleteWall(document, 'c-a1', freshCapture());
				expect(changed.kind, spec.id).toBe('success');
				if (changed.kind === 'success') {
					expect(changed.document.rooms.map((room) => room.id), spec.id).toContain('room-k');
					expect(
						changed.document.objects.find((object) => object.id === 'obj-k')?.roomId,
						spec.id
					).toBe('room-k');
					expect(
						changed.document.openings.map((opening) => [opening.id, opening.wallId]),
						spec.id
					).toEqual([['opening:k:door:1', 'k-a1']]);
				}
				continue;
			}
			if (spec.id === 'N-2') {
				// The admitted independent-component crossing: no topology refusal
				// and a clean compile.
				expect(topology, spec.id).toBeUndefined();
				expect(compiled.issues, spec.id).toEqual([]);
				continue;
			}
			if (
				spec.id === 'N-2i' ||
				spec.id === 'class4-self-intersection-v1' ||
				spec.id === 'class4-open-room-boundary-v1'
			) {
				expect(topology?.code, spec.id).toBe('unsupported_wall_topology');
			} else if (spec.id === 'class4-component-duplicate-junction-v1') {
				expect(topology?.code, spec.id).toBe('duplicate_junction_point');
			} else if (spec.id === 'class4-zero-length-wall-v1') {
				expect(topology, spec.id).toBeDefined();
			}
		}
		// Fixtures and expectations are one-to-one in both directions.
		expect(Object.keys(P23B_CORRECTNESS_VERDICTS).sort()).toEqual(
			P23B_CORRECTNESS_SPECS.map((spec) => spec.id).sort()
		);
		expect(visited).toHaveLength(P23B_CORRECTNESS_SPECS.length);
		expect(new Set(visited).size).toBe(visited.length);
	});
});
