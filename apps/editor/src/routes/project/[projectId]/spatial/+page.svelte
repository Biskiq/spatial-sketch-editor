<script lang="ts">
	/**
	 * Foundation reset notice (PR #115 §4.1/§4.2).
	 *
	 * The editor shell was removed in #115, so this route is a static notice
	 * rather than an authoring surface: it loads no project, opens no editor
	 * session and holds no authoring state. It links to `/projects` only.
	 */
</script>

<svelte:head>
	<title>Spatial — foundation reset</title>
</svelte:head>

<main class="notice">
	<div class="card" role="status">
		<p class="eyebrow">Foundation reset</p>
		<h1>Spatial authoring is paused</h1>
		<p>
			The editor surface for this route was removed while the spatial foundation is rebuilt. Your
			projects are untouched — they are listed in your project hub.
		</p>
		<a class="button" href="/projects">Back to projects</a>
	</div>
</main>

<style>
	.notice {
		display: grid;
		min-height: 100dvh;
		place-items: center;
		margin: 0;
		padding: 2rem;
		background: #111117;
		color: #d6d2dc;
		font-family:
			Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
	}

	.card {
		max-width: 34rem;
		padding: 2rem;
		border: 1px solid #2b2b36;
		border-radius: 0.75rem;
		background: #17171f;
	}

	.eyebrow {
		margin: 0 0 0.5rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: 0.75rem;
		color: #8f8a99;
	}

	h1 {
		margin: 0 0 0.75rem;
		font-size: 1.5rem;
		color: #f4f2f7;
	}

	p {
		margin: 0 0 1.25rem;
		line-height: 1.55;
	}

	.button {
		display: inline-block;
		padding: 0.6rem 1rem;
		border-radius: 0.5rem;
		background: #c9a227;
		color: #16161c;
		font-weight: 600;
		text-decoration: none;
	}
</style>
