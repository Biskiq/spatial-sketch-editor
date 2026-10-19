/**
 * F.2 `unit-envelope-v1` — envelope, unit, lock and payload shapes (AM-2).
 *
 * One project is one envelope of five domains: Layout, Scene, Camera,
 * Experience and typed resources. Experience and resource payloads are
 * collections, so several Experiences share one world and several resources
 * share one registry. Empty collections are explicit — an envelope never omits
 * a domain to mean "nothing there".
 *
 * This module is vocabulary only. Strict validation lives in `./validate`,
 * canonical bytes and content revisions in `./canonical`. Nothing here is
 * imported by the project-model root barrel: an F.2 envelope is reached through
 * its own package subpath, which `T3.P01.S04` activated.
 *
 * The Scene unit is Camera-free Scene 2: the landed Scene 1 record grammar
 * (textures, materials, entities, clusters) unchanged, with the navigation graph
 * moved out to the Camera and Experience units. The Camera unit keeps the
 * spatial half of the landed navigation records — views (eye/target/fov and
 * connectivity) and connections (path, view tracks, framing envelope, directed
 * timing) — while editorial order, holds, cycle entry and detour policy move to
 * Experience. Camera keeps its intrinsic framing/timing facts; an editorial
 * station hold is never a second Camera motion timeline.
 */

import { LAYOUT_WALL_FIRST_FORMAT_VERSION } from '@portfolio/layout-core';
import type { LayoutDocumentWallFirst } from '@portfolio/layout-core';
import type {
	AcceptedRevision,
	ReferenceDomain,
	ReferenceFailureCode,
	SemanticReference
} from '../references/types';
import type {
	SceneConnection,
	SceneEntity,
	SceneMaterialInstance,
	SceneObjectCluster,
	SceneTextureAsset
} from '../scene';

/** The envelope format this module implements. */
export const UNIT_ENVELOPE_FORMAT_VERSION = 1 as const;

/** Admitted unit versions (AM-2). Layout tracks the landed wall-first format. */
export const LAYOUT_UNIT_FORMAT_VERSION = LAYOUT_WALL_FIRST_FORMAT_VERSION;
export const SCENE_UNIT_FORMAT_VERSION = 2 as const;
export const CAMERA_UNIT_FORMAT_VERSION = 1 as const;
export const EXPERIENCE_UNIT_FORMAT_VERSION = 1 as const;
export const RESOURCE_UNIT_FORMAT_VERSION = 1 as const;

/** The five admitted unit domains, in stable order. */
export const UNIT_DOMAINS = ['layout', 'scene', 'camera', 'experience', 'resources'] as const;

export type UnitDomain = (typeof UNIT_DOMAINS)[number];

/** The one admitted payload version per domain. */
export const ADMITTED_UNIT_VERSIONS: Readonly<Record<UnitDomain, number>> = {
	layout: LAYOUT_UNIT_FORMAT_VERSION,
	scene: SCENE_UNIT_FORMAT_VERSION,
	camera: CAMERA_UNIT_FORMAT_VERSION,
	experience: EXPERIENCE_UNIT_FORMAT_VERSION,
	resources: RESOURCE_UNIT_FORMAT_VERSION
};

/**
 * `UnitHeader` — one stable codec identity per admitted domain. `formatVersion`
 * is the payload's own version and must equal the payload's `formatVersion`
 * field: a header/payload mismatch rejects.
 */
export type UnitHeader = {
	domain: UnitDomain;
	unitId: string;
	formatVersion: number;
	/** Content revision of the canonical domain data alone; see `./canonical`. */
	contentRevision: string;
};

/** `DomainUnit` — one domain-owned validator/codec boundary. */
export type DomainUnit<TData = unknown> = {
	header: UnitHeader;
	data: TData;
};

/**
 * `UnresolvedBinding` — a typed authored diagnostic that retains the original
 * F.1 reference and its repair status in the owning domain. It is never a
 * fabricated resolved pin, and an executable-closure failure is distinguished
 * from a structural one by how the reader reports it.
 */
