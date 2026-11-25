import type { ComponentProps } from 'svelte';
import type StageLibrary from './StageLibrary.svelte';

export type LibraryProps = ComponentProps<typeof StageLibrary>;

export type LibraryView = {
	readonly open: boolean;
	readonly previewing: boolean;
	readonly lens: 'world' | 'experience';
	readonly available: boolean;
	readonly nonce: number;
	readonly props: LibraryProps;
};
