/**
 * The editor host's **explicit boot states**.
 *
 * Every state a creator can land in is named, distinct and tested — no state is
 * folded into another, and none is inferred from a payload's shape:
 *
 * - `loading` — a cloud read is in flight.
 * - `new` — a freshly minted identity awaiting the starter/empty choice. The
 *   spatial route now admits an empty baseline immediately and keeps the starter
 *   available as an explicit replacement.
 * - `empty` — a genuinely empty baseline is active (honest: no floor, no starter).
 * - `ready` — an admitted source is mounted on the Stage.
 * - `diagnostics` — the source validates but its canonical compile has blocking
 *   issues; the state names them and never renders a silent empty Stage.
 * - `refused` — the payload is not a supported current-format source, or it names
 *   another project than the one this host is showing.
 * - `missing` — a project identity reached through an explicit open that the
 *   server does not have. Never silently treated as new.
 * - `forbidden` — the identity exists but this session may not read it.
 * - `error` — network or server failure, distinct from `missing`/`forbidden`.
 *
 * The one rule that decides `new` vs `missing` is **how the identity was
 * reached**, not what the server returned: `create` is a minted identity the
 * creator is starting, `open` is a real address someone asked to load. Both get a
 * 404 for an absent row; only `create` may become `new`.
 *
 * Pure: the reducer takes the load outcome and returns the next state; it performs
 * no IO of its own, and every source it admits goes through the one admission
 * path.
 */
import type { LayoutGeometryIssue } from '@portfolio/layout-core';
import type { ProjectIssue } from '@portfolio/project-model';
import { createEmptyUnitEnvelope } from '@portfolio/project-model/units';

import {
	admitSource,
	admitSourceJson,
	type AdmissionContext,
	type AdmissionOutcome,
	type StageReadSnapshot
} from './source-admission';
import { DEFAULT_STARTER_TEMPLATE, starterTemplate } from './starter-gallery';

export type BootIntent = 'create' | 'open';

export type BootState =
	| { readonly status: 'loading'; readonly projectId: string; readonly intent: BootIntent }
	| { readonly status: 'new'; readonly projectId: string; readonly intent: BootIntent }
	| { readonly status: 'empty'; readonly projectId: string; readonly snapshot: StageReadSnapshot }
	| { readonly status: 'ready'; readonly projectId: string; readonly snapshot: StageReadSnapshot }
	| {
			readonly status: 'diagnostics';
			readonly projectId: string;
			readonly issues: readonly LayoutGeometryIssue[];
	  }
	| {
			readonly status: 'refused';
			readonly projectId: string;
			readonly reason: 'invalid-json' | 'invalid-format' | 'dimension-limit' | 'project-mismatch';
			readonly issues: readonly ProjectIssue[];
	  }
	| { readonly status: 'missing'; readonly projectId: string }
	| { readonly status: 'forbidden'; readonly projectId: string }
	| { readonly status: 'error'; readonly projectId: string; readonly message: string };

/** The outcome of one cloud project read, deliberately separate from its cause. */
export type BootLoadOutcome =
	| { readonly kind: 'loaded'; readonly document: unknown }
	| { readonly kind: 'not-found' }
	| { readonly kind: 'forbidden' }
	| { readonly kind: 'network' }
	| { readonly kind: 'server'; readonly message: string };

/**
 * How an identity was reached.
 *
 * `create=1` marks an identity the editor just minted (the `/editor`, `/` and
 * "New Project" entries); absence of it is an explicit open. An identity reached
 * any other way is therefore never silently new.
 */
export function bootIntentFromSearch(search: URLSearchParams): BootIntent {
	return search.get('create') === '1' ? 'create' : 'open';
}

/** The state before the first read resolves. */
export function initialBootState(projectId: string, intent: BootIntent): BootState {
	return { status: 'loading', projectId, intent };
}

