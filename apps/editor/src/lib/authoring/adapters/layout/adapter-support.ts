/**
 * T1.P01.S04 — wiring between the adapter's public services and the
 * framework-free instrument controller.
 *
 * It reads the accepted F.2 Layout unit and the one canonical selection; it owns
 * no state and reaches no host internals.
 */

import { stageLayout } from '$lib/authoring/stage/unit-stage-source';
import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';
import type { StageAcceptOutcome } from '$lib/authoring/stage/host-acceptance';
import type { GestureAcquisition } from '$lib/authoring/stage/stage-session';
import type { LayoutDocumentWallFirst } from '@portfolio/layout-core';
import type { AuthoringIntent } from '@portfolio/project-model';

import {
	createLayoutInstrument,
	type LayoutGesturePort,
	type LayoutInstrument,
	type LayoutInstrumentOptions,
	type LayoutWriteOutcome
} from './instrument';
import { layoutSubjectOf, type LayoutSubject } from './precision';

function writeOutcome(outcome: StageAcceptOutcome): LayoutWriteOutcome {
	switch (outcome.kind) {
		case 'installed':
		case 'unchanged':
		case 'no-op':
			return { kind: outcome.kind };
		case 'refused':
			return { kind: 'refused', code: outcome.code, message: outcome.message };
	}
}

function port(services: StageAdapterServices): LayoutInstrumentOptions['port'] {
	return {
		accept: async (intent: AuthoringIntent) => writeOutcome(await services.authoring.accept(intent)),
		acceptedRevision: () => ({
			revisionId: services.authoring.acceptedRevision().revisionId
		})
	};
}

function documentOf(services: StageAdapterServices): LayoutDocumentWallFirst {
	return stageLayout(services.stage.snapshot());
}

/**
 * One gesture lease per instrument instance. The host owns the lease; this port
 * only remembers the acquisition it was granted so release can never release a
 * gesture someone else now holds.
 */
function gesturePort(services: StageAdapterServices): LayoutGesturePort {
	let lease: GestureAcquisition | null = null;
	return {
		acquire() {
			if (lease !== null) {
				// A reading change can end the lease while the instrument still holds
				// the object; a spent grant must be replaced, not reported as held.
				if (lease.kind === 'granted' && lease.lease.active) return true;
				lease = null;
			}
			const evaluationId = services.stage.evaluationId();
			if (evaluationId === null) return false;
			const outcome = services.stage.acquireGesture({
				owner: 'layout-precision',
				evaluationId,
				policy: 'cancel-on-reading-change'
			});
			if (outcome.kind !== 'granted') return false;
			lease = outcome;
			return true;
		},
		release() {
			if (lease !== null && lease.kind === 'granted') lease.lease.release();
			lease = null;
		}
	};
}

/**
 * The Card's name writer for one Layout subject, delegated to the same planner.
 *
 * It deliberately takes **no host gesture lease**: the uncommitted text in the Card
 * is transient UI state, not a document proposal. A *draft* builds no intent, so a
 * draft can never enter history. Both its value and the writer it commits through
 * are rebuilt from the current accepted snapshot, so a draft can only rename the
 * current subject against the current revision, never write against the one it was
 * typed under — and the committed rename is one ordinary `layout-entity-name`
 * history entry, refused rather than applied against a stale revision. Holding the
 * lease for the draft would disable Undo on a shell keystroke while protecting no
 * history. The Dimensions/placement instruments are different: their typed values
 * are settled-fact proposals, so they do hold the lease.
 */
export function layoutNameTarget(
	services: StageAdapterServices,
	subject: LayoutSubject
): { readonly value: string; commit(name: string): Promise<{ kind: 'accepted' } | { kind: 'refused'; code: string; message: string }> } | null {
	if (subject.kind === 'object') return null;
	const document = documentOf(services);
	const value =
		subject.kind === 'wall'
			? document.walls.find((candidate) => candidate.id === subject.id)?.name ?? ''
			: document.openings.find((candidate) => candidate.id === subject.id)?.name ?? '';
	const snapshot = services.stage.snapshot();
	const instrument = createLayoutInstrument({
		subject,
		document,
		projectId: snapshot.acceptedRevision.projectId,
		contentRevision: snapshot.domain.unitRevisions.layout,
		port: port(services)
	});
	return {
		value,
		async commit(name: string) {
			instrument.edit('name', name);
			const outcome = await instrument.commit('name');
			instrument.dispose();
			if (outcome.kind === 'accepted') return { kind: 'accepted' };
			return {
				kind: 'refused',
				code: outcome.kind === 'refused' ? outcome.code : outcome.kind,
				message: outcome.kind === 'refused' || outcome.kind === 'invalid' ? outcome.message : 'The name was not accepted.'
			};
		}
	};
}

/**
 * The Card's field-writer input for a selected Wall or Opening; `null` when there
 * is none. T1.P02.S02 moved these ordinary Layout fields out of the retired
 * Dimensions task and into the Card, with the same controller.
 */
export function layoutCardFieldsInput(services: StageAdapterServices): LayoutInstrumentOptions | null {
	const snapshot = services.stage.snapshot();
	const subject = layoutSubjectOf(services.stage.selection());
	if (subject === null || subject.kind === 'object') return null;
	return {
		subject,
		document: documentOf(services),
		projectId: snapshot.acceptedRevision.projectId,
		contentRevision: snapshot.domain.unitRevisions.layout,
		port: port(services),
		gesture: gesturePort(services)
	};
}

/**
 * The placement instrument input. Placement addresses no existing subject, so
 * it does not depend on a selection; the controller never reads its fields.
 */
export function layoutPlacementInput(services: StageAdapterServices): LayoutInstrumentOptions {
	const snapshot = services.stage.snapshot();
	const subject: LayoutSubject = layoutSubjectOf(services.stage.selection()) ?? {
		kind: 'object',
		id: '(placement)'
	};
	return {
		subject,
		document: documentOf(services),
		projectId: snapshot.acceptedRevision.projectId,
		contentRevision: snapshot.domain.unitRevisions.layout,
		port: port(services),
		gesture: gesturePort(services)
	};
}

export function createCardFieldsInstrument(services: StageAdapterServices): LayoutInstrument | null {
	const input = layoutCardFieldsInput(services);
	return input === null ? null : createLayoutInstrument(input);
}

export function createPlacementInstrument(services: StageAdapterServices): LayoutInstrument {
	return createLayoutInstrument(layoutPlacementInput(services));
}
