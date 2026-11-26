<script lang="ts">
	import ShellIcon from './ShellIcon.svelte';

	type HeadFindEntry = {
		readonly id: string;
		readonly adapterId: string;
		readonly label: string;
		readonly verb: string;
	};

	let {
		find,
		findResults,
		open = $bindable(),
		input = $bindable(),
		uid,
		onRun
	}: {
		find: { readonly entries: readonly HeadFindEntry[]; readonly query: string; readonly onQuery: (query: string) => void };
		findResults: readonly HeadFindEntry[];
		open: boolean;
		input: HTMLInputElement | undefined;
		uid: string;
		onRun: (entry: HeadFindEntry) => void | Promise<void>;
	} = $props();

	let findIndex = $state(0);
	const findGroup = (entry: HeadFindEntry) =>
		entry.adapterId === 'project-menu'
			? 'Commands'
			: entry.verb === 'Select' || entry.verb === 'Go to'
				? 'Places'
				: entry.verb === 'Arm'
					? 'Tools'
					: 'Commands';
</script>

<div class="find" class:open={open} data-head-find>
	<ShellIcon name="search" size={15} />
	<input
		bind:this={input}
		type="search"
		role="combobox"
		aria-label="Find a subject, tool or operation"
		aria-expanded={open}
		aria-controls={`${uid}-find-results`}
		aria-autocomplete="list"
		aria-activedescendant={open && findResults[findIndex] ? `${uid}-find-${findIndex}` : undefined}
		placeholder="Find tools, actions, places…"
		value={find.query}
		onfocus={() => {
			open = true;
			findIndex = 0;
		}}
		oninput={(event) => {
			find.onQuery(event.currentTarget.value);
			findIndex = 0;
			open = true;
		}}
		onkeydown={(event) => {
			if (event.key === 'Escape') {
				event.preventDefault();
				event.stopPropagation();
				open = false;
				input?.focus();
			} else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
				event.preventDefault();
				open = true;
				findIndex = (findIndex + (event.key === 'ArrowDown' ? 1 : -1) + findResults.length) % Math.max(1, findResults.length);
				document.getElementById(`${uid}-find-${findIndex}`)?.scrollIntoView({ block: 'nearest' });
			} else if (event.key === 'Enter' && open && findResults[findIndex]) {
				event.preventDefault();
				void onRun(findResults[findIndex]!);
			}
		}}
	/>
	<kbd>⌘K</kbd>
	<div class="find-body" hidden={!open}>
		<ul class="find-results" id={`${uid}-find-results`} role="listbox" aria-label="Find results">
			{#each findResults as entry, index (`${entry.adapterId}:${entry.id}`)}
				{#if index === 0 || findGroup(findResults[index - 1]!) !== findGroup(entry)}<li role="presentation" class="find-group">{findGroup(entry)}</li>{/if}
				<li role="option" id={`${uid}-find-${index}`} aria-selected={index === findIndex}>
					<button
						type="button"
						tabindex="-1"
						data-find-id={entry.id}
						data-find-adapter={entry.adapterId}
						onpointerdown={(event) => event.preventDefault()}
						onclick={() => void onRun(entry)}
					>
						<ShellIcon
							name={entry.verb === 'Select' ? 'select' : entry.verb === 'Go to' ? 'layers' : entry.verb === 'Arm' ? 'ink' : 'find'}
							size={15}
						/>
						<span class="find-verb">{entry.verb}</span>{' '}<span>{entry.label}</span>
					</button>
				</li>
			{/each}
		</ul>
		{#if find.entries.length === 0}<p class="find-empty">No matching results</p>{/if}
	</div>
</div>

<style>
	.find {
		position: relative;
		display: flex;
		align-items: center;
		gap: 6px;
		width: 250px;
		height: var(--shell-control-height);
		padding: 0 8px;
		border-radius: 8px;
		background: var(--shell-on-forest-wash-strong);
		color: var(--shell-ink-quiet);
	}
	.find.open {
		width: 330px;
		background: var(--shell-field-focus);
		color: var(--shell-ink-3);
	}
	.find input {
		width: 100%;
		min-width: 0;
		border: 0;
		outline: none;
		padding: 0;
		background: transparent;
		color: inherit;
		font: var(--shell-text-body) var(--shell-sans);
	}
	.find input::placeholder {
		color: var(--shell-ink-quiet);
	}
	.find.open input {
		color: var(--shell-ink);
	}
	kbd {
		color: var(--shell-ink-quiet);
		font: var(--shell-text-meta) var(--shell-mono);
		white-space: nowrap;
	}
	.find-body {
		position: absolute;
		z-index: 40;
		top: 36px;
		right: 0;
		width: 330px;
		padding: 4px;
		border: 1px solid var(--shell-hairline);
		border-radius: 10px;
		background: var(--shell-popover);
		color: var(--shell-ink);
		box-shadow: var(--shell-shadow);
	}
	.find-body[hidden] {
		display: none;
	}
	.find-results {
		margin: 0;
		padding: 0;
		list-style: none;
		max-height: 420px;
		overflow: auto;
	}
	.find-results button {
		justify-content: flex-start;
		width: 100%;
		height: auto;
		min-height: var(--shell-control-height);
		padding: 5px 8px;
		text-align: left;
		white-space: normal;
		border: 0;
		border-radius: 6px;
		background: transparent;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.find-results [aria-selected='true'],
	.find-results button:hover {
		background: var(--shell-hover);
		border-radius: 6px;
	}
	.find-verb {
		flex: none;
		font-size: var(--shell-text-label);
		color: var(--shell-ink-3);
	}
	.find-group {
		padding: 6px 8px 2px;
		color: var(--shell-ink-3);
		font-size: var(--shell-text-meta);
		text-transform: uppercase;
		letter-spacing: 0.07em;
	}
	.find-empty {
		margin: 8px;
		font-size: var(--shell-text-utility);
	}
	@media (max-width: 1100px) {
		.find,
		.find.open {
			width: 210px;
		}
	}
	@media (max-width: 860px) {
		kbd {
			display: none;
		}
		.find,
		.find.open {
			width: 150px;
		}
	}
	@media (pointer: coarse) {
		.find {
			min-height: 44px;
		}
	}
</style>
