import type { RegionProps } from '../workspace/region-ownership';

export type ArtworkScope = RegionProps['canvas']['artworkScope'];
export type ArtworkOverlay = Exclude<RegionProps['viewport']['artwork'], undefined>;
export type HangingOverlay = Exclude<RegionProps['viewport']['hanging'], undefined>;
