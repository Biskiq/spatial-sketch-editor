/**
 * CPU calibration entry (T3.P03.S02).
 *
 * The performance contract's reproduction step 2: run a fixed calibration page
 * — the packet's grid-7 compile plus the Stage's admission — bundled as a
 * production build, 20× in Chrome. The median is the machine's calibration
 * value; another developer machine finds the CDP throttling rate whose median
 * lands within ±10 % of the designated reference machine's median.
 *
 * The workload is the packet's own grid-7 fixture (100 Walls) through
 * `compileWallFirstLayoutGeometry` and `admitSource` — the canonical compile and
 * admission every project open uses, not a synthetic loop.
 */

import { compileWallFirstLayoutGeometry } from '@portfolio/layout-core';
import { createEmptyUnitEnvelope } from '@portfolio/project-model/units';

import { admitSource } from '../../src/lib/authoring/stage/source-admission';
import { addOpenings, buildGrid } from '../lib/fixtures';

type CalibrationResult = {
	readonly compileMs: number[];
	readonly admissionMs: number[];
	readonly totalMs: number[];
	readonly walls: number;
	readonly rooms: number;
};

declare global {
	interface Window {
		__biskiqCalibration?: (runs?: number) => Promise<CalibrationResult>;
	}
}

async function prepare(): Promise<{
	document: ReturnType<typeof buildGrid>;
	envelope: Awaited<ReturnType<typeof createEmptyUnitEnvelope>>;
}> {
	const document = addOpenings(buildGrid(7));
	const envelope = await createEmptyUnitEnvelope({
		id: 'perf-calibration',
		name: 'Calibration grid-7',
		acceptedRevision: { projectId: 'perf-calibration', revisionId: 'revision-calibration-1' },
		layout: document
	});
	return { document, envelope };
}

window.__biskiqCalibration = async (runs = 20): Promise<CalibrationResult> => {
	const { document, envelope } = await prepare();
	// One unmeasured preparation so module evaluation and the first JIT tier are
	// not the calibration value; the contract's 20 measured samples follow.
	compileWallFirstLayoutGeometry(document);
	await admitSource(envelope, {
		sessionEpoch: 'calibration',
		acceptedRevision: { projectId: 'perf-calibration', revisionId: 'revision-calibration-1' }
	});
	const compileMs: number[] = [];
	const admissionMs: number[] = [];
	const totalMs: number[] = [];
	for (let run = 0; run < runs; run++) {
		const compileStart = performance.now();
		compileWallFirstLayoutGeometry(document);
		const compileEnd = performance.now();
		const admissionStart = compileEnd;
		await admitSource(envelope, {
			sessionEpoch: 'calibration',
			acceptedRevision: { projectId: 'perf-calibration', revisionId: 'revision-calibration-1' }
		});
		const admissionEnd = performance.now();
		compileMs.push(compileEnd - compileStart);
		admissionMs.push(admissionEnd - admissionStart);
		totalMs.push(admissionEnd - compileStart);
	}
	return {
		compileMs,
		admissionMs,
		totalMs,
		walls: document.walls.length,
		rooms: document.rooms.length
	};
};
