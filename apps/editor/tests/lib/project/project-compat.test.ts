import { describe, expect, it } from 'vitest';

import {
	createEmptyProject,
	parseProjectJson,
	serializeProject,
	validateProject,
	ProjectValidationError
} from '$lib/project/project-codec';
import type { Project } from '$lib/project/project-types';
import { LAYOUT_WALL_FIRST_FORMAT_VERSION } from '$lib/layout/layout-wall-first-types';
import { decodeProjectCompatible } from '$lib/content/scene-format';
import { identifySceneFormat } from '$lib/content/scene-format';

function validProject(): Project {
	return createEmptyProject({ id: 'project-test', name: 'Compat Fixture' });
}

function issueCodes(result: { success: boolean; issues?: Array<{ code: string }> }): string[] {
	return result.success ? [] : result.issues!.map((issue) => issue.code);
}

describe('scene format identification (P23.0a)', () => {
	it('identifies the recognized legacy scene shape', () => {
		const project = validProject();
		const identification = identifySceneFormat(project.scene);
		expect(identification.kind).toBe('recognized-legacy');
		if (identification.kind !== 'recognized-legacy') return;
		expect(identification.sceneSpace).toBe('legacy-room-local');
	});

	it('decodes the world-local scene shape through the P23.0b decoder', () => {
		const project = validProject();
		const identification = identifySceneFormat({
			...project.scene,
			formatVersion: 1
		});
		expect(identification.kind).toBe('world-local');
		if (identification.kind !== 'world-local') return;
		expect(identification.sceneSpace).toBe('project-world');
		expect(identification.document.formatVersion).toBe(1);
	});

	it('rejects unsupported scene formatVersion values by name', () => {
		const project = validProject();
		const identification = identifySceneFormat({
			...project.scene,
			formatVersion: 7
		});
		expect(identification.kind).toBe('unrecognized');
		if (identification.kind !== 'unrecognized') return;
		expect(identification.reason).toBe('unsupported-format-version');
		expect(identification.issues[0]!.path).toBe('$.formatVersion');
	});

	it('rejects non-object scene payloads explicitly', () => {
		const identification = identifySceneFormat([1, 2, 3]);
		expect(identification.kind).toBe('unrecognized');
		if (identification.kind !== 'unrecognized') return;
		expect(identification.reason).toBe('invalid-json-payload');
	});

	it('keeps strict legacy scene validation as the recognized path', () => {
		const project = validProject();
		const identification = identifySceneFormat({ ...project.scene, units: 'feet' });
		expect(identification.kind).toBe('unrecognized');
		if (identification.kind !== 'unrecognized') return;
		expect(identification.reason).toBe('legacy-invalid');
	});
});

