import type { OperationChange } from '@portfolio/project-model/f4';
import type { ScenePathAnchor } from '@portfolio/project-model/scene';
import type { ProjectEnvelope } from '@portfolio/project-model/units';
import type { StageAdapterServices } from '../stage/stage-adapter-host';
import { cameraConnectionCreateIntent, cameraConnectionUpdateIntent } from './commands-presentation';
import type { ExperienceSubject } from './experience-model';
import {
	previewPathSamples,
	readExperiencePath,
	resolvePathAnchorInsertion,
	resolvePathOccurrence,
	type ExperiencePathOccurrence,
	type ExperiencePathRead
} from './experience-paths';

type Submission = Parameters<StageAdapterServices['authoring']['accept']>[0];
type Revision = { readonly projectId: string; readonly revisionId: string };
type PathInput = Parameters<typeof readExperiencePath>[0];

export type ExperienceCameraSessionPorts = {
	readonly experience: () => PathInput['experience'] | null;
	readonly guide: () => PathInput['guide'];
	readonly graph: () => PathInput['graph'] | null;
	readonly geometry: () => PathInput['geometry'];
	readonly envelope: () => ProjectEnvelope;
	readonly say: (kind: 'success' | 'info' | 'refusal', text: string) => void;
	readonly newId: () => string;
	readonly revision: () => Revision;
	readonly run: (builder: () => Submission, success?: (changes: readonly OperationChange[]) => string) => Promise<boolean>;
};

