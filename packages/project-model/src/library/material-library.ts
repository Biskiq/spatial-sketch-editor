/**
 * The `material` library payload (format 1).
 *
 * A material item is an owner-private, immutable **saved Finish**: the
 * effective, untreated recipe a creator chose to keep, with its display name.
 * It is deliberately distinct from the recipe identity:
 *
 *   { formatVersion: 1, kind: 'material', name, recipe }
 *
 * - `contentId` hashes these exact canonical bytes, including the display name.
 * - `recipeHash` is the recipe's own identity (canonical recipe bytes only), so
 *   the same material saved under two names has two item identities and one
 *   portable recipe revision.
 *
 * Local image identities and project ids are never part of the payload. They are
 * the transport's pinned dependencies (`MaterialLibraryImageBinding`), so a
 * destination project vendors its own bytes and never depends on a source
 * project's object key.
 *
 * The module is runtime-safe: it reads the material grammar and the canonical
 * serializer only, imports no editor, renderer, DOM or API module, and the editor
 * and the API share it.
 */
import { dedupeMaterialIssues } from '../materials/issues';
import { recipeImageDigests, type MaterialResourceImage } from '../materials/definition';
import { recipeHash } from '../materials/recipe';
import { readRecipe } from '../materials/read';
import { resolveFinish, type ImageIndex, type ResolveBase } from '../materials/resolve';
import { materialImageIndex, mergeImageIndexes, shippedImageIndex } from '../materials/resolve';
import type {
  Finish,
  FinishOverrides,
  Hash,
  LocalImage,
  MapRole,
  Mapping,
  PaletteSlot,
  Recipe,
  ResolvedMaps
} from '../materials/types';
import { MATERIAL_MAP_ROLES } from '../materials/types';
import { canonicalUnitJson } from '../units/canonical';
import { sha256Bytes } from '../package-sha';

/** The one payload format this tree writes and reads for material items. */
export const MATERIAL_LIBRARY_PAYLOAD_FORMAT_VERSION = 1 as const;

/** A user-chosen library name is bounded so the list stays readable. */
export const MATERIAL_LIBRARY_NAME_MAX_LENGTH = 120;

/** One item's canonical bytes never exceed 256 KiB, like a form item. */
export const MATERIAL_LIBRARY_MAX_CANONICAL_BYTES = 256 * 1024;

/** A v1 material item names at most five distinct image dependencies. */
export const MATERIAL_LIBRARY_MAX_IMAGES = 5;

/** One thumbnail is a PNG no larger than 192×192 and 256 KiB. */
export const MATERIAL_LIBRARY_MAX_THUMBNAIL_BYTES = 256 * 1024;
export const MATERIAL_LIBRARY_MAX_THUMBNAIL_EDGE = 192;

export type MaterialLibraryKind = 'material';

/** The one payload of a `material` library item. */
export type MaterialLibraryPayload = {
  readonly formatVersion: typeof MATERIAL_LIBRARY_PAYLOAD_FORMAT_VERSION;
  readonly kind: MaterialLibraryKind;
  readonly name: string;
  readonly recipe: Recipe;
};

/** What the owner's list returns for a material item; payload bytes stay behind read. */
export type MaterialLibraryItemSummary = {
  readonly id: string;
  readonly name: string;
  readonly kind: MaterialLibraryKind;
  readonly formatVersion: number;
  readonly contentId: string;
  readonly createdAt: string;
  /** The portable recipe revision, distinct from the item content id. */
  readonly recipeHash: Hash;
  readonly imageCount: number;
  /** Whether a fixed thumbnail derivative has been installed. */
  readonly hasThumbnail: boolean;
};

/** One image dependency of a material item, as the transport pins it. */
export type MaterialLibraryImageBinding = {
  readonly hash: Hash;
  readonly source: LocalImage;
};

/** One image a transfer installed in the destination project. */
export type MaterialLibraryTransferImage = {
  readonly hash: Hash;
  readonly source: LocalImage;
  readonly mime: string;
  readonly byteSize: number;
  /** Display-only name for a newly installed project texture row. */
  readonly name?: string;
};

/** The result an insertion uses to issue D's `scene-finish-register`. */
export type MaterialLibraryTransfer = {
  readonly itemId: string;
  readonly contentId: string;
  readonly finishId: string;
  readonly name: string;
  readonly recipe: Recipe;
  readonly recipeHash: Hash;
  readonly images: readonly MaterialLibraryTransferImage[];
  /** The destination's saved-base token at metadata commit, or null. */
  readonly savedBase: string | null;
};

