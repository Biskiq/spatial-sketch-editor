/** Existing bridges into Stage outside the adapter contract. Additions require review. */
const domainToCore: readonly [source: string, targets: readonly string[]][] = [
	// These Artwork views consume the same projected Stage primitives as the Stage overlay.
	['artwork/ArtworkCard.svelte', ['stage-facade.ts (type)']],
	['artwork/ArtworkHangingGuides.svelte', ['stage-facade.ts (type)']],
	['artwork/ArtworkResizeOverlay.svelte', ['stage-facade.ts (type)']],

	// Experience components share the editor's glyphs and snapshot handoff.
	['experience/ExperienceMarks.svelte', ['shell/StageSticker.svelte']],
	['experience/ExperienceGuideHeader.svelte', ['shell/ShellIcon.svelte']],
	['experience/ExperiencePathMovement.svelte', ['shell/ShellIcon.svelte']],
	['experience/ExperiencePresentationWriter.svelte', ['shell/ShellIcon.svelte']],
	['experience/ExperienceSnapshot.svelte', ['shell/ShellIcon.svelte', 'stage-snapshots.ts']],
	['experience/ExperienceStopWriter.svelte', ['shell/ShellIcon.svelte']],
	['experience/ExperienceSubjectWriter.svelte', ['shell/ShellIcon.svelte']],
	['experience/ExperienceTransitionWriter.svelte', ['shell/ShellIcon.svelte']],
	['experience/ExperienceViewWriter.svelte', ['shell/ShellIcon.svelte']],
	// Existing Experience views and controller use the accepted source and Stage viewing contracts.
	['experience/experience-controller.svelte.ts', ['unit-stage-source.ts']],
	['experience/experience-card-model.ts', ['stage-facade.ts (type)']],
	['experience/experience-index.ts', ['shell/experience-index-groups.ts (type)']],
	['experience/experience-lens.svelte.ts', ['stage-axis-travel.ts', 'stage-input.ts', 'stage-facade.ts (type)']],
	['experience/experience-lens-tools.svelte.ts', ['stage-input.ts']],
	['experience/experience-view-edit-session.svelte.ts', ['stage-axis-travel.ts']],
	['experience/experience-preview.svelte.ts', ['stage-facade.ts (type)']],
	['experience/preview-handover.ts', ['camera-session.ts (type)']],

	// Plan picking must agree with the readings and clipping already installed in Canvas.
	['layout/plan-pick-provider.ts', [
		'cutaway/cutaway-resolved.ts', 'cutaway/cutaway-resolved.ts (type)', 'lift-ink.ts',
		'paper-plan.ts', 'paper-plan.ts (type)', 'slice/slice-clip-2d.ts', 'slice/slice-cut.ts',
		'slice/slice-cut.ts (type)', 'slice/slice-resolved.ts', 'stage-facade.ts (type)'
	]],
	['layout/plan-pick-geometry.ts', [
		'cutaway/cutaway-resolved.ts', 'cutaway/cutaway-resolved.ts (type)', 'lift-ink.ts',
		'paper-plan.ts', 'paper-plan.ts (type)', 'slice/slice-clip-2d.ts', 'slice/slice-cut.ts',
		'slice/slice-cut.ts (type)', 'slice/slice-resolved.ts', 'stage-facade.ts (type)'
	]],

	// Shared Material Editor wheel, and the current Library browse-view and selection contracts.
	['library/LibraryMaterialEditor.svelte', ['shell/StagePaintWheel.svelte']],
	['library/LibraryMaterialEditorFields.svelte', ['shell/StagePaintWheel.svelte']],
	['library/StageLibrary.svelte', ['route/stage-shell-state.svelte.ts (type)']],
	['library/library-target.ts', ['semantic-selection.ts (type)']],
	// Existing Look runtimes consume selection identities and accepted facade types.
	['look/finish-card.svelte.ts', ['semantic-selection.ts (type)']],
	['look/look-authoring.svelte.ts', ['stage-facade.ts (type)', 'stage-handles.ts (type)']],
	// The project lifetime reads and hands off the same canonical Stage session and admitted source.
	['project-session/project-session.svelte.ts', [
		'boot-state.ts', 'boot-state.ts (type)', 'host-acceptance.ts (type)', 'source-admission.ts (type)',
		'stage-session.ts', 'stage-session.ts (type)'
	]]
];

export const DOMAIN_TO_CORE = new Set(domainToCore.flatMap(([from, targets]) =>
	targets.map((to) => `${from} → stage/${to}`)));