export function createExperienceCameraSession(ports: ExperienceCameraSessionPorts) {
	let pathOccurrence = $state<ExperiencePathOccurrence | null>(null);
	let selectedAnchorId = $state<string | null>(null);

	const selectedPath = $derived.by((): ExperiencePathRead | null => {
		const experience = ports.experience();
		const graph = ports.graph();
		if (experience === null || pathOccurrence === null || graph === null) return null;
		return readExperiencePath({
			experience,
			guide: ports.guide(),
			graph,
			occurrence: pathOccurrence,
			geometry: ports.geometry()
		});
	});
	// An Undo, a reorder or a removed occurrence invalidates the session's point
	// and edit target; never leave a stale writer aimed at the old path.
	$effect(() => {
		const read = selectedPath;
		if (read === null) {
			selectedAnchorId = null;
			return;
		}
		if (selectedAnchorId !== null && !read.anchors.some((anchor) => anchor.id === selectedAnchorId)) {
			selectedAnchorId = null;
		}
	});


	function nextAnchorId(connectionId: string, existing: readonly string[]): string {
		const occupied = new Set(existing);
		for (let index = 1; ; index += 1) {
			const candidate = `${connectionId}-anchor-${String(index).padStart(2, '0')}`;
			if (!occupied.has(candidate)) return candidate;
		}
	}

	// ---- Camera paths ----

	function selectPath(occurrence: ExperiencePathOccurrence | null): void {
		pathOccurrence = occurrence;
		selectedAnchorId = null;
	}


	function selectAnchor(anchorId: string | null): void {
		selectedAnchorId = anchorId;
	}

	async function createPath(occurrence: ExperiencePathOccurrence): Promise<boolean> {
		const experience = ports.experience();
		if (experience === null) return false;
		const resolved = resolvePathOccurrence(experience, ports.guide(), occurrence);
		if (resolved === null) {
			ports.say('refusal', 'This move has no destination to travel to.');
			return false;
		}
		if (resolved.transition !== 'travel') {
			ports.say('refusal', 'A Cut has no travel path. Choose Travel first.');
			return false;
		}
		const fromView = ports.envelope().units.camera.data.views.find((view) => view.id === resolved.fromViewId);
		const toView = ports.envelope().units.camera.data.views.find((view) => view.id === resolved.toViewId);
		if (fromView === undefined || toView === undefined) {
			ports.say('refusal', 'A View this move needs is missing.');
			return false;
		}
		const accepted = await ports.run(
			() =>
				cameraConnectionCreateIntent({
					envelope: ports.envelope(),
					revision: ports.revision(),
					ids: { operation: ports.newId(), connection: ports.newId() },
					fromView,
					toView
				}),
			() => 'Camera path added'
		);
		if (accepted) selectPath(occurrence);
		return accepted;
	}

	/** One accepted write per anchor edit; every other connection field survives. */
	async function writePathAnchors(
		read: ExperiencePathRead,
		anchors: readonly ScenePathAnchor[]
	): Promise<boolean> {
		if (read.connectionId === null) return false;
		const connection = ports.envelope().units.camera.data.connections.find((entry) => entry.id === read.connectionId);
		if (connection === undefined) return false;
		return ports.run(
			() =>
				cameraConnectionUpdateIntent({
					envelope: ports.envelope(),
					revision: ports.revision(),
					ids: { operation: ports.newId() },
					connectionId: connection.id,
					anchors
				})
		);
	}

	function proposedPathAnchors(
		read: ExperiencePathRead,
		anchorId: string | null,
		point: readonly [number, number, number],
		slot?: number,
		near?: readonly [number, number, number]
	): readonly ScenePathAnchor[] | null {
		const connection = ports.envelope().units.camera.data.connections.find((entry) => entry.id === read.connectionId);
		const graph = ports.graph();
		if (connection === undefined || read.direction === null || graph === null) return null;
		const anchors = connection.positionPath.anchors;
		if (anchorId !== null) {
			const previous = anchors.find((anchor) => anchor.id === anchorId);
			if (previous === undefined || previous.position.every((value, index) => value === point[index])) return null;
			return anchors.map((anchor) => anchor.id === anchorId ? { ...anchor, position: [...point] } : anchor);
		}
		const insertion = slot === undefined
			? resolvePathAnchorInsertion({ connection, direction: read.direction, graph, point: [...(near ?? point)] })
			: Number.isInteger(slot) ? { index: slot, position: point } : null;
		if (insertion === null || insertion.index < 0 || insertion.index > anchors.length) return null;
		const anchor: ScenePathAnchor = {
			id: nextAnchorId(connection.id, anchors.map((entry) => entry.id)),
			position: [...(near === undefined ? insertion.position : point)]
		};
		return [...anchors.slice(0, insertion.index), anchor, ...anchors.slice(insertion.index)];
	}

	function previewPathDrag(
		anchorId: string | null,
		point: readonly [number, number, number],
		origin: readonly [number, number, number]
	): ExperiencePathRead['samples'] | null {
		const read = selectedPath;
		const graph = ports.graph();
		if (read === null || read.direction === null || graph === null) return null;
		if (read.connectionId === null) return null;
		try {
			const anchors = proposedPathAnchors(read, anchorId, point, undefined, origin);
			return anchors === null ? null : previewPathSamples(read.connectionId, read.direction, graph, anchors);
		} catch {
			// An intermediate point may fail Camera evaluation. Keep the accepted route visible.
			return null;
		}
	}

	async function addPathAnchor(
		point: readonly [number, number, number],
		slot?: number,
		near?: readonly [number, number, number]
	): Promise<boolean> {
		const read = selectedPath;
		if (read === null || read.connectionId === null || read.direction === null) return false;
		const anchors = proposedPathAnchors(read, null, point, slot, near);
		if (anchors === null) {
			ports.say('refusal', 'Insert a point on the selected Camera path.');
			return false;
		}
		const accepted = await writePathAnchors(read, anchors);
		if (accepted) {
			const existing = new Set(read.anchors.map((anchor) => anchor.id));
			selectedAnchorId = anchors.find((anchor) => !existing.has(anchor.id))?.id ?? null;
		}
		return accepted;
	}

	async function movePathAnchor(anchorId: string, point: readonly [number, number, number]): Promise<boolean> {
		const read = selectedPath;
		if (read === null) return false;
		const anchors = proposedPathAnchors(read, anchorId, point);
		return anchors !== null && writePathAnchors(read, anchors);
	}

	async function removePathAnchor(anchorId: string): Promise<boolean> {
		const read = selectedPath;
		if (read === null || read.connectionId === null) return false;
		const connection = ports.envelope().units.camera.data.connections.find((entry) => entry.id === read.connectionId);
		if (connection === undefined || !connection.positionPath.anchors.some((entry) => entry.id === anchorId)) {
			return false;
		}
		const accepted = await writePathAnchors(
			read,
			connection.positionPath.anchors.filter((entry) => entry.id !== anchorId)
		);
		if (accepted) selectedAnchorId = null;
		return accepted;
	}

	async function straightenPath(): Promise<boolean> {
		const read = selectedPath;
		if (read === null || read.connectionId === null) return false;
		const connection = ports.envelope().units.camera.data.connections.find((entry) => entry.id === read.connectionId);
		if (connection === undefined) return false;
		if (connection.positionPath.anchors.length === 0) {
			ports.say('info', 'The Camera path is already straight.');
			return false;
		}
		const accepted = await writePathAnchors(read, []);
		if (accepted) selectedAnchorId = null;
		return accepted;
	}

	async function setPathDuration(seconds: number | null): Promise<boolean> {
		const read = selectedPath;
		if (read === null || read.connectionId === null || read.direction === null) return false;
		if (seconds !== null && (!Number.isFinite(seconds) || seconds <= 0)) {
			ports.say('refusal', 'A duration is a positive number of seconds, or Auto.');
			return false;
		}
		const connection = ports.envelope().units.camera.data.connections.find((entry) => entry.id === read.connectionId);
		if (connection === undefined) return false;
		return ports.run(
			() =>
				cameraConnectionUpdateIntent({
					envelope: ports.envelope(),
					revision: ports.revision(),
					ids: { operation: ports.newId() },
					connectionId: connection.id,
					timing: { [read.direction!]: { durationSeconds: seconds } }
				}),
			() => (seconds === null ? 'Automatic duration restored' : 'Camera path duration changed')
		);
	}


	function selectSubject(next: ExperienceSubject | null): void {
		// A transition owns its path occurrence; any other subject clears the Path reading.
		pathOccurrence = next?.kind === 'transition' ? { kind: 'transition', stopId: next.stopId } : null;
		selectedAnchorId = null;
	}

	return {
		get occurrence() {
			return pathOccurrence;
		},
		get read() {
			return selectedPath;
		},
		get anchorId() {
			return selectedAnchorId;
		},
		select: selectPath,
		selectAnchor,
		selectSubject,
		createPath,
		previewPathDrag,
		addPathAnchor,
		movePathAnchor,
		removePathAnchor,
		straightenPath,
		setPathDuration
	};
}
