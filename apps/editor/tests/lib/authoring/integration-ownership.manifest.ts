/**
 * X9 ownership manifest.
 *
 * One policy table for the feature layer. The guards read this file; the
 * lifecycle and Escape order stay in their source tables.
 */
export type FeatureManifestEntry = {
	readonly id: string;
	readonly entry: string;
	readonly subOwners: readonly string[];
	readonly regions: readonly string[];
	readonly viewType: string;
};

export const FEATURES: readonly FeatureManifestEntry[] = [
	{
		id: 'appearance',
		entry: 'src/lib/authoring/look/appearance-feature.svelte.ts',
		subOwners: [
			'src/lib/authoring/look/appearance/card-session.svelte.ts',
			'src/lib/authoring/look/appearance/paint-session.svelte.ts',
			'src/lib/authoring/look/appearance/import-session.svelte.ts',
			'src/lib/authoring/look/appearance/library-draft-session.svelte.ts',
			'src/lib/authoring/look/appearance/align-session.svelte.ts',
			'src/lib/authoring/look/appearance/repair-session.svelte.ts',
			'src/lib/authoring/look/appearance/operations.ts',
			'src/lib/authoring/look/appearance/canvas-region.ts',
			'src/lib/authoring/look/appearance/finish-authority.ts'
		],
		regions: [
			'src/lib/authoring/look/AppearanceWorldRegions.svelte',
			'src/lib/authoring/look/AppearanceSharedRegions.svelte'
		],
		viewType: 'src/lib/authoring/look/appearance-view.ts'
	},
	{
		id: 'artwork',
		entry: 'src/lib/authoring/artwork/artwork-feature.svelte.ts',
		subOwners: [
			'src/lib/authoring/artwork/artwork-host.svelte.ts',
			'src/lib/authoring/stage/route/stage-artwork-interaction.svelte.ts'
		],
		regions: [],
		viewType: 'src/lib/authoring/artwork/artwork-view.ts'
	},
	{
		id: 'experience',
		entry: 'src/lib/authoring/experience/experience-feature.svelte.ts',
		subOwners: [
			'src/lib/authoring/stage/route/stage-experience-binding.svelte.ts',
			'src/lib/authoring/experience/experience-region-views.svelte.ts'
		],
		regions: [],
		viewType: 'src/lib/authoring/experience/experience-view.ts'
	},
	{
		id: 'layout-readings',
		entry: 'src/lib/authoring/stage/readings/layout-readings-feature.svelte.ts',
		subOwners: [
			'src/lib/authoring/stage/readings/unfold-host.svelte.ts',
			'src/lib/authoring/stage/readings/slice-host.svelte.ts',
			'src/lib/authoring/stage/readings/lift-host.svelte.ts',
			'src/lib/authoring/stage/readings/cutaway-host.svelte.ts',
			'src/lib/authoring/stage/readings/wall-face-host.svelte.ts',
			'src/lib/authoring/stage/readings/plan-parameters.svelte.ts',
			'src/lib/authoring/stage/readings/layout-readings-lifecycle.ts'
		],
		regions: [],
		viewType: 'src/lib/authoring/stage/readings/layout-readings-view.ts'
	},
	{
		id: 'library',
		entry: 'src/lib/authoring/library/library-feature.svelte.ts',
		subOwners: ['src/lib/authoring/library/library-host.svelte.ts'],
		regions: ['src/lib/authoring/library/LibraryWorldRegion.svelte'],
		viewType: 'src/lib/authoring/library/library-view.ts'
	},
	{
		id: 'light-inspection',
		entry: 'src/lib/authoring/look/light-inspection-feature.svelte.ts',
		subOwners: [
			'src/lib/authoring/stage/route/light-look-through.svelte.ts',
			'src/lib/authoring/look/light-inspection/light-inspection-guards.svelte.ts',
			'src/lib/authoring/look/light-inspection/light-coverage.ts'
		],
		regions: [],
		viewType: 'src/lib/authoring/look/light-inspection-view.ts'
	},
	{
		id: 'sky',
		entry: 'src/lib/authoring/look/sky-feature.svelte.ts',
		subOwners: ['src/lib/authoring/look/sky/sky-host.svelte.ts'],
		regions: [],
		viewType: 'src/lib/authoring/look/sky-view.ts'
	},
	{
		id: 'studio',
		entry: 'src/lib/authoring/studio/studio-feature.svelte.ts',
		subOwners: [
			'src/lib/authoring/studio/studio-controller.svelte.ts',
			'src/lib/authoring/studio/studio-port.svelte.ts',
			'src/lib/authoring/studio/studio-find.svelte.ts',
			'src/lib/authoring/studio/studio-entry-session.svelte.ts',
			'src/lib/authoring/studio/studio-strips.svelte.ts'
		],
		regions: ['src/lib/authoring/studio/StudioWorldRegions.svelte'],
		viewType: 'src/lib/authoring/studio/studio-view.ts'
	}
];

/**
 * Compatibility phases that remain because a named mounted case fails without
 * the creation point. Each is called exactly once by the host.
 */
export const COMPAT_PHASES = [
	{
		feature: 'appearance',
		phase: 'attachAuthoring',
		appendix: 'A17',
		proof: 'drops the Paint tray expansion and the draft when Paint is put down'
	},
	{
		feature: 'layout-readings',
		phase: 'attachReadings',
		appendix: 'A21',
		proof: 'releases the inspection and held cutaway when Preview takes the Stage'
	},
	{
		feature: 'artwork',
		phase: 'attachGuard',
		appendix: 'A24',
		proof: 'releases the inspection and held cutaway when Preview takes the Stage'
	}
] as const;
