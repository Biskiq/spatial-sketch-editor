import type { RegionProps } from '../../workspace/region-ownership';

export type SkyBounds = Exclude<RegionProps['canvas']['snapshotBounds'], undefined>;
export type SkyPanel = Exclude<RegionProps['panels']['environment'], undefined>;
