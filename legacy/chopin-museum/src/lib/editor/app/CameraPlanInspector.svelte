<script lang="ts">
	// P23.14 §13 — the panel opens on the selection, not on prose: the section
	// heading is the property-first identity line (kind icon, name-or-reference,
	// kind stated separately), and raw canonical IDs live behind Technical
	// details. Camera entities carry no ledger reference, so the authored label is
	// the identity and its raw ID is diagnosis.
	import { Camera, Eye, GitMerge, Spline } from 'lucide-svelte';
	import type { CameraConnectionDirection } from '$lib/types/scene';
	import { isFlowNode } from '$lib/content/scene';
	import type { EditorStore } from '../editor-store.svelte';
	import EditorNumberField from '../fields/EditorNumberField.svelte';
	import { getNodeConnections } from '../camera/editor-camera-connections';
	import { formatCameraNodeLabel } from '../editor-outliner';
	import { getScenePathAnchorWorldPosition } from '../camera/editor-camera-path';
	import { resolvePlanSceneGraphFromDocument } from '../layout/plan-camera-projection';
	import EditorCameraConnectionTiming from '../camera/EditorCameraConnectionTiming.svelte';
	import type { EditorViewState } from './editor-view-state.svelte';

	let {
		store,
		viewState = null
	}: { store: EditorStore; viewState?: EditorViewState | null } = $props();

	const selection = $derived(store.navigationSelection);
	const node = $derived(store.selectedNavigationNode);
	const connection = $derived(store.selectedConnection);
	const anchor = $derived(store.selectedAnchor);
	const viewKeyframe = $derived(store.selectedViewKeyframe);
	const mainFlowNodeIds = $derived(store.mainFlowNodeIds);
	const nodeOrder = $derived(
		node && selection?.kind === 'node'
			? mainFlowNodeIds.indexOf(node.id) + 1
			: null
	);
	const nodeOnSequence = $derived(node ? !store.isRelic && isFlowNode(node) : false);
	const graph = $derived.by(() => {
		try {
			return resolvePlanSceneGraphFromDocument(store.document, store.rooms);
		} catch {
			// scene/layout divergence: timing metrics degrade to unavailable.
			return null;
		}
	});
	const fromNode = $derived(
		connection
			? store.document.navigationNodes.find(
					(candidate) => candidate.id === connection.fromNodeId
			  )
			: undefined
	);
	const toNode = $derived(
		connection
			? store.document.navigationNodes.find(
					(candidate) => candidate.id === connection.toNodeId
			  )
			: undefined
	);
	const nodeConnections = $derived(
		node && selection?.kind === 'node'
			? getNodeConnections(store.document, node.id)
			: null
	);
	const partnerLabels = $derived(
		new Map(
			store.document.navigationNodes.map((candidate) => [
				candidate.id,
				formatCameraNodeLabel(candidate.label, candidate.id)
			])
		)
	);
	const nodeWorld = $derived(
		node && selection?.kind === 'node'
			? store.rooms.pointInFrame(node.roomId, node.position)
			: null
	);
	const anchorWorld = $derived(
		anchor && selection?.kind === 'anchor'
			? getScenePathAnchorWorldPosition(anchor, store.rooms)
			: null
	);

	// One disclosure state for the panel, so switching between camera kinds never
	// collapses the identity the user just opened.
	let technicalDetailsOpen = $state(false);

	let timingDirection = $state<CameraConnectionDirection>('forward');
	$effect(() => {
		if (selection?.kind === 'connection') {
			timingDirection = store.activeCameraDirection;
		}
	});

	let labelDraft = $state('');
	$effect(() => {
		labelDraft = node?.label ?? '';
	});

	function saveLabel() {
		if (!node) return;
		if (!store.commitSelectedNodeLabel(labelDraft)) labelDraft = node.label;
	}

	function onLabelKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			saveLabel();
		} else if (event.key === 'Escape' && node) {
			event.preventDefault();
			event.stopPropagation();
			labelDraft = node.label;
		}
	}

	function commitNodeXZ(x: number, z: number) {
		const current = nodeWorld;
		if (!node || !current || !Number.isFinite(x) || !Number.isFinite(z)) return;
		const local = store.rooms.localPointInFrame(node.roomId, [x, current[1], z]);
		store.commitNavigationNodePoint(node.id, 'position', local);
	}

	function commitAnchorXZ(x: number, z: number) {
		const current = anchorWorld;
		if (selection?.kind !== 'anchor' || !current) return;
		if (!Number.isFinite(x) || !Number.isFinite(z)) return;
		if (!store.beginDocumentTransaction()) return;
		if (
			!store.updateConnectionAnchorWorldPoint(
				selection.connectionId,
				selection.anchorId,
				[x, current[1], z]
			)
		) {
			store.cancelDocumentTransaction();
			return;
		}
		store.commitDocumentTransaction();
	}

	function commitDuration(value: number) {
		if (!connection || selection?.kind !== 'connection') return;
		const timing = connection.timing?.[timingDirection];
		store.setConnectionTiming(connection.id, timingDirection, {
			durationSeconds: value,
			...(timing?.easing !== undefined ? { easing: timing.easing } : {})
		});
	}

	function useAutomatic() {
		if (!connection || selection?.kind !== 'connection') return;
		const timing = connection.timing?.[timingDirection];
		if (!timing) return;
		if (timing.easing !== undefined) {
			store.setConnectionTiming(connection.id, timingDirection, {
				easing: timing.easing
			});
		} else {
			store.setConnectionTiming(connection.id, timingDirection, null);
		}
	}

	function selectDirection(direction: CameraConnectionDirection) {
		if (!connection) return;
		store.selectionActions.selectCameraConnectionDirection(
			connection.id,
			direction
		);
	}
