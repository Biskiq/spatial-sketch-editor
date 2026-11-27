import { admittedCatalogueModelAssets } from '../../scene/object-definition-policy';

/**
 * Admitted catalogue models any project may place.
 *
 * Admission, not held resources, decides visibility: `place-object` grants the
 * shipped asset resource and its exact lock in the same accepted result as the
 * entity, so a project that does not yet carry the resource is still able to
 * place it. A catalogue model without an admitted definition or recorded contact
 * is not offered, because that placement would always refuse.
 */
export function visibleCatalogueModels(
	inStudio: boolean,
): readonly { readonly id: string; readonly name: string }[] {
	if (inStudio) return [];
	return admittedCatalogueModelAssets();
}
