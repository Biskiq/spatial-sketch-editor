<script lang="ts">
	/**
	 * A View snapshot slot (R217.S28, E10).
	 *
	 * The slot keeps its Round 2 geometry and placeholder until a **visible** slot
	 * asks the Stage's one renderer for its exact authored pose. Results are cached
	 * by pose and accepted source revision; nothing is serialized, and a slot that
	 * never becomes visible never renders.
	 */
	import { untrack } from 'svelte';
	import { onMount } from 'svelte';
	import ShellIcon from '../stage/shell/ShellIcon.svelte';
	import {
		onStageSnapshotAvailability,
		onStageSnapshotsInvalidated,
		requestStageSnapshot,
		stageSnapshotAvailable
	} from '../stage/stage-snapshots';
	import { experienceHomes } from './experience-homes';

	let {
		label,
		viewId = null,
		number = null,
		ratio = '16/10',
		selected = false
	}: {
		/** The View (or Presentation) the slot stands for; read by assistive technology. */
		label: string;
		/** The authored View to render. Without one the slot stays a placeholder. */
		viewId?: string | null;
		/** A Stop's place in its Guide, shown as the corner badge. */
		number?: number | null;
		ratio?: '16/10' | 'stop' | 'row';
		selected?: boolean;
	} = $props();

	let controller: ReturnType<ReturnType<typeof experienceHomes>['controller']> = null;
	try {
		controller = experienceHomes().controller();
	} catch {
		// A slot mounted outside the route keeps its placeholder; it never throws.
		controller = null;
	}

	let slot = $state<HTMLSpanElement | null>(null);
	let visible = $state(false);
	let hostReady = $state(false);
	let epoch = $state(0);
	let source = $state<string | null>(null);

	onMount(() => {
		const stopAvailability = onStageSnapshotAvailability(() => {
			hostReady = true;
		});
		// Invalidation is broadcast to every slot at once; each slot re-requests on
		// its own microtask so no listener writes state inside the broadcaster.
		let queued = false;
		const stopInvalidation = onStageSnapshotsInvalidated(() => {
			if (queued) return;
			queued = true;
			queueMicrotask(() => {
				queued = false;
				source = null;
				epoch += 1;
			});
		});
		const cleanup = () => {
			stopAvailability();
			stopInvalidation();
		};
		const element = slot;
		if (element === null || typeof IntersectionObserver === 'undefined') {
			visible = viewId !== null;
			return cleanup;
		}
		const observer = new IntersectionObserver(
			(entries) => {
				// Keep observing: a scrolled-away slot must stop asking for work, and
				// become eligible again when it returns to view. Disconnecting after the
				// first sight left every off-screen slot permanently visible.
				for (const entry of entries) {
					if (entry.target === element) visible = entry.isIntersecting;
				}
			},
			{ rootMargin: '120px' }
		);
		observer.observe(element);
		return () => {
			observer.disconnect();
			cleanup();
		};
	});

	$effect(() => {
		const id = viewId;
		const liveController = controller;
		// `epoch` makes an invalidation re-request; `hostReady` covers a slot that
		// mounted before the Stage renderer registered.
		void epoch;
		const live = visible && hostReady && id !== null && liveController !== null && stageSnapshotAvailable();
		if (!live || liveController === null || id === null) return;
		const pose = liveController.viewPose(id);
		const revision = liveController.sourceRevision;
		if (pose === null) return;
		let current = true;
		untrack(() => {
			void requestStageSnapshot({
				viewId: id,
				sourceRevision: revision,
				pose: { eye: pose.eye, target: pose.target, fovDegrees: pose.fov },
				aspect: 16 / 10
			}).then((url) => {
				if (current && url !== null) source = url;
			});
		});
		return () => {
			current = false;
		};
	});

	$effect(() => {
		// A new authored View pose or source revision makes the old image a lie.
		void viewId;
		void controller?.sourceRevision;
		untrack(() => {
			source = null;
		});
	});
</script>

<span
	class="snapshot {ratio === 'stop' ? 'stop' : ratio === 'row' ? 'row' : ''}"
	class:selected
	class:rendered={source !== null}
	role="img"
	aria-label={source === null ? `${label}, snapshot not rendered yet` : `${label}, snapshot`}
	bind:this={slot}
>
	{#if source !== null}
		<img src={source} alt="" draggable="false" />
	{:else}
		<ShellIcon name="camera" size={ratio === 'row' ? 12 : 16} />
	{/if}
	{#if number !== null}<span class="number">{number}</span>{/if}
</span>

<style>
	.snapshot {
		position: relative;
		display: grid;
		place-items: center;
		width: 100%;
		aspect-ratio: 16 / 10;
		border: 2px solid transparent;
		border-radius: 6px;
		background: var(--shell-mat);
		color: var(--shell-ink-3);
		overflow: hidden;
	}
	.snapshot.stop {
		aspect-ratio: auto;
		height: 50px;
		border-width: 0;
		border-radius: 5px;
	}
	.snapshot.row {
		width: 48px;
		height: 30px;
		aspect-ratio: auto;
		flex: none;
		border-width: 0;
		border-radius: 4px;
	}
	.snapshot.selected {
		border-color: var(--shell-gold);
	}
	.snapshot img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.number {
		position: absolute;
		top: 3px;
		left: 3px;
		padding: 0 4px;
		border-radius: 4px;
		background: var(--shell-forest);
		color: var(--shell-white);
		font: 600 10px/1.4 var(--shell-mono);
	}
</style>
