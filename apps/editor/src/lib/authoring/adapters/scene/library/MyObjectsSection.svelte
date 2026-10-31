<script lang="ts">
	/**
	 * T5.P01.S04 — My Objects, the `form` library scope's editor surface.
	 *
	 * It is a section of the existing Place instrument. The list loads lazily when
	 * the section opens; choosing an item reads its bytes, verifies the content id
	 * through the shared strict codec, evaluates the authored source and arms an
	 * editable copy for the existing floor placement. Nothing here selects,
	 * commits or writes the project: insertion is the ordinary accepted Scene
	 * intent the Place session already carries.
	 *
	 * A footprint silhouette is derived from the item's own source only when the
	 * creator asks for it or inserts it, and is never stored. An item from another
	 * development format stays listed and removable but can never be inserted.
	 */
	import { onMount, untrack } from 'svelte';
	import { env } from '$env/dynamic/public';
	import {
		FORM_LIBRARY_PAYLOAD_FORMAT_VERSION,
		type FormLibraryItemSummary,
		type FormLibraryPayload
	} from '@portfolio/project-model/library';

	import { evaluateFormMesh } from '$lib/content/form-evaluation';
	import type { ArmedFormCopy } from '../placement';
	import {
		FormLibraryClientError,
		createFormLibraryClient,
		type FormLibraryClient
	} from './client';

	let {
		client = createFormLibraryClient({ apiOrigin: env.PUBLIC_API_ORIGIN ?? '' }),
		armedCopy = null,
		startOpen = false,
		showToggle = true,
		onArm,
		onClear
	}: {
		/** Injectable for tests; production reads the public API origin. */
		client?: FormLibraryClient;
		armedCopy?: ArmedFormCopy | null;
		/** The lazy wrapper owns the only toggle and mounts this section open. */
		startOpen?: boolean;
		showToggle?: boolean;
		/** False when no live Stage reading can hold the arm; nothing is placed. */
		onArm: (copy: ArmedFormCopy) => boolean;
		onClear: () => void;
	} = $props();

	type Footprint = {
		readonly outline: readonly (readonly [number, number])[];
		readonly width: number;
		readonly depth: number;
	};

	// The wrapper mounts this open; it owns the toggle after that.
	let open = $state(untrack(() => startOpen));
	let loaded = $state(false);
	let loading = $state(false);
	let busyId = $state<string | null>(null);
	let items = $state<readonly FormLibraryItemSummary[]>([]);
	let error = $state<string | null>(null);
	let message = $state<string | null>(null);
	/** The item the current ready message was written for, never a live guess. */
	let readyItemId = $state<string | null>(null);
	let confirmingRemove = $state<string | null>(null);
	let footprints = $state<Record<string, Footprint>>({});
	let listing = 0;

	function wordsOf(cause: unknown): string {
		if (cause instanceof FormLibraryClientError) return cause.message;
		// A lost response is not proof that nothing changed; ask for a refresh.
		return 'My Objects could not be reached; refresh before retrying.';
	}

	async function refresh(): Promise<void> {
		const listingAt = ++listing;
		loading = true;
		error = null;
		message = null;
		readyItemId = null;
		try {
			const next = await client.list();
			if (listingAt !== listing) return;
			items = next;
			loaded = true;
		} catch (cause) {
			if (listingAt !== listing) return;
			error = wordsOf(cause);
		} finally {
			if (listingAt === listing) loading = false;
		}
	}

	async function toggle(): Promise<void> {
		open = !open;
		message = null;
		if (open && !loaded) await refresh();
	}

	onMount(() => {
		if (open && !loaded) void refresh();
	});

	function footprintOf(payload: FormLibraryPayload): Footprint | null {
		const mesh = evaluateFormMesh(payload.form);
		if (mesh === null) return null;
		const outline = mesh.footprint.map(([x, z]) => [x, z] as const);
		let minX = Infinity;
		let maxX = -Infinity;
		let minZ = Infinity;
		let maxZ = -Infinity;
		for (const [x, z] of outline) {
			minX = Math.min(minX, x);
			maxX = Math.max(maxX, x);
			minZ = Math.min(minZ, z);
			maxZ = Math.max(maxZ, z);
		}
		if (![minX, maxX, minZ, maxZ].every(Number.isFinite)) return null;
		return { outline, width: maxX - minX, depth: maxZ - minZ };
	}

	function silhouettePoints(footprint: Footprint): string {
		let minX = Infinity;
		let maxX = -Infinity;
		let minZ = Infinity;
		let maxZ = -Infinity;
		for (const [x, z] of footprint.outline) {
			minX = Math.min(minX, x);
			maxX = Math.max(maxX, x);
			minZ = Math.min(minZ, z);
			maxZ = Math.max(maxZ, z);
		}
		const span = Math.max(maxX - minX, maxZ - minZ, 0.001);
		const pad = span * 0.08;
		const scale = 100 / (span + pad * 2);
		return footprint.outline
			.map(([x, z]) => `${((x - minX + pad) * scale).toFixed(2)},${((z - minZ + pad) * scale).toFixed(2)}`)
			.join(' ');
	}

	/** Read, verify and evaluate one item without arming it. */
	async function readPayload(item: FormLibraryItemSummary): Promise<FormLibraryPayload | null> {
		try {
			const { payload } = await client.read(item);
			const footprint = footprintOf(payload);
			if (footprint === null) {
				error = 'That item’s saved source cannot be evaluated, so it cannot be inserted.';
				return null;
			}
			footprints = { ...footprints, [item.id]: footprint };
			return payload;
		} catch (cause) {
			error = wordsOf(cause);
			return null;
		}
	}

	async function showFootprint(item: FormLibraryItemSummary): Promise<void> {
		if (busyId !== null) return;
		busyId = item.id;
		error = null;
		message = null;
		readyItemId = null;
		try {
			await readPayload(item);
		} finally {
			busyId = null;
		}
	}

	async function insert(item: FormLibraryItemSummary): Promise<void> {
		if (busyId !== null) return;
		busyId = item.id;
		error = null;
		message = null;
		readyItemId = null;
		try {
			const payload = await readPayload(item);
			if (payload === null) return;
			const footprint = footprints[item.id];
			const meshContact = evaluateFormMesh(payload.form)?.contactMinY;
			if (meshContact === undefined) {
				error = 'That item’s saved source cannot be evaluated, so it cannot be inserted.';
				return;
			}
			if (!onArm({ itemId: item.id, item: payload, contactMinY: meshContact })) {
				error = 'The Stage has no live reading, so the copy was not armed. Choose Insert again.';
				return;
			}
			readyItemId = item.id;
			message = `${payload.name} is ready: click its floor position to place an editable copy${
				footprint === undefined ? '' : ` (${footprint.width.toFixed(3)} × ${footprint.depth.toFixed(3)} m)`
			}.`;
		} finally {
			busyId = null;
		}
	}

	async function remove(item: FormLibraryItemSummary): Promise<void> {
		if (busyId !== null) return;
		readyItemId = null;
		message = null;
		if (confirmingRemove !== item.id) {
			confirmingRemove = item.id;
			message = null;
			error = null;
			return;
		}
		busyId = item.id;
		confirmingRemove = null;
		error = null;
		try {
			await client.remove(item.id);
			items = items.filter((candidate) => candidate.id !== item.id);
			if (armedCopy?.itemId === item.id) onClear();
			message = `Removed ${item.name}. Copies already inserted are unaffected.`;
		} catch (cause) {
			error = wordsOf(cause);
		} finally {
			busyId = null;
		}
	}

	const usable = $derived(items.filter((item) => item.formatVersion === FORM_LIBRARY_PAYLOAD_FORMAT_VERSION));
	const older = $derived(items.length - usable.length);
	/**
	 * A ready message is shown only while the parent still holds that arm. A typed
	 * commit, a primitive choice, a reading change or a failed arm clears it in the
	 * session, and the panel must not keep claiming the copy is ready.
	 */
	const readyVisible = $derived(readyItemId !== null && armedCopy?.itemId === readyItemId);
	const messageVisible = $derived(message !== null && (readyItemId === null || readyVisible));
