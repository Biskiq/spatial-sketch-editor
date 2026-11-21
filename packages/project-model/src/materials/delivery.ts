/**
 * The pure material delivery contribution for the cold composer and T4.
 *
 * The projection is an immutable derivation of admitted authored values:
 *
 * - the one supported profile;
 * - every resource-backed definition an admitted subject actually uses, sorted
 *   by digest;
 * - every image pin the subject's effective bindings resolve to, sorted by
 *   digest then local source;
 * - one use per admitted subject with its resolved (untreated) inputs and its
 *   coordinate requirements, sorted by subject.
 *
 * It never reads a renderer, a Scene unit or a network. The cold composer
 * supplies the verified image index and manifest pins; a project texture without
 * a manifest digest is refused even when its HTTP read succeeded, and a static
 * image must be in the frozen shipped manifest.
 */
import { shippedImage } from './catalogue';
import { dedupeMaterialIssues, type MaterialIssue } from './issues';
import {
	materialImageIndex,
	mergeImageIndexes,
	resolveFinish,
	shippedImageIndex,
	type ImageIndex
} from './resolve';
import type {
	Finish,
	Hash,
	MapRole,
	Mapping,
	PaletteSlot,
	Recipe,
	ResolvedImage
} from './types';

export type MaterialDeliveryImagePin = {
	readonly hash: Hash;
	readonly source: ResolvedImage['source'];
	readonly mime: string;
	readonly size: number;
	/** Static images carry the frozen shipped URI as their locator. */
	readonly locator?: string;
};

export type MaterialDeliveryMappingRequirement = {
	readonly role: MapRole;
	readonly kind: Mapping['kind'];
	/** Present for `uv` mapping. */
	readonly uvSet?: 0 | 1;
};

export type MaterialDeliveryUse = {
	readonly subject: string;
	readonly finishId: string | null;
	readonly resolvedInputs: import('./types').BoundInputs;
	readonly mappingRequirements: readonly MaterialDeliveryMappingRequirement[];
};

export type MaterialDeliveryContribution = {
	readonly profiles: readonly { readonly id: string; readonly version: string }[];
	readonly definitions: readonly { readonly hash: Hash; readonly recipe: Recipe }[];
	readonly imagePins: readonly MaterialDeliveryImagePin[];
	readonly uses: readonly MaterialDeliveryUse[];
	readonly issues: readonly MaterialIssue[];
};

type MaterialDeliverySubjectBase = {
	readonly subject: string;
	readonly palette?: readonly PaletteSlot[];
};

/**
 * One admitted drawable subject. A named Finish carries its overrides; a direct
 * catalogue assignment (`materialId` with no instance) contributes the curated
 * recipe and reports no Finish id.
 */
export type MaterialDeliverySubject =
	| (MaterialDeliverySubjectBase & { readonly finish: Finish; readonly catalogue?: never })
	| (MaterialDeliverySubjectBase & { readonly catalogue: string; readonly finish?: never });

export type MaterialDeliveryInput = {
	/** Resource-backed definitions by digest. */
	readonly definitions: ReadonlyMap<Hash, Recipe>;
	/** Each definition's own image mappings, keyed by definition digest. */
	readonly definitionImages: ReadonlyMap<Hash, readonly ResolvedImage[]>;
	readonly imageIndex: ImageIndex;
	/**
	 * Verified manifest pins for project bytes. Delivery requires a digest, MIME
	 * and exact byte length; a missing entry refuses the subject.
	 */
	readonly projectImagePins?: ReadonlyMap<Hash, { readonly mime: string; readonly size: number; readonly locator?: string }>;
	readonly subjects: readonly MaterialDeliverySubject[];
};

function mappingRequirement(role: MapRole, mapping: Mapping): MaterialDeliveryMappingRequirement {
	return {
		role,
		kind: mapping.kind,
		...(mapping.kind === 'uv' ? { uvSet: mapping.set } : {})
	};
}

function compareText(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}

function sourceKey(source: ResolvedImage['source']): string {
	return 'textureId' in source ? `texture:${source.textureId}` : `shipped:${source.shipped}`;
}

