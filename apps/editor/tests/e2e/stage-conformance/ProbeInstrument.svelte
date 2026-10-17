<script lang="ts">
	import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
	import { heightIntent, sceneCreateIntent, sceneShadowIntent, selectSceneEntity } from './probe-adapter';
	import { probeState, setResult } from './probe-state';
	let { services }: { services: StageAdapterServices } = $props();

	async function run(label: string, action: () => Promise<{ kind: string }>): Promise<void> {
		const outcome = await action();
		setResult(`${label}: ${outcome.kind}`);
	}
</script>
<button type="button" onclick={() => run('height', () => services.authoring.accept(heightIntent(services)))}>
	Apply conformance height
</button>
<button type="button" onclick={() => run('entity', () => services.authoring.accept(sceneCreateIntent(services)))}>
	Create conformance entity
</button>
<button type="button" onclick={() => run('shadow', () => services.authoring.accept(sceneShadowIntent(services)))}>
	Toggle conformance entity shadow
</button>
<button type="button" onclick={() => setResult(`selection: ${selectSceneEntity(services)}`)}>
	Select conformance entity
</button>
<p role="status">{$probeState.lastResult}</p>
<dl class="probe-echo">
	<dt>Scene entity</dt>
	<dd data-probe="entity">{$probeState.entityId ?? 'none'}</dd>
	<dt>receiveShadow</dt>
	<dd data-probe="shadow">{$probeState.receiveShadow === null ? 'n/a' : String($probeState.receiveShadow)}</dd>
	<dt>Selection echo</dt>
	<dd data-probe="echo">{[$probeState.primary ?? 'none', ...$probeState.ordered].join(' | ')}</dd>
	<dt>Echo deliveries</dt>
	<dd data-probe="changes">{$probeState.selectionChanges}</dd>
</dl>
