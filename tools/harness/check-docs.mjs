import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
	anchorsOf, formatFindings, markdownFiles, missingWalkedDocuments, scanDocumentation
} from '../../apps/editor/tests/helpers/docs-references.ts';

const missing = missingWalkedDocuments(markdownFiles());
assert.equal(missing.length, 0, `Missing documentation: ${missing.join(', ')}`);
const findings = scanDocumentation();
assert.equal(findings.length, 0, formatFindings(findings));
const anchors = anchorsOf(readFileSync('docs/reference/north-star.md', 'utf8'));
const ledger = JSON.parse(readFileSync('capabilities.json', 'utf8'));
for (const entry of ledger.capabilities) {
	assert(anchors.has(entry.northStar.replace(/^north-star\.md#/, '')), `Missing North Star heading for ${entry.id}`);
}
