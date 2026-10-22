import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
	compileWallFirstLayoutGeometry,
	deriveLayoutWallRoles,
	extractBoundaryCandidateFaces,
	validateWallFirstPortalRelations,
	wallFirstAdjacentRooms,
	type LayoutDocumentWallFirst
} from '@portfolio/layout-core';
import { P23B_MATRIX_SPECS, buildP23BMatrixFixture } from './__fixtures__/p23b-fixtures';

/**
 * T1.P02.S01 acceptance criterion 2 — the format 5 → 6 differential.
 *
 * The six CLASS 5 matrix fixtures were authored with `role: 'boundary'` on every
 * Wall (all-boundary kernels). Format 6 removed the field; nothing else about
 * the fixtures changed. The digests below were recorded at the base revision
 * `55683981` (the last format-5 tree) by compiling those fixtures with the
 * format-5 code, then removing the role vocabulary from the digest:
 *
 * - every compiled Wall's `role` and every compiled Junction leg's `role` are
 *   excluded (that field is the cutover itself; its new value is asserted
 *   separately below), and
 * - `cacheKey` is excluded because it is an input digest that embeds the role
 *   vocabulary (it therefore changes for every Wall/Junction when the
 *   vocabulary changes). Compiled ids, geometry, faces, Rooms, queries and
 *   portal facts are all included.
 *
 * The comparison is therefore a real pre/post differential: the expected values
 * come from the base revision's code, not from the code under test. If format 6
 * changed a polygon, a sample, a face key, a Room boundary or a portal relation
 * for an all-boundary kernel, this test fails.
 *
 * HOW THE DIGESTS WERE RECORDED (repeatable): `git archive 55683981` into a
 * scratch copy of `packages/layout-core` plus this fixture module, run the same
 * digest function below against the format-5 compiler, and pin its six outputs.
 */
const PRE_FORMAT6_DIGESTS: Record<string, string> = {
	'p23b-12-wall-straight-v1': '71a235645e2aaa67884f2dd11dfb1c82430429354866d0ada81f40504e56c3cb',
	'p23b-12-wall-target-curved-v1': '70c17f46ecc6e47792b24d11623aa9962470293b0ae764ddfe80536488645b42',
	'p23b-12-wall-all-curved-v1': '72d43fc5f8eac78c8aee9f8635158adac54297c1752d7ff5e0e53b6ff0acef31',
	'p23b-40-wall-straight-v1': '0d8886a62b6c76f80a35373eea603c421d6b9b86a19ff1a4a4e28b5ce12c4a6e',
	'p23b-40-wall-target-curved-v1': 'a8861b813d363ad767b4b0d2272524f002b386ecf541305ad13cc5fee2656c96',
	'p23b-40-wall-all-curved-v1': '8928aa74102721a17e89284a93e2bab9a5edac0e96ee82d1d4032e2844113bd8'
};

const canonical = (value: unknown): string => {
	if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
	if (value !== null && typeof value === 'object') {
		const entries = Object.entries(value as Record<string, unknown>)
			.filter(([key, entry]) => key !== 'cacheKey' && entry !== undefined)
			.sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
		return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`).join(',')}}`;
	}
	return JSON.stringify(value) ?? 'null';
};

function formatNeutralDigest(document: LayoutDocumentWallFirst): string {
	const { geometry } = compileWallFirstLayoutGeometry(document);
	const faces = extractBoundaryCandidateFaces(document).faces;
	// The two fields the cutover renames, removed so what remains is geometry.
	const walls = geometry.walls.map(({ role: _role, ...rest }) => rest);
	const junctions = (geometry.junctions ?? []).map(({ legs, ...rest }) => ({
		...rest,
		legs: legs.map(({ role: _legRole, ...leg }) => leg)
	}));
	const payload = {
		geometry: {
			walls,
			rooms: geometry.rooms,
			junctions,
			queries: geometry.queries
		},
		faces: faces.map((face) => ({
			key: face.key,
			boundary: face.boundary,
			polygon: face.polygon,
			signedArea: face.signedArea
		})),
		rooms: document.rooms,
		portals: {
			issues: validateWallFirstPortalRelations(document),
			adjacency: document.walls.map((wall) => [
				wall.id,
				[...wallFirstAdjacentRooms(document, wall.id)].sort()
			])
		}
	};
	return createHash('sha256').update(canonical(payload)).digest('hex');
}

describe('T1.P02.S01 — format 6 pre/post differential over all-boundary kernels', () => {
	for (const spec of P23B_MATRIX_SPECS) {
		it(`${spec.id}: format 6 compiles exactly as format 5 did`, () => {
			const document = buildP23BMatrixFixture(spec);
			// The premise the differential rests on: this was an all-boundary kernel,
			// so every Wall is now derived bounding and no face was gated away.
			const roles = deriveLayoutWallRoles(document);
			expect([...new Set(roles.values())]).toEqual(['bounding']);
			expect(extractBoundaryCandidateFaces(document).faces).toHaveLength(spec.rooms);

			expect(formatNeutralDigest(document)).toBe(PRE_FORMAT6_DIGESTS[spec.id]);

			// The one intended difference: the compiled vocabulary follows the
			// derived model, and the portal facts stay admitted.
			const { geometry } = compileWallFirstLayoutGeometry(document);
			expect(new Set(geometry.walls.map((wall) => wall.role))).toEqual(new Set(['bounding']));
			expect(validateWallFirstPortalRelations(document)).toEqual([]);
		});
	}
});
