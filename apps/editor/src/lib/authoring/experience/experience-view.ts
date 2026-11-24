import type { RegionProps } from '../workspace/region-ownership';

/**
 * Experience's share of the shared regions. Experience mounts no region of its
 * own: its keys are read from this view type and assigned by the host.
 */
export type ExperienceViewportView = Pick<
	RegionProps['viewport'],
	| 'experienceMarks'
	| 'viewEditTurn'
	| 'pendingViewWrite'
	| 'onResolvePendingViewWrite'
	| 'onCancelPendingViewWrite'
	| 'welcome'
	| 'onDismissWelcome'
	| 'homes'
	| 'onExperienceController'
>;

export type ExperienceToolbarView = Pick<RegionProps['toolbars'], 'viewLine' | 'experience'>;
