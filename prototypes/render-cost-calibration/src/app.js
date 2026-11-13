import { allConfigs } from './configs.js';
import { BACKEND_LABELS, probeWebGPU, runBackend, runLightingSweep } from './bench.js';
import { CANVAS_HEIGHT, CANVAS_WIDTH, DPR } from './scene.js';

let canvas = document.querySelector('#view');
const backendSelect = document.querySelector('#backend');
const runButton = document.querySelector('#run');
const runAllButton = document.querySelector('#run-all');
const downloadButton = document.querySelector('#download');
const status = document.querySelector('#status');
const availability = document.querySelector('#availability');
const progress = document.querySelector('#progress');
const resultsBody = document.querySelector('#results tbody');
const fitsPanel = document.querySelector('#fits');
const budgetsPanel = document.querySelector('#budgets');
const canvasNote = document.querySelector('#canvas-note');

const state = {
	results: {},
	running: false,
	shown: null,
	webgpu: null
};

canvasNote.textContent = `Drawing buffer ${CANVAS_WIDTH}×${CANVAS_HEIGHT}, DPR ${DPR}. The canvas is CSS-scaled; measurements use the drawing buffer.`;

/**
 * A canvas cannot carry both a WebGPU and a WebGL2 context. Give each backend
 * run a fresh one so B and C never contend for the previous run's context.
 */
function freshCanvas() {
	const next = document.createElement('canvas');
	next.id = 'view';
	next.width = CANVAS_WIDTH;
	next.height = CANVAS_HEIGHT;
	canvas.replaceWith(next);
	canvas = next;
	return next;
}

function setStatus(text) {
	status.textContent = text;
}

function format(value, digits = 2) {
	if (value === null || value === undefined || Number.isNaN(value)) return '—';
	return Number(value).toFixed(digits);
}

function fitText(fit, unit) {
	if (!fit) return 'no fit';
	const quality = fit.usable ? '' : ' · R²<0.8, raw curve';
	return `${format(fit.b, 4)} ${unit} · R² ${format(fit.r2, 3)}${quality}`;
}

function card(title, definitionList) {
	const cardElement = document.createElement('div');
	cardElement.className = 'card';
	const heading = document.createElement('h3');
	heading.textContent = title;
	cardElement.append(heading);
	const dl = document.createElement('dl');
	for (const [term, value] of definitionList) {
		const dt = document.createElement('dt');
		dt.textContent = term;
		const dd = document.createElement('dd');
		dd.textContent = value;
		if (typeof value === 'string' && value.includes('R²<0.8')) dd.className = 'warn';
		dl.append(dt, dd);
	}
	cardElement.append(dl);
	return cardElement;
}

function renderFits(result) {
	fitsPanel.replaceChildren();
	if (!result) {
		fitsPanel.innerHTML = '<p class="note">No run yet.</p>';
		return;
	}
	if (!result.summary) {
		fitsPanel.innerHTML = `<p class="note bad">${result.label}: unavailable — ${result.reason}</p>`;
		return;
	}
	const c = result.summary.constants;
	const cards = [
		card('Draw submission', [
			['c_draw', `${format(c.cDrawMs, 4)} ms/draw`],
			['R²', format(c.cDrawR2, 3)]
		]),
		card('Triangles', [
			['c_tri', `${format(c.cTriangleMs, 6)} ms/triangle`],
			['R²', format(c.cTriangleR2, 3)]
		]),
		card('Unshadowed point light · N=1000', [
			['per light', `${format(c.cPointLightMs1000, 4)} ms`],
			['R²', format(c.cPointLightR2_1000, 3)]
		]),
		card('Unshadowed point light · N=5000', [
			['per light', `${format(c.cPointLightMs5000, 4)} ms`],
			['R²', format(c.cPointLightR2_5000, 3)]
		]),
		card('Unshadowed point light · fill view', [
			['per light', `${format(c.cPointLightMsFill, 4)} ms`],
			['R²', format(c.cPointLightR2_fill, 3)]
		]),
		card('Unshadowed spot light', [
			['N=1000', `${format(c.cSpotLightMs1000, 4)} ms`],
			['N=5000', `${format(c.cSpotLightMs5000, 4)} ms`]
		]),
		card('Shadow pass', [
			['N=1000', `${format(c.cShadowPassMs1000, 4)} ms/pass`],
			['N=5000', `${format(c.cShadowPassMs5000, 4)} ms/pass`],
			['cached saving (N=1000)', `${format(c.cachedShadowSavingMsPerPass1000, 4)} ms/pass`]
		]),
		card('Submission ratios', [
			['instancing N=1000', `${format(c.instancingRatio1000, 2)}×`],
			['instancing N=5000', `${format(c.instancingRatio5000, 2)}×`],
			['batching N=1000', `${format(c.batchingRatio1000, 2)}×`],
			['batching N=5000', `${format(c.batchingRatio5000, 2)}×`]
		]),
		card('Light-variant compile', [
			['4 → 5 lights first frame', `${format(c.lightVariantCompileMs, 2)} ms`],
			['program delta', format(result.summary.compile?.programDelta, 0)]
		])
	];
	fitsPanel.append(...cards);
	canvasNote.textContent = `${result.label} · ${result.detail.backend} · ${result.timer ?? 'no GPU timer'} · ${result.rows.length} configurations.`;
}

