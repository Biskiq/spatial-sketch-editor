<script lang="ts">
	/**
	 * Save to My library: a snapshot of the Finish or draft, never a project
	 * write. The button owns only its short-lived feedback; the session owns the
	 * save and its notice.
	 */
	import type { FinishTileSource } from '$lib/render/materials/finish-tiles.svelte';
	import { tryUsePrivateLibrary } from './private-library-provider';
	import type { PrivateLibraryOutcome } from './private-library.svelte';

	let {
		finishKey = null,
		name = '',
		tileSource = null,
		save = null,
		disabled = false,
		className = 'foot-text'
	}: {
		finishKey?: string | null;
		name?: string;
		tileSource?: FinishTileSource | null;
		/** A draft save supplied by its session; otherwise the Card saves its Finish. */
		save?: (() => Promise<PrivateLibraryOutcome>) | null;
		disabled?: boolean;
		className?: string;
	} = $props();

	const privateLibrary = tryUsePrivateLibrary();
	let phase = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');
	let failure = $state('');
	let timer: ReturnType<typeof setTimeout> | null = null;

	const offline = $derived(privateLibrary?.status === 'offline');
	const available = $derived(
		save !== null || (privateLibrary !== null && finishKey !== null),
	);
	const label = $derived(
		phase === 'saving'
			? 'Saving…'
			: phase === 'saved'
				? 'Saved'
				: phase === 'error'
					? 'Couldn’t save · Retry'
					: offline
						? 'Offline · Retry'
						: 'Save to My library',
	);

	function clearTimer(): void {
		if (timer !== null) clearTimeout(timer);
		timer = null;
	}

	$effect(() => () => clearTimer());

	async function run(): Promise<void> {
		if (phase === 'saving' || !available) return;
		clearTimer();
		phase = 'saving';
		failure = '';
		const action =
			save ??
			(() => privateLibrary!.saveFinish({ finishKey: finishKey!, name, tileSource }));
		const outcome = await action();
		if (outcome.ok) {
			phase = 'saved';
			timer = setTimeout(() => (phase = 'idle'), 2400);
		} else {
			phase = 'error';
			failure = outcome.message;
		}
	}
</script>

<button
	type="button"
	class={className}
	disabled={disabled || phase === 'saving' || !available}
	title={failure !== '' ? failure : offline ? (privateLibrary?.error ?? 'My library is offline.') : 'A private copy for any project; nothing in this project changes'}
	data-finish-save-library
	data-material-editor-save
	onclick={() => void run()}
>{label}</button>
