/**
 * The Experience Preview host.
 *
 * It owns the route-local Preview controller and the Artwork closure the
 * Preview hands to the Stage: every placed image is verified once, up front,
 * and then served from the closed-over bytes for the run. It keeps no state of
 * its own; the controller remains the one Preview authority.
 */
import type { ProjectApi } from '$lib/platform/project-persistence';
import type { StageDomainRead } from '../stage/source-admission';
import { createExperiencePreview } from './experience-preview.svelte';
import { readVerifiedArtwork } from '../artwork/project-artwork';
import { verifyArtworkDecode } from '$lib/render/artwork/artwork-decode';
import { createArtworkScope, type ArtworkBytes } from '$lib/render/artwork/artwork-scope';

export type ExperiencePreviewHostInput = Omit<
	Parameters<typeof createExperiencePreview>[0],
	'prepareArtwork'
> & {
	readonly api: ProjectApi | null;
	readonly projectId: string;
};

export function createExperiencePreviewHost(input: ExperiencePreviewHostInput) {
	const { api, projectId, ...rest } = input;
	return createExperiencePreview({
		...rest,
		async prepareArtwork(domain, signal) {
			const read = domain as StageDomainRead;
			const images = new Map(
				read.scene.entities.flatMap((entity) =>
					entity.kind === 'artwork' ? [[entity.source.assetId, entity.source] as const] : [],
				),
			);
			if (!images.size) return null;
			if (api === null) throw new Error('Artwork images are unavailable in Preview.');
			const bytes = new Map<string, ArtworkBytes>();
			const rows = new Map((await api.listAssets(projectId, signal)).map((row) => [row.id, row]));
			for (const [id, image] of images) {
				const row = rows.get(id);
				if (!row) throw new Error('A placed Artwork is missing. Retry entering Preview.');
				const content = await readVerifiedArtwork(api, projectId, image, signal, row);
				await verifyArtworkDecode(content.bytes, content.mime, image);
				signal.throwIfAborted();
				bytes.set(id, content);
			}
			return createArtworkScope(async (image) => {
				const content = bytes.get(image.assetId);
				if (!content) throw new Error('Artwork is missing in this Preview.');
				return content;
			});
		},
	});
}

export type ExperiencePreviewHost = ReturnType<typeof createExperiencePreviewHost>;