export type UnresolvedBinding = {
	reference: SemanticReference;
	/** The domain that owns the binding and must repair it. */
	domain: ReferenceDomain;
	status: ReferenceFailureCode;
	message: string;
};

/** External bytes pin: content hash, MIME type, exact size and immutable locator. */
export type ResourcePin = {
	hash: string;
	mime: string;
	size: number;
	/** Immutable locator. A mutable asset row is never a pin. */
	locator: string;
};

/** A capability/version this lock entry requires of its consumer. */
export type RequiredCapability = { id: string; version: string };

/**
 * One dependency-lock entry, keyed by qualified identity/instance scope. The
 * lock pins exact unit/resource content revisions and the required
 * capability/version; external bytes additionally pin hash/MIME/size/locator.
 */
export type DependencyLockEntry = {
	domain: ReferenceDomain;
	subjectKind: string;
	subjectId: string;
	/** Ordered stable instance IDs; empty denotes the root subject. */
	instancePath: readonly string[];
	contentRevision: string;
	requiredCapabilities: readonly RequiredCapability[];
	/** Present only for external bytes. */
	pin: ResourcePin | null;
};

/** `DependencyLock` — a deterministic set, never an unordered bag. */
export type DependencyLock = {
	formatVersion: typeof UNIT_ENVELOPE_FORMAT_VERSION;
	entries: readonly DependencyLockEntry[];
};

/** The Layout payload: the landed strict wall-first document, unchanged. */
export type LayoutUnitPayload = LayoutDocumentWallFirst;

/**
 * Camera-free Scene 2: the landed world-local records without the navigation
 * graph. `formatVersion: 2` is the payload's own version and matches the unit
 * header.
 */
export type CameraFreeSceneDocument = {
	formatVersion: typeof SCENE_UNIT_FORMAT_VERSION;
	textures: SceneTextureAsset[];
	materials: SceneMaterialInstance[];
	entities: SceneEntity[];
	/** Editor-only hierarchy metadata; visitor rendering stays flat. */
	clusters?: SceneObjectCluster[];
};

/** A Camera view: one eye/target/fov station plus its connectivity. */
export type CameraView = {
	id: string;
	label: string;
	/** Project-world eye position in meters. */
	eye: [number, number, number];
	/** Project-world look target in meters. */
	target: [number, number, number];
	/** Vertical field of view in degrees. */
	fov: number;
	/** Stable connectivity to other views. */
	connectedViewIds: readonly string[];
};

/**
 * The Camera payload. Connections are the landed Scene connection records
 * unchanged — path geometry, view tracks, framing envelope and directed timing
 * are Camera-intrinsic facts, and their byte values are preserved by migration.
 */
export type CameraUnitPayload = {
	formatVersion: typeof CAMERA_UNIT_FORMAT_VERSION;
	views: CameraView[];
	connections: SceneConnection[];
};

/**
 * A labelled Presentation: the visitor-facing use of one Camera view. Two
 * Presentations may share one view, and one Presentation may be used by several
 * Stops.
 */
export type ExperiencePresentation = {
	id: string;
	label: string;
	viewId: string;
};

/**
 * How execution continues after a Stop. `sequence-next` follows the guide's
 * order; an explicit `stop` overrides it once, including a nonadjacent target;
 * `end` finishes the run.
 */
export type ExperienceContinuation =
	| { kind: 'sequence-next' }
	| { kind: 'stop'; stopId: string }
	| { kind: 'end' };

/**
 * A Stop is a stable authored occurrence identity — never an array index, a
 * label, a Room, a pose or a Camera view id. Visiting one Stop twice starts two
 * fresh runs that share this identity.
 */
export type ExperienceStop = {
	id: string;
	presentationId: string;
	/** An editorial station hold: finite, non-negative seconds. */
	holdSeconds?: number;
	/** Default continuation is the guide sequence; this field overrides it. */
	continuation?: ExperienceContinuation;
};

