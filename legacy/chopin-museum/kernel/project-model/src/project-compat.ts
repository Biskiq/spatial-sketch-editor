/**
 * `project-compat.ts` — P23.0b explicit Project-level compatible decode.
 *
 * Combines the Layout and Scene format identification boundaries into one
 * decode result for a whole saved Project (`{ id, name, layout, scene }`).
 * The Project root itself does **not** carry a second schema number: nested
 * Layout/Scene compatibility is delegated to their shared decoders (H5 §10.1).
 *
 * Decode matrix (P23.0 child plan, "Compatible decode result"):
 *
 * ```text
 * legacy layout + legacy scene   → migrated (lossless) | legacy-compatible
 *                                  (migration rejected → read-only compat,
 *                                  diagnostics in the report)
 * legacy layout + world scene    → migrated   (scene is already world-local;
 *                                  only the Layout converts)
 * wall-first layout + legacy scene → unrecognized
 *                                  (`missing-legacy-room-frame-context`:
 *                                  a wall-first project no longer carries
 *                                  the Room frames that give legacy
 *                                  room-local Scene values meaning — H5
 *                                  provenance rules, never guessed)
 * wall-first layout + world scene → wall-first (direct canonical decode)
 * mixed unrecognized either side → named per-side rejection
 * ```
 *
 * `migrated` results carry the full migration report (wall/opening/room
 * lineage + diagnostics); runtime preparation consumes `sceneSpace` to know
 * whether Scene values still require Room-frame resolution.
 */
import {
	decodeLayoutValueCompatible,
	migrateLegacyLayoutDocument,
	type CompatibleLayoutDecode,
	type LayoutDocument,
	type LayoutDocumentWallFirst,
	type LegacyLayoutMigrationReport
} from '@portfolio/layout-core';
import type { ProjectIssue } from './project-types';
import { identifySceneFormat, type SceneFormatIdentification } from './scene-format';
import { convertSceneDocumentToWorldLocal } from './scene-world-conversion';
import { createLayoutRoomRegistry, validateProjectSceneRooms } from './project-layout-semantics';
import type { SceneDocument } from './scene';

/** Project payload shape shared by every success variant. */
export type CompatibleProjectPayload = {
	id: string;
	name: string;
	/** Canonical wall-first Layout (decoded directly or migrated). */
	layout: LayoutDocumentWallFirst;
	/** Canonical world-local Scene (decoded directly or converted). */
	scene: SceneDocument;
};

export type WallFirstProjectDecode = {
	kind: 'wall-first';
	project: CompatibleProjectPayload;
	sceneSpace: 'project-world';
};

export type MigratedProjectDecode = {
	kind: 'migrated';
	project: CompatibleProjectPayload;
	report: ProjectMigrationReport;
	sceneSpace: 'project-world';
};

export type LegacyCompatibleProjectDecode = {
	kind: 'legacy-compatible';
	project: {
		id: string;
		name: string;
		/** Legacy Room-owned Layout document, kept as decoded. */
		layout: LayoutDocument;
		/** Scene document as decoded (legacy room-local or already world-local). */
		scene: SceneDocument;
	};
	/**
	 * Migration was attempted and rejected; the project stays on the
	 * read-only compatibility path with the diagnostics that name why.
	 */
	report: ProjectMigrationReport;
	/**
	 * The Scene document's coordinate space. Usually `legacy-room-local`
	 * (the classic legacy-compatible project); `project-world` occurs when a
	 * legacy Layout could not migrate but the Scene was already world-local.
	 * Runtime preparation branches on this exactly once.
	 */
	sceneSpace: 'legacy-room-local' | 'project-world';
};

export type UnrecognizedProjectDecode = {
	kind: 'unrecognized';
	reason:
		| 'invalid-payload'
		| 'invalid-id'
		| 'invalid-name'
		| 'layout-unrecognized'
		| 'scene-unrecognized'
		| 'mixed-format-unsupported'
		| 'missing-legacy-room-frame-context';
	issues: ProjectIssue[];
};

/**
 * Explicit compatible-decode result. Every generation pair has exactly one
 * named outcome; downstream runtime preparation branches once on
 * `sceneSpace` (never re-derives format state from field shapes).
 */
export type CompatibleProjectDecode =
	| WallFirstProjectDecode
	| MigratedProjectDecode
	| LegacyCompatibleProjectDecode
	| UnrecognizedProjectDecode;

/** Deterministic migration/identification diagnostics. Not persisted truth. */
export type ProjectDecodeReport = {
	issues: ProjectIssue[];
};

/** Full migration report for `migrated` / `legacy-compatible` results. */
export type ProjectMigrationReport = {
	issues: ProjectIssue[];
	/** Present when Layout migration was attempted (success or rejection). */
	layout?: LegacyLayoutMigrationReport;
};

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

/**
 * Decode a whole Project payload with explicit format identification.
 *
 * Accepts an already-parsed value (project codec seam). JSON-string input
 * should go through the caller's JSON parse so `invalid_json` failures keep
 * their existing project-codec semantics.
 */
