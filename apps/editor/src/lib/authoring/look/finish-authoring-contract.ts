import type { TargetAnalysis } from '@portfolio/project-model/materials';
import type { AcceptedRevision } from '@portfolio/project-model/references';
import type {
	MaterialId,
	SceneMaterialInstance,
	SceneSurfaceRef,
} from '@portfolio/project-model/scene';
import type { FinishKey, SceneFinishRef } from '@portfolio/project-model/scene-planning';
import type { ProjectApi } from '$lib/platform/project-persistence';
import type { StageAdapterServices } from '../stage/stage-adapter-host';
import type { FinishCardTarget, FinishReachChoice } from './finish-card.svelte';
import type { CoatReading } from './colour-coat-port';
import type { PaintColour } from './paint-pick';
import type { PaintPreferenceStore } from './paint-preferences';

export type PaintableSurface = SceneSurfaceRef;

/** The Stage and revision an upload began in; a write may not outlive either. */
export type ImageWriteContext = {
	readonly services: StageAdapterServices;
	readonly acceptedRevision: AcceptedRevision;
};

export type FinishAcceptInput = {
	readonly kind: string;
	readonly payload: unknown;
	readonly entityIds?: readonly string[];
	readonly targets?: readonly import('@portfolio/project-model/references').SemanticReference[];
	readonly allocatedIds?: readonly { readonly kind: string; readonly id: string }[];
};

export type FinishAcceptOutcome = {
	readonly kind: string;
	readonly code?: string;
	readonly reason?: string | null;
	readonly message?: string;
};

export function surfaceTargetSubject(surface: PaintableSurface): {
	kind: 'wall' | 'room' | 'region';
	id: string;
} {
	switch (surface.kind) {
		case 'wall-side':
			return { kind: 'wall', id: surface.wallId };
		case 'room-floor':
		case 'room-lid':
			return { kind: 'room', id: surface.roomId };
		case 'region-face':
			return { kind: 'region', id: surface.regionId };
	}
}

export function surfaceTargetComponent(surface: PaintableSurface): string {
	switch (surface.kind) {
		case 'wall-side':
			return `side:${surface.side}`;
		case 'room-floor':
			return 'floor';
		case 'room-lid':
			return 'lid';
		case 'region-face':
			return surface.face;
	}
}

/** A Stage pick the draft editor retargets to. */
export type LibraryDraftPick =
	| { readonly kind: 'entity'; readonly entityId: string }
	| { readonly kind: 'surface'; readonly surface: SceneSurfaceRef };

export type LibrarySwapRequest = {
	readonly target: FinishCardTarget;
	readonly targetKey: string;
	readonly place: string;
	readonly finishName: string;
	readonly materialLabel: string;
	readonly currentId: MaterialId | null;
	/** The reach the Card showed; null when there was nothing to choose. */
	readonly reach: FinishReachChoice | null;
	readonly reachLine: string;
	readonly users: number;
};

export type FinishAuthoringHost = {
	readonly services: () => StageAdapterServices | null;
	readonly onNotice: (message: string) => void;
	/** Open Library › Finishes, scrolled to the current tile. */
	readonly openFinishes: () => void;
	/** Open the Library on Materials in Swap mode for the request just captured. */
	readonly openLibrarySwap?: () => void;
	/** Arm the host Paint task, optionally in the Finish dropper. */
	readonly armPaint: (mode: { readonly kind: 'paint' } | { readonly kind: 'dropper' }) => void;
	/** Whether the host Paint tool is armed now; a Library pick then arms, never assigns. */
	readonly isPaintArmed?: () => boolean;
	/** Creator favourites and recents. Defaults to the device store. */
	readonly preferences?: PaintPreferenceStore;
	/** The colour-coat planner enables the Colours tab. It preserves relief and
	 * deduplicates coats without mutating the Finish shared by other surfaces.
	 */
	readonly colourCoat?: PaintColourPort;
	/** Optional target analysis for static Finish diagnostics (UV / normal / metric basis). */
	readonly targetAnalysis?: () => TargetAnalysis | undefined;
	/** Exact-byte storage recovery for Relink… (zero history entries). */
	readonly repairAsset?: (
		assetId: string,
		bytes: Uint8Array,
		expectedPin: string,
		signal?: AbortSignal,
	) => Promise<{ readonly ok: true } | { readonly ok: false; readonly message: string }>;
	/** Invalidate cached GPU/store views for one project asset and reload Stage textures. */
	readonly invalidateAndReloadAsset?: (assetId: string) => void;
	/** Retry failed textures on Stage and inspection preview. */
	readonly retryTextures?: () => void;
	/**
	 * S4b's creator-bytes seam. These are absent in a route with no cloud project;
	 * *+ From image* then refuses with the same words Artwork uses.
	 */
	readonly api?: () => ProjectApi | null;
	readonly projectId?: () => string | null;
	readonly canEdit?: () => boolean;
	readonly isSaved?: () => boolean;
	/** Decoded width ÷ height of a project texture, or `null` until it loads. */
	readonly imageAspect?: (textureId: string) => number | null;
	/** Decoded pixel size, for the D3 low-resolution warning. */
	readonly imageDimensions?: (
		textureId: string,
	) => { readonly width: number; readonly height: number } | null;
	/** The texture record's URI, if the image is a project texture. */
	readonly textureUri?: (textureId: string) => string | null;
	/** A retained, verified preview URL for that project texture (CSS only). */
	readonly texturePreviewUri?: (textureId: string) => string | null;
	readonly textureFailed?: (uri: string) => boolean;
	/** Targeted Retry: drop one source failure and reload that image. */
	readonly retryTexture?: (uri: string) => void;
};

