/** A read-only adapter consumer with no source document or decoder dependency. */
import { resolveReference, type SemanticReference } from '@portfolio/project-model';
import type { StageReadSnapshot } from '$lib/authoring/stage/accepted-read';
import type { StageFacade } from '$lib/authoring/stage/stage-facade';

export function readAccepted(snapshot: StageReadSnapshot, target: SemanticReference) {
	return { identity: snapshot.acceptedRevision, kind: snapshot.sourceKind, version: snapshot.sourceVersion,
		resolution: resolveReference(target, snapshot.domain.references), name: snapshot.domain.name };
}
export function selectAccepted(stage: StageFacade, target: SemanticReference) {
	return stage.setSelection({ ordered: [{ reference: target }], primary: target });
}
/** A second test-only encoding: no authored format implementation or source authority. */
export function encodingIndependentRead(domain: StageReadSnapshot['domain']): StageReadSnapshot {
	return { acceptedRevision: domain.references.snapshot.acceptedRevision, sourceContentId: domain.references.snapshot.sourceContentId,
		canonicalJson: '{}', sourceKind: 'test-read-port', sourceVersion: 27,
		sessionEpoch: domain.references.sessionEpoch, compileGeneration: domain.references.generationId ?? '', domain };
}
