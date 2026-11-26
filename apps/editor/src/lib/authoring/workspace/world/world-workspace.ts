import WorldLeading from './WorldLeading.svelte';
import WorldTrailing from './WorldTrailing.svelte';

/**
 * The World workspace's placements.
 *
 * The host mounts these at the stage container's two placement slots; the
 * Experience workspace mounts none, because its contributions are region keys.
 * Keeping the pair in one descriptor is what makes the workspace a composition
 * unit rather than two region components that happen to share a folder.
 */
export const WORLD_WORKSPACE = {
	id: 'world' as const,
	leading: WorldLeading,
	trailing: WorldTrailing,
} as const;
