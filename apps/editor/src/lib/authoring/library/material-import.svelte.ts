/**
 * Material set import session over E5 (T2.S8 U6).
 *
 * Owns session-local file bytes, slow-read progress (after 300 ms), E5
 * proposal/conflict/normal-acknowledgement state, `prepareDraft` for live E7
 * previews, and `acceptDraft` (one undo, P20 upload retention). Cancelling or
 * closing aborts in-flight work and releases bytes; nothing is written until
 * Accept succeeds.
 */
import {
	proposeMaterialSet,
	type DraftEdits,
	type DraftRoleEdit,
	type ProposalConflict,
	type SetCandidate,
	type SetFileFact,
	type SetProposal
} from '@portfolio/project-model/material-authoring';
import type { MapRole, NormalConvention } from '@portfolio/project-model/materials';
import type { AcceptedRevision, SceneSurfaceRef } from '@portfolio/project-model';
import {
	acceptDraft,
	prepareDraft,
	readSetFileFact,
	type AcceptDraftHost,
	type AcceptDraftResult,
	type PreparedFinishDraft,
	type SetFileSession
} from '$lib/authoring/materials/material-set';
import type { MaterialProofRegistry } from '$lib/authoring/material-proof';

export type ImportTargetChoice =
	| { readonly kind: 'entity'; readonly id: string; readonly label: string }
	| { readonly kind: 'surface'; readonly surface: SceneSurfaceRef; readonly label: string };

export type ImportFileRow = {
	readonly key: string;
	readonly name: string;
	readonly readsAs: string;
	readonly note: string;
	readonly state: 'ok' | 'ack' | 'clash' | 'skip';
	readonly badge: string;
};

export type MaterialImportHost = {
	readonly acceptHost: () => AcceptDraftHost | null;
	readonly expectedRevision: () => AcceptedRevision | null;
	readonly materialProofs: () => MaterialProofRegistry | null;
	readonly onAccepted?: (result: {
		readonly finishKey: string;
		readonly name: string;
		readonly targetCount: number;
		readonly targetKind: 'layout' | 'scene' | null;
		readonly firstTarget: ImportTargetChoice | null;
	}) => void;
};

