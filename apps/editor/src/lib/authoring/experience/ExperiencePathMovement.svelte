<script lang="ts">
	/**
	 * R217.S29 — the one Movement section for a selected Camera path.
	 *
	 * A Transition Card and an in-Stop step both render this same section against
	 * the controller's selected occurrence. It owns no selection or write path:
	 * duration, Auto, Straighten, remove and add all call the existing controller.
	 */
	import ShellIcon from '../stage/shell/ShellIcon.svelte';
	import { experienceHomes } from './experience-homes';
	import type { ExperiencePathOccurrence, ExperiencePathRead } from './experience-paths';
	import { formatPathFacts, formatPathSeconds } from './experience-paths';

	let {
		path,
		pathReason = null,
		busyReason = null,
		occurrence
	}: {
		readonly path: ExperiencePathRead | null;
		readonly pathReason?: string | null;
		readonly busyReason?: string | null;
		readonly occurrence: ExperiencePathOccurrence;
	} = $props();

	const homes = experienceHomes();
	const controller = $derived(homes.controller());
	const sharedNote = $derived.by(() => {
		if (path === null || path.sharedUses.length === 0) return null;
		const names = path.sharedUses.map((use) => {
			if (use.occurrence.kind === 'step') return 'a step inside a Stop';
			const index = (controller?.guideStops ?? []).findIndex((entry) => entry.id === use.stopId);
			return index >= 0 ? `Stop ${index + 1} → ${index + 2}` : 'another Stop transition';
		});
		return `Shared with ${names.join(', ')} — one edit changes all of them.`;
	});

	function stepDuration(direction: 1 | -1): void {
		if (controller === null || path === null) return;
		const current = path.seconds ?? 1;
		void controller.setPathDuration(Math.max(1, Math.round(current) + direction));
	}

	function addPath(): void {
		void controller?.createPath(occurrence);
	}

	function removePoint(): void {
		if (controller === null) return;
		const anchorId = controller.selectedAnchorId;
		if (anchorId !== null) void controller.removePathAnchor(anchorId);
	}
</script>