export type MaterialLibraryIssue = {
  readonly path: string;
  readonly code: string;
  readonly message: string;
};

export type MaterialLibraryReadResult =
  | {
      readonly success: true;
      readonly payload: MaterialLibraryPayload;
      readonly canonicalJson: string;
    }
  | { readonly success: false; readonly issues: readonly MaterialLibraryIssue[] };

export type MaterialLibraryBytesResult =
  | {
      readonly success: true;
      readonly payload: MaterialLibraryPayload;
      readonly canonicalJson: string;
      readonly contentId: Hash;
      readonly recipeHash: Hash;
    }
  | { readonly success: false; readonly issues: readonly MaterialLibraryIssue[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function issue(path: string, code: string, message: string): MaterialLibraryIssue {
  return { path, code, message };
}

/** The canonical payload object: trimmed name, normalized recipe, sorted keys. */
export function canonicalMaterialLibraryPayload(
  payload: MaterialLibraryPayload
): MaterialLibraryPayload {
  return {
    formatVersion: MATERIAL_LIBRARY_PAYLOAD_FORMAT_VERSION,
    kind: 'material',
    name: payload.name.trim(),
    recipe: payload.recipe
  };
}

/** Deterministic canonical JSON for a material payload. */
export function canonicalMaterialLibraryJson(payload: MaterialLibraryPayload): string {
  return canonicalUnitJson(canonicalMaterialLibraryPayload(payload));
}

/** The only canonical byte producer for a `material` library item. */
export function canonicalMaterialLibraryBytes(payload: MaterialLibraryPayload): Uint8Array {
  return new TextEncoder().encode(canonicalMaterialLibraryJson(payload));
}

/** The content identity of one canonical payload, including its display name. */
export async function materialLibraryContentId(payload: MaterialLibraryPayload): Promise<Hash> {
  return sha256Bytes(canonicalMaterialLibraryBytes(payload));
}

/** The portable recipe revision of one payload, independent of its name. */
export async function materialLibraryRecipeHash(payload: MaterialLibraryPayload): Promise<Hash> {
  return recipeHash(payload.recipe);
}

/** Every image digest one material recipe binds, with the roles that name it. */
export function materialLibraryImageDigests(recipe: Recipe): Map<Hash, readonly MapRole[]> {
  return recipeImageDigests(recipe);
}

/**
 * The exact image dependencies a payload requires.
 *
 * The caller supplies the local bindings the source project verified; this
 * helper refuses a missing, extra, duplicate or over-limit dependency. Order is
 * digest-ascending so a request digest never depends on map iteration.
 */
export function materialLibraryImageBindings(
  recipe: Recipe,
  images: readonly MaterialLibraryImageBinding[]
): { readonly images: readonly MaterialLibraryImageBinding[] } | {
  readonly issues: readonly MaterialLibraryIssue[];
} {
  const issues: MaterialLibraryIssue[] = [];
  const required = recipeImageDigests(recipe);
  if (required.size > MATERIAL_LIBRARY_MAX_IMAGES) {
    issues.push(
      issue(
        '$.recipe.maps',
        'too_many_images',
        `A material item may bind at most ${MATERIAL_LIBRARY_MAX_IMAGES} distinct images`
      )
    );
  }
  const seen = new Map<Hash, MaterialLibraryImageBinding>();
  for (const [index, image] of images.entries()) {
    if (!/^sha256-[0-9a-f]{64}$/.test(image.hash)) {
      issues.push(issue(`$.images[${index}].hash`, 'invalid_hash', 'Use a lowercase sha256 digest'));
      continue;
    }
    const sourceKey =
      'textureId' in image.source ? `texture:${image.source.textureId}` : `shipped:${image.source.shipped}`;
    if (!/^[^\s]+$/.test(sourceKey.slice(sourceKey.indexOf(':') + 1))) {
      issues.push(
        issue(`$.images[${index}].source`, 'invalid_local_image', 'Use a stable local identity without whitespace')
      );
      continue;
    }
    const previous = seen.get(image.hash);
    if (previous !== undefined) {
      const previousKey =
        'textureId' in previous.source
          ? `texture:${previous.source.textureId}`
          : `shipped:${previous.source.shipped}`;
      if (previousKey !== sourceKey) {
        issues.push(
          issue(`$.images[${index}]`, 'duplicate_image', 'One digest may have exactly one local source')
        );
      }
      continue;
    }
    seen.set(image.hash, image);
  }
  for (const hash of required.keys()) {
    if (!seen.has(hash)) {
      issues.push(
        issue('$.images', 'missing_image', `The recipe binds ${hash} with no verified local source`)
      );
    }
  }
  for (const hash of seen.keys()) {
    if (!required.has(hash)) {
      issues.push(
        issue('$.images', 'unused_image', `The image ${hash} is not bound by any recipe role`)
      );
    }
  }
  if (issues.length > 0) return { issues };
  return {
    images: [...seen.values()]
      .sort((left, right) => (left.hash < right.hash ? -1 : left.hash > right.hash ? 1 : 0))
  };
}

/**
 * Read one payload strictly.
 *
 * Format is checked before shape so a payload written by another development
 * format is reported as unusable rather than misread. The recipe is normalized
 * through the one material reader; unknown keys, a wrong kind, an empty/overlong
 * name and a non-canonical-size payload refuse.
 */
export function readMaterialLibraryPayload(input: unknown): MaterialLibraryReadResult {
  if (!isRecord(input)) {
    return {
      success: false,
      issues: [issue('$', 'invalid_type', 'Expected a material library item object')]
    };
  }
  if (input.formatVersion !== MATERIAL_LIBRARY_PAYLOAD_FORMAT_VERSION) {
    return {
      success: false,
      issues: [
        issue(
          '$.formatVersion',
          'unsupported_format_version',
          `Unsupported material library formatVersion ${JSON.stringify(input.formatVersion)}; recognized value: ${MATERIAL_LIBRARY_PAYLOAD_FORMAT_VERSION}`
        )
      ]
    };
  }
  const allowed = ['formatVersion', 'kind', 'name', 'recipe'];
  const issues: MaterialLibraryIssue[] = [];
  for (const key of Object.keys(input)) {
    if (!allowed.includes(key)) {
      issues.push(issue(`$.${key}`, 'unknown_property', `Unknown material library property: ${key}`));
    }
  }
  if (input.kind !== 'material') {
    issues.push(issue('$.kind', 'unsupported_kind', `Unsupported material library kind: ${String(input.kind)}`));
  }
  if (typeof input.name !== 'string') {
    issues.push(issue('$.name', 'invalid_type', 'A material library item needs a name'));
  } else {
    const name = input.name.trim();
    if (name.length === 0) {
      issues.push(issue('$.name', 'empty_name', 'A library item needs a name'));
    } else if (name.length > MATERIAL_LIBRARY_NAME_MAX_LENGTH) {
      issues.push(
        issue(
          '$.name',
          'name_too_long',
          `A library item name is at most ${MATERIAL_LIBRARY_NAME_MAX_LENGTH} characters`
        )
      );
    }
  }
  const recipeRead = readRecipe(input.recipe);
  if (!recipeRead.success) {
    for (const problem of recipeRead.issues) {
      issues.push(
        issue(
          problem.path === '$' ? '$.recipe' : `$.recipe${problem.path.slice(1)}`,
          problem.code,
          problem.action ?? 'The material recipe is not admissible'
        )
      );
    }
  }
  if (issues.length > 0 || !recipeRead.success) {
    return { success: false, issues };
  }
  const payload = canonicalMaterialLibraryPayload({
    formatVersion: MATERIAL_LIBRARY_PAYLOAD_FORMAT_VERSION,
    kind: 'material',
    name: input.name as string,
    recipe: recipeRead.recipe
  });
  const canonicalJson = canonicalMaterialLibraryJson(payload);
  if (new TextEncoder().encode(canonicalJson).byteLength > MATERIAL_LIBRARY_MAX_CANONICAL_BYTES) {
    return {
      success: false,
      issues: [
        issue(
          '$',
          'payload_too_large',
          `A library item is at most ${MATERIAL_LIBRARY_MAX_CANONICAL_BYTES} canonical bytes`
        )
      ]
    };
  }
  return { success: true, payload, canonicalJson };
}

/**
 * Read and verify the bytes one item's read route returned.
 *
 * The content id is recomputed from the received bytes and compared with the id
 * the caller pinned. A mismatch, malformed JSON, a non-canonical spelling or an
 * unsupported body refuses before anything can be inserted.
 */
export async function readMaterialLibraryBytes(
  bytes: Uint8Array,
  options: { readonly contentId?: Hash } = {}
): Promise<MaterialLibraryBytesResult> {
  if (bytes.byteLength > MATERIAL_LIBRARY_MAX_CANONICAL_BYTES) {
    return {
      success: false,
      issues: [
        issue(
          '$',
          'payload_too_large',
          `A library item is at most ${MATERIAL_LIBRARY_MAX_CANONICAL_BYTES} canonical bytes`
        )
      ]
    };
  }
  const contentId = await sha256Bytes(bytes);
  if (options.contentId !== undefined && options.contentId !== contentId) {
    return {
      success: false,
      issues: [
        issue('$', 'content_id_mismatch', 'The item bytes do not match the content id they were read as')
      ]
    };
  }
  let input: unknown;
  try {
    input = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return {
      success: false,
      issues: [issue('$', 'invalid_json', 'The item bytes are not JSON')]
    };
  }
  const parsed = readMaterialLibraryPayload(input);
  if (!parsed.success) return parsed;
  const canonical = new TextEncoder().encode(parsed.canonicalJson);
  if (
    canonical.byteLength !== bytes.byteLength ||
    canonical.some((value, index) => value !== bytes[index])
  ) {
    return {
      success: false,
      issues: [
        issue(
          '$',
          'non_canonical_payload',
          'The item bytes are not the canonical serialization they claim to be'
        )
      ]
    };
  }
  const recipe = await materialLibraryRecipeHash(parsed.payload);
  return {
    success: true,
    payload: parsed.payload,
    canonicalJson: parsed.canonicalJson,
    contentId,
    recipeHash: recipe
  };
}

/* -------------------------------------------------------------------------- */
/* Flattening an accepted Finish                                              */
/* -------------------------------------------------------------------------- */

export type FinishLibraryCapture = {
  readonly name: string;
  readonly base: ResolveBase;
  readonly overrides?: FinishOverrides;
  readonly palette?: readonly PaletteSlot[];
  readonly imageIndex: ImageIndex;
};

export type FinishLibraryDraft = {
  readonly payload: MaterialLibraryPayload;
  readonly contentId: Hash;
  readonly recipeHash: Hash;
  readonly images: readonly MaterialLibraryImageBinding[];
  /** Palette slots whose current literal was captured by this Save. */
  readonly capturedFollowers: readonly string[];
};

export type FinishLibraryDraftResult =
  | { readonly ok: true; readonly draft: FinishLibraryDraft }
  | { readonly ok: false; readonly issues: readonly MaterialLibraryIssue[] };

function mappingsEqual(left: Mapping, right: Mapping): boolean {
  return canonicalUnitJson(left) === canonicalUnitJson(right);
}

function bindingFor(
  role: MapRole,
  resolved: ResolvedMaps[MapRole],
  setMapping: Mapping,
  images: Map<Hash, MaterialLibraryImageBinding>
): Recipe['maps'][MapRole] {
  if (resolved === undefined || resolved.image === null) return undefined;
  const image = resolved.image;
  if (!images.has(image.hash)) {
    images.set(image.hash, { hash: image.hash, source: image.source });
  }
  const mapping =
    resolved.mapping === undefined || mappingsEqual(resolved.mapping, setMapping)
      ? {}
      : { mapping: resolved.mapping };
  switch (role) {
    case 'color':
      return { image: image.hash, ...mapping };
    case 'normal':
      return {
        image: image.hash,
        convention: (resolved as import('../materials/types').ResolvedNormal).convention,
        ...mapping
      };
    default: {
      const scalar = resolved as import('../materials/types').ResolvedScalar;
      return {
        image: image.hash,
        component: scalar.component,
        invert: scalar.invert,
        ...mapping
      };
    }
  }
}

/**
 * Flatten one accepted Finish into a portable recipe and its exact image pins.
 *
 * This is the only Save-side composition: a palette follower becomes its current
 * literal, Treatment is never involved, and every effective binding keeps its
 * own mapping when it differs from the set mapping. A missing pin, an unresolved
 * base or an image with no verified local source refuses rather than saving a
 * recipe the destination cannot reproduce.
 */
export async function flattenFinishForLibrary(
  capture: FinishLibraryCapture
): Promise<FinishLibraryDraftResult> {
  const issues: MaterialLibraryIssue[] = [];
  const resolution = resolveFinish(
    capture.base,
    capture.overrides,
    capture.palette,
    capture.imageIndex
  );
  if (resolution.inputs === null || resolution.issues.length > 0) {
    return {
      ok: false,
      issues: dedupeMaterialIssues(resolution.issues).map((problem) =>
        issue(
          problem.path,
          problem.code,
          problem.action ?? 'The Finish cannot be resolved for saving.'
        )
      )
    };
  }
  const inputs = resolution.inputs;
  const images = new Map<Hash, MaterialLibraryImageBinding>();
  const maps: Record<string, unknown> = {};
  for (const role of MATERIAL_MAP_ROLES) {
    const binding = bindingFor(role, inputs.maps[role], inputs.mapping, images);
    if (binding !== undefined) maps[role] = binding;
  }
  const recipeInput = {
    profile: inputs.profile,
    color: inputs.color,
    roughness: inputs.roughness,
    metalness: inputs.metalness,
    occlusionStrength: inputs.occlusionStrength,
    normalScale: inputs.normalScale,
    mapping: inputs.mapping,
    maps
  };
  const read = readRecipe(recipeInput);
  if (!read.success) {
    return {
      ok: false,
      issues: read.issues.map((problem) =>
        issue(problem.path, problem.code, problem.action ?? 'The flattened recipe is not admissible.')
      )
    };
  }
  const required = recipeImageDigests(read.recipe);
  for (const hash of required.keys()) {
    if (!images.has(hash)) {
      issues.push(issue('$.recipe.maps', 'missing_pin', `The recipe binds ${hash} with no verified image`));
    }
  }
  if (issues.length > 0) return { ok: false, issues };

  const payloadRead = readMaterialLibraryPayload({
    formatVersion: MATERIAL_LIBRARY_PAYLOAD_FORMAT_VERSION,
    kind: 'material',
    name: capture.name,
    recipe: read.recipe
  });
  if (!payloadRead.success) {
    return { ok: false, issues: payloadRead.issues };
  }
  const payload = payloadRead.payload;
  const capturedFollowers: string[] = [];
  const overrideColor = capture.overrides?.color;
  if (overrideColor !== undefined && typeof overrideColor !== 'string') {
    capturedFollowers.push(overrideColor.slot);
  }
  const bindings = materialLibraryImageBindings(read.recipe, [...images.values()]);
  if ('issues' in bindings) return { ok: false, issues: bindings.issues };
  return {
    ok: true,
    draft: {
      payload,
      contentId: await materialLibraryContentId(payload),
      recipeHash: await materialLibraryRecipeHash(payload),
      images: bindings.images,
      capturedFollowers
    }
  };
}

/**
 * Read one scene Finish from an envelope-like source and flatten it.
 *
 * This composes the runtime material index, the shipped manifest and the Scene's
 * verified texture pins exactly the way delivery and the Scene look adapter do.
 * The caller supplies the definition recipe because the pure resolver never
 * imports the resource unit.
 */
export function finishLibraryDraftFromScene(input: {
  readonly finish: Finish;
  readonly definition: Recipe | null;
  readonly definitionImages: readonly MaterialResourceImage[];
  readonly textureImages: readonly MaterialLibraryImageBinding[];
  readonly palette?: readonly PaletteSlot[];
}): Promise<FinishLibraryDraftResult> {
  if ('material' in input.finish.base && input.definition === null) {
    return Promise.resolve({
      ok: false,
      issues: [
        issue(
          '$.base.material',
          'missing-definition',
          'The Finish names a material definition this project no longer carries.'
        )
      ]
    });
  }
  const base: ResolveBase =
    'catalogue' in input.finish.base
      ? { catalogue: input.finish.base.catalogue }
      : { material: input.definition! };
  const imageIndex = mergeImageIndexes(
    shippedImageIndex(),
    materialImageIndex(input.definitionImages),
    materialImageIndex(input.textureImages)
  );
  return flattenFinishForLibrary({
    name: input.finish.name,
    base,
    ...(input.finish.overrides === undefined ? {} : { overrides: input.finish.overrides }),
    ...(input.palette === undefined ? {} : { palette: input.palette }),
    imageIndex
  });
}
