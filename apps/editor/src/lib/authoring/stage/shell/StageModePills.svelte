<script lang="ts">
	/**
	 * The Lift and Slice pills. Each disclosure's open flag is local here; every
	 * scope, depth and Put back command goes back through the pill's own port.
	 */
	type SlicePillItem = {
		readonly kind: 'to-floor' | 'below';
		readonly label: string;
		readonly checked: boolean;
		readonly meters?: number;
	};

	let {
		lift,
		slice,
		lookThroughActive
	}: {
		lift: {
			readonly scopeRoomId: string | null;
			readonly scopeLabel: string | null;
			readonly candidate: { readonly id: string; readonly label: string } | null;
			onScope: (roomId: string | null) => void;
			onPutBack: () => void;
		} | null;
		slice: {
			readonly mode?: 'level' | 'drawn';
			readonly cutLabel: string;
			readonly depthLabel: string;
			readonly items: readonly SlicePillItem[];
			onDepth: (item: SlicePillItem) => void;
			onFlip?: () => void;
			onPutBack: () => void;
		} | null;
		lookThroughActive: boolean;
	} = $props();

	/** The Lift scope menu's own open flag; a choice or Put back closes it. */
	let liftMenuOpen = $state(false);
	/** The Slice depth menu's own open flag, on the same terms. */
	let sliceMenuOpen = $state(false);

	function chooseLiftScope(roomId: string | null): void {
		liftMenuOpen = false;
		lift?.onScope(roomId);
	}
</script>