describe('project compatible decode (P23.0a)', () => {
	it('migrates a floorable legacy project to wall-first layout + world-local scene', () => {
		const project = validProject();
		// Give the empty project one floor with a single rectangular room so
		// migration has the frame context it needs (the empty-project case is
		// covered by the legacy-compatible test below).
		const floorable: Project = {
			...project,
			layout: {
				units: 'meters',
				floors: [
					{
						id: 'floor-1',
						name: 'Floor 1',
						elevation: 0,
						height: 3,
						rooms: [
							{
								id: 'room-a',
								name: 'A',
								frame: { origin: [0, 0], yaw: 0 },
								wallThickness: 0.2,
								floorThickness: 0.1,
								ceilingThickness: 0.1,
								boundary: {
									closed: true,
									segments: [
										{ id: 's', kind: 'line', start: [0, 0], end: [4, 0] },
										{ id: 'e', kind: 'line', start: [4, 0], end: [4, 3] },
										{ id: 'n', kind: 'line', start: [4, 3], end: [0, 3] },
										{ id: 'w', kind: 'line', start: [0, 3], end: [0, 0] }
									]
								},
								openings: []
							}
						]
					}
				],
				objects: []
			}
		};
		const decoded = decodeProjectCompatible(floorable);
		expect(decoded.kind).toBe('migrated');
		if (decoded.kind !== 'migrated') return;
		expect(decoded.sceneSpace).toBe('project-world');
		// The layout is now the wall-first shape with the floor descriptor, at
		// the current canonical format (P23.6H bumped 4 → 5).
		expect(decoded.project.layout.formatVersion).toBe(LAYOUT_WALL_FIRST_FORMAT_VERSION);
		expect(decoded.project.layout.floor.id).toBe('floor-1');
		expect(decoded.project.layout.rooms[0]!.id).toBe('room-a');
		// The scene is world-local (discriminated) with no room-bound entities.
		expect(decoded.project.scene.formatVersion).toBe(1);
		expect(decoded.project.scene.entities.every((entity) => entity.roomId === undefined)).toBe(true);
		// The migration report carries the layout lineage.
		expect(decoded.report.layout?.roomLineage).toEqual([
			{ sourceRoomId: 'room-a', targetRoomId: 'room-a' }
		]);
		expect(decoded.report.issues).toEqual([]);
	});

	it('migrates a legacy layout + already-world-local scene (scene passes through)', () => {
		const project = validProject();
		const worldScene = { ...project.scene, formatVersion: 1 as const };
		const floorable: Project = {
			...project,
			scene: worldScene,
			layout: {
				units: 'meters',
				floors: [
					{
						id: 'floor-1',
						name: 'Floor 1',
						elevation: 0,
						height: 3,
						rooms: [
							{
								id: 'room-a',
								name: 'A',
								frame: { origin: [0, 0], yaw: 0 },
								wallThickness: 0.2,
								floorThickness: 0.1,
								ceilingThickness: 0.1,
								boundary: {
									closed: true,
									segments: [
										{ id: 's', kind: 'line', start: [0, 0], end: [4, 0] },
										{ id: 'e', kind: 'line', start: [4, 0], end: [4, 3] },
										{ id: 'n', kind: 'line', start: [4, 3], end: [0, 3] },
										{ id: 'w', kind: 'line', start: [0, 3], end: [0, 0] }
									]
								},
								openings: []
							}
						]
					}
				],
				objects: []
			}
		};
		const decoded = decodeProjectCompatible(floorable);
		expect(decoded.kind).toBe('migrated');
		if (decoded.kind !== 'migrated') return;
		// The world-local scene passes through the canonical decoder (deep-equal
		// value; the decoder owns its canonical copy).
		expect(decoded.project.scene).toStrictEqual(worldScene);
	});

	it('decodes a valid legacy project as legacy-compatible with room-local sceneSpace', () => {
		const decoded = decodeProjectCompatible(validProject());
		expect(decoded.kind).toBe('legacy-compatible');
		if (decoded.kind !== 'legacy-compatible') return;
		expect(decoded.sceneSpace).toBe('legacy-room-local');
		// A floorless empty project cannot migrate (the wall-first schema
		// requires a floor descriptor the payload does not carry) — the
		// diagnostic names it and the project stays on the read-only path.
		expect(decoded.report.issues).toEqual([
			expect.objectContaining({ path: '$.layout.floors', code: 'missing_floor' })
		]);
		expect(decoded.project.id).toBe('project-test');
	});

	it('decodes JSON round-trips of the legacy shape identically', () => {
		const project = validProject();
		const json = serializeProject(project);
		const parsed = parseProjectJson(json);
		expect(parsed.success).toBe(true);

		const decoded = decodeProjectCompatible(JSON.parse(json));
		expect(decoded.kind).toBe('legacy-compatible');
	});

	it('rejects wall-first layout + legacy scene with the dedicated missing-frame-context diagnostic', () => {
		const project = validProject();
		const mixed = {
			...project,
			layout: {
				units: 'meters',
				formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
				floor: { id: 'floor', name: 'Floor', elevation: 0 },
				junctions: [],
				walls: [],
				rooms: [],
				openings: [],
				objects: []
			}
		};
		const decoded = decodeProjectCompatible(mixed);
		expect(decoded.kind).toBe('unrecognized');
		if (decoded.kind !== 'unrecognized') return;
		expect(decoded.reason).toBe('missing-legacy-room-frame-context');
		expect(decoded.issues[0]!.code).toBe('missing_legacy_room_frame_context');
	});

	it('prefixes layout identification failures at their project path', () => {
		const project = validProject();
		const decoded = decodeProjectCompatible({
			...project,
			layout: { ...project.layout, units: 'feet' }
		});
		expect(decoded.kind).toBe('unrecognized');
		if (decoded.kind !== 'unrecognized') return;
		expect(decoded.reason).toBe('layout-unrecognized');
		expect(decoded.issues).toContainEqual(
			expect.objectContaining({ path: '$.layout.units', code: 'unsupported_units' })
		);
	});

	it('prefixes scene identification failures at their project path', () => {
		const project = validProject();
		const decoded = decodeProjectCompatible({
			...project,
			scene: { ...project.scene, formatVersion: 7 }
		});
		expect(decoded.kind).toBe('unrecognized');
		if (decoded.kind !== 'unrecognized') return;
		expect(decoded.reason).toBe('scene-unrecognized');
		expect(decoded.issues).toContainEqual(
			expect.objectContaining({ path: '$.scene.formatVersion', code: 'unsupported_format_version' })
		);
	});

	it('rejects unknown root keys and invalid ids explicitly', () => {
		const project = validProject() as unknown as Record<string, unknown>;
		project.extra = true;
		const unknownKey = decodeProjectCompatible(project);
		expect(unknownKey).toMatchObject({ kind: 'unrecognized', reason: 'invalid-payload' });

		const badId = decodeProjectCompatible({ ...validProject(), id: 'bad id!' });
		expect(badId).toMatchObject({ kind: 'unrecognized', reason: 'invalid-id' });
	});

	it('does not mutate its input', () => {
		const project = validProject();
		const before = JSON.stringify(project);
		decodeProjectCompatible(project);
		expect(JSON.stringify(project)).toBe(before);
	});
});

