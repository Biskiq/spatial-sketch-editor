/**
 * The complete project-image closure (T2.S8 · PR C).
 *
 * A project names creator bytes in two places: the Scene texture registry (a
 * Finish image, including records left behind by a removed Finish) and the
 * Artwork shelf. Save, cold Load and detached delivery must resolve the same
 * logical images and reject a document that gives one asset two different pins.
 *
 * This module is the one enumerator. It is pure and runtime-safe: the API, the
 * editor and the cold visitor can all read it without importing a renderer or a
 * storage implementation. It deliberately returns **requirements**, not bytes:
 *
 * - a project texture carries an authored `texture` resource pin when one is
 *   present; Save and Load require that pin, because it is the only authored
 *   answer for what those bytes are;
 * - an Artwork image has no authored hash; its P20 registry row is authoritative
 *   and its shelf entry carries the oriented dimensions to verify.
 *
 * `delivery` includes the current texture registry closure and only placed
 * Artwork, matching release preparation. `private-save` and `private-load`
 * include every registered project texture and every shelf image, whether or
 * not a Finish or a hanging still uses it, so an unreferenced-but-registered
 * image can never silently disappear from the saved head.
 *
 * Static catalogue textures are not project bytes. For delivery they must name
 * the frozen shipped registry; private Save/Load leave them to the editor's
 * catalogue path.
 */
import { isArtworkAssetId } from './artwork';
import { shippedImage } from './materials/catalogue';
import { finishTextureBindings } from './materials/read';
import { ARTWORK_MAX_BYTES } from './artwork-image';
import { isAllowedShippedTextureUri } from './shipped-static';
import type { ProjectEnvelope, ResourcePin, TypedResource } from './units/types';

export type ProjectImagePurpose = 'private-save' | 'private-load' | 'delivery';

export const PROJECT_ASSET_URI_PREFIX = '/project-assets/';

const IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/webp'] as const;
const SHA256_IDENTITY = /^sha256-[0-9a-f]{64}$/;

/** The bytes identity an image requirement resolves to. */
export type ProjectImagePin = Readonly<{
	hash: string;
	mime: (typeof IMAGE_MIMES)[number];
	size: number;
}>;

/** Oriented dimensions declared by one Artwork shelf entry. */
export type ProjectImageArtwork = Readonly<{
	name: string;
	pixelWidth: number;
	pixelHeight: number;
}>;

/**
 * One logical project image and every authored path that references it.
 *
 * `expectedPin` is the authored `texture` resource pin. It is `null` for an
 * Artwork image, whose P20 registry row is authoritative. `artwork` is present
 * only when a shelf entry declares oriented dimensions.
 */
export type ProjectImageRequirement = Readonly<{
	assetId: string;
	locator: string;
	expectedPin: ProjectImagePin | null;
	artwork: ProjectImageArtwork | null;
	paths: readonly string[];
}>;

export type ProjectImageClosureIssue = Readonly<{
	path: string;
	code: string;
	message: string;
}>;

export type ProjectImageClosure = Readonly<{
	requirements: readonly ProjectImageRequirement[];
	issues: readonly ProjectImageClosureIssue[];
}>;

type Scene = ProjectEnvelope['units']['scene']['data'];

function isImageMime(value: unknown): value is ProjectImagePin['mime'] {
	return typeof value === 'string' && (IMAGE_MIMES as readonly string[]).includes(value);
}

/** Whether a value is a pin a project texture may carry. */
export function isProjectImagePin(value: unknown): value is ProjectImagePin {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
	const pin = value as Record<string, unknown>;
	return (
		typeof pin.hash === 'string' &&
		SHA256_IDENTITY.test(pin.hash) &&
		isImageMime(pin.mime) &&
		typeof pin.size === 'number' &&
		Number.isSafeInteger(pin.size) &&
		pin.size > 0 &&
		pin.size <= ARTWORK_MAX_BYTES
	);
}

function expectedPinOf(resource: TypedResource | undefined): ProjectImagePin | null {
	const pin: ResourcePin | null = resource?.pin ?? null;
	if (pin === null) return null;
	return isProjectImagePin(pin)
		? { hash: pin.hash, mime: pin.mime as ProjectImagePin['mime'], size: pin.size }
		: null;
}

function resourceFor(
	resources: readonly TypedResource[],
	assetId: string,
): TypedResource | undefined {
	return resources.find((resource) => resource.kind === 'texture' && resource.id === assetId);
}

function addPath(paths: string[], path: string): void {
	if (!paths.includes(path)) paths.push(path);
}

function comparePaths(paths: string[]): string[] {
	return [...paths].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
}

/**
 * Enumerate the image closure of one Scene payload.
 *
 * `resources` supplies the authored texture pins. Passing an empty list is the
 * legacy release shape, where the P20 registry row is the only pin; Save and
 * Load pass the envelope's resource unit and therefore require an authored pin.
 */
