import assert from 'node:assert/strict';
import {
	formatFindings,
	markdownFiles,
	missingWalkedDocuments,
	scanDocumentation,
} from '../../apps/editor/tooling-tests/docs/docs-references.ts';

const missing = missingWalkedDocuments(markdownFiles());
assert.equal(missing.length, 0, `Missing documentation: ${missing.join(', ')}`);
const findings = scanDocumentation();
assert.equal(findings.length, 0, formatFindings(findings));