export function decodeProjectCompatible(input: unknown): CompatibleProjectDecode {
	if (typeof input !== 'object' || input === null || Array.isArray(input)) {
		return {
			kind: 'unrecognized',
			reason: 'invalid-payload',
			issues: [{ path: '$', code: 'invalid_type', message: 'Expected a project object' }]
		};
	}
	const record = input as Record<string, unknown>;
	for (const key of Object.keys(record)) {
		if (key !== 'id' && key !== 'name' && key !== 'layout' && key !== 'scene') {
			return {
				kind: 'unrecognized',
				reason: 'invalid-payload',
				issues: [
					{ path: `$.${key}`, code: 'unknown_key', message: `Unknown key '${key}'` }
				]
			};
		}
	}

	const id = record.id;
	if (typeof id !== 'string' || !ID_PATTERN.test(id)) {
		return {
			kind: 'unrecognized',
			reason: 'invalid-id',
			issues: [
				{
					path: '$.id',
					code: 'invalid_id',
					message: 'Expected an ID matching /^[A-Za-z0-9][A-Za-z0-9._:-]*$/'
				}
			]
		};
	}
	const name = record.name;
	if (typeof name !== 'string' || name.trim().length === 0) {
		return {
			kind: 'unrecognized',
			reason: 'invalid-name',
			issues: [{ path: '$.name', code: 'invalid_value', message: 'Expected a non-empty name' }]
		};
	}
	if (record.layout === undefined || record.scene === undefined) {
		return {
			kind: 'unrecognized',
			reason: 'invalid-payload',
			issues: [
				{
					path: '$',
					code: 'missing_field',
					message: 'Expected both layout and scene documents'
				}
			]
		};
	}

	const layout = decodeLayoutValueCompatible(record.layout);
	const scene = identifySceneFormat(record.scene);

	if (layout.kind === 'unrecognized') {
		return {
			kind: 'unrecognized',
			reason: 'layout-unrecognized',
			issues: layout.issues.map((issue) => prefixIssue('$.layout', issue))
		};
	}
	if (scene.kind === 'unrecognized') {
		return {
			kind: 'unrecognized',
			reason: 'scene-unrecognized',
			issues: scene.issues.map((issue) => prefixIssue('$.scene', issue))
		};
	}

	// --- wall-first layout + world-local scene: direct canonical decode -----
	if (layout.kind === 'wall-first' && scene.kind === 'world-local') {
		return {
			kind: 'wall-first',
			project: { id, name, layout: layout.document, scene: scene.document },
			sceneSpace: 'project-world'
		};
	}

	// --- wall-first layout + legacy scene: untrustworthy frame context ------
	// A wall-first Layout no longer carries the Room frames that give legacy
	// room-local Scene values meaning. H5 provenance rules forbid guessing
	// (no ID matching, no identity transforms); a future explicit
	// user-supplied frame mapping import UI is the only sanctioned path.
	if (layout.kind === 'wall-first' && scene.kind === 'recognized-legacy') {
		return {
			kind: 'unrecognized',
			reason: 'missing-legacy-room-frame-context',
			issues: [
				{
					path: '$.scene',
					code: 'missing_legacy_room_frame_context',
					message:
						'Legacy room-local Scene values cannot be converted against a wall-first Layout: the source Room frames are not carried by this payload and must not be guessed'
				}
			]
		};
	}

	// --- legacy layout: migrate (scene may be legacy or already world) ------
	if (layout.kind === 'legacy') {
		const migration = migrateLegacyLayoutDocument(layout.document);
		if (migration.kind === 'rejected') {
			// Compatibility path: keep both legacy documents as decoded, name
			// the rejection, stay read-only (P23.0 "Read-only legacy
			// compatibility path").
			return {
				kind: 'legacy-compatible',
				project: {
					id,
					name,
					layout: layout.document,
					scene: scene.document
				},
				report: {
					issues: migration.issues.map((issue) => prefixIssue('$.layout', issue))
				},
				sceneSpace:
					scene.kind === 'recognized-legacy' ? ('legacy-room-local' as const) : ('project-world' as const)
			};
		}
		if (scene.kind === 'recognized-legacy') {
			// Scene conversion happens against the *trusted legacy* registry —
			// built from the pre-migration legacy Layout (H5 provenance rule 1),
			// before Room frames stop being authoritative. Dangling `roomId`
			// references cannot convert (no frame to resolve through, and
			// guessing is forbidden), so the project stays on the read-only
			// compatibility path with diagnostics instead of throwing.
			const registry = createLayoutRoomRegistry(layout.document);
			const referenceIssues = validateProjectSceneRooms(scene.document, registry);
			if (referenceIssues.length > 0) {
				return {
					kind: 'legacy-compatible',
					project: {
						id,
						name,
						layout: layout.document,
						scene: scene.document
					},
					report: {
						issues: referenceIssues
					},
					sceneSpace: 'legacy-room-local' as const
				};
			}
			const worldScene = convertSceneDocumentToWorldLocal(scene.document, registry);
			return {
				kind: 'migrated',
				project: {
					id,
					name,
					layout: migration.document,
					scene: worldScene
				},
				report: {
					issues: [],
					layout: migration.report
				},
				sceneSpace: 'project-world'
			};
		}
		// Legacy layout + already world-local scene: Layout migrates, scene
		// passes through untouched.
		return {
			kind: 'migrated',
			project: {
				id,
				name,
				layout: migration.document,
				scene: scene.document
			},
			report: {
				issues: [],
				layout: migration.report
			},
			sceneSpace: 'project-world'
		};
	}

	// Exhaustiveness: every layout/scene pairing is handled above.
	return {
		kind: 'unrecognized',
		reason: 'mixed-format-unsupported',
		issues: [
			{
				path: '$',
				code: 'mixed_format_unsupported',
				message: 'Project documents use an unsupported format pairing'
			}
		]
	};
}

function prefixIssue(prefix: '$.layout' | '$.scene', issue: ProjectIssue): ProjectIssue {
	return {
		...issue,
		path: issue.path === '$' ? prefix : `${prefix}${issue.path.slice(1)}`
	};
}
