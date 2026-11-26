<script lang="ts">
	import { formatGuideTime } from '@portfolio/camera-core/navigation';

	let { welcome, placeCount, chooseFree, startAgain }: {
		welcome: {
			title: string;
			body: string | null;
			canStartTour: boolean;
			manualPacing: boolean;
			guideSeconds: number;
			guideStopCount: number;
			chooseGuided: () => void;
		} | null;
		placeCount: number;
		chooseFree: () => void;
		startAgain: () => void;
	} = $props();
</script>

{#if welcome}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_no_noninteractive_element_to_interactive_role (a modal card owns its own keys) -->
	<section class="visitor-card visitor-welcome" role="dialog" aria-modal="true" aria-label="Welcome">
		<p class="overline">Welcome to</p>
		<h1>{welcome.title}</h1>
		{#if welcome.body}<p class="welcome-body">{welcome.body}</p>{/if}
		<div class="choices">
			<button
				type="button"
				class="choice primary"
				disabled={!welcome.canStartTour}
				onclick={welcome.chooseGuided}
			>
				<strong>Take the guided tour</strong>
				<span>{welcome.guideStopCount} {welcome.guideStopCount === 1 ? 'stop' : 'stops'} · {welcome.manualPacing ? 'at your own pace' : `about ${formatGuideTime(welcome.guideSeconds)}`}</span>
			</button>
			<button type="button" class="choice" disabled={placeCount === 0} onclick={chooseFree}>
				<strong>Explore freely</strong>
				<span>{placeCount} {placeCount === 1 ? 'place' : 'places'}</span>
			</button>
		</div>
		</section>
{:else}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions, a11y_no_noninteractive_element_to_interactive_role (a modal card owns its own keys) -->
	<section class="visitor-card visitor-end" role="dialog" aria-modal="true" aria-label="End of the tour">
		<p class="overline">End of the tour</p>
		<h1>Thank you for visiting</h1>
		<p class="welcome-body">Keep exploring — including views the tour skipped.</p>
		<div class="end-actions">
			<button type="button" class="vbtn gold" disabled={placeCount === 0} onclick={chooseFree}>Keep exploring</button>
			<button type="button" class="vbtn" onclick={startAgain}>Start the tour again</button>
		</div>
		</section>
{/if}

<style>
	.visitor-card {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: min(520px, calc(100% - 2rem));
		padding: 30px 30px 26px;
		border: 1px solid rgb(243 240 228 / 12%);
		border-radius: 20px;
		background: var(--visitor-glass);
		-webkit-backdrop-filter: blur(14px);
		backdrop-filter: blur(14px);
		color: var(--visitor-ivory);
		box-shadow: 0 24px 60px rgb(0 0 0 / 0.45);
		text-align: center;
		z-index: 8;
	}
	.visitor-welcome h1,
	.visitor-end h1 {
		margin: 0 0 10px;
		color: var(--visitor-ivory);
		font: 500 34px/1.1 var(--visitor-serif);
	}
	.visitor-end h1 {
		font-size: 30px;
	}
	.welcome-body {
		max-width: 40ch;
		margin: 0 auto 18px;
		color: rgb(243 240 228 / 72%);
		font: 14px/1.5 var(--visitor-sans);
	}
	.choices {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
		text-align: left;
	}
	.choice {
		display: grid;
		gap: 4px;
		padding: 16px;
		border: 1px solid rgb(243 240 228 / 18%);
		border-radius: 14px;
		background: rgb(243 240 228 / 6%);
		color: var(--visitor-ivory);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.choice:hover:not(:disabled) {
		border-color: var(--visitor-gold);
	}
	.choice:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.choice strong {
		font: 600 14px var(--visitor-sans);
	}
	.choice span {
		color: rgb(243 240 228 / 66%);
		font: 12px/1.45 var(--visitor-sans);
	}
	.choice.primary {
		border-color: transparent;
		background: var(--visitor-gold);
		color: var(--visitor-forest);
	}
	.choice.primary span {
		color: rgb(17 41 31 / 78%);
	}
	.choice.primary:hover:not(:disabled) {
		border-color: transparent;
		filter: brightness(1.05);
	}
	.end-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		justify-content: center;
	}
	@media (max-width: 760px) {
		.choices {
			grid-template-columns: 1fr;
		}
	}
</style>