<section class="c-sec path-movement" aria-label="Movement" data-path-movement>
	<h3>Movement</h3>
	<div class="field">
		<span class="f-lbl" id="transition-duration-label">Duration</span>
		<span class="stepper" role="group" aria-labelledby="transition-duration-label">
			<button
				type="button"
				disabled={path?.state !== 'ready' || busyReason !== null}
				title={pathReason ?? 'Shorter duration'}
				aria-label="Shorter duration"
				onclick={() => stepDuration(-1)}
			>
				<ShellIcon name="minus" size={11} /><span class="sr-only">{pathReason ?? 'Shorter duration'}</span>
			</button>
			<b class="value" aria-live="polite">
				{#if path?.state === 'ready'}
					{path.authoredSeconds === null ? `Auto · ${formatPathSeconds(path.seconds)}` : formatPathSeconds(path.seconds)}
				{:else}—{/if}
			</b>
			<button
				type="button"
				disabled={path?.state !== 'ready' || busyReason !== null}
				title={pathReason ?? 'Longer duration'}
				aria-label="Longer duration"
				onclick={() => stepDuration(1)}
			>
				<ShellIcon name="plus" size={11} /><span class="sr-only">{pathReason ?? 'Longer duration'}</span>
			</button>
		</span>
	</div>
	{#if path?.state === 'ready' && path.authoredSeconds !== null}
		<div class="field">
			<span class="f-lbl">Duration source</span>
			<button type="button" class="small" disabled={busyReason !== null} title={busyReason ?? 'Use Camera’s automatic duration'} onclick={() => void controller?.setPathDuration(null)}>
				Use automatic duration
			</button>
		</div>
	{/if}
	<div class="field">
		<span class="f-lbl">Path</span>
		{#if path?.state === 'ready'}
			<span class="f-val" data-path-facts>{formatPathFacts(path)}</span>
		{:else}
			<span class="f-val muted" title={pathReason ?? undefined}>{pathReason ?? '—'}</span>
		{/if}
	</div>
	{#if path?.state === 'ready'}
		<div class="path-actions">
			<button type="button" class="btn" disabled={busyReason !== null || path.anchorCount === 0} title={path.anchorCount === 0 ? 'The path is already straight' : 'Straighten Camera path'} onclick={() => void controller?.straightenPath()}>
				Straighten Camera path
			</button>
			{#if controller?.selectedAnchorId !== null && controller?.selectedAnchorId !== undefined}
				<button type="button" class="btn refuse" disabled={busyReason !== null} onclick={removePoint}>
					Remove path point
				</button>
			{/if}
		</div>
		{#if path.wall?.crosses}
			<div class="alert caution" role="status">
				<ShellIcon name="warning" size={13} /><span>This Camera path passes through a wall.</span>
			</div>
		{/if}
		{#if sharedNote !== null}<p class="shared-note">{sharedNote}</p>{/if}
	{:else if path?.state === 'gap' || path === null}
		<div class="path-actions">
			<button type="button" class="btn" disabled={busyReason !== null} onclick={addPath}>
				Add Camera path
			</button>
		</div>
	{/if}
</section>

<style>
	.path-movement {
		display: grid;
		gap: 8px;
		padding: 10px 12px 12px;
		border-bottom: 1px solid var(--shell-hairline, #e1e4de);
	}
	h3 {
		margin: 0;
		font: 600 11px var(--shell-sans, ui-sans-serif, sans-serif);
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--shell-ink-3, #79817b);
	}
	.field {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 28px;
	}
	.f-lbl {
		flex: 0 0 72px;
		color: var(--shell-ink-3, #79817b);
		font-size: 11px;
	}
	.f-val {
		min-width: 0;
		color: var(--shell-ink, #1b201c);
		font-size: 12px;
	}
	.muted {
		color: var(--shell-ink-3, #79817b);
	}
	.stepper {
		display: inline-flex;
		align-items: center;
		gap: 2px;
	}
	.stepper button,
	.small {
		min-height: 24px;
		border: 1px solid var(--shell-hairline, #e1e4de);
		border-radius: 5px;
		background: var(--shell-card, #fff);
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.stepper button {
		width: 24px;
		padding: 0;
	}
	.value {
		min-width: 74px;
		text-align: center;
		font: 600 11px var(--shell-mono, ui-monospace, monospace);
	}
	.small {
		padding: 0 8px;
		font-size: 11px;
	}
	.path-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.btn {
		min-height: 28px;
		padding: 0 9px;
		border: 1px solid var(--shell-hairline, #e1e4de);
		border-radius: 6px;
		background: var(--shell-card, #fff);
		color: var(--shell-ink, #1b201c);
		font: inherit;
		font-size: 11px;
		cursor: pointer;
	}
	.btn.refuse {
		border-color: var(--shell-caution, #b5682d);
		color: var(--shell-caution, #b5682d);
	}
	.alert {
		display: flex;
		align-items: flex-start;
		gap: 6px;
		padding: 6px 8px;
		border-radius: 6px;
		background: var(--shell-caution-bg, #fdf3f0);
		color: var(--shell-caution, #b5682d);
		font-size: 11px;
	}
	.shared-note {
		margin: 0;
		color: var(--shell-ink-3, #79817b);
		font-size: 11px;
	}
	button:disabled {
		opacity: 0.45;
		cursor: default;
	}
	button:focus-visible {
		outline: 2px solid var(--shell-forest-raised, #22503c);
		outline-offset: 1px;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		padding: 0;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
		border: 0;
	}
	@media (pointer: coarse) {
		.stepper button,
		.small,
		.btn {
			min-height: 44px;
		}
		.stepper button {
			width: 44px;
		}
	}
</style>
