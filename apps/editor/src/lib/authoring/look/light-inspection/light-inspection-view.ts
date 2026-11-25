import type { RegionProps } from '../../workspace/region-ownership';

export type LightCoverage = Exclude<RegionProps['viewport']['lightCoverage'], undefined>;
export type LightThroughFrame =
	NonNullable<RegionProps['viewport']['lookThrough']> & { readonly mode: 'light' };