export function titleCaseStem(stem: string): string {
	const cleaned = stem.replace(/[_-]+/g, ' ').trim();
	if (!cleaned) return 'Imported Material';
	return cleaned.replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function validateImportSize(raw: string): { readonly ok: true; readonly value: number } | { readonly ok: false; readonly message: string } {
	const v = Number.parseFloat(raw);
	if (!Number.isFinite(v) || v < 0.05 || v > 20) {
		return { ok: false, message: 'Physical size must be between 0.05 m and 20 m.' };
	}
	return { ok: true, value: Number(v.toFixed(4)) };
}

export function validateImportName(raw: string): { readonly ok: true; readonly value: string } | { readonly ok: false; readonly message: string } {
	const trimmed = raw.trim();
	if (trimmed.length < 1 || trimmed.length > 120) {
		return { ok: false, message: 'Name must be 1–120 characters.' };
	}
	return { ok: true, value: trimmed };
}

export function createMaterialImportSession(host: MaterialImportHost) {
	let open = $state(false);
	let phase = $state<'idle' | 'reading' | 'ready' | 'writing'>('idle');
	let readCount = $state(0);
	let totalCount = $state(0);
	let showSlowRead = $state(false);
	let invoker = $state.raw<HTMLElement | null>(null);

	let fileSession = $state.raw<SetFileSession | null>(null);
	let proposal = $state.raw<SetProposal | null>(null);
	let candidate = $state.raw<SetCandidate | null>(null);
	let prepared = $state.raw<PreparedFinishDraft | null>(null);

	// User resolutions
	let conflictChoices = $state.raw<Record<string, string>>({});
	let normalConvention = $state<NormalConvention>('+Y');
	let normalDetected = $state(false);
	let normalDetectedDetail = $state<string | null>(null);
	let normalAck = $state(true);
	let sizeText = $state('1');
	let nameText = $state('');
	let targets = $state.raw<readonly ImportTargetChoice[]>([]);
	let targetKind = $state<'layout' | 'scene'>('layout');
	let errorMessage = $state<string | null>(null);

	let controller: AbortController | null = null;
	let slowTimer: ReturnType<typeof setTimeout> | null = null;

	function clearSlowTimer(): void {
		if (slowTimer !== null) {
			clearTimeout(slowTimer);
			slowTimer = null;
		}
		showSlowRead = false;
	}

	function releaseSession(): void {
		clearSlowTimer();
		controller?.abort();
		controller = null;
		if (prepared !== null) {
			for (const src of prepared.sources.values()) src.release();
			prepared = null;
		}
		fileSession?.release();
		fileSession = null;
		proposal = null;
		candidate = null;
	}

	function buildDraftEdits(): DraftEdits | null {
		if (candidate === null || fileSession === null) return null;
		const sizeCheck = validateImportSize(sizeText);
		const nameCheck = validateImportName(nameText);
		if (!sizeCheck.ok || !nameCheck.ok) return null;

		const roles: Partial<Record<MapRole, DraftRoleEdit>> = {};

		for (const choice of candidate.roleChoices) {
			if (choice.role === 'color') {
				roles.color = { role: 'color', file: choice.file };
			} else if (choice.role === 'normal') {
				roles.normal = {
					role: 'normal',
					file: choice.file,
					convention: normalConvention
				};
			} else {
				roles[choice.role] = {
					role: choice.role,
					file: choice.file,
					component: choice.component ?? 'r',
					invert: choice.invert === true
				};
			}
		}

		for (const conflict of candidate.conflicts) {
			const pickedFile = conflictChoices[conflict.role];
			if (!pickedFile) return null;
			if (conflict.role === 'color') {
				roles.color = { role: 'color', file: pickedFile };
			} else if (conflict.role === 'normal') {
				roles.normal = {
					role: 'normal',
					file: pickedFile,
					convention: normalConvention
				};
			} else {
				const fact = fileSession.factsByKey().get(pickedFile);
				const lower = fact?.name.toLowerCase() ?? '';
				const isGloss = lower.includes('gloss');
				const isOrm = lower.includes('orm') || lower.includes('arm') || lower.includes('rma');
				const component = isOrm
					? conflict.role === 'occlusion'
						? 'r'
						: conflict.role === 'roughness'
							? 'g'
							: 'b'
					: 'r';
				roles[conflict.role] = {
					role: conflict.role,
					file: pickedFile,
					component,
					invert: isGloss && conflict.role === 'roughness'
				};
			}
		}

		if (Object.keys(roles).length === 0) return null;

		return {
			name: nameCheck.value,
			mapping: {
				kind: 'surface',
				metric: { tileMeters: [sizeCheck.value, sizeCheck.value], rotation: 0, offset: [0, 0] }
			},
			roles
		};
	}

	async function refreshPrepared(): Promise<void> {
		if (fileSession === null || controller === null) return;
		const edits = buildDraftEdits();
		const rev = host.expectedRevision();
		const proofs = host.materialProofs();
		if (edits === null || rev === null || proofs === null) {
			prepared = null;
			return;
		}
		const res = await prepareDraft(edits, fileSession, rev, controller.signal, proofs);
		if (controller?.signal.aborted) return;
		if (res.ok) {
			prepared = res.draft;
		} else {
			prepared = null;
		}
	}

	function applyProposal(next: SetProposal): void {
		proposal = next;
		const first = next.candidates[0] ?? null;
		candidate = first;
		conflictChoices = {};
		const normalChoice = first?.roleChoices.find((c) => c.role === 'normal');
		if (normalChoice !== undefined) {
			normalConvention = normalChoice.convention ?? '+Y';
			const needsAck = normalChoice.acknowledge === 'normal-convention';
			normalDetected = !needsAck;
			normalAck = !needsAck;
			normalDetectedDetail = normalDetected
				? `Normal direction: ${normalConvention === '-Y' ? 'DirectX (−Y)' : 'OpenGL (+Y)'}, from “${normalChoice.name}”.`
				: null;
		} else {
			normalConvention = '+Y';
			normalDetected = true;
			normalAck = true;
			normalDetectedDetail = null;
		}
		sizeText = '1';
		nameText = titleCaseStem(first?.stem ?? '');
		errorMessage = null;
	}

	async function start(
		files: readonly File[],
		initialTargets: readonly ImportTargetChoice[],
		opener?: HTMLElement | null
	): Promise<void> {
		if (files.length === 0) return;
		releaseSession();
		open = true;
		phase = 'reading';
		readCount = 0;
		totalCount = files.length;
		invoker = opener ?? null;
		targets = [...initialTargets];
		const hasLayout = initialTargets.some((t) => t.kind === 'surface');
		targetKind = hasLayout ? 'layout' : 'scene';
		errorMessage = null;

		const run = new AbortController();
		controller = run;
		slowTimer = setTimeout(() => {
			if (phase === 'reading') showSlowRead = true;
		}, 300);

		try {
			const bytes = new Map<string, Uint8Array>();
			const facts: SetFileFact[] = [];
			for (let i = 0; i < files.length; i += 1) {
				if (run.signal.aborted) return;
				const file = files[i]!;
				const key = `f:${i}:${file.name}`;
				const data = new Uint8Array(await file.arrayBuffer());
				if (run.signal.aborted) return;
				bytes.set(key, data);
				facts.push(await readSetFileFact(key, file.name, data));
				readCount = i + 1;
			}
			clearSlowTimer();
			if (run.signal.aborted) return;

			let released = false;
			const session: SetFileSession = {
				facts,
				factsByKey: () => new Map(facts.map((f) => [f.key, f])),
				bytesOf: (key) => (released ? undefined : bytes.get(key)),
				release() {
					released = true;
					bytes.clear();
				}
			};
			fileSession = session;
			const rev = host.expectedRevision()?.revisionId ?? 'rev-0';
			const nextProposal = proposeMaterialSet(facts, rev);
			applyProposal(nextProposal);
			phase = 'ready';
			await refreshPrepared();
		} catch (error) {
			clearSlowTimer();
			if (run.signal.aborted) return;
			errorMessage = error instanceof Error ? error.message : 'Could not read the selected files.';
			phase = 'ready';
		}
	}

	function chooseConflict(role: MapRole, fileKey: string): void {
		conflictChoices = { ...conflictChoices, [role]: fileKey };
		errorMessage = null;
		void refreshPrepared();
	}

	function reopenConflict(role: MapRole): void {
		const next = { ...conflictChoices };
		delete next[role];
		conflictChoices = next;
		prepared = null;
	}

	function setNormalConvention(conv: NormalConvention): void {
		normalConvention = conv;
		normalDetected = false;
		normalAck = false;
		errorMessage = null;
		void refreshPrepared();
	}

	function reopenNormalChoice(): void {
		normalDetected = false;
		normalAck = false;
		prepared = null;
	}

	function setNormalAck(checked: boolean): void {
		normalAck = checked;
		errorMessage = null;
		void refreshPrepared();
	}

	function setSize(raw: string): void {
		sizeText = raw;
		errorMessage = null;
		void refreshPrepared();
	}

	function setName(raw: string): void {
		nameText = raw;
		errorMessage = null;
		void refreshPrepared();
	}

	function setTargetKind(kind: 'layout' | 'scene'): void {
		targetKind = kind;
	}

	function blockingCount(): number {
		if (candidate === null) return 1;
		let count = 0;
		for (const conflict of candidate.conflicts) {
			if (!conflictChoices[conflict.role]) count += 1;
		}
		const hasNormal =
			candidate.roleChoices.some((c) => c.role === 'normal') ||
			candidate.conflicts.some((c) => c.role === 'normal');
		if (hasNormal && !normalDetected && !normalAck) count += 1;
		return count;
	}

	function isReady(): boolean {
		if (phase !== 'ready' || candidate === null) return false;
		if (blockingCount() > 0) return false;
		if (!validateImportSize(sizeText).ok) return false;
		if (!validateImportName(nameText).ok) return false;
		return true;
	}

	function selectedTargets(): readonly ImportTargetChoice[] {
		const hasLayout = targets.some((t) => t.kind === 'surface');
		const hasScene = targets.some((t) => t.kind === 'entity');
		if (hasLayout && hasScene) {
			return targets.filter((t) => (targetKind === 'layout' ? t.kind === 'surface' : t.kind === 'entity'));
		}
		return targets;
	}

	function fileRows(): readonly ImportFileRow[] {
		if (candidate === null || fileSession === null) return [];
		const rows: ImportFileRow[] = [];
		const facts = fileSession.facts;
		for (const fact of facts) {
			const choice = candidate.roleChoices.find((c) => c.file === fact.key);
			const conflict = candidate.conflicts.find((c) => c.files.includes(fact.key));
			const unassigned = candidate.unassigned.find((u) => u.file === fact.key);
			if (conflict) {
				const picked = conflictChoices[conflict.role];
				rows.push({
					key: fact.key,
					name: fact.name,
					readsAs: conflict.role,
					note: conflict.action,
					state: picked ? (picked === fact.key ? 'ok' : 'skip') : 'clash',
					badge: picked ? (picked === fact.key ? `${conflict.role} source` : `${conflict.role} unused`) : 'collision'
				});
			} else if (choice) {
				const needsAck = choice.role === 'normal' && !normalDetected;
				rows.push({
					key: fact.key,
					name: fact.name,
					readsAs: choice.role === 'color' ? 'Colour' : choice.role === 'normal' ? 'Normal' : choice.role,
					note: choice.source === 'packed-orm' ? 'packed R · G · B' : choice.invert ? 'gloss, inverted to roughness' : choice.source,
					state: needsAck ? (normalAck ? 'ok' : 'ack') : 'ok',
					badge: needsAck ? (normalAck ? `${normalConvention} confirmed` : 'check') : 'ready'
				});
			} else if (unassigned) {
				rows.push({
					key: fact.key,
					name: fact.name,
					readsAs: 'Not used',
					note: unassigned.detail,
					state: 'skip',
					badge: 'ignored'
				});
			}
		}
		return rows;
	}

	async function accept(): Promise<boolean> {
		if (!isReady() || fileSession === null || controller === null) return false;
		const acceptHost = host.acceptHost();
		const rev = host.expectedRevision();
		const proofs = host.materialProofs();
		if (acceptHost === null || rev === null || proofs === null) {
			errorMessage = 'The project is not ready to accept imports yet.';
			return false;
		}
		const edits = buildDraftEdits();
		if (edits === null) {
			errorMessage = 'Answer the open questions above before importing.';
			return false;
		}
		phase = 'writing';
		errorMessage = null;
		try {
			const prep = await prepareDraft(edits, fileSession, rev, controller.signal, proofs);
			if (!prep.ok) {
				errorMessage = prep.issues[0]?.action ?? 'Some fields still need attention.';
				phase = 'ready';
				return false;
			}
			const chosen = selectedTargets();
			const entityIds = chosen.filter((t): t is Extract<ImportTargetChoice, { kind: 'entity' }> => t.kind === 'entity').map((t) => t.id);
			const surfaces = chosen.filter((t): t is Extract<ImportTargetChoice, { kind: 'surface' }> => t.kind === 'surface').map((t) => t.surface);
			const result: AcceptDraftResult = await acceptDraft(
				prep.draft,
				{ entityIds, surfaces },
				crypto.randomUUID(),
				controller.signal,
				acceptHost
			);
			if (result.ok) {
				const finishName = validateImportName(nameText).ok ? nameText.trim() : 'Imported Material';
				const firstTarget = chosen[0] ?? null;
				const kindUsed = surfaces.length > 0 ? 'layout' : entityIds.length > 0 ? 'scene' : null;
				const returnTo = invoker;
				releaseSession();
				open = false;
				phase = 'idle';
				host.onAccepted?.({
					finishKey: `project:${result.finishId}`,
					name: finishName,
					targetCount: chosen.length,
					targetKind: kindUsed,
					firstTarget
				});
				if (chosen.length === 0 && returnTo && returnTo.isConnected) {
					queueMicrotask(() => returnTo.focus());
				}
				return true;
			}
			if (result.code === 'stale-revision') {
				const latestRev = host.expectedRevision()?.revisionId ?? rev.revisionId;
				applyProposal(proposeMaterialSet(fileSession.facts, latestRev));
				errorMessage = result.message;
				phase = 'ready';
				await refreshPrepared();
				return false;
			}
			errorMessage = result.message;
			phase = 'ready';
			return false;
		} catch (error) {
			if (controller?.signal.aborted) return false;
			errorMessage = error instanceof Error ? error.message : 'Import could not be completed.';
			phase = 'ready';
			return false;
		}
	}

	function cancel(restoreFocus = true): boolean {
		if (!open) return false;
		const returnTo = invoker;
		releaseSession();
		open = false;
		phase = 'idle';
		invoker = null;
		errorMessage = null;
		if (restoreFocus && returnTo && returnTo.isConnected) {
			queueMicrotask(() => returnTo.focus());
		}
		return true;
	}

	return {
		get open() { return open; },
		get phase() { return phase; },
		get readCount() { return readCount; },
		get totalCount() { return totalCount; },
		get showSlowRead() { return showSlowRead; },
		get candidate() { return candidate; },
		get proposal() { return proposal; },
		get prepared() { return prepared; },
		get conflictChoices() { return conflictChoices; },
		get normalConvention() { return normalConvention; },
		get normalDetected() { return normalDetected; },
		get normalDetectedDetail() { return normalDetectedDetail; },
		get normalAck() { return normalAck; },
		get sizeText() { return sizeText; },
		get nameText() { return nameText; },
		get targets() { return targets; },
		get targetKind() { return targetKind; },
		get errorMessage() { return errorMessage; },
		get fileSession() { return fileSession; },
		blockingCount,
		isReady,
		selectedTargets,
		fileRows,
		start,
		chooseConflict,
		reopenConflict,
		setNormalConvention,
		reopenNormalChoice,
		setNormalAck,
		setSize,
		setName,
		setTargetKind,
		accept,
		cancel
	};
}

export type MaterialImportSession = ReturnType<typeof createMaterialImportSession>;
