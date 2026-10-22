import type { Vec3 } from '$lib/types/scene';
import type { FallbackKind } from '$lib/types/assets';

export type AssetFallbackKind = FallbackKind | 'book' | 'decor';

/** Approximate world-space bounds in metres: [width, height, depth]. */
export const assetFallbackDimensions: Record<AssetFallbackKind, Vec3> = {
  piano: [1.5, 1, 2.25],
  chair: [0.64, 0.9, 0.54],
  sofa: [2.46, 1.01, 0.83],
  table: [0.95, 0.69, 0.95],
  chandelier: [0.89, 1.48, 0.9],
  desk: [1.4, 0.75, 0.7],
  lamp: [0.32, 0.55, 0.32],
  frame: [0.85, 1.05, 0.07],
  book: [0.18, 0.04, 0.25],
  books: [0.48, 0.15, 0.3],
  clock: [0.38, 2.11, 0.5],
  decor: [0.22, 0.38, 0.22],
  rug: [2.6, 0.015, 1.8],
  // Neutral 1 m box when no approved footprint is available.
  generic: [1, 1, 1]
};

/**
 * The fallback box for a model kind. A creator model's approved footprint owns
 * its width and depth; height stays a neutral 1 m until an instance supplies a
 * placed scale. Catalogue kinds ignore the footprint argument.
 */
export function fallbackDimensionsFor(
  kind: AssetFallbackKind,
  footprint?: { width: number; depth: number }
): Vec3 {
  if (kind !== 'generic' || footprint === undefined) return assetFallbackDimensions[kind];
  return [footprint.width, 1, footprint.depth];
}