</script>

{#if selection?.kind === 'node' && node && nodeWorld}
	<section class="camera-plan-panel" aria-label="Camera Plan node editor">
		<div class="section-heading">
			<span class="identity-icon" aria-hidden="true"><Camera size={15} /></span>
			<span class="identity-text">
				<span class="identity-title">{formatCameraNodeLabel(node.label, node.id)}</span>
				<!-- P23.0b: a canonical node carries no Room, so the locality badge must
				     report the node's own frame — "room-local" here was a fixed string
				     that described the legacy format only. -->
				<span class="identity-kind"
					>Camera node · {node.roomId ? 'room-local' : 'world-local'}</span
				>
			</span>
		</div>

		<label class="label-field">
			<span>Label</span>
			<input
				bind:value={labelDraft}
				disabled={store.isAuthoringPauseBlocked}
				onblur={saveLabel}
				onkeydown={onLabelKeyDown}
			/>
		</label>

		<dl>
			<div>
				<dt>Flow order</dt>
				<dd>
					{#if nodeOrder !== null}
						<span class="order-badge">#{nodeOrder}</span>
					{:else}
						<span class="unsequenced-badge">Unsequenced</span>
					{/if}
				</dd>
			</div>
		</dl>

		<details class="technical-details" bind:open={technicalDetailsOpen}>
			<summary>Technical details</summary>
			<span class="technical-id">{node.id}</span>
			{#if node.roomId}<span class="technical-id">Room {node.roomId}</span>{/if}
		</details>

		{#key node.id}
			<div class="xz-fields" aria-label="Camera node world position">
				<EditorNumberField
					label="World X (m)"
					value={nodeWorld[0]}
					step={0.01}
					fractionDigits={3}
					oncommit={(x) => commitNodeXZ(x, nodeWorld[2])}
				/>
				<EditorNumberField
					label="World Z (m)"
					value={nodeWorld[2]}
					step={0.01}
					fractionDigits={3}
					oncommit={(z) => commitNodeXZ(nodeWorld[0], z)}
				/>
			</div>
		{/key}

		{#if nodeConnections}
			<section class="connections" aria-label="Node connections">
				<div class="section-heading">
					<h3>Connections</h3>
					<span>{nodeConnections.outgoing.length + nodeConnections.incoming.length}</span>
				</div>
				{#if nodeConnections.outgoing.length === 0 && nodeConnections.incoming.length === 0}
					<p class="connections-empty">No connections</p>
				{:else}
					<ul class="connection-list">
						{#each nodeConnections.outgoing as row (row.connectionId)}
							<li class="connection-row outgoing">
								<span class="badge" aria-hidden="true">▶</span>
								<span class="partner" title={partnerLabels.get(row.partnerId) ?? row.partnerId}>
									{partnerLabels.get(row.partnerId) ?? row.partnerId}
								</span>
								{#if row.partnerRoomId !== node.roomId}
									<span class="room">{row.partnerRoomId}</span>
								{/if}
								<span class="meta">{row.anchorsCount} anchors</span>
							</li>
						{/each}
						{#each nodeConnections.incoming as row (row.connectionId)}
							<li class="connection-row incoming">
								<span class="badge" aria-hidden="true">◀</span>
								<span class="partner" title={partnerLabels.get(row.partnerId) ?? row.partnerId}>
									{partnerLabels.get(row.partnerId) ?? row.partnerId}
								</span>
								{#if row.partnerRoomId !== node.roomId}
									<span class="room">{row.partnerRoomId}</span>
								{/if}
								<span class="meta">{row.anchorsCount} anchors</span>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		{/if}

		<div class="topology" aria-label="Camera topology commands">
			<button
				type="button"
				disabled={nodeOnSequence || store.isDocumentTransactionActive || store.isEditorInteractionActive || store.pendingNavigationCommand !== null}
				title={nodeOnSequence ? 'Inspect at Sequence boundary' : 'Preview Camera'}
				onclick={() => { viewState?.setView('camera', '3d'); store.previewCamera(node.id, 'visitor'); }}
			>Preview Camera</button>
			<button
				type="button"
				disabled={store.isAuthoringPauseBlocked}
				onclick={() => store.beginConnectExistingNodes()}
			>Connect to another node</button>
			<button
				type="button"
				class="danger"
				disabled={store.isAuthoringPauseBlocked}
				onclick={() => store.deleteNavigationNode(node.id)}
			>Delete camera node</button>
		</div>
	</section>
{:else if selection?.kind === 'connection' && connection}
	<section class="camera-plan-panel" aria-label="Camera Plan connection editor">
		<div class="section-heading">
			<span class="identity-icon" aria-hidden="true"><GitMerge size={15} /></span>
			<span class="identity-text">
				<span class="identity-title">{formatCameraNodeLabel(fromNode?.label, connection.fromNodeId)} → {formatCameraNodeLabel(toNode?.label, connection.toNodeId)}</span>
				<span class="identity-kind">Camera connection · {connection.positionPath.kind}</span>
			</span>
		</div>
		<dl>
			<div><dt>From</dt><dd>{formatCameraNodeLabel(fromNode?.label, connection.fromNodeId)}</dd></div>
			<div><dt>To</dt><dd>{formatCameraNodeLabel(toNode?.label, connection.toNodeId)}</dd></div>
			<div><dt>Anchors</dt><dd>{connection.positionPath.anchors.length}</dd></div>
			<div><dt>Clearance</dt><dd>{connection.clearance.toFixed(2)} m</dd></div>
		</dl>

		<details class="technical-details" bind:open={technicalDetailsOpen}>
			<summary>Technical details</summary>
			<span class="technical-id">{connection.id}</span>
			<span class="technical-id">{connection.fromNodeId} → {connection.toNodeId}</span>
		</details>

		{#if graph}
			<EditorCameraConnectionTiming
				{connection}
				direction={timingDirection}
				graph={graph}
				disabled={store.isAuthoringPauseBlocked}
				oncommit={commitDuration}
				onDirectionChange={selectDirection}
				onUseAutomatic={useAutomatic}
			/>
		{/if}

		<button
			type="button"
			class="danger"
			disabled={store.isAuthoringPauseBlocked}
			onclick={() => store.deleteConnection(connection.id)}
		>Delete camera connection</button>
	</section>
{:else if selection?.kind === 'anchor' && anchor && anchorWorld && connection}
	<section class="camera-plan-panel" aria-label="Camera Plan anchor editor">
		<div class="section-heading">
			<span class="identity-icon" aria-hidden="true"><Spline size={15} /></span>
			<span class="identity-text">
				<span class="identity-title">Curve anchor</span>
				<!-- Same vocabulary as the node badge: the document frame is what the
				     user reads, not a synonym for it. -->
				<span class="identity-kind"
					>Camera path · {anchor.roomId ? 'room-local' : 'world-local'}</span
				>
			</span>
		</div>

		<details class="technical-details" bind:open={technicalDetailsOpen}>
			<summary>Technical details</summary>
			<span class="technical-id">{anchor.id}</span>
			<span class="technical-id">Path {connection.id}</span>
		</details>
		{#key `${connection.id}:${anchor.id}`}
			<div class="xz-fields" aria-label="Camera path anchor world position">
				<EditorNumberField
					label="World X (m)"
					value={anchorWorld[0]}
					step={0.01}
					fractionDigits={3}
					oncommit={(x) => commitAnchorXZ(x, anchorWorld[2])}
				/>
				<EditorNumberField
					label="World Z (m)"
					value={anchorWorld[2]}
					step={0.01}
					fractionDigits={3}
					oncommit={(z) => commitAnchorXZ(anchorWorld[0], z)}
				/>
			</div>
		{/key}
		<button
			type="button"
			class="danger"
			disabled={store.isAuthoringPauseBlocked}
			onclick={() => store.deleteSelectedAnchor()}
		>Delete Anchor</button>
	</section>
{:else if selection?.kind === 'view-keyframe' && viewKeyframe && connection}
	<section class="camera-plan-panel" aria-label="Camera Plan view breakpoint">
		<div class="section-heading">
			<span class="identity-icon" aria-hidden="true"><Eye size={15} /></span>
			<span class="identity-text">
				<span class="identity-title">{selection.direction} view breakpoint</span>
				<span class="identity-kind">Camera connection framing</span>
			</span>
		</div>
		<p class="passive-note">
			A view breakpoint stays selected across the Plan ⇄ 3D switch, but its
			framing is authored in Camera 3D. Switch to 3D to edit the look target,
			FOV, and aim.
		</p>
		<details class="technical-details" bind:open={technicalDetailsOpen}>
			<summary>Technical details</summary>
			<span class="technical-id">{viewKeyframe.id}</span>
			<span class="technical-id">Path {connection.id}</span>
		</details>
	</section>
{/if}

{#if selection && store.statusMessage}
	<p class="status" role="status">{store.statusMessage}</p>
{/if}

<style>
	.camera-plan-panel { display: flex; flex-direction: column; gap: 0.75rem; }
	/* P23.14 §13 — the property-first identity line: kind icon, name-or-reference
	   and the kind stated separately. No prose lead, no dashboard. */
	.section-heading { display: flex; min-width: 0; align-items: flex-start; gap: 0.4rem; }
	.identity-icon { display: inline-flex; flex: 0 0 auto; margin-top: 0.1rem; color: var(--editor-text-muted); }
	.identity-text { display: flex; min-width: 0; flex-direction: column; gap: 0.12rem; }
	.identity-title { overflow: hidden; color: var(--editor-text-primary); font-size: 13px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
	.identity-kind { color: var(--editor-text-muted); font-size: 10px; letter-spacing: 0.05em; text-transform: uppercase; }
	/* P23.14 §13 — raw canonical IDs are diagnosis, reachable on demand. */
	.technical-details { display: flex; flex-direction: column; gap: 0.2rem; color: var(--editor-text-muted); font-size: 0.68rem; }
	.technical-details summary { cursor: pointer; }
	.technical-id { font-family: var(--editor-font-mono, ui-monospace, monospace); font-size: 10px; overflow-wrap: anywhere; }
	/* Text takes the warning TEXT sibling (ruling D2): the base token is the
	   glyph/border family, re-inked for surfaces, not for small text. */
	.status { margin: 0.75rem 0 0; color: var(--editor-text-warning); font-size: 0.7rem; line-height: 1.4; }
	dl { display: flex; flex-direction: column; gap: 0.4rem; margin: 0; }
	dl div { display: grid; grid-template-columns: 4.4rem 1fr; gap: 0.45rem; }
	dt, .label-field span { color: var(--editor-text-secondary); font-size: 12px; font-weight: 400; }
	dd { display: flex; flex-direction: column; gap: 0.1rem; margin: 0; color: var(--editor-text-primary); font-size: 12.5px; font-weight: 500; font-variant-numeric: tabular-nums; }
	.label-field { display: flex; flex-direction: column; gap: 0.3rem; }
	.label-field input { width: 100%; box-sizing: border-box; padding: 0.42rem; border: 1px solid var(--editor-border-normal); border-radius: 0.3rem; background: var(--editor-bg-panel); color: var(--editor-text-primary); font: 500 12.5px var(--editor-font); }
	.order-badge { align-self: flex-start; padding: 0.14rem 0.5rem; border: 1px solid var(--editor-accent-border); border-radius: 999px; background: var(--editor-bg-selected); color: var(--editor-text-primary); font-size: 0.68rem; font-weight: 650; }
	.unsequenced-badge { align-self: flex-start; padding: 0.14rem 0.5rem; border: 1px dashed var(--editor-border-strong); border-radius: 999px; color: var(--editor-outline-muted); font-size: 0.66rem; }
	.xz-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.45rem; }
	.topology { display: grid; grid-template-columns: 1fr; gap: 0.35rem; }
	button { padding: 0.42rem 0.4rem; border: 1px solid var(--editor-border-normal); border-radius: 0.3rem; background: var(--editor-bg-panel-raised); color: var(--editor-text-secondary); font: inherit; font-size: 0.72rem; cursor: pointer; }
	button.danger { border-color: var(--editor-danger-border); color: var(--editor-danger-fg); }
	button:disabled, input:disabled { opacity: 0.42; cursor: default; }
	.connections { display: flex; flex-direction: column; gap: 0.45rem; padding-top: 0.4rem; border-top: 1px solid var(--editor-border-subtle); }
	.connections h3 { margin: 0; font-size: 11px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; color: var(--editor-text-muted); }
	.connections-empty { margin: 0; color: var(--editor-text-muted); font-size: 0.7rem; }
	.connection-list { display: flex; flex-direction: column; gap: 0.28rem; margin: 0; padding: 0; list-style: none; }
	.connection-row { display: grid; grid-template-columns: 1rem minmax(0, 1fr) auto auto; gap: 0.5rem; align-items: center; padding: 0.3rem 0.4rem; border: 1px solid var(--editor-border-subtle); border-radius: 0.28rem; background: var(--editor-bg-panel); }
	.connection-row.outgoing { border-left: 2px solid var(--editor-accent); }
	.connection-row.incoming { border-left: 2px solid var(--editor-accent-hover); }
	.badge { color: var(--editor-accent); font: 0.7rem/1 var(--editor-font); text-align: center; }
	.connection-row.incoming .badge { color: var(--editor-accent-hover); }
	.partner { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.72rem; color: var(--editor-text-primary); }
	.room { color: var(--editor-text-muted); font: 0.6rem/1 var(--editor-font); }
	.meta { color: var(--editor-text-muted); font-size: 0.6rem; }
	.passive-note { margin: 0; padding: 0.55rem; border: 1px solid var(--editor-accent-border); border-radius: 0.35rem; background: var(--editor-bg-panel-raised); color: var(--editor-text-secondary); font-size: 0.7rem; line-height: 1.45; }
</style>
