import { describe, expect, it } from 'vitest';

import { ACCEPTANCE_PLAN, DIAGNOSTIC_PLAN, basePlan, parseProfile } from '../../../perf/lib/profile';

describe('bench profiles', () => {
	it('keeps every ratified acceptance default', () => {
		expect(ACCEPTANCE_PLAN.acceptanceEvidence).toBe(true);
		expect(ACCEPTANCE_PLAN.runs).toBe(10);
		expect(ACCEPTANCE_PLAN.warmup).toBe(1);
		expect(ACCEPTANCE_PLAN.inputSamples).toBe(60);
		expect(ACCEPTANCE_PLAN.dragSamples).toBe(5);
		expect(ACCEPTANCE_PLAN.undoRedoCycles).toBe(20);
		expect(ACCEPTANCE_PLAN.f13Edits).toBe(20);
		expect(ACCEPTANCE_PLAN.f13Cycles).toEqual({ cold: 10, warm: 1, 'repeat-use': 10 });
		expect(ACCEPTANCE_PLAN.cacheStates.f2).toEqual(['cold', 'warm', 'repeat-use']);
		expect(ACCEPTANCE_PLAN.cacheStates.f7).toEqual(['cold', 'warm', 'repeat-use']);
		expect(ACCEPTANCE_PLAN.oldMethod).toBe(true);
		expect(ACCEPTANCE_PLAN.delayProof).toBe(true);
		expect(ACCEPTANCE_PLAN.stageTraceTiers).toBe('all');
	});

	it('marks the diagnostic plan non-acceptance while keeping the input floor', () => {
		expect(DIAGNOSTIC_PLAN.acceptanceEvidence).toBe(false);
		expect(DIAGNOSTIC_PLAN.inputSamples).toBe(60);
		expect(DIAGNOSTIC_PLAN.runs).toBe(3);
		expect(DIAGNOSTIC_PLAN.dragSamples).toBe(2);
		expect(DIAGNOSTIC_PLAN.undoRedoCycles).toBe(5);
		expect(DIAGNOSTIC_PLAN.f13Edits).toBe(10);
		expect(DIAGNOSTIC_PLAN.f13Cycles).toEqual({ cold: 1, warm: 2, 'repeat-use': 1 });
		expect(DIAGNOSTIC_PLAN.note).toContain('not acceptance evidence');
	});

	it('keeps every F3 hard cache state but reduces cold and repeat-use to checks', () => {
		expect(DIAGNOSTIC_PLAN.cacheStates.f3).toEqual(['cold', 'warm', 'repeat-use']);
		expect(DIAGNOSTIC_PLAN.runCounts.f3).toEqual({ cold: 1, warm: 3, 'repeat-use': 1 });
		expect(DIAGNOSTIC_PLAN.cacheStates.f2).toEqual(['cold', 'warm']);
		expect(DIAGNOSTIC_PLAN.cacheStates.f7).toEqual(['warm']);
		expect(DIAGNOSTIC_PLAN.runCounts.f7).toBe(1);
		expect(DIAGNOSTIC_PLAN.stageTraceTiers).toEqual(['grid-L']);
		expect(DIAGNOSTIC_PLAN.oldMethod).toBe(false);
		expect(DIAGNOSTIC_PLAN.delayProof).toBe(false);
	});

	it('parses only the named profiles and defaults to acceptance', () => {
		expect(parseProfile(undefined)).toBe('acceptance');
		expect(parseProfile('')).toBe('acceptance');
		expect(parseProfile('acceptance')).toBe('acceptance');
		expect(parseProfile('diagnostic')).toBe('diagnostic');
		expect(() => parseProfile('smoke')).toThrow('acceptance or diagnostic');
		expect(basePlan('acceptance')).toBe(ACCEPTANCE_PLAN);
		expect(basePlan('diagnostic')).toBe(DIAGNOSTIC_PLAN);
	});
});