/** One Guide: an ordered list of stable Stop IDs with exactly one entry. */
export type ExperienceGuide = {
	id: string;
	label: string;
	stopIds: readonly string[];
	entryStopId: string;
};

/**
 * An explicit blocking Gate on one Presentation: the visitor must continue
 * deliberately. A Gate is authored, never inferred — legacy direct-entry
 * prohibition is not the same meaning and is never renamed into one.
 */
export type ExperienceGate = {
	id: string;
	presentationId: string;
};

/** An explicit choice/return relationship; never a guessed detour policy. */
export type ExperienceDetour = {
	id: string;
	fromStopId: string;
	toStopId: string;
	returnToStopId: string;
};

/** One Experience: an ordered editorial reading of the shared world. */
export type Experience = {
	id: string;
	label: string;
	/** The guide whose sequence the Experience enters by default; `null` iff it has no guides. */
	entryGuideId: string | null;
	presentations: readonly ExperiencePresentation[];
	stops: readonly ExperienceStop[];
	guides: readonly ExperienceGuide[];
	/** Explicit, possibly empty: gates are authored, never inferred. */
	gates: readonly ExperienceGate[];
	/** Explicit, possibly empty: detours are authored, never inferred. */
	detours: readonly ExperienceDetour[];
};

/** The Experience payload is a collection: several Experiences share one world. */
export type ExperienceUnitPayload = {
	formatVersion: typeof EXPERIENCE_UNIT_FORMAT_VERSION;
	experiences: readonly Experience[];
};

/** The admitted typed-resource kinds: the existing project texture/asset family. */
export const RESOURCE_KINDS = ['texture', 'asset'] as const;

export type ResourceKind = (typeof RESOURCE_KINDS)[number];

/**
 * One typed resource. `contentRevision` is the exact content revision when the
 * bytes are known; `pin` is the external-bytes pin for a resource outside the
 * project; `unresolved` is the authored diagnostic when the binding is not yet
 * resolved. A resource with neither revision nor pin is always `unresolved` —
 * a fabricated pin is never admitted.
 */
export type TypedResource = {
	kind: ResourceKind;
	id: string;
	contentRevision: string | null;
	pin: ResourcePin | null;
	unresolved: UnresolvedBinding | null;
};

/** The resource payload is a collection; an empty registry is valid only when unused. */
export type ResourceUnitPayload = {
	formatVersion: typeof RESOURCE_UNIT_FORMAT_VERSION;
	resources: readonly TypedResource[];
};

/** Any admitted unit payload. */
export type UnitPayload =
	| LayoutUnitPayload
	| CameraFreeSceneDocument
	| CameraUnitPayload
	| ExperienceUnitPayload
	| ResourceUnitPayload;

/** The envelope's five units, exactly one per domain. */
export type ProjectUnits = {
	layout: DomainUnit<LayoutUnitPayload>;
	scene: DomainUnit<CameraFreeSceneDocument>;
	camera: DomainUnit<CameraUnitPayload>;
	experience: DomainUnit<ExperienceUnitPayload>;
	resources: DomainUnit<ResourceUnitPayload>;
};

/**
 * `ProjectEnvelope` — one project, one format version, exactly one unit per
 * domain, plus the accepted revision and the dependency lock. The source-content
 * digest excludes `acceptedRevision` and every session/history/receipt value;
 * those live here and never inside an authored unit.
 */
export type ProjectEnvelope = {
	formatVersion: typeof UNIT_ENVELOPE_FORMAT_VERSION;
	id: string;
	name: string;
	acceptedRevision: AcceptedRevision;
	dependencyLock: DependencyLock;
	units: ProjectUnits;
};

/** The payload type a domain carries. */
export type PayloadOf<D extends UnitDomain> = D extends 'layout'
	? LayoutUnitPayload
	: D extends 'scene'
		? CameraFreeSceneDocument
		: D extends 'camera'
			? CameraUnitPayload
			: D extends 'experience'
				? ExperienceUnitPayload
				: ResourceUnitPayload;
