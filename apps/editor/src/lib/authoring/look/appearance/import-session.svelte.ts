import type { ProjectApi } from '$lib/platform/project-persistence';
import type { MaterialProofRegistry } from '../../material-proof';
import type { StageReadSnapshot } from '../../stage/accepted-read';
import type { StageAdapterServices } from '../../stage/stage-adapter-host';
import type { StageLens } from '../../stage/stage-session';
import { stageEnvelope } from '../../stage/unit-stage-source';
import {
	createMaterialImportSession,
	type ImportTargetChoice,
} from '../../library/material-import.svelte';
import type { ImportSheetProps } from '../appearance-view';
import type { FinishAuthoring } from '../finish-authoring.svelte';

export function createAppearanceImportSession(input: {
	readonly api: ProjectApi | null;
	readonly projectId: string;
	readonly snapshot: () => StageReadSnapshot | null;
	readonly previewing: () => boolean;
	readonly lens: () => StageLens;
	readonly services: () => StageAdapterServices | null;
	readonly materialProofs: MaterialProofRegistry;
	readonly onNotice: (message: string) => void;
	readonly finishes: () => FinishAuthoring;
}) {
	const materialImport = createMaterialImportSession({
		acceptHost: () => {
			if (input.snapshot() === null) return null;
			const services = input.services();
			const cloudApi = input.api;
			if (services === null || cloudApi === null) return null;
			return {
				api: cloudApi,
				projectId: input.projectId,
				current: () => {
					const shot = services.stage.snapshot();
					return { revision: shot.acceptedRevision, source: stageEnvelope(shot) };
				},
				accept: async (intent) => {
					const outcome = await services.authoring.accept(intent);
					if (outcome.kind === 'installed') return { kind: 'accepted' };
					if (outcome.kind === 'refused')
						return { kind: 'rejected', code: outcome.code, message: outcome.message };
					return { kind: 'rejected', code: outcome.kind, message: 'No change was made.' };
				},
				entityReference: (source, entityId) => ({
					version: 1 as const,
					domain: 'scene' as const,
					revision: {
						kind: 'exact' as const,
						contentRevision: source.units.scene.header.contentRevision,
					},
					subject: { kind: 'entity' as const, id: entityId },
					instancePath: [],
					location: { kind: 'project-root' as const },
					componentId: null,
					capabilityId: null,
				}),
				surfaceReference: (source, surface) => ({
					version: 1 as const,
					domain: 'layout' as const,
					revision: {
						kind: 'exact' as const,
						contentRevision: source.units.layout.header.contentRevision,
					},
					subject:
						surface.kind === 'wall-side'
							? { kind: 'wall' as const, id: surface.wallId }
							: surface.kind === 'region-face'
								? { kind: 'region' as const, id: surface.regionId }
								: { kind: 'room' as const, id: surface.roomId },
					instancePath: [],
					location: { kind: 'project-root' as const },
					componentId: null,
					capabilityId: null,
				}),
			};
		},
		expectedRevision: () => input.snapshot()?.acceptedRevision ?? null,
		materialProofs: () => input.materialProofs,
		onAccepted: ({ finishKey, name, targetCount, targetKind, firstTarget }) => {
			input.finishes().noteUsedFinish?.(finishKey);
			if (targetCount > 0 && firstTarget !== null) {
				const nouns = targetKind === 'layout' ? 'surfaces' : 'parts';
				const other = targetKind === 'layout' ? 'objects' : 'walls';
				input.onNotice(
					`${name} is on ${targetCount} ${nouns} · paint it on ${other} from Materials — same Finish`,
				);
				if (firstTarget.kind === 'surface') {
					input.finishes().card.requestOpen({ kind: 'surface', surface: firstTarget.surface });
				} else {
					input.finishes().card.requestOpen({ kind: 'entity', entityId: firstTarget.id });
				}
			} else {
				input.onNotice(`${name} added to This project`);
			}
		},
	});

	function currentImportTargets(): ImportTargetChoice[] {
		const out: ImportTargetChoice[] = [];
		const target = input.finishes().libraryTarget();
		if (target !== null) {
			if (target.kind === 'entity') {
				out.push({ kind: 'entity', id: target.entityId, label: target.label });
			} else {
				out.push({ kind: 'surface', surface: target.surface, label: target.label });
			}
		}
		return out;
	}

	function dismissMaterialImport(): boolean {
		if (!materialImport.open) return false;
		materialImport.cancel();
		return true;
	}

	function start(files: readonly File[], invoker?: HTMLElement | null) {
		return materialImport.start(files, currentImportTargets(), invoker);
	}

	const props = $derived.by((): ImportSheetProps | null =>
		materialImport.open && !input.previewing() && input.lens() === 'world'
			? { session: materialImport }
			: null,
	);

	return {
		start,
		dismissMaterialImport,
		view: materialImport,
		cancel: materialImport.cancel,
		get props() {
			return props;
		},
	};
}