{#if lift !== null}
	<!--
		The Lift pill, beside Look through's: Lift · <scope> ▾ · Put back.
		Every press stops at the pill so the Stage's own pointer work never sees it.
	-->
	<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
	<div
		class="mode-pill lift-pill"
		class:with-through={lookThroughActive}
		data-lift-pill
		onclick={(event) => event.stopPropagation()}
		onpointerdown={(event) => event.stopPropagation()}
	>
		<span>Lift</span>
		<button
			type="button"
			data-lift-scope
			aria-haspopup="menu"
			aria-expanded={liftMenuOpen}
			title="Choose what Lift shows from above"
			onclick={() => (liftMenuOpen = !liftMenuOpen)}
		>
			{lift.scopeLabel ?? 'Everything'}<span class="chev" aria-hidden="true">▾</span>
		</button>
		{#if liftMenuOpen}
			<div class="lift-menu" role="menu" aria-label="Lift scope">
				<button
					type="button"
					role="menuitemradio"
					aria-checked={lift.scopeRoomId === null}
					data-lift-scope-all
					onclick={() => chooseLiftScope(null)}
				>
					Everything
				</button>
				{#if lift.candidate !== null}
					<button
						type="button"
						role="menuitemradio"
						aria-checked={lift.scopeRoomId === lift.candidate.id}
						data-lift-scope-space
						onclick={() => chooseLiftScope(lift.candidate!.id)}
					>
						This space: {lift.candidate.label}
					</button>
				{/if}
			</div>
		{/if}
		<button
			type="button"
			class="pill-primary"
			data-lift-put-back
			onclick={() => {
				liftMenuOpen = false;
				lift.onPutBack();
			}}>Put back</button
		>
	</div>
{/if}
{#if slice !== null}
	<!--
		The Slice pill, after Lift's: Cut at {h} m · depth ▾ · Put back. The height is
		the Sheet's live value, so dragging the Sheet moves the pill with the cut.
	-->
	<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
	<div
		class="mode-pill slice-pill"
		class:with-lift={lift !== null}
		data-slice-pill
		onclick={(event) => event.stopPropagation()}
		onpointerdown={(event) => event.stopPropagation()}
	>
		<span>{slice.mode === 'drawn' ? slice.cutLabel : `Cut at ${slice.cutLabel} m`}</span>
		{#if slice.mode === 'drawn'}
			<span class="slice-depth-read" data-slice-depth title="Drag the depth grip on the cut to change it">
				{slice.depthLabel}
			</span>
			<button type="button" data-slice-flip title="Reverse which side is removed" onclick={() => slice.onFlip?.()}>
				Flip
			</button>
		{:else}
			<button
				type="button"
				data-slice-depth
				aria-haspopup="menu"
				aria-expanded={sliceMenuOpen}
				title="Choose what the Slice shows"
				onclick={() => (sliceMenuOpen = !sliceMenuOpen)}
			>
				{slice.depthLabel}<span class="chev" aria-hidden="true">▾</span>
			</button>
			{#if sliceMenuOpen}
				<div class="lift-menu" role="menu" aria-label="Slice depth">
					{#each slice.items as item (item.kind === 'to-floor' ? 'to-floor' : item.label)}
						<button
							type="button"
							role="menuitemradio"
							aria-checked={item.checked}
							data-slice-depth-item
							onclick={() => {
								sliceMenuOpen = false;
								slice.onDepth(item);
							}}>{item.label}</button
						>
					{/each}
				</div>
			{/if}
		{/if}
		<button
			type="button"
			class="pill-primary"
			data-slice-put-back
			onclick={() => {
				sliceMenuOpen = false;
				slice.onPutBack();
			}}>Put back</button
		>
	</div>
{/if}

<style>
	.mode-pill {
		position: absolute;
		left: 50%;
		top: 0.75rem;
		z-index: 6;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 4px 4px 12px;
		border-radius: 20px;
		background: var(--shell-glass-dark);
		color: var(--shell-ink-light);
		font-size: 12px;
		box-shadow: 0 8px 20px rgb(0 0 0 / 0.28);
	}
	.mode-pill button {
		height: 28px;
		padding: 0 11px;
		border: 0;
		border-radius: 14px;
		background: var(--shell-on-forest-wash-strong);
		color: inherit;
		font: inherit;
		font-size: 12px;
		cursor: pointer;
	}
	.mode-pill button.pill-primary {
		background: var(--shell-mode-active-bg);
		color: var(--shell-mode-active-ink);
		font-weight: 600;
	}
	/*
	 * Lift takes the row under the reading bar: the bar is `z-index: 8` and spans the
	 * Stage's centre, so the shared `0.75rem` row is painted underneath it and the pill
	 * is not visible at all. Look through's pill keeps that row because the bar is gone
	 * while it shows; when both pills are present, Lift is already one line under it.
	 */
	.mode-pill.lift-pill {
		padding-left: 12px;
		top: 3.4rem;
	}
	.mode-pill.lift-pill.with-through {
		top: 3.4rem;
	}
	/* The Slice pill takes the same row as Lift's for the same reason, and drops a
	 * row when Lift is showing, so the two readings can both state their pose. */
	.mode-pill.slice-pill {
		top: 3.4rem;
	}
	.mode-pill.slice-pill.with-lift {
		top: 6.1rem;
	}
	.lift-pill .chev {
		margin-left: 5px;
		font-size: 10px;
		opacity: 0.8;
	}
	.lift-menu {
		position: absolute;
		top: 36px;
		left: 50%;
		z-index: 7;
		transform: translateX(-50%);
		min-width: 168px;
		padding: 4px;
		border: 1px solid var(--shell-hairline);
		border-radius: 10px;
		background: var(--shell-popover);
		color: var(--shell-ink);
		box-shadow: var(--shell-shadow);
	}
	.lift-menu button {
		display: flex;
		align-items: center;
		width: 100%;
		background: transparent;
		color: var(--shell-ink);
		border-radius: 7px;
	}
	.lift-menu button:hover {
		background: var(--shell-hover);
	}
	.lift-menu button[aria-checked='true'] {
		font-weight: 600;
	}
	@media (pointer: coarse) {
		.mode-pill button {
			min-width: 44px;
			min-height: 44px;
		}
	}
</style>
