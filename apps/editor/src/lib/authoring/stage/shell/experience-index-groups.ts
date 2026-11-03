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
	/** Every Experience of the source, for the locator's sibling switch. */
	readonly experiences: readonly { readonly id: string; readonly label: string }[];
	/** The open Experience, or null when the source has none yet. */
	readonly current: { readonly id: string; readonly label: string } | null;
	/** The Presentations the filter leaves, in the Experience's own order. */
	readonly presentations: readonly {
		readonly id: string;
		readonly label: string;
		readonly selected: boolean;
	}[];
	/** The Presentation filter the search field shows. */
	readonly query: string;
	readonly busy: boolean;
	/** The Guide group: the open Experience's entry or named Guide, and whether its panel is open. */
	readonly guide: { readonly label: string | null; readonly open: boolean } | null;
	onQuery(query: string): void;
	onOpenExperience(experienceId: string): void;
	onSelectPresentation(presentationId: string): void;
	onCreateExperience(): void;
	onToggleGuide(): void;
};
