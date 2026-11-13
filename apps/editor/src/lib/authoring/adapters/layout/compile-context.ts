/**
 * E4 / I2 — the Layout adapter's project-epoch compile seam.
 *
 * One context per Layout adapter: `createAdapter` runs exactly once per Stage
 * facade / acceptance-host pair, so the context lives for one opened project and
 * is released when the facade ends the adapter's registration. Bindings (rebuilt
 * on every accepted install) borrow it and never dispose it.
 *
 * It is the only module in the Layout adapter that reaches the compiler:
 *
 * - `plan` binds this project's incremental session for one synchronous planner
 *   step, seeded from the accepted baseline, so the precision planners' candidate
 *   compiles reuse every unchanged entity;
 * - `compiled` is the canonical session-less read (the record of a frozen
 *   document, or one compile) used by candidate presentation; a planner step's
 *   own last compile is handed over once for that exact document object.
 *
 * It is a cache, never decision state: a cold run of either is equal by the
 * session's construction proof. After `dispose`, `plan` runs its body with no
 * session bound and the store stays empty, so a late planner step of a closed
 * project cannot hold that project's units.
 */
import {
	compileWallFirstLayoutGeometry,
	createLayoutCompileSession,
	withLayoutCompileSession,
	type CompiledLayoutGeometryResult,
	type LayoutCompileSession,
	type LayoutDocumentWallFirst
} from '@portfolio/layout-core';
import type { DomainPlanner } from '@portfolio/project-model';
import type { ProjectEnvelope } from '@portfolio/project-model/units';

export type LayoutCompileContext = {
	/** Run one planner step with this project's session bound (seeded from `accepted`). */
	plan<T>(accepted: LayoutDocumentWallFirst, body: () => T): T;
	/** The canonical session-less read of `document`. */
	compiled(document: LayoutDocumentWallFirst): CompiledLayoutGeometryResult;
	/** Retained units, per entity class. */
	retained(): { walls: number; junctions: number; rooms: number; objects: number };
	/** Whether `dispose` has run. */
	disposed(): boolean;
	/** Release every retained unit; idempotent. */
	dispose(): void;
};

export function createLayoutCompileContext(): LayoutCompileContext {
	const session = createLayoutCompileSession();
	let live = true;
	/**
	 * The last document a planner step compiled in this session, and that
	 * compile, handed over once: a proposal planned and then presented in the
	 * same frame (Opening Repeat) reads the planner's own compile of that exact
	 * object instead of compiling it a second time.
	 */
	let handover: { document: LayoutDocumentWallFirst; result: CompiledLayoutGeometryResult } | null = null;
	const bound: LayoutCompileSession = {
		...session,
		compile(document, sampling) {
			const result = session.compile(document, sampling);
			handover = sampling === undefined ? { document, result } : null;
			return result;
		}
	};
	return {
		plan(accepted, body) {
			handover = null;
			if (!live) return body();
			return withLayoutCompileSession(bound, () => {
				session.seedFromCompiled(accepted);
				return body();
			});
		},
		compiled(document) {
			const taken = handover;
			handover = null;
			if (live && taken !== null && taken.document === document) {
				return { geometry: taken.result.geometry, issues: [...taken.result.issues] };
			}
			return compileWallFirstLayoutGeometry(document);
		},
		retained: () => session.retained(),
		disposed: () => !live,
		dispose() {
			live = false;
			handover = null;
			session.reset();
		}
	};
}

/** The same planner with each `prepare` run through `context.plan`. */
export function plannerInContext(
	context: LayoutCompileContext,
	planner: DomainPlanner<ProjectEnvelope>
): DomainPlanner<ProjectEnvelope> {
	return {
		...planner,
		prepare: (request) => context.plan(request.snapshot.domain.source.units.layout.data, () => planner.prepare(request))
	};
}

/** What lifetime proofs read about one Layout adapter: its context and live binding's memo. */
export type LayoutAdapterLifetime = {
	readonly context: LayoutCompileContext;
	/** Entries held by the live binding's candidate memo, or `null` with no live binding. */
	memoHeld: (() => number) | null;
};

const LIFETIME_BY_ADAPTER = new WeakMap<object, LayoutAdapterLifetime>();

/** Record a Layout adapter's lifetime handles (read by lifetime tests only). */
export function bindLayoutCompileContext(adapter: object, lifetime: LayoutAdapterLifetime): void {
	LIFETIME_BY_ADAPTER.set(adapter, lifetime);
}

/** A Layout adapter's compile context and live memo, for lifetime proofs. */
export function layoutAdapterLifetimeOf(adapter: object): LayoutAdapterLifetime | undefined {
	return LIFETIME_BY_ADAPTER.get(adapter);
}
