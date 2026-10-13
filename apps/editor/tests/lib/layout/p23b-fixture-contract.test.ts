import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
	compileWallFirstLayoutGeometry,
	planWallRoleChange,
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

const LEDGER_PATH = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../../../../docs/roadmap/p23b-geometry-performance/p23b.0-measurement-foundation/fixture-ledger.json');
const ledger = JSON.parse(readFileSync(LEDGER_PATH, 'utf8')) as {
	identityScope: string;
	fixtures: Array<{
		id: string;
		semanticClass: number;
		role: string;
		canonicalLayoutSha256: string;
		rawPayloadSha256: string | null;
		documentShape: ReturnType<typeof shape>;
		shippedVerdict: { codec: string; topology: string; compilerIssues: string[] };
	}>;
};

function ledgerFixture(id: string) {
	const fixture = ledger.fixtures.find((entry) => entry.id === id);
	if (!fixture) throw new Error(`Missing P23B fixture-ledger entry: ${id}`);
	return fixture;
}

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
			const fixtureShape = shape(document);
			const ledgerEntry = ledgerFixture(spec.id);
			ids.push(spec.id);
			expect(validateWallFirstLayoutDocument(document).success, spec.id).toBe(true);
			expect(validateWallFirstTopology(document), spec.id).toBeUndefined();
			expect(compiled.issues, spec.id).toEqual([]);
			expect(shape(document), spec.id).toMatchObject({
				rooms: spec.rooms,
				walls: spec.walls,
				junctions: spec.rooms * 4,
				openings: 0,
				curvedWalls: spec.curvedWalls
			});
			expect(serializeWallFirstLayoutDocument(document)).toBe(canonical);
			expect(ledgerEntry).toMatchObject({
				semanticClass: spec.semanticClass,
				role: spec.role,
				canonicalLayoutSha256: sha256(canonical),
				rawPayloadSha256: null,
				documentShape: fixtureShape,
				shippedVerdict: { codec: 'accepted', topology: 'admitted', compilerIssues: [] }
			});
		}
		expect(ids).toHaveLength(6);
		expect(new Set(ids).size).toBe(6);
		expect(P23B_MATRIX_SPECS.filter((spec) => spec.role === 'control')).toHaveLength(4);
		expect(P23B_MATRIX_SPECS.filter((spec) => spec.role === 'timing-target')).toHaveLength(2);
	});

	it('pins the CLASS 2/3/4 verdicts to the shipped codec, topology gate and compiler', () => {
		for (const spec of P23B_CORRECTNESS_SPECS) {
			const document = buildP23BCorrectnessFixture(spec);
			const canonical = serializeWallFirstLayoutDocument(document);
			const codec = validateWallFirstLayoutDocument(document);
			const topology = validateWallFirstTopology(document);
			const compiled = compileWallFirstLayoutGeometry(document);
			const fixtureShape = {
				rooms: document.rooms.length,
				walls: document.walls.length,
				junctions: document.junctions.length,
				openings: document.openings.length,
				curvedWalls: document.walls.filter((wall) => wall.centerline.kind === 'cubic-chain').length,
				centerlineKinds: document.walls.reduce<Record<string, number>>((counts, wall) => {
					counts[wall.centerline.kind] = (counts[wall.centerline.kind] ?? 0) + 1;
					return counts;
				}, {})
		};
		const ledgerEntry = ledgerFixture(spec.id);
			expect(codec.success, spec.id).toBe(true);

			if (spec.semanticClass === 2) {
				expect(topology, spec.id).toBeUndefined();
				const changed = planWallRoleChange(document, 'c-a1', 'partition');
				expect(changed.kind, spec.id).toBe('success');
				if (changed.kind === 'success') {
					expect(changed.document.rooms.map((room) => room.id), spec.id).toContain('room-k');
					expect(changed.document.objects.find((object) => object.id === 'obj-k')?.roomId, spec.id).toBe('room-k');
					expect(changed.document.openings.map((opening) => [opening.id, opening.wallId]), spec.id).toEqual([['opening:k:door:1', 'k-a1']]);
				}
			} else if (spec.id === 'N-2') {
				expect(topology, spec.id).toBeUndefined();
				expect(compiled.issues, spec.id).toEqual([]);
			} else if (spec.id === 'N-2i' || spec.id === 'class4-self-intersection-v1') {
				expect(topology?.code, spec.id).toBe('unsupported_wall_topology');
			} else if (spec.id === 'class4-component-duplicate-junction-v1') {
				expect(topology?.code, spec.id).toBe('duplicate_junction_point');
			} else if (spec.id === 'class4-open-room-boundary-v1') {
				expect(compiled.issues.length, spec.id).toBeGreaterThan(0);
			} else if (spec.id === 'class4-zero-length-wall-v1') {
				expect(topology, spec.id).toBeDefined();
			}
			expect(ledgerEntry).toMatchObject({
				semanticClass: spec.semanticClass,
				role: spec.role,
				canonicalLayoutSha256: sha256(canonical),
				rawPayloadSha256: null,
				documentShape: fixtureShape,
				shippedVerdict: {
					codec: 'accepted',
					topology: topology?.code ?? 'admitted',
					compilerIssues: compiled.issues.map((issue) => issue.code)
				}
			});
		}
		expect(ledger.identityScope).toContain('measurement provenance');
		expect(ledger.fixtures).toHaveLength(16);
		expect(new Set(ledger.fixtures.map((fixture) => fixture.id)).size).toBe(ledger.fixtures.length);
	});
});
