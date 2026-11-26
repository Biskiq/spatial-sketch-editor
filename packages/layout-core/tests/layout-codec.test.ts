import { describe, expect, it } from 'vitest';
import {
	createEmptyWallFirstLayoutDocument,
	LAYOUT_WALL_FIRST_FORMAT_VERSION,
	serializeWallFirstLayoutDocument,
	validateWallFirstLayoutDocument,
} from '@portfolio/layout-core/wall';

describe('Layout format versions', () => {
	it('refuses noncurrent versions at the reader and writer boundaries', () => {
		const current = createEmptyWallFirstLayoutDocument();
		expect(validateWallFirstLayoutDocument(current).success).toBe(true);

		for (const offset of [-1, 1]) {
			const input = { ...current, formatVersion: LAYOUT_WALL_FIRST_FORMAT_VERSION + offset };
			expect(validateWallFirstLayoutDocument(input)).toMatchObject({
				success: false,
				issues: [{ path: '$.formatVersion', code: 'unsupported_format_version' }],
			});
			expect(() => serializeWallFirstLayoutDocument(input)).toThrow(
				/Canonical Layout Save requires formatVersion/,
			);
		}
	});
});
