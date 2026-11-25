import { eyeOfInspectionPose, type ViewportEvaluation } from '@portfolio/camera-core/viewport';
import { overheadSourcesOf } from '@portfolio/layout-core/geometry';
import type { ProjectEnvelope } from '@portfolio/project-model/units';
import { initialLiftScope, interiorLift } from '../../layout/interior-lift-store.svelte';
import { contribution } from '../../workspace/region-ownership';
import type { StageReadSnapshot } from '../accepted-read';
import type { StageSelectionEntry } from '../semantic-selection';

export function createLiftHost(input: {
	readonly snapshot: () => StageReadSnapshot | null;
	readonly envelope: () => ProjectEnvelope | null;
	readonly selection: () => StageSelectionEntry | null;
	readonly evaluation: () => ViewportEvaluation | null;
	readonly notice: (notice: string) => void;
}) {
	/**
	 * The overheads the live Lift reading has lifted: Room lids **and** authored
	 * region slabs. Lift maps Layout's sources to representation ids;
	 * which overheads a scope names is `overheadSourcesOf`'s answer.
	 * `VisitorPreviewSurface` never receives either list, so Preview stays as-built.
	 */
	const liftedSources = $derived.by(() => {
		const reading = interiorLift.reading;
		if (reading === null) return [];
		const snapshot = input.snapshot();
		return snapshot === null ? [] : overheadSourcesOf(snapshot.domain.geometry, reading.scope);
	});
	const liftedRoomIds = $derived(
		liftedSources
			.filter((source) => source.key.kind === 'room-lid')
			.map((source) => source.subject.id)
	);
	const liftedRegionIds = $derived(
		liftedSources
			.filter((source) => source.key.kind === 'region')
			.map((source) => source.subject.id)
	);
	/** The selected Room, when the selection is one: a lift is selected through its Room. */
	const selectedLiftRoomId = $derived.by(() => {
		const entry = input.selection();
		return entry?.reference.domain === 'layout' && entry.reference.subject.kind === 'room'
			? entry.reference.subject.id
			: null;
	});

	/**
	 * The entry rule, stated once: a Room selection wins, then the Room the eye is
	 * inside in 3D, then everything. Plan has no eye to be occupied by, and the
	 * reading never re-derives its scope after entry.
	 */
	function toggleLift(): void {
		if (interiorLift.isActive()) {
			interiorLift.putBack();
			return;
		}
		const snapshot = input.snapshot();
		if (snapshot === null) return;
		const evaluation = input.evaluation();
		interiorLift.lift(
			initialLiftScope({
				selectedRoomId: selectedLiftRoomId,
				reading: evaluation?.renderedReading === 'plan' ? 'plan' : '3d',
				eye: evaluation === null ? null : eyeOfInspectionPose(evaluation.pose),
				compiled: snapshot.domain.geometry
			})
		);
	}

	const liftControl = $derived({ active: interiorLift.isActive(), toggle: toggleLift });

	/**
	 * The Lift pill's reads. The scoped Room is named as its Card titles it, and the
	 * menu's candidate is the same rule entry uses: selected Room, occupied Room,
	 * then the Room already scoped. Everything else is Today's scope.
	 */
	const liftPill = $derived.by(() => {
		const reading = interiorLift.reading;
		if (reading === null) return null;
		const scopeRoomId = reading.scope.kind === 'space' ? reading.scope.roomId : null;
		const nameOf = (roomId: string | null): string | null =>
			roomId === null
				? null
				: (input.envelope()?.units.layout.data.rooms.find((room) => room.id === roomId)?.name ??
					null);
		const geometry = input.snapshot()?.domain.geometry ?? null;
		const evaluation = input.evaluation();
		const occupiedRoomId =
			geometry === null || evaluation === null
				? null
				: (() => {
						const occupied = initialLiftScope({
							selectedRoomId: null,
							reading: '3d',
							eye: eyeOfInspectionPose(evaluation.pose),
							compiled: geometry
						});
						return occupied.kind === 'space' ? occupied.roomId : null;
					})();
		const candidateId = selectedLiftRoomId ?? occupiedRoomId ?? scopeRoomId;
		const candidateName = nameOf(candidateId);
		return {
			scopeRoomId,
			scopeLabel: nameOf(scopeRoomId),
			candidate:
				candidateId === null || candidateName === null
					? null
					: { id: candidateId, label: candidateName },
			onScope: (roomId: string | null) => {
				interiorLift.setScope(roomId === null ? { kind: 'all' } : { kind: 'space', roomId });
			},
			onPutBack: () => interiorLift.putBack()
		};
	});

	function attachScope(): void {
		/**
		 * A scoped Space that stops compiling (deleted, merged, undone away) ends the
		 * reading in words instead of leaving a pill pointing at nothing. This is a
		 * read-side reconciliation: it writes no document and no history.
		 */
		$effect(() => {
			const reading = interiorLift.reading;
			if (reading === null || reading.scope.kind !== 'space') return;
			const snapshot = input.snapshot();
			if (snapshot === null) return;
			const roomId = reading.scope.roomId;
			if (snapshot.domain.geometry.rooms.some((room) => room.roomId === roomId)) return;
			interiorLift.clear();
			input.notice('Lift ended: the Space is gone.');
		});
	}

	const canvas = contribution<'layout-readings', 'canvas'>()({
		get liftSources() { return liftedSources; },
		get liftedRoomIds() { return liftedRoomIds; },
		get liftedRegionIds() { return liftedRegionIds; }
	});
	const viewport = contribution<'layout-readings', 'viewport'>()({
		get lift() { return liftPill; }
	});

	return {
		canvas, viewport, attachScope,
		get control() { return liftControl; },
		active: () => interiorLift.isActive(),
		putBack: () => interiorLift.putBack(),
		clear: () => interiorLift.clear()
	};
}
