import { sameSky, type SceneSky } from '@portfolio/project-model/units';
import type { SceneSkyUpdatePayload } from '@portfolio/project-model/units/planning';
import type { AcceptedRevision } from '@portfolio/project-model/references';

type Host = {
	sky: () => SceneSky;
	revision: () => AcceptedRevision | undefined;
	busy: () => boolean;
	preview: (sky: SceneSky | null) => void;
	update: (patch: SceneSkyUpdatePayload, revision: AcceptedRevision) => Promise<void>;
};

export function createSkyGesture(host: Host) {
	let active = $state.raw<{
		owner: string;
		base: SceneSky;
		revision: AcceptedRevision;
	} | null>(null);
	let patch: SceneSkyUpdatePayload = {};
	let frame: number | undefined;
	let generation = 0;

	function clearFrame(): void {
		if (frame !== undefined) cancelAnimationFrame(frame);
		frame = undefined;
	}

	function cancel(): boolean {
		if (active === null) return false;
		active = null;
		generation++;
		clearFrame();
		host.preview(null);
		return true;
	}

	function current(): boolean {
		const revision = host.revision();
		return (
			active !== null &&
			active.revision.projectId === revision?.projectId &&
			active.revision.revisionId === revision.revisionId
		);
	}

	function begin(owner: string): boolean {
		if (active !== null) return active.owner === owner && current();
		const revision = host.revision();
		if (!revision || host.busy()) return false;
		generation++;
		active = { owner, base: host.sky(), revision };
		patch = {};
		return true;
	}

	function resolved(): SceneSky {
		const base = active?.base ?? host.sky();
		return { ...base, ...patch, moon: { ...base.moon, ...patch.moon } };
	}

	function move(owner: string, next: SceneSkyUpdatePayload): void {
		if (active?.owner !== owner) return;
		if (!current()) {
			cancel();
			return;
		}
		patch = next;
		if (frame !== undefined) return;
		frame = requestAnimationFrame(() => {
			frame = undefined;
			if (current()) host.preview(resolved());
			else cancel();
		});
	}

	async function commit(owner: string): Promise<void> {
		if (active?.owner !== owner) return;
		if (!current()) {
			cancel();
			return;
		}
		const { base, revision } = active;
		const sky = resolved();
		clearFrame();
		active = null;
		if (sameSky(base, sky)) {
			host.preview(null);
			return;
		}
		const ticket = generation;
		host.preview(sky);
		try {
			await host.update(patch, revision);
		} finally {
			if (generation === ticket) host.preview(null);
		}
	}

	$effect(() => {
		if (active && !current()) cancel();
	});

	return {
		get owner() {
			return active?.owner ?? null;
		},
		get value() {
			return active ? resolved() : host.sky();
		},
		begin,
		move,
		commit,
		cancel,
	};
}
