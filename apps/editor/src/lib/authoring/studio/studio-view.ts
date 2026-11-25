import type { ComponentProps } from 'svelte';
import type StudioScopeStrip from './StudioScopeStrip.svelte';
import type StudioRootPanel from './StudioRootPanel.svelte';
import type StudioTransferStrip from './StudioTransferStrip.svelte';
import type { StudioContext, StudioOrigin } from './studio-model';

export type StudioTransferView = ComponentProps<typeof StudioTransferStrip>;
export type StudioScopeView = ComponentProps<typeof StudioScopeStrip>;
export type StudioRootView = Omit<ComponentProps<typeof StudioRootPanel>, 'canUndo' | 'onUndo'>;

/** Studio's lens read, kept structural so the feature imports no Stage module. */
export type StudioLens = 'world' | 'experience';

/** What Find knows of Studio: the shape `stageDockView` reads. */
export type StudioFindView = {
	readonly active: boolean;
	readonly origin: StudioOrigin;
	readonly context: StudioContext;
	readonly canEdit: boolean;
	readonly rootCount: number;
};