function budgetCell(entry) {
	if (!entry || entry.value === null || entry.value === undefined) return 'none tested';
	let text = `${entry.value}`;
	if (entry.nextTested !== null && entry.nextTested !== undefined) text += ` (next ${entry.nextTested} fails)`;
	if (entry.fitValue !== null && entry.fitValue !== undefined) text += ` · fit ${entry.fitValue}`;
	return text;
}

function shadowBudgetCell(entry) {
	if (!entry || entry.passes === null || entry.passes === undefined) return entry?.nextTested ? `none (${entry.nextTested} passes fail)` : 'none tested';
	let text = `${entry.passes} pass${entry.passes === 1 ? '' : 'es'}`;
	if (entry.lights !== null && entry.lights !== undefined) text = `${entry.lights} light${entry.lights === 1 ? '' : 's'} / ${text}`;
	if (entry.nextTested !== null && entry.nextTested !== undefined) text += ` (next ${entry.nextTested} fails)`;
	if (entry.fitValue !== null && entry.fitValue !== undefined) text += ` · fit ${entry.fitValue}`;
	return text;
}

function renderBudgets(result) {
	budgetsPanel.replaceChildren();
	if (!result) {
		budgetsPanel.innerHTML = '<p class="note">No run yet.</p>';
		return;
	}
	if (!result.summary) {
		budgetsPanel.innerHTML = `<p class="note bad">${result.label}: unavailable — ${result.reason}</p>`;
		return;
	}
	const table = document.createElement('table');
	table.innerHTML = `
		<thead><tr>
			<th>N</th>
			<th class="num">Unshadowed point lights · 16.7 ms</th>
			<th class="num">· 33.3 ms</th>
			<th class="num">Shadowed · 16.7 ms</th>
			<th class="num">· 33.3 ms</th>
			<th class="num">Cached shadows · 16.7 ms</th>
			<th class="num">· 33.3 ms</th>
		</tr></thead><tbody></tbody>`;
	const body = table.querySelector('tbody');
	for (const n of ['1000', '5000']) {
		const budget = result.budgets[n];
		const row = document.createElement('tr');
		row.innerHTML = `
			<td>${n}</td>
			<td class="num">${budgetCell(budget.unshadowedPointLights[16.7])}</td>
			<td class="num">${budgetCell(budget.unshadowedPointLights[33.3])}</td>
			<td class="num">${shadowBudgetCell(budget.shadowed[16.7])}</td>
			<td class="num">${shadowBudgetCell(budget.shadowed[33.3])}</td>
			<td class="num">${shadowBudgetCell(budget.cachedShadowed[16.7])}</td>
			<td class="num">${shadowBudgetCell(budget.cachedShadowed[33.3])}</td>`;
		body.append(row);
	}
	const wrap = document.createElement('div');
	wrap.className = 'table-wrap';
	wrap.append(table);
	const note = document.createElement('p');
	note.className = 'note';
	note.textContent =
		'Shadowed rows show authored lights and the pass count they cost: a directional or spot light is one pass, a point light is six. Cached rows are measured from the cached-shadow configurations, not derived by subtracting a fitted saving.';
	budgetsPanel.append(wrap, note);
}

function renderTable(result) {
	resultsBody.replaceChildren();
	if (!result || !result.rows) return;
	for (const row of result.rows) {
		const tr = document.createElement('tr');
		tr.innerHTML = `
			<td>${row.group}</td>
			<td>${row.label}</td>
			<td class="num">${format(row.medianMs, 2)}</td>
			<td class="num">${format(row.p95Ms, 2)}</td>
			<td class="num">${format(row.cpuSubmitMedianMs, 2)}</td>
			<td class="num">${format(row.gpuMs, 2)}</td>
			<td class="num">${format(row.workMs, 2)}</td>
			<td class="num">${format(row.syncMs, 2)}</td>
			<td class="num">${format(row.draws, 0)}</td>
			<td class="num">${format(row.triangles, 0)}</td>
			<td class="num">${format(row.programs, 0)}</td>
			<td class="num">${format(row.firstFrameMs, 2)}</td>`;
		resultsBody.append(tr);
	}
}

