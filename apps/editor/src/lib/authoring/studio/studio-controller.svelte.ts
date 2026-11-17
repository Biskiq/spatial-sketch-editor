/**
 * Object Studio's one session value.
 *
 * Studio is a posture over the Stage that already exists: it holds *which root is
 * scoped, what surrounds it, where the creator came from and how to get back* —
 * and nothing else. Selection, Camera, history, Save and the document all stay with
 * their owners; this controller reaches them only through the narrow ports the route
 * hands it, and everything it keeps is session state that is never serialized.
 *
 * Every public method is idempotent against a stale call (a root that vanished, a
 * lens that changed) and refuses in words rather than guessing.
 */
import {
	newRootSince,
	pickScopeOf,
	resolveStudioOpening,
	reviewReturnView,
	studioRoots,
	type StudioContext,
	type StudioEntityRead,
	type StudioOrigin,
	type StudioOpening,
	type StudioPhase,
	type StudioPickScope,
	type StudioRoot,
	type StudioViewRecord
} from './studio-model';

export type StudioBounds = {
	readonly min: readonly [number, number, number];
	readonly max: readonly [number, number, number];
};

/** What the route lends Studio. Each is the existing owner's own capability. */
export type StudioPorts = {
	/** The accepted Scene entities, read live. */
	entities(): readonly StudioEntityRead[];
	/** The primary selected Scene entity id, or `null`. */
	selectedEntityId(): string | null;
	/** Select one whole Scene entity through the canonical selection; `null` clears. */
	select(entityId: string | null): boolean;
	/** Set (or clear) the session pick scope on the facade. */
	setScope(scope: StudioPickScope | null): void;
	/** The Camera's current viewing intent, or `null` before the first evaluation. */
	captureView(): StudioViewRecord | null;
	/** Realize a revalidated view as a viewing intent through the one Camera. */
	restoreView(record: StudioViewRecord): boolean;
	/** The drawn bounds of one entity, or `null` while its body has not mounted. */
	rootBounds(entityId: string): StudioBounds | null;
	/** Frame these bounds through a `fit` intent. */
	fit(bounds: StudioBounds): boolean;
	/** The current content bounds, for return-view revalidation. */
	contentBounds(): StudioBounds | null;
	/** Frame everything (the fallback when a saved view cannot be trusted). */
	fitAll(): void;
	/** Arm the Objects instrument so the creator can add a form. */
	armCreation(): void;
	/** Close the open Scene creation task, if any (no source is written). */
	closeCreation(): void;
	/** Settle or discard uncommitted input before leaving; `false` blocks the exit. */
	settlePending(): boolean;
	notice(message: string): void;
	/**
	 * Place copy in World: Save the project if needed, save the root to My Objects, and
	 * open the destination chooser. Reports its own failures through `notice` and
	 * resolves `true` only when it navigated.
	 */
	placeCopy?(rootId: string): Promise<boolean>;
	/** Mirror the posture into the address (replaceState); `null` removes it. */
	syncUrl(state: { readonly objectId: string | null } | null): void;
	/** Navigate away through the route's existing unsaved guard. */
	navigate(href: string): void;
	/** Put keyboard focus back on the control that opened Studio, or the root Card. */
	focusReturn(initiator: string | null): void;
	/** The Index disclosure, which Studio records and restores like the Camera. */
	indexOpen?(): boolean;
	setIndexOpen?(open: boolean): void;
};

type ReturnRecord = {
	readonly view: StudioViewRecord | null;
	readonly selectedId: string | null;
	readonly indexOpen: boolean | null;
	readonly initiator: string | null;
};

type CreationRecord = {
	/** The root that was scoped when "New object here" began, for cancel recovery. */
	readonly previousRootId: string | null;
	readonly baseline: ReadonlySet<string>;
};

export function createStudioController(ports: StudioPorts) {
	let phase = $state<StudioPhase>({ kind: 'inactive' });
	let origin = $state<StudioOrigin>('standalone');
	let context = $state<StudioContext>('mat');
	let creating = $state(false);
	/** A Place-copy journey is saving; the strip shows it and refuses a second start. */
	let placingCopy = $state(false);
	/** A frame that waited for the root's body to mount; retried on render changes. */
	let framePending: string | null = null;
	let creation: CreationRecord | null = null;
	let returning: ReturnRecord | null = null;
	/** The root id this session last scoped, so Undo can requalify it. */
	let lastRoot: string | null = null;
	/** The form ids seen at the last read, so a form Studio did not scope is noticed. */
	let known = new Set<string>();
	/** The eligible roots as last read: reactive, so the strip and panels follow the source. */
	let rootList = $state<readonly StudioRoot[]>([]);
	function syncKnown(): void {
		rootList = studioRoots(ports.entities());
		known = new Set(rootList.map((root) => root.id));
	}

	function applyScope(next: StudioPhase): void {
		phase = next;
		ports.setScope(pickScopeOf(next));
	}
	function rootName(id: string): string {
		return rootList.find((root) => root.id === id)?.name ?? 'Object';
	}
	function frameRoot(id: string): void {
		const bounds = ports.rootBounds(id);
		if (bounds === null) {
			framePending = id;
			return;
		}
		// A refused frame (no viewport rect yet) stays pending and is retried.
		framePending = ports.fit(bounds) ? null : id;
	}
	function enter(rootId: string): void {
		syncKnown();
		lastRoot = rootId;
		creating = false;
		creation = null;
		applyScope({ kind: 'active', rootId });
		ports.select(rootId);
		ports.syncUrl({ objectId: rootId });
		frameRoot(rootId);
	}
	function applyOpening(opening: StudioOpening): void {
		switch (opening.kind) {
			case 'enter':
				enter(opening.rootId);
				return;
			case 'empty':
				applyScope({ kind: 'empty' });
				ports.select(null);
				ports.syncUrl({ objectId: null });
				ports.armCreation();
				return;
			case 'choose':
				applyScope({ kind: 'choose', roots: opening.roots });
				ports.select(null);
				ports.syncUrl({ objectId: null });
				return;
			case 'no-objects':
				applyScope({ kind: 'no-objects' });
				ports.select(null);
				ports.syncUrl({ objectId: null });
				return;
			case 'unavailable':
				applyScope({ kind: 'unavailable', requestedId: opening.requestedId, reason: opening.reason, lost: false });
				ports.select(null);
				ports.syncUrl({ objectId: null });
		}
	}

	function endPosture(): void {
		if (phase.kind === 'inactive') return;
		creating = false;
		creation = null;
		framePending = null;
		returning = null;
		lastRoot = null;
		applyScope({ kind: 'inactive' });
		ports.syncUrl(null);
	}

	return {
		get phase(): StudioPhase { return phase; },
		get active(): boolean { return phase.kind !== 'inactive'; },
		get origin(): StudioOrigin { return origin; },
		get context(): StudioContext { return context; },
		get creating(): boolean { return creating; },
		get placingCopy(): boolean { return placingCopy; },
		get rootId(): string | null { return phase.kind === 'active' ? phase.rootId : null; },
		get rootName(): string | null { return phase.kind === 'active' ? rootName(phase.rootId) : null; },
		get roots(): readonly StudioRoot[] { return rootList; },

		/** Open the posture from the address, once the project is loaded. */
		openFromEntry(input: { readonly objectId: string | null; readonly minted: boolean }): void {
			origin = 'standalone';
			context = 'mat';
			returning = null;
			syncKnown();
			applyOpening(resolveStudioOpening({ entities: ports.entities(), requestedId: input.objectId, minted: input.minted }));
		},

		/** World entry: record the way back, then scope the selected form. */
		enterFromWorld(rootId: string, initiator: string | null): boolean {
			if (!studioRoots(ports.entities()).some((root) => root.id === rootId)) {
				ports.notice('Only a native form can be edited in Object Studio.');
				return false;
			}
			if (phase.kind !== 'inactive') return false;
			// Finish or cancel a pending stroke or manipulation first: entry changes scope,
			// not source, and must not carry a gesture into the new posture.
			if (!ports.settlePending()) return false;
			origin = 'world';
			context = 'world';
			returning = {
				view: ports.captureView(),
				selectedId: ports.selectedEntityId() ?? rootId,
				indexOpen: ports.indexOpen?.() ?? null,
				initiator
			};
			enter(rootId);
			return true;
		},

		setContext(next: StudioContext): void {
			if (phase.kind === 'inactive' || context === next) return;
			context = next;
			if (phase.kind === 'active') frameRoot(phase.rootId);
		},

		/** Choose object: list the roots, with nothing scoped until one is picked. */
		openChooser(): void {
			if (phase.kind === 'inactive') return;
			const roots = studioRoots(ports.entities());
			if (roots.length === 0) return;
			if (!ports.settlePending()) return;
			creating = false;
			creation = null;
			framePending = null;
			applyScope({ kind: 'choose', roots });
			ports.select(null);
			ports.syncUrl({ objectId: null });
		},

		/** Make another listed root the scoped one (Choose object). */
		chooseRoot(rootId: string): boolean {
			if (phase.kind === 'inactive') return false;
			if (!studioRoots(ports.entities()).some((root) => root.id === rootId)) {
				ports.notice('That object is no longer available.');
				return false;
			}
			if (!ports.settlePending()) return false;
			enter(rootId);
			return true;
		},

		/**
		 * New object here: a fresh mat in the same project. The previous root is kept
		 * so cancelling the gesture recovers it instead of stranding the creator.
		 */
		newObjectHere(): void {
			if (phase.kind === 'inactive') return;
			if (!ports.settlePending()) return;
			creation = {
				previousRootId: phase.kind === 'active' ? phase.rootId : lastRoot,
				baseline: new Set(ports.entities().map((entity) => entity.id))
			};
			creating = true;
			context = 'mat';
			framePending = null;
			applyScope({ kind: 'empty' });
			ports.select(null);
			ports.syncUrl({ objectId: null });
			ports.armCreation();
		},

		/** A creation gesture ended with no new form: recover what was scoped before. */
		cancelCreation(): void {
			if (!creating || phase.kind !== 'empty') return;
			const record = creation;
			// A form accepted just before the task closed is the new root, not a cancel.
			const created = record === null ? null : newRootSince(ports.entities(), record.baseline);
			if (created !== null) {
				enter(created.id);
				return;
			}
			creating = false;
			creation = null;
			ports.closeCreation();
			const roots = studioRoots(ports.entities());
			const previous = record?.previousRootId ?? null;
			if (previous !== null && roots.some((root) => root.id === previous)) {
				enter(previous);
				return;
			}
			if (roots.length === 1) enter(roots[0]!.id);
			else if (roots.length > 1) applyOpening({ kind: 'choose', roots });
			else applyOpening({ kind: 'no-objects' });
		},

		/**
		 * Re-read the accepted source after a commit, Undo or Redo. Studio never
		 * edits: it only keeps its scope true to what the source now says.
		 */
		reconcile(): void {
			if (phase.kind === 'inactive') return;
			const entities = ports.entities();
			const roots = studioRoots(entities);
			rootList = roots;
			const fresh = roots.filter((root) => !known.has(root.id));
			if (phase.kind === 'active') {
				const scoped = phase.rootId;
				if (roots.some((root) => root.id === scoped)) {
					// A form placed or duplicated from Studio's own Objects/Card becomes the
					// scoped root, so it is drawn and editable instead of silently hidden.
					const added = fresh[fresh.length - 1];
					if (added !== undefined) {
						ports.closeCreation();
						enter(added.id);
					} else known = new Set(roots.map((root) => root.id));
					return;
				}
				// The scoped root is gone (deleted, or Undo removed its creation).
				const lost = phase.rootId;
				ports.closeCreation();
				ports.select(null);
				applyScope({ kind: 'unavailable', requestedId: lost, reason: 'missing', lost: true });
				ports.syncUrl({ objectId: null });
				return;
			}
			if (phase.kind === 'empty' && creation !== null) {
				const created = newRootSince(entities, creation.baseline);
				if (created !== null) {
					ports.closeCreation();
					enter(created.id);
				}
				return;
			}
			if (phase.kind === 'empty') {
				// A freshly minted mat that gained its first form (or Redo restored one).
				const created = roots[roots.length - 1];
				if (created !== undefined) {
					ports.closeCreation();
					enter(created.id);
				}
				return;
			}
			if (phase.kind === 'unavailable') {
				// Undo can restore the very root that was lost: it requalifies in place.
				const wanted = phase.requestedId;
				if (roots.some((root) => root.id === wanted)) enter(wanted);
				return;
			}
			if (phase.kind === 'choose') {
				if (roots.length === 0) applyScope({ kind: 'no-objects' });
				else applyScope({ kind: 'choose', roots });
				return;
			}
			if (phase.kind === 'no-objects' && roots.length > 0) {
				applyOpening(roots.length === 1 ? { kind: 'enter', rootId: roots[0]!.id } : { kind: 'choose', roots });
			}
		},

		/** Retry a frame that was waiting for the body to mount. */
		retryFrame(): void {
			if (framePending !== null && phase.kind === 'active' && phase.rootId === framePending) frameRoot(framePending);
		},

		/** World origin: restore the Camera view and the original selection, then leave. */
		backToWorld(): boolean {
			if (phase.kind === 'inactive' || origin !== 'world') return false;
			if (!ports.settlePending()) return false;
			const record = returning;
			creating = false;
			creation = null;
			framePending = null;
			ports.closeCreation();
			applyScope({ kind: 'inactive' });
			returning = null;
			ports.syncUrl(null);
			if (record === null) {
				ports.fitAll();
				return true;
			}
			const check = reviewReturnView(record.view, ports.contentBounds());
			if (check.valid && record.view !== null && ports.restoreView(record.view)) {
				// Realized as one viewing intent through the Camera; nothing was written.
			} else {
				ports.fitAll();
				ports.notice(`${check.valid ? 'The saved view could not be restored' : check.reason} Showing everything instead.`);
			}
			const stillThere = record.selectedId !== null && ports.entities().some((entity) => entity.id === record.selectedId);
			ports.select(stillThere ? record.selectedId : null);
			if (record.indexOpen !== null) ports.setIndexOpen?.(record.indexOpen);
			ports.focusReturn(record.initiator);
			return true;
		},

		/** Standalone origin: the creator's way out is the project list. */
		backToProjects(): void {
			if (phase.kind === 'inactive') return;
			if (!ports.settlePending()) return;
			ports.navigate('/projects');
		},

		/**
		 * Standalone origin: send a copy of the scoped object to another project's World.
		 * Pending input settles first; a second press while saving does nothing.
		 */
		async placeCopyInWorld(): Promise<boolean> {
			if (phase.kind !== 'active' || placingCopy || ports.placeCopy === undefined) return false;
			if (!ports.settlePending()) return false;
			placingCopy = true;
			try {
				return await ports.placeCopy(phase.rootId);
			} finally {
				placingCopy = false;
			}
		},

		/** Standalone origin: continue in the ordinary World with the same project. */
		openInWorld(): boolean {
			if (phase.kind === 'inactive') return false;
			if (!ports.settlePending()) return false;
			const root = phase.kind === 'active' ? phase.rootId : null;
			creating = false;
			creation = null;
			framePending = null;
			ports.closeCreation();
			applyScope({ kind: 'inactive' });
			returning = null;
			ports.syncUrl(null);
			ports.select(root);
			ports.fitAll();
			return true;
		},

		/**
		 * Choosing the Experience lens: resolve the pending task first, then end the
		 * posture. `false` means a gesture is still running and the lens must not change.
		 */
		leaveForLens(): boolean {
			if (phase.kind === 'inactive') return true;
			if (!ports.settlePending()) return false;
			endPosture();
			return true;
		},

		/** A replaced project or a refused load ends the posture. */
		end: endPosture
	};
}

export type StudioController = ReturnType<typeof createStudioController>;