export type FinishEntityView = {
	readonly entityId: string;
	readonly entityName: string;
	readonly kind: 'primitive' | 'form' | 'model';
	readonly key: FinishKey;
	readonly ref: SceneFinishRef;
	readonly label: string;
	readonly users: number;
	readonly editable: boolean;
	readonly pristine: boolean;
	readonly baseMaterialId: MaterialId | null;
	readonly baseLabel: string;
	readonly instance: SceneMaterialInstance | null;
	readonly effectiveColor: string;
	readonly literalColor: string | null;
	readonly followerSlot: string | null;
	readonly roughness: number;
	readonly roughnessAuthored: boolean;
	readonly metalOn: boolean;
	readonly metalCaption: string;
	readonly hasColorImage: boolean;
	/** The colour map's texture id, or `null` when the image is the catalogue's. */
	readonly colorMapId: string | null;
	readonly colorMapUri: string | null;
	readonly colorMapFailed: boolean;
	readonly colorMapWarning: string | null;
	readonly tileMeters: readonly [number, number] | null;
	/** The catalogue's own tile size, the field's starting value before an edit. */
	readonly defaultTileMeters: readonly [number, number];
	readonly rotation: number;
	/** Scale is offered only when the Finish has a map to scale (D18). */
	readonly tileSizeAvailable: boolean;
	readonly directionAvailable: boolean;
	/** Scale/Direction are Floor/Form ideas; a model keeps its own UVs. */
	readonly canEditMapping: boolean;
	/** Box sides approximate their tiling with width × depth (existing rule). */
	readonly scaleApproximate: boolean;
	readonly canSaveToPalette: boolean;
	readonly paletteRoom: boolean;
	readonly originalWritesWhite: boolean;
};

export type FinishPaletteView = {
	readonly slots: readonly {
		readonly id: string;
		readonly name: string;
		readonly color: string;
		readonly users: number;
	}[];
	readonly room: boolean;
};

/** The seam the colour-coat planner implements. Paint never edits a Finish. */
export type PaintColourPort = {
	/** One acceptance: coat these objects with the colour. */
	readonly paintEntities: (entityIds: readonly string[], colour: PaintColour) => Promise<boolean>;
	/** One acceptance: coat these Layout surfaces with the colour. */
	readonly paintSurfaces: (
		surfaces: readonly SceneSurfaceRef[],
		colour: PaintColour,
	) => Promise<boolean>;
	/** Whether every target already wears this colour (no write, no history entry). */
	readonly isAlready?: (
		targets: {
			readonly entityIds: readonly string[];
			readonly surfaces: readonly SceneSurfaceRef[];
		},
		colour: PaintColour,
	) => boolean;
	/** What a colour does to one target: refuse in place, or coat it keeping the named relief. */
	readonly read?: (
		target: { readonly entityId: string } | { readonly surface: SceneSurfaceRef },
	) => CoatReading | null;
};

export type PaintSwatch = {
	readonly kind: 'finish' | 'colour';
	/** A Finish key, `slot:<id>` or `#rrggbb`: the stored reference. */
	readonly key: string;
	readonly label: string;
	readonly color: string;
	readonly favourite: boolean;
	/** A project Finish's own colour image, multiplied over the swatch until its picture loads. */
	readonly imageUri?: string | null;
};

/** Everything the Paint tray draws. Resolved here so the tray owns no Finish state. */
export type PaintTrayView = {
	/** False until a colour-coat port exists; the tray then has one tab. */
	readonly colourEnabled: boolean;
	readonly active: PaintSwatch | null;
	readonly dropper: boolean;
	readonly colours: {
		readonly row: readonly PaintSwatch[];
		readonly palette: readonly {
			readonly id: string;
			readonly name: string;
			readonly color: string;
		}[];
	};
	readonly materials: {
		readonly row: readonly PaintSwatch[];
		readonly project: readonly PaintSwatch[];
		readonly curated: readonly PaintSwatch[];
	};
};

export function entityReference(services: StageAdapterServices, entityId: string) {
	const snapshot = services.stage.snapshot();
	return {
		version: 1 as const,
		domain: 'scene' as const,
		revision: { kind: 'exact' as const, contentRevision: snapshot.domain.unitRevisions.scene },
		subject: { kind: 'entity' as const, id: entityId },
		instancePath: [],
		location: { kind: 'project-root' as const },
		componentId: null,
		capabilityId: null,
	};
}

export function newId(kind: string, id: string) {
	return { kind, id };
}