/**
 * Project one admitted set of subjects.
 *
 * The same Finish used by two subjects contributes one definition and one pin
 * set, but two uses: the use is the subject's own accepted binding, not a
 * property of the shared definition.
 */
export function materialDeliveryContribution(
	input: MaterialDeliveryInput
): MaterialDeliveryContribution {
	const issues: MaterialIssue[] = [];
	const definitions = new Map<Hash, Recipe>();
	const pins = new Map<string, MaterialDeliveryImagePin>();
	const uses: MaterialDeliveryUse[] = [];

	const addPin = (image: ResolvedImage): void => {
		const key = `${image.hash}\0${sourceKey(image.source)}`;
		if (pins.has(key)) return;
		if ('shipped' in image.source) {
			const shipped = shippedImage(image.source.shipped);
			if (shipped === undefined || shipped.hash !== image.hash) {
				issues.push({
					code: 'missing-image',
					path: `$.images.${image.hash}`,
					action: 'Use an image from the frozen static manifest.'
				});
				return;
			}
			pins.set(key, {
				hash: image.hash,
				source: image.source,
				mime: shipped.mime,
				size: shipped.byteSize,
				locator: shipped.uri
			});
			return;
		}
		const pin = input.projectImagePins?.get(image.hash);
		if (pin === undefined) {
			issues.push({
				code: 'missing-pin',
				path: `$.images.${image.hash}`,
				action: 'Verify the downloaded bytes and add their manifest digest, MIME and byte length.'
			});
			return;
		}
		pins.set(key, {
			hash: image.hash,
			source: image.source,
			mime: pin.mime,
			size: pin.size,
			...(pin.locator === undefined ? {} : { locator: pin.locator })
		});
	};

	for (const subject of input.subjects) {
		const finish = subject.finish ?? null;
		const base =
			finish === null
				? { catalogue: subject.catalogue! }
				: 'catalogue' in finish.base
				? { catalogue: finish.base.catalogue }
				: (() => {
						const recipe = input.definitions.get(finish.base.material);
						if (recipe === undefined) {
							issues.push({
								code: 'missing-definition',
								path: `$.subjects.${subject.subject}.base.material`,
								action: 'Include the definition this Finish names in the delivery closure.'
							});
							return null;
						}
						definitions.set(finish.base.material, recipe);
						return { material: recipe };
					})();
		if (base === null) continue;
		const imageIndex = finish !== null && 'material' in finish.base
			? mergeImageIndexes(
					shippedImageIndex(),
				materialImageIndex(input.definitionImages.get(finish.base.material) ?? []),
				input.imageIndex
				)
			: input.imageIndex;
		const resolution = resolveFinish(base, finish?.overrides, subject.palette, imageIndex);
		issues.push(...resolution.issues);
		if (resolution.inputs === null) continue;
		const requirements: MaterialDeliveryMappingRequirement[] = [];
		for (const role of ['color', 'normal', 'roughness', 'metalness', 'occlusion'] as const) {
			const binding = resolution.inputs.maps[role];
			if (binding === undefined || binding.image === null) continue;
			addPin(binding.image);
			requirements.push(mappingRequirement(role, binding.mapping));
		}
		uses.push({
			subject: subject.subject,
			finishId: finish?.id ?? null,
			resolvedInputs: resolution.inputs,
			mappingRequirements: requirements
		});
	}

	if (issues.length > 0) {
		return {
			profiles: [],
			definitions: [],
			imagePins: [],
			uses: [],
			issues: dedupeMaterialIssues(issues)
		};
	}
	return {
		profiles: [{ id: 'pbr-metallic-roughness', version: '1' }],
		definitions: [...definitions.entries()]
			.map(([hash, recipe]) => ({ hash, recipe }))
			.sort((left, right) => compareText(left.hash, right.hash)),
		imagePins: [...pins.values()].sort(
			(left, right) =>
				compareText(left.hash, right.hash) || compareText(sourceKey(left.source), sourceKey(right.source))
		),
		uses: uses.sort((left, right) => compareText(left.subject, right.subject)),
		issues: []
	};
}
