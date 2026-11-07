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
 * The Scene unit is Camera-free Scene 5: the world-local record grammar
 * (textures, materials, entities, clusters) with the navigation graph moved out
 * to the Camera and Experience units, and native forms admitted as entities.
 * The Camera unit keeps the
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
export const SCENE_UNIT_FORMAT_VERSION = 5 as const;
export const CAMERA_UNIT_FORMAT_VERSION = 1 as const;
export const EXPERIENCE_UNIT_FORMAT_VERSION = 4 as const;
export const RESOURCE_UNIT_FORMAT_VERSION = 2 as const;

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
 * Camera-free Scene 5: the landed world-local records without the navigation
 * graph, carrying native forms and optional world presentation. `formatVersion: 5` is the payload's own
 * version and matches the unit header. A model names a catalogue asset or a
 * `model` resource of the same envelope; the fallback vocabulary includes the
 * generic footprint box.
 */
export type CameraFreeSceneDocument = {
	formatVersion: typeof SCENE_UNIT_FORMAT_VERSION;
	textures: SceneTextureAsset[];
	materials: SceneMaterialInstance[];
	entities: SceneEntity[];
	/** Editor-only hierarchy metadata; visitor rendering stays flat. */
	clusters?: SceneObjectCluster[];
	/**
	 * Scene 5 — World presentation: the sky, horizon and light the World renders
	 * in. Absent means `paper`, the Stage's own look. A fixed preset, never
	 * per-value lighting.
	 */
	environment?: SceneEnvironment;
};

/** The fixed environment presets (Experience review 1, R5). */
export const SCENE_ENVIRONMENT_PRESETS = ['paper', 'daylight', 'golden-hour', 'dusk'] as const;
export type SceneEnvironmentPreset = (typeof SCENE_ENVIRONMENT_PRESETS)[number];
export type SceneEnvironment = { readonly preset: SceneEnvironmentPreset };

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

/** The closed Presentation text kinds; plain text is the only member so far. */
export const EXPERIENCE_TEXT_KINDS = ['plain'] as const;

/**
 * One Presentation's Information-panel text, bounded and kind-closed.
 *
 * The bound is measured in code points, so an authoring surface and the reader
 * count the same text. A longer body is a structural refusal, never truncated.
 */
export const EXPERIENCE_TEXT_MAX_LENGTH = 4000;
export const EXPERIENCE_WELCOME_MAX_LENGTH = 600;
/** A Stop's stay is always finite and at least this long (sheet §31). */
export const EXPERIENCE_STAY_MIN_SECONDS = 1;
/** The stay a new Stop is given; Manual pacing keeps it unused. */
export const EXPERIENCE_STAY_DEFAULT_SECONDS = 5;
/** An invitation prompt's bound, in code points. */
export const EXPERIENCE_INVITATION_PROMPT_MAX_LENGTH = 80;

export type ExperiencePresentationText = {
	kind: 'plain';
	body: string;
};

/**
 * One View of a Presentation, in the Presentation's suggested order.
 *
 * `transition` is the authored step **to the next View** — Cut (absent means
 * Cut) or Travel along the Camera path that joins the pair. A Cut or Travel
 * belongs to the item it leaves, in a Presentation exactly as in a Guide (A-1),
 * so the last View has none. A step adds no Guide time: it is played only while
 * a visitor explores.
 */
export type ExperiencePresentationView = {
	viewId: string;
	transition?: ExperienceTransitionKind;
};

/**
 * A labelled Presentation: the visitor-facing use of the Camera Views it names.
 *
 * `views` is the Presentation's own suggested order, which visitors step with
 * ‹ ›. It is never Guide order and never connectivity. The first View is the
 * Default; an empty list is an honest state that cannot be entered. `subject` is
 * an F.1 semantic reference with no component (a Scene entity or a Layout
 * element), or `null` for an environment or region Presentation; no Room or
 * clone is invented to host it. Two Presentations may share one View, and one
 * Presentation may be used by several Stops. `explorable` is *Listed in Places*.
 */
export type ExperiencePresentation = {
	id: string;
	/** The own name. `null` follows the linked Scene entity's live name (G24). */
	label: string | null;
	views: readonly ExperiencePresentationView[];
	subject: SemanticReference | null;
	text: ExperiencePresentationText | null;
	explorable: boolean;
};

/**
 * The name a Presentation shows: its own name when it has one, otherwise the
 * linked subject's live name (G24). A Presentation with neither has no name.
 */
export function presentationDisplayName(
	presentation: Pick<ExperiencePresentation, 'label'>,
	subjectName: string | null
): string {
	return presentation.label ?? subjectName ?? 'Untitled Presentation';
}

/** The Default View of a Presentation: its first View, or `null` when it has none. */
export function presentationDefaultViewId(presentation: Pick<ExperiencePresentation, 'views'>): string | null {
	return presentation.views[0]?.viewId ?? null;
}

/** The ordered View ids of a Presentation. */
export function presentationViewIds(presentation: Pick<ExperiencePresentation, 'views'>): string[] {
	return presentation.views.map((view) => view.viewId);
}

/** The authored approach to a Stop: a Cut (the default) or a supported Travel. */
export const EXPERIENCE_TRANSITIONS = ['cut', 'travel'] as const;

export type ExperienceTransitionKind = (typeof EXPERIENCE_TRANSITIONS)[number];

/**
 * The authored step a Stop leaves by: Cut (absent means Cut) or Travel along the
 * one Camera path that joins its exit View to the next Stop's entry View.
 *
 * The step belongs to the Stop it leaves, so the last Stop of a Guide has none.
 * Experience never silently cuts when a Travel is unsupported and never searches
 * the Camera graph; the gap is reported.
 */

