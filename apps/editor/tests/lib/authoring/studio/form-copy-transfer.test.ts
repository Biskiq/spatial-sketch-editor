import { afterEach, describe, expect, it } from 'vitest';
import {
	beginFormCopyTransfer,
	endFormCopyTransfer,
	peekFormCopyTransfer
} from '../../../../src/lib/authoring/adapters/scene/library/transfer';

const transfer = { sourceProjectId: 'src', objectId: 'form-1', objectName: 'Table', itemId: 'item' };

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
	it('holds identifiers only', () => {
		beginFormCopyTransfer(transfer);
		expect(Object.keys(peekFormCopyTransfer()!).sort()).toEqual(['itemId', 'objectId', 'objectName', 'sourceProjectId']);
	});
});