/**
 * The F.2 envelope inside a loaded cloud payload, or the payload itself.
 *
 * The persistence reader already exposes `document`; a raw source JSON open has
 * no wrapper. Both are handed to the same admission. A pre-epoch payload is not
 * unwrapped or sniffed: it is refused by the envelope validator.
 */
export function documentOf(document: unknown): unknown {
	return document;
}

/** Map one admission outcome onto a boot state. `active` is used for a clean admit. */
function stateFromAdmission(
	projectId: string,
	outcome: AdmissionOutcome,
	active: 'ready' | 'empty'
): BootState {
	switch (outcome.kind) {
		case 'admitted':
			return active === 'empty'
				? { status: 'empty', projectId, snapshot: outcome.snapshot }
				: { status: 'ready', projectId, snapshot: outcome.snapshot };
		case 'refused':
			return { status: 'refused', projectId, reason: outcome.reason, issues: outcome.issues };
		case 'diagnostics':
			return { status: 'diagnostics', projectId, issues: outcome.issues };
	}
}

/**
 * Reduce one load outcome into the next boot state.
 *
 * The admission is performed once, through the one admission path, so a source
 * that renders has already passed canonical validation, compile and Scene
 * resolution.
 */
export async function bootFromLoadOutcome(
	state: BootState,
	outcome: BootLoadOutcome,
	context: AdmissionContext
): Promise<BootState> {
	const projectId = state.projectId;
	switch (outcome.kind) {
		case 'not-found':
			// A minted identity may start empty; an explicitly opened absence remains
			// `missing`. The route handles minted starts before issuing any cloud read,
			// and this reducer keeps the same result if a caller already has a 404.
			return state.status === 'loading' && state.intent === 'create'
				? await bootEmpty(projectId, context)
				: { status: 'missing', projectId };
		case 'forbidden':
			return { status: 'forbidden', projectId };
		case 'network':
			return { status: 'error', projectId, message: 'Cloud service is unavailable' };
		case 'server':
			return { status: 'error', projectId, message: outcome.message };
		case 'loaded':
			return stateFromAdmission(projectId, await admitSource(documentOf(outcome.document), context), 'ready');
	}
}

/**
 * Admit an explicit source-JSON open through the same admission path.
 *
 * Used by the "open source JSON" entry: JSON that does not parse is a `refused`
 * state, never a silent empty Stage.
 */
export async function bootFromSourceJson(
	json: string,
	projectId: string,
	context: AdmissionContext
): Promise<BootState> {
	return stateFromAdmission(projectId, await admitSourceJson(json, context), 'ready');
}

/**
 * Boot the canonical starter gallery template as a **new baseline**.
 *
 * The template builds through the retained Wall-chain planner, then passes the
 * same admission path as any other source: a template that stopped compiling
 * would surface as `diagnostics`, not as a silently empty Stage.
 */
export async function bootStarterGallery(
	projectId: string,
	context: AdmissionContext,
	templateId: string = DEFAULT_STARTER_TEMPLATE.id
): Promise<BootState> {
	const template = starterTemplate(templateId);
	if (template === null) {
		return { status: 'error', projectId, message: `Unknown starter template "${templateId}"` };
	}
	const envelope = await template.build(projectId, template.label, context.acceptedRevision);
	return stateFromAdmission(projectId, await admitSource(envelope, context), 'ready');
}

/**
 * Boot a genuinely empty current-format baseline: the level record exists, and no
 * enclosure (Wall, Room or floor polygon) is derived from it.
 */
export async function bootEmpty(projectId: string, context: AdmissionContext): Promise<BootState> {
	const envelope = await createEmptyUnitEnvelope({
		id: projectId,
		name: 'Untitled project',
		acceptedRevision: context.acceptedRevision
	});
	return stateFromAdmission(projectId, await admitSource(envelope, context), 'empty');
}

/** `true` when the state has an admitted source mounted on the Stage. */
export function stages(status: BootState['status']): boolean {
	return status === 'ready' || status === 'empty';
}