describe('P23.1 wall-first project codec', () => {
	it('accepts the explicit wall-first project shape through the strict codec', () => {
		const project = validProject();
		const wallFirstProject = {
			...project,
			scene: { ...project.scene, formatVersion: 1 as const },
			layout: {
				units: 'meters',
				formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
				floor: { id: 'floor', name: 'Floor', elevation: 0 },
				junctions: [],
				walls: [],
				rooms: [],
				openings: [],
				objects: []
			}
		};
		const result = parseProjectJson(JSON.stringify(wallFirstProject));
		expect(result.success).toBe(true);
	});

	it('refuses a superseded wall-first version on both the read and write paths', () => {
		// P23.6I is pre-Compatibility-Baseline: the wall-first `4` generation that
		// reached `main` before this branch is **not** a supported version, so
		// neither path migrates it (`docs/reference/north-star.md` → Development-stage schema
		// compatibility). Reinterpreting the stored payload was the rejected
		// alternative — under `4` the Floor *was* the vertical authority, so reading
		// it as current state would change what the document says.
		const project = validProject();
		const superseded = {
			...project,
			scene: { ...project.scene, formatVersion: 1 as const },
			layout: {
				units: 'meters',
				formatVersion: 4,
				floor: { id: 'floor', name: 'Floor', elevation: 0, height: 3 },
				junctions: [],
				walls: [],
				rooms: [],
				openings: [],
				objects: []
			}
		};

		// Reader: rejects by name. Only the legacy (version-less) Room-owned shape
		// stays tolerant; a declared version the decoder does not implement is an
		// explicit failure rather than a silent reinterpretation.
		const read = validateProject(superseded);
		expect(read.success).toBe(false);
		expect(issueCodes(read)).toContain('unsupported_format_version');

		// Writer: the same failure, with the path prefixed onto the Layout half.
		let thrown: unknown;
		try {
			serializeProject(superseded);
		} catch (error) {
			thrown = error;
		}
		expect(thrown).toBeInstanceOf(ProjectValidationError);
		const issue = (thrown as ProjectValidationError).issue;
		expect(issue.code).toBe('unsupported_format_version');
		expect(issue.path).toBe('$.layout.formatVersion');

		// The supported shapes still round-trip: the legacy Room-owned project and
		// the canonical wall-first project both serialize.
		expect(serializeProject(validProject())).toBeTruthy();
		const canonical = {
			...project,
			scene: { ...project.scene, formatVersion: 1 as const },
			layout: {
				units: 'meters',
				formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION,
				floor: { id: 'floor', name: 'Floor', elevation: 0 },
				junctions: [],
				walls: [],
				rooms: [],
				openings: [],
				objects: []
			}
		};
		expect(validateProject(canonical).success).toBe(true);
		expect(serializeProject(canonical)).toContain(
			`"formatVersion": ${LAYOUT_WALL_FIRST_FORMAT_VERSION}`
		);
	});
});
