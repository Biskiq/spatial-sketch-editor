/// <reference types="vite/client" />

declare module 'virtual:museum-editor-entry' {
	import type { Component } from 'svelte';

	const MuseumEditorEntry: Component;
	export default MuseumEditorEntry;
}

/** Replaced in the client bundle; absent in plain unit-test transforms. */
declare const __BISKIQ_BUILD_REVISION__: string;
