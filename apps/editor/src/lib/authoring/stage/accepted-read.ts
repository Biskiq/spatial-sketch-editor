/** Common accepted Stage read boundary. No current-format source dependency. */
import type { CompiledLayoutGeometry, LayoutGeometryIssue } from '@portfolio/layout-core';
import type { AcceptedRevision, ReferenceReadContext, RuntimeScene, LayoutRoomRegistry, NavigationGraph } from '@portfolio/project-model';
import type { UnitDomain } from '@portfolio/project-model/units';

/** The domain read access a Stage snapshot publishes. Immutable by construction. */
export type StageDomainRead = {
	/** F.1 resolvers bound to this exact accepted identity, independent of encoding. */
	readonly references: ReferenceReadContext;
	readonly name: string;
	/** Canonical compiled Layout through the one shared geometry core. */
	readonly geometry: CompiledLayoutGeometry;
	/**
	 * The authored Layout level id: the canonical `layout-location` qualification
	 * every F.1 Layout reference is resolved against. It is a read of the admitted
	 * source, never a second authority — compiled `floors` may be empty (a source
	 * with objects and no enclosure) while the authored level still exists.
	 */
	readonly layoutLevelId: string;
	/** The evaluated level datum in project-world meters. */
	readonly datumMeters: number;
	/** The resolved runtime Scene. */
	readonly scene: RuntimeScene;
	/** The current-format (empty) Room registry. */
	readonly rooms: LayoutRoomRegistry;
	/** The visitor-equivalent navigation graph, built from the Camera unit. */
	readonly graph: NavigationGraph;
	/**
	 * Each unit's own content revision. An exact F.1 reference to a Layout, Scene,
	 * Camera or Experience subject names its owning unit's revision, not the
	 * envelope-wide digest: one unit changing must not invalidate another's
	 * references.
	 */
	readonly unitRevisions: Readonly<Record<UnitDomain, string>>;
	/** Non-blocking compiler warnings, retained for diagnostics disclosure. */
	readonly warnings: readonly LayoutGeometryIssue[];
};

/**
 * `StageReadSnapshot` — the source-independent validated read facade the Stage
 * mounts. Field names follow AM-4's `AcceptedSnapshot@1` (accepted revision,
 * source-content identity, admitted source kind/version, domain read access) so
 * the later host↔F4 wiring can swap in S03's export without renaming a consumer.
 */
export type StageReadSnapshot = {
	readonly acceptedRevision: AcceptedRevision;
	readonly sourceContentId: string;
	/**
	 * The canonical source bytes the content identity describes.
	 *
	 * One canonicalization produces both fields, so a host that starts an acceptance
	 * history from this snapshot records exactly the bytes the F4 adapter will
	 * re-admit on Undo: a history state whose canonical JSON came from a different
	 * serializer would be refused as "not the exact recorded source".
	 */
	readonly canonicalJson: string;
	/** Host session lifetime guard; separate from the acceptance revision. */
	readonly sessionEpoch: string;
	readonly sourceKind: string;
	readonly sourceVersion: number;
	/** Opaque compile/representation generation every fragment carries. */
	readonly compileGeneration: string;
	readonly domain: StageDomainRead;
};
