import type { BootState } from '../boot-state';
import { stageEnvelope } from '../unit-stage-source';

export function createProjectReadyPort(boot: () => BootState) {
	const snapshot = $derived.by(() => {
		const current = boot();
		return current.status === 'ready' || current.status === 'empty' ? current.snapshot : null;
	});

	const envelope = $derived(snapshot === null ? null : stageEnvelope(snapshot));
	const sourceFindings = $derived.by(() => {
		if (snapshot === null) return null;
		const { diagnostics, closure } = snapshot.domain;
		return diagnostics.length === 0 && closure.length === 0 ? null : { diagnostics, closure };
	});

	return {
		snapshot: () => snapshot,
		envelope: () => envelope,
		findings: () => sourceFindings,
		active: () => snapshot !== null,
		datumMeters: () => snapshot?.domain.datumMeters ?? 0,
	};
}
