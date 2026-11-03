/**
 * The Experience groups the shared Index shows in the Experience lens (R217.S25).
 *
 * A projection the route builds from the Experience controller. The Index only renders
 * it and reports the creator's intent back through these callbacks; it owns no
 * Experience state, and it never submits a command itself.
 */
export type ExperienceIndexGroups = {
	/** The lens is mounted but the controller is not yet bound to the admitted source. */
	readonly pending: boolean;
	/** Every Experience of the source, for the crumb's sibling menu. */
	readonly experiences: readonly { readonly id: string; readonly label: string }[];
	/** The open Experience, or null when the source has none yet. */
	readonly current: { readonly id: string; readonly label: string } | null;
	/** The Guides of the open Experience. One is active (`open`); its panel is the instrument. */
	readonly guides: readonly {
		readonly id: string;
		readonly label: string;
		/** The Guide's Stops, for the row's *n stops* meta. */
		readonly stopCount: number;
		readonly open: boolean;
		readonly selected: boolean;
		/** R217.S26: the Experience's Opening Guide carries the *opens* tag. */
		readonly opening: boolean;
	}[];
	/** The Presentations the filter leaves, in the Experience's own order. */
	readonly presentations: readonly {
		readonly id: string;
		readonly label: string;
		readonly viewCount: number;
		readonly explorable: boolean;
		/** 1-based positions in the active Guide; empty when the Guide has no Stop for the Presentation. */
		readonly stopNumbers: readonly number[];
		readonly selected: boolean;
		readonly expanded: boolean;
		readonly views: readonly {
			readonly id: string;
			readonly label: string;
			readonly onTour: boolean;
			readonly isDefault: boolean;
			readonly selected: boolean;
		}[];
	}[];
	/** Every Presentation of the Experience, before the filter (the search appears from 8). */
	readonly totalPresentations: number;
	/** The Presentation filter the search field shows. */
	readonly query: string;
	readonly busy: boolean;
	onQuery(query: string): void;
	onOpenExperience(experienceId: string): void;
	onCreateExperience(): void;
	/** R217.S26: the crumb's inline rename. An empty name refuses with its reason. */
	onRenameExperience(label: string): Promise<{ readonly kind: 'accepted' | 'refused'; readonly message?: string }>;
	/** null = the "No Guide yet" row: open the empty Guide. */
	onOpenGuide(guideId: string | null): void;
	onSelectPresentation(presentationId: string): void;
	onToggleExpand(presentationId: string): void;
	onSelectView(viewId: string, presentationId: string): void;
};