function showResult(kind) {
	const result = state.results[kind];
	state.shown = kind;
	renderFits(result);
	renderBudgets(result);
	renderTable(result);
	downloadButton.disabled = !result;
}

function backendKey() {
	return backendSelect.value;
}

function makeProgressHandler(label) {
	return ({ index, total, label: configLabel }) => {
		const percent = total ? Math.round((index / total) * 100) : 0;
		progress.value = percent;
		setStatus(`${label}: ${index}/${total} — ${configLabel}`);
	};
}

async function runOne(kind) {
	if (state.running) return;
	state.running = true;
	runButton.disabled = true;
	runAllButton.disabled = true;
	downloadButton.disabled = true;
	try {
		setStatus(`Starting ${BACKEND_LABELS[kind]}…`);
		const target = freshCanvas();
		const result = await runBackend(kind, target, makeProgressHandler(BACKEND_LABELS[kind]));
		state.results[kind] = result;
		showResult(kind);
		setStatus(`Completed ${BACKEND_LABELS[kind]} — ${result.rows.length} configurations.`);
	} catch (error) {
		state.results[kind] = {
			kind,
			label: BACKEND_LABELS[kind],
			available: false,
			reason: error.message
		};
		showResult(kind);
		setStatus(`${BACKEND_LABELS[kind]} unavailable: ${error.message}`);
		console.error(error);
	} finally {
		state.running = false;
		runButton.disabled = false;
		runAllButton.disabled = false;
		downloadButton.disabled = !state.results[backendKey()];
	}
}

async function runAll() {
	for (const kind of ['webgl', 'webgpu', 'webgpu-force-webgl']) {
		await runOne(kind);
	}
	progress.value = 100;
	setStatus('All backends attempted. Summary is in the tables; download each backend separately.');
}

function download() {
	const kind = state.results[backendKey()] ? backendKey() : state.shown;
	const result = state.results[kind];
	if (!result) return;
	const payload = {
		schemaVersion: 1,
		kind: 'render-cost-calibration',
		deviceLabel: navigator.platform,
		backend: kind,
		result
	};
	const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = `render-cost-${kind}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
	link.click();
	URL.revokeObjectURL(url);
}

runButton.addEventListener('click', () => runOne(backendKey()));
runAllButton.addEventListener('click', runAll);
downloadButton.addEventListener('click', download);
backendSelect.addEventListener('change', () => showResult(backendKey()));

probeWebGPU().then((probe) => {
	state.webgpu = probe;
	availability.textContent = [
		`WebGPU detection: ${probe.available ? 'available' : 'unavailable'}`,
		probe.available
			? `adapter: ${JSON.stringify(probe.adapter)}`
			: `reason: ${probe.reason} (backend B will record this and will not silently fall back)`,
		`three r${'187'} · ${allConfigs().length} configurations per backend`
	].join('\n');
});

const lightingButton = document.querySelector('#run-lighting');
const lightingStatus = document.querySelector('#lighting-status');
state.lighting = null;

/** Lighting-system sweep: A default, B default / dynamic / clustered. One JSON for both. */
async function runLighting() {
	if (state.running) return null;
	state.running = true;
	lightingButton.disabled = true;
	runButton.disabled = true;
	runAllButton.disabled = true;
	const out = { schemaVersion: 1, kind: 'render-cost-lighting-systems', results: {} };
	try {
		for (const kind of ['webgl', 'webgpu']) {
			try {
				out.results[kind] = await runLightingSweep(kind, freshCanvas(), makeProgressHandler(`Lighting · ${BACKEND_LABELS[kind]}`));
			} catch (error) {
				out.results[kind] = { kind, available: false, reason: error.message };
			}
		}
		state.lighting = out;
		lightingStatus.textContent = 'Lighting sweep complete. Download it with the button.';
		setStatus('Lighting sweep complete.');
		return out;
	} finally {
		state.running = false;
		lightingButton.disabled = false;
		runButton.disabled = false;
		runAllButton.disabled = false;
	}
}

function downloadLighting() {
	if (!state.lighting) return;
	const blob = new Blob([JSON.stringify(state.lighting, null, 2)], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = `render-cost-lighting-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
	link.click();
	URL.revokeObjectURL(url);
}

lightingButton.addEventListener('click', async () => {
	await runLighting();
});
document.querySelector('#download-lighting').addEventListener('click', downloadLighting);

window.__RCC__ = {
	runLighting,
	getLighting: () => state.lighting,
	runBackend: runOne,
	runAll,
	getResults: () => state.results,
	getState: () => ({ running: state.running, shown: state.shown }),
	/** Debug only: a named subset, with no compile step. */
	debug: async (kind, ids) => {
		const result = await runBackend(kind, freshCanvas(), () => {}, ids);
		state.results[kind] = result;
		showResult(kind);
		return result.rows;
	}
};
