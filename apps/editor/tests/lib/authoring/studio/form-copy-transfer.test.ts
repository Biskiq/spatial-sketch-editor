import { afterEach, describe, expect, it } from 'vitest';
import {
	beginFormCopyTransfer,
	copyLanded,
	endFormCopyTransfer,
	peekFormCopyTransfer
} from '../../../../src/lib/authoring/adapters/scene/library/transfer';

const transfer = {
	sourceProjectId: 'src', objectId: 'form-1', objectName: 'Shape',
	itemId: 'item', entityId: 'entity-transfer-copy'
};

describe('form copy transfer record', () => {
	afterEach(() => endFormCopyTransfer());
	it('remembers the way back without clearing on read, and forgets on end', () => {
		expect(peekFormCopyTransfer()).toBeNull();
		beginFormCopyTransfer(transfer);
		expect(peekFormCopyTransfer()).toEqual(transfer);
		expect(peekFormCopyTransfer()).toEqual(transfer);
		endFormCopyTransfer();
		expect(peekFormCopyTransfer()).toBeNull();
	});
	it('holds identifiers only, including the exact insertion id', () => {
		beginFormCopyTransfer(transfer);
		expect(Object.keys(peekFormCopyTransfer()!).sort()).toEqual([
			'entityId', 'itemId', 'objectId', 'objectName', 'sourceProjectId'
		]);
	});
});

describe('transfer copy settlement', () => {
	const entity = (id: string) => ({ id });

	it('completes only when the transferred entity id is in the accepted source', () => {
		expect(copyLanded(transfer, [entity('other'), entity(transfer.entityId)])).toBe(true);
	});

	it('does not complete with no new entity', () => {
		expect(copyLanded(transfer, [entity('other')])).toBe(false);
	});

	it('preserves the way back when an unrelated entity is created', () => {
		// A new form — even one with the same default name as the copy — is not
		// the transferred insertion and must not clear the way back.
		expect(copyLanded(transfer, [entity('entity-new-shape')])).toBe(false);
		expect(copyLanded(transfer, [entity('entity-model'), entity('entity-artwork')])).toBe(false);
	});

	it('rejects a stale transfer record without an insertion id', () => {
		expect(copyLanded({ ...transfer, entityId: '' }, [entity(transfer.entityId)])).toBe(false);
	});
});