export function collectSceneImageRequirements(
	scene: Scene,
	purpose: ProjectImagePurpose,
	resources: readonly TypedResource[] = [],
): ProjectImageClosure {
	const issues: ProjectImageClosureIssue[] = [];
	const requirements = new Map<string, { requirement: ProjectImageRequirement; paths: string[] }>();

	const placedArtwork = new Set<string>();
	for (const entity of scene.entities) {
		if (entity.kind === 'artwork') placedArtwork.add(entity.source.assetId);
	}

	function add(requirement: ProjectImageRequirement): void {
		const existing = requirements.get(requirement.assetId);
		if (existing === undefined) {
			requirements.set(requirement.assetId, { requirement, paths: [...requirement.paths] });
			return;
		}
		for (const path of requirement.paths) addPath(existing.paths, path);
		const previous = existing.requirement;
		if (
			previous.expectedPin !== null &&
			requirement.expectedPin !== null &&
			(previous.expectedPin.hash !== requirement.expectedPin.hash ||
				previous.expectedPin.mime !== requirement.expectedPin.mime ||
				previous.expectedPin.size !== requirement.expectedPin.size)
		) {
			issues.push({
				path: requirement.paths[0] ?? requirement.locator,
				code: 'image-pin-conflict',
				message: `Project image "${requirement.assetId}" is pinned to two different byte identities`,
			});
			return;
		}
		const expectedPin = previous.expectedPin ?? requirement.expectedPin;
		const artwork = previous.artwork ?? requirement.artwork;
		if (
			previous.artwork !== null &&
			requirement.artwork !== null &&
			(previous.artwork.pixelWidth !== requirement.artwork.pixelWidth ||
				previous.artwork.pixelHeight !== requirement.artwork.pixelHeight)
		) {
			issues.push({
				path: requirement.paths[0] ?? requirement.locator,
				code: 'image-dimensions-conflict',
				message: `Project image "${requirement.assetId}" declares two different oriented sizes`,
			});
			return;
		}
		existing.requirement = { ...previous, expectedPin, artwork };
	}

	for (const [index, texture] of scene.textures.entries()) {
		const recordPath = `$.units.scene.data.textures[${index}].uri`;
		if (!texture.uri.startsWith(PROJECT_ASSET_URI_PREFIX)) {
			if (purpose === 'delivery' && !isAllowedShippedTextureUri(texture.uri)) {
				issues.push({
					path: recordPath,
					code: 'image-static-unknown',
					message: `Static texture "${texture.uri}" is not in the frozen shipped registry`,
				});
			}
			continue;
		}
		const assetId = texture.uri.slice(PROJECT_ASSET_URI_PREFIX.length);
		if (!isArtworkAssetId(assetId) || texture.id !== assetId) {
			issues.push({
				path: recordPath,
				code: 'image-texture-identity-mismatch',
				message: `Scene texture "${texture.id}" must carry the canonical project asset URI for its own id`,
			});
			continue;
		}
		const resource = resourceFor(resources, assetId);
		const expectedPin = expectedPinOf(resource);
		if (purpose !== 'delivery' && expectedPin === null) {
			issues.push({
				path: `$.units.resources.data.resources`,
				code: 'image-pin-missing',
				message: `Project image "${assetId}" needs a texture resource pin before it can be saved or opened`,
			});
			continue;
		}
		if (expectedPin !== null && resource?.pin?.locator !== texture.uri) {
			issues.push({
				path: `$.units.resources.data.resources`,
				code: 'image-pin-locator-mismatch',
				message: `Project image "${assetId}" is pinned to a different locator than its Scene texture record`,
			});
			continue;
		}
		const paths = [recordPath];
		for (const [materialIndex, material] of scene.materials.entries()) {
			for (const binding of finishTextureBindings(material)) {
				if (binding.textureId === texture.id) {
					addPath(
						paths,
						`$.units.scene.data.materials[${materialIndex}].overrides.maps.${binding.role}.image.textureId`,
					);
				}
			}
		}
		add({
			assetId,
			locator: texture.uri,
			expectedPin,
			artwork: null,
			// The Scene record is the canonical locator and stays first; the
			// material/entity references follow in authored order.
			paths: [recordPath, ...comparePaths(paths.filter((path) => path !== recordPath))],
		});
	}

	// Scene 12 Finish overrides name local images directly. Every one is a
	// project image reference, whether the binding came from a curated base or a
	// resource definition.
	for (const [materialIndex, material] of scene.materials.entries()) {
		for (const binding of finishTextureBindings(material)) {
			const path = `$.units.scene.data.materials[${materialIndex}].overrides.maps.${binding.role}.image.textureId`;
			const resource = resourceFor(resources, binding.textureId);
			const expectedPin = expectedPinOf(resource);
			if (expectedPin === null && purpose !== 'delivery') {
				issues.push({
					path,
					code: 'image-pin-missing',
					message: `Project image "${binding.textureId}" needs a texture resource pin before it can be saved or opened`,
				});
				continue;
			}
			add({
				assetId: binding.textureId,
				locator: `${PROJECT_ASSET_URI_PREFIX}${binding.textureId}`,
				expectedPin,
				artwork: null,
				paths: [path],
			});
		}
		// A Scene 12 override may name a shipped image rather than a project
		// texture. It has no P20 pin, so its only admissible identity is the frozen
		// shipped manifest; a root-relative path is not enough.
		for (const [role, binding] of Object.entries(material.overrides?.maps ?? {})) {
			if (binding === null || binding === undefined || !('image' in binding)) continue;
			const image = binding.image;
			if (!('shipped' in image)) continue;
			if (shippedImage(image.shipped) !== undefined) continue;
			issues.push({
				path: `$.units.scene.data.materials[${materialIndex}].overrides.maps.${role}.image.shipped`,
				code: 'image-static-unknown',
				message: `Static texture "${image.shipped}" is not in the frozen shipped registry`,
			});
		}
	}

	// Every material definition belongs to the same project-image closure. Its
	// recipe digests are exact, so a local mapping is verified against both the
	// Scene texture record and that texture's resource pin.
	for (const [resourceIndex, resource] of resources.entries()) {
		if (resource.kind !== 'material' || resource.material === undefined) continue;
		const definitionPath = `$.units.resources.data.resources[${resourceIndex}].material.images`;
		for (const image of resource.material.images) {
			if ('shipped' in image.source) {
				const shipped = shippedImage(image.source.shipped);
				if (shipped === undefined || shipped.hash !== image.hash) {
					issues.push({
						path: definitionPath,
						code: 'image-static-unknown',
						message: `Material "${resource.id}" names shipped image "${image.source.shipped}" outside the frozen manifest or with a different digest`,
					});
				}
				continue;
			}
			const textureId = image.source.textureId;
			const texture = scene.textures.find((candidate) => candidate.id === textureId);
			if (texture === undefined) {
				issues.push({
					path: definitionPath,
					code: 'image-texture-identity-mismatch',
					message: `Material "${resource.id}" maps ${image.hash} to texture "${textureId}" with no Scene texture record`,
				});
				continue;
			}
			const textureResource = resourceFor(resources, textureId);
			const expectedPin = expectedPinOf(textureResource);
			if (expectedPin === null) {
				issues.push({
					path: definitionPath,
					code: 'image-pin-missing',
					message: `Material "${resource.id}" maps ${image.hash} to texture "${textureId}" with no resolved pin`,
				});
				continue;
			}
			if (expectedPin.hash !== image.hash) {
				issues.push({
					path: definitionPath,
					code: 'image-pin-conflict',
					message: `Material "${resource.id}" binds ${image.hash} and texture "${textureId}" pins ${expectedPin.hash}`,
				});
				continue;
			}
			add({
				assetId: textureId,
				locator: texture.uri,
				expectedPin,
				artwork: null,
				paths: [definitionPath],
			});
		}
	}

	for (const [index, image] of (scene.artworkLibrary ?? []).entries()) {
		if (purpose === 'delivery' && !placedArtwork.has(image.assetId)) continue;
		const paths = [`$.units.scene.data.artworkLibrary[${index}]`];
		if (!isArtworkAssetId(image.assetId)) {
			issues.push({
				path: paths[0]!,
				code: 'image-artwork-identity-invalid',
				message: 'An Artwork shelf entry must carry a canonical project asset id',
			});
			continue;
		}
		for (const [entityIndex, entity] of scene.entities.entries()) {
			if (entity.kind === 'artwork' && entity.source.assetId === image.assetId) {
				addPath(paths, `$.units.scene.data.entities[${entityIndex}].source`);
			}
		}
		add({
			assetId: image.assetId,
			locator: `${PROJECT_ASSET_URI_PREFIX}${image.assetId}`,
			expectedPin: null,
			artwork: { name: image.name, pixelWidth: image.pixelWidth, pixelHeight: image.pixelHeight },
			paths,
		});
	}

	if (purpose === 'delivery') {
		for (const assetId of placedArtwork) {
			if ((scene.artworkLibrary ?? []).some((image) => image.assetId === assetId)) continue;
			issues.push({
				path: '$.units.scene.data.artworkLibrary',
				code: 'image-artwork-shelf-missing',
				message: `Placed Artwork "${assetId}" has no shelf entry declaring its dimensions`,
			});
		}
	}

	return {
		requirements: [...requirements.values()]
			.map((entry) => ({ ...entry.requirement, paths: [...entry.paths] }))
			.sort((left, right) =>
				left.assetId < right.assetId ? -1 : left.assetId > right.assetId ? 1 : 0,
			),
		issues: issues.sort((left, right) =>
			left.path < right.path ? -1 : left.path > right.path ? 1 : left.code < right.code ? -1 : 1,
		),
	};
}

/** Enumerate the image closure of a complete admitted project envelope. */
export function collectEnvelopeImageRequirements(
	envelope: ProjectEnvelope,
	purpose: ProjectImagePurpose,
): ProjectImageClosure {
	return collectSceneImageRequirements(
		envelope.units.scene.data,
		purpose,
		envelope.units.resources.data.resources,
	);
}
