/**
 * Narrow teardown facade for hosts that must release a texture scope without
 * importing the editor texture store into their source boundary.
 *
 * The implementation remains in `texture-store.ts`, beside the source and
 * variant caches it owns.
 */
export { releaseTextureScope } from './texture-store';