/**
 * The way back from a cross-project Place copy.
 *
 * *Place copy in World* leaves the object's project for a destination. Until the copy
 * is placed (or the creator returns), the destination remembers **which saved object
 * project and root it came from**, so cancelling, a destination that fails to load, or a
 * refresh always has a visible way back to the saved object. It carries identifiers
 * only: never source bytes, never a document value. It lives in the tab's session
 * storage (with an in-memory fallback), so closing the tab forgets it, and the saved
 * project and My Objects item are untouched either way. It is not a transaction: the
 * source Save, the library write and the destination insertion are three steps.
 */
export type FormCopyTransfer = {
	readonly sourceProjectId: string;
	readonly objectId: string;
	readonly objectName: string;
	/** The My Objects item that carries the copy to the destination. */
	readonly itemId: string;
	/**
	 * The exact Scene entity id the copy will occupy at the destination. Minted
	 * with the transfer and handed through the intake to `place-form-copy`, so the
	 * destination can tell this insertion from any other new entity.
	 */
	readonly entityId: string;
};

const KEY = 'biskiq.studio.transfer';
let memory: FormCopyTransfer | null = null;

function valid(value: unknown): value is FormCopyTransfer {
	if (typeof value !== 'object' || value === null) return false;
	const record = value as Record<string, unknown>;
	return ['sourceProjectId', 'objectId', 'objectName', 'itemId', 'entityId'].every(
		(field) => typeof record[field] === 'string' && record[field] !== '',
	);
}

export function beginFormCopyTransfer(transfer: FormCopyTransfer): void {
	memory = transfer;
	try {
		sessionStorage.setItem(KEY, JSON.stringify(transfer));
	} catch {
		/* memory keeps it */
	}
}

/** The pending transfer, or `null`. Reads never clear it. */
export function peekFormCopyTransfer(): FormCopyTransfer | null {
	try {
		const raw = sessionStorage.getItem(KEY);
		if (raw !== null) {
			const parsed: unknown = JSON.parse(raw);
			if (valid(parsed)) return parsed;
		}
	} catch {
		/* fall back to memory */
	}
	return memory;
}

/** The transfer finished (placed) or the creator returned: forget the way back. */
export function endFormCopyTransfer(): void {
	memory = null;
	try {
		sessionStorage.removeItem(KEY);
	} catch {
		/* nothing to clear */
	}
}

/**
 * Has the intended copy actually landed in the accepted source?
 *
 * The transfer mints the exact entity id the copy will occupy and hands it to
 * `place-form-copy`, so completion is tied to that one insertion: the accepted
 * source contains the transferred entity id. A changed entity count — or even a
 * same-named form — is not enough: an unrelated primitive, artwork or restored
 * entity must leave the way back intact so the creator can still reach **Return
 * to object**. Nothing here writes; it only decides whether this session-only
 * transfer can be forgotten.
 */
export function copyLanded(
	transfer: FormCopyTransfer,
	entities: readonly { readonly id: string }[],
): boolean {
	return entities.some((entity) => entity.id === transfer.entityId);
}
