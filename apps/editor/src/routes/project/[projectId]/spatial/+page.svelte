<script lang="ts">
	import { page } from '$app/state';
	import { createWorkspaceHost } from '$lib/authoring/workspace/host/workspace-host.svelte';
	import WorkspaceHost from '$lib/authoring/workspace/host/WorkspaceHost.svelte';

	const host = createWorkspaceHost({ page: () => page });
</script>

<WorkspaceHost {host} />