</script>

<section class="library" aria-label="My Objects" data-my-objects>
	<div class="head">
		{#if showToggle}
			<button
				type="button"
				class="toggle"
				data-my-objects-toggle
				aria-expanded={open}
				aria-controls="my-objects-panel"
				onclick={() => void toggle()}
			>
				My Objects{loaded ? ` (${items.length})` : ''}
			</button>
		{:else}
			<span class="heading">My Objects{loaded ? ` (${items.length})` : ''}</span>
		{/if}
		{#if open}
			<button type="button" class="quiet" onclick={() => void refresh()} disabled={loading}>
				{loading ? 'Loading…' : 'Refresh'}
			</button>
		{/if}
	</div>

	{#if open}
		<div id="my-objects-panel">
		<p class="intro">
			Save a form from its Card. Inserting places an editable copy with the saved source exactly;
			edits to the copy and to the saved item never reach each other.
		</p>

		{#if loading && !loaded}
			<p class="hint" role="status">Loading My Objects…</p>
		{:else if items.length === 0 && loaded}
			<p class="hint">Nothing saved yet. Select a form and choose “Save to My Objects”.</p>
		{:else}
			<ul class="items">
				{#each items as item (item.id)}
					{@const olderFormat = item.formatVersion !== FORM_LIBRARY_PAYLOAD_FORMAT_VERSION}
					{@const footprint = footprints[item.id]}
					{@const armed = armedCopy?.itemId === item.id}
					<li class:armed data-my-objects-item={item.id}>
						<div class="item-head">
							<div class="item-name">
								<strong>{item.name}</strong>
								{#if armed}<span class="badge">Ready to place</span>{/if}
								{#if olderFormat}
									<span class="badge older">Made with an earlier development version</span>
								{/if}
							</div>
							<div class="item-actions">
								{#if olderFormat}
									<span class="hint">Format {item.formatVersion}; it cannot be inserted.</span>
								{:else}
									<button
										type="button"
										data-my-objects-insert
										onclick={() => void insert(item)}
										disabled={busyId !== null}
									>
										Insert
									</button>
									<button
										type="button"
										class="quiet"
										data-my-objects-footprint
										onclick={() => void showFootprint(item)}
										disabled={busyId !== null}
									>
										Footprint
									</button>
								{/if}
								<button
									type="button"
									class="quiet destructive"
									data-my-objects-remove
									onclick={() => void remove(item)}
									disabled={busyId !== null}
								>
									{confirmingRemove === item.id ? 'Confirm remove' : 'Remove'}
								</button>
								{#if confirmingRemove === item.id}
									<button type="button" class="quiet" onclick={() => (confirmingRemove = null)}>
										Cancel
									</button>
								{/if}
							</div>
						</div>
						{#if footprint}
							<div class="footprint">
								<svg viewBox="0 0 100 100" role="img" aria-label={`Footprint ${footprint.width.toFixed(3)} by ${footprint.depth.toFixed(3)} metres`}>
									<polygon points={silhouettePoints(footprint)} />
								</svg>
								<span>{footprint.width.toFixed(3)} × {footprint.depth.toFixed(3)} m</span>
							</div>
						{/if}
					</li>
				{/each}
			</ul>
			{#if older > 0}
				<p class="hint">{older} item{older === 1 ? '' : 's'} made with an earlier development version cannot be inserted. Remove stays available.</p>
			{/if}
		{/if}

		{#if messageVisible}<p class="notice" role="status">{message}</p>{/if}
		{#if error}<p class="error" role="alert">{error}</p>{/if}
		</div>
	{/if}
</section>

<style>
	.library {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		border-top: 1px solid #4d4655;
		padding-top: 0.55rem;
	}
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.toggle {
		background: transparent;
		border-color: transparent;
		color: #d9c9ff;
		font-weight: 650;
		text-align: left;
	}
	.heading {
		color: #d9c9ff;
		font-weight: 650;
	}
	.intro,
	.hint {
		margin: 0;
		color: #8f8a99;
		font-size: 0.74rem;
	}
	.items {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		margin: 0;
		padding: 0;
		list-style: none;
		max-height: 16rem;
		overflow: auto;
	}
	.items li {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		border: 1px solid #4d4655;
		border-radius: 0.35rem;
		padding: 0.35rem 0.45rem;
	}
	.items li.armed {
		border-color: #c9a9ff;
	}
	.item-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		flex-wrap: wrap;
	}
	.item-name {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex-wrap: wrap;
		min-width: 0;
	}
	.badge {
		border: 1px solid #6f5c8f;
		border-radius: 999px;
		padding: 0 0.35rem;
		color: #c9a9ff;
		font-size: 0.64rem;
	}
	.badge.older {
		border-color: #8a6f3f;
		color: #e0c48f;
	}
	.item-actions {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		flex-wrap: wrap;
	}
	button {
		font: inherit;
		min-height: 2.75rem;
		padding: 0 0.5rem;
		border: 1px solid #635a6f;
		border-radius: 0.3rem;
		background: #292632;
		color: inherit;
		cursor: pointer;
	}
	button.quiet {
		background: transparent;
	}
	button.destructive {
		color: #ff9f8a;
	}
	button:disabled {
		cursor: default;
		opacity: 0.5;
	}
	.footprint {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: #bdb7c8;
		font-size: 0.72rem;
	}
	.footprint svg {
		width: 2.5rem;
		height: 2.5rem;
		background: #1f1c27;
		border: 1px solid #3d3747;
		border-radius: 0.25rem;
	}
	.footprint polygon {
		fill: rgb(201 169 255 / 35%);
		stroke: #c9a9ff;
		stroke-width: 1.5;
	}
	.notice {
		margin: 0;
		color: #bfe5cd;
	}
	.error {
		margin: 0;
		color: #ff9f8a;
	}
</style>
