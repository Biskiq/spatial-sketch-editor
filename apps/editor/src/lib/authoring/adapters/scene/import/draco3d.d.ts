/**
 * `draco3d` ships no type declarations and the recipe imports it only through a
 * dynamic `import()` for sources that declare `KHR_draco_mesh_compression`.
 * Declaring the one export the recipe uses keeps the decoder load lazy without
 * an `any` in the recipe itself.
 */
declare module 'draco3d' {
	export function createDecoderModule(options?: unknown): Promise<unknown>;
}