/**
 * A Stop's invitation to explore. It shows on arrival and leaves with the Stop;
 * `prompt` is the creator's words, or `null` for the default wording.
 */
export type ExperienceInvitation = {
	prompt: string | null;
};

/**
 * A Stop is one visit to one Presentation: an entry View, one stay and an
 * optional invitation. It is a stable authored occurrence identity — never an
 * array index, a label, a Room, a pose or a Camera view id. Visiting one Stop
 * twice starts two fresh runs that share this identity.
 *
 * `entryViewId` overrides the Presentation's Default (`null` follows the
 * Default, including after a reorder). `staySeconds` is always finite and at
 * least `EXPERIENCE_STAY_MIN_SECONDS`; Manual pacing ignores it and keeps it.
 */
export type ExperienceStop = {
	id: string;
	presentationId: string;
	entryViewId: string | null;
	staySeconds: number;
	invitation: ExperienceInvitation | null;
	/** The step to the next Stop in its Guide; absent means Cut. Never on the last. */
	transition?: ExperienceTransitionKind;
};

/** The View a Stop enters at: its own override, else its Presentation's Default. */
export function stopEntryViewId(
	stop: Pick<ExperienceStop, 'entryViewId'>,
	presentation: Pick<ExperiencePresentation, 'views'> | null | undefined
): string | null {
	return stop.entryViewId ?? (presentation ? presentationDefaultViewId(presentation) : null);
}

/** How a Guide plays: Automatic moves on when each stay ends; Manual waits for Next. */
export const EXPERIENCE_GUIDE_PACINGS = ['automatic', 'manual'] as const;
export type ExperienceGuidePacing = (typeof EXPERIENCE_GUIDE_PACINGS)[number];

/**
 * One Guide: one linear order of stable Stop IDs and its pacing. The first Stop
 * starts the Guide and the last one ends it, so there is no start Stop.
 */
export type ExperienceGuide = {
	id: string;
	label: string;
	stopIds: readonly string[];
	pacing: ExperienceGuidePacing;
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
	welcome: ExperiencePresentationText | null;
	presentations: readonly ExperiencePresentation[];
	stops: readonly ExperienceStop[];
	guides: readonly ExperienceGuide[];
	/** Explicit, possibly empty: detours are authored, never inferred. */
	detours: readonly ExperienceDetour[];
};

/** The Experience payload is a collection: several Experiences share one world. */
export type ExperienceUnitPayload = {
	formatVersion: typeof EXPERIENCE_UNIT_FORMAT_VERSION;
	experiences: readonly Experience[];
};

/** The admitted typed-resource kinds: textures, catalogue assets and creator models. */
export const RESOURCE_KINDS = ['texture', 'asset', 'model'] as const;

export type ResourceKind = (typeof RESOURCE_KINDS)[number];

/** The approved model derivative's one admitted media type. */
export const MODEL_RESOURCE_MIME = 'model/gltf-binary' as const;

/** Owner-accepted batch E bounds, enforced where a model resource is admitted. */
export const MODEL_SOURCE_SET_MAX_BYTES = 50 * 1024 * 1024;
export const MODEL_DERIVATIVE_MAX_BYTES = 25 * 1024 * 1024;

/**
 * The retained source file set of a model import: its manifest hash and declared
 * extent. The hash is over the manifest, never over an individual byte stream, so
 * it cannot be confused with the derivative's byte pin.
 */
export type ModelSourcePin = {
	manifestHash: string;
	size: number;
	fileCount: number;
};

/** The recipe identity/version that produced the derivative (creator import). */
export type ModelRefineRecipe = {
	id: string;
	version: number;
};

/**
 * The placement definition of a creator model: the metric scale, pivot, occupied
 * footprint and local contact the creator confirmed. Only floor placement is
 * admitted; an instance never carries a second copy of these facts.
 */
export type ModelPlacement = {
	/** Metres per source unit; finite and greater than zero. */
	metresPerSourceUnit: number;
	/** The derivative's local pivot, in its own metres. */
	pivot: readonly [number, number, number];
	/** Occupied footprint in metres around the pivot (X/Z). */
	footprint: { readonly width: number; readonly depth: number };
	/** The derivative's lowest local contact, in metres. */
	contactMinY: number;
	/** Only floor placement is admitted in this format. */
	placement: 'floor';
};

/**
 * The model-resource detail the approved revision supplies. The derivative's own
 * bytes stay the resource's `pin`; this record is the retained provenance and the
 * confirmed placement.
 */
export type ModelResourceDetail = {
	source: ModelSourcePin;
	recipe: ModelRefineRecipe;
	/** Digest of the ingest report the approving creator confirmed. */
	reportDigest: string;
	placement: ModelPlacement;
};

/**
 * One typed resource. `contentRevision` is the exact content revision when the
 * bytes are known; `pin` is the external-bytes pin for a resource outside the
 * project; `unresolved` is the authored diagnostic when the binding is not yet
 * resolved. A resource with neither revision nor pin is always `unresolved` —
 * a fabricated pin is never admitted.
 *
 * A `model` resource is the one kind with extra retained truth: it must carry an
 * approved derivative pin (its content revision is that pin's hash) and the
 * `model` detail. Every other kind may omit the detail.
 */
export type TypedResource = {
	kind: ResourceKind;
	id: string;
	contentRevision: string | null;
	pin: ResourcePin | null;
	unresolved: UnresolvedBinding | null;
	model?: ModelResourceDetail;
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
