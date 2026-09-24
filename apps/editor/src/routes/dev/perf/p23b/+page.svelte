<script lang="ts">
	import { dev } from '$app/environment';
	import EditorApp from '$lib/editor/app/EditorApp.svelte';
	import {
		buildP23BMatrixFixture,
		P23B_MATRIX_SPECS,
		P23B_OWNER_FIXTURE_ID,
		P23B_OWNER_LAYOUT
	} from '$lib/bench/p23b-fixtures';
	import { createEmptyWorldLocalSceneDocument, type SceneDocument } from '$lib/content/scene';
	import { measureBrowserTier, type BrowserTierOptions } from '$lib/bench/browser-bench';
	import { DEFAULT_NODE_OPTIONS, measureNodeTier } from '$lib/bench/plan-bench';
	import { serializeWallFirstLayoutDocument, validateWallFirstLayoutDocument, validateWallFirstTopology, compileWallFirstLayoutGeometry } from '@portfolio/layout-core';
	import type { BenchInteractionBoundary, BenchInteractionBoundaryResult, BenchInteractionPath, BenchInteractionProtocol, BenchInteractionReport, BenchProvenance, BenchSample, BenchWorkloadResult, P23BBrowserRunReport } from '$lib/bench/bench-types';
	import fixtureLedger from '../../../../../../../docs/roadmap/p23b-geometry-performance/p23b.0-measurement-foundation/fixture-ledger.json';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	type InteractionReport = BenchInteractionReport;
	type DurableReport = Omit<P23BBrowserRunReport, 'interactions' | 'interactionSampleCounts'> & {
		interactions?: BenchInteractionReport;
		interactionSampleCounts?: P23BBrowserRunReport['interactionSampleCounts'];
	};
	const P23B_BENCHMARK_SCENE: SceneDocument = {
		...createEmptyWorldLocalSceneDocument(),
		navigationNodes: [
			{ id: 'p23b-nav-start', label: 'P23B start', position: [20, 6, 24], cameraTarget: [23, 1, 24], fov: 54, connectedNodeIds: ['p23b-nav-end'], nextNodeId: 'p23b-nav-end' },
			{ id: 'p23b-nav-end', label: 'P23B end', position: [26, 6, 24], cameraTarget: [23, 1, 24], fov: 54, connectedNodeIds: ['p23b-nav-start'], previousNodeId: 'p23b-nav-start' }
		],
		connections: [
			{ id: 'p23b-nav-edge', fromNodeId: 'p23b-nav-start', toNodeId: 'p23b-nav-end', clearance: 0.4, positionPath: { kind: 'auto-bezier', anchors: [] } }
		]
	};
	const INTERACTION_PROTOCOL: BenchInteractionProtocol = {
		selection: { target: 'Select boundary Wall wall-chain-1 in the Plan viewport', snapGrid: 'Not applicable' },
		'plan-drag-edit': { target: 'Move boundary Wall wall-chain-1.2 by one grid increment, then release', snapGrid: 'Snap 0.25 m on; grid on' },
		'bend-knot-edit': { target: 'Bend Wall wall-chain-1 at knot wall-chain-1:knot:1 by one grid increment, then release', snapGrid: 'Snap 0.25 m on; grid on' },
		'wall-authoring': { target: 'Create a partition Wall between [24, 24] and [28, 24] in the clear owner-layout region', snapGrid: 'Snap 0.25 m on; grid on' },
		'plan-pan-zoom': { target: 'Middle-button pan and wheel zoom in the Plan viewport', snapGrid: 'Not applicable' },
		'guided-3d-navigation': { target: 'Play the existing PerspectiveCamera edge p23b-nav-edge from p23b-nav-start to p23b-nav-end', snapGrid: 'Not applicable' }
	};

	const WARMUP = 5;
	const SAMPLES = 20;
	const OWNER_RAW_SHA256 = '63f15ed8745d08bf5f65ab2c85829d1b9f1df6f36b3a9137147b70d5d09f5e05';
	let running = $state(false);
	let issue = $state('');
	let report = $state<DurableReport | null>(null);
	let capturing = $state(false);
	let captureStartedAt = $state<string | null>(null);
	let interactionResults = $state<InteractionReport | null>(null);
	let sampleCounts = $state<DurableReport['interactionSampleCounts']>({});
	const MEASUREMENT_LIMITATIONS = [
		'Svelte tick records flush completion; it does not establish GPU upload or painted presentation.',
		'requestAnimationFrame records a browser-frame boundary; presented-frame latency is unavailable.',
		'WebGL and BufferGeometry marks cover observable CPU work only; GPU upload and driver execution are unavailable.'
	];

	function hashUtf8(value: string): Promise<string> {
		return crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)).then((digest) =>
			[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
		);
	}

	function browserName(userAgent: string): { name: string; version: string } {
		const match = userAgent.match(/(Edg|Chrome|Chromium|Firefox|Version)\/([\d.]+)/);
		if (!match) return { name: 'unknown', version: 'unknown' };
		const name = match[1] === 'Edg' ? 'Microsoft Edge' : match[1] === 'Version' ? 'Safari' : match[1]!;
		return { name, version: match[2]! };
	}

	function readGraphics() {
		const editorCanvas = [...document.querySelectorAll('canvas')].find((canvas) =>
			canvas.closest('.editor-page, .page') !== null
		);
		const canvas = editorCanvas ?? document.createElement('canvas');
		const source: 'active-editor-canvas' | 'diagnostic-canvas' = editorCanvas
			? 'active-editor-canvas'
			: 'diagnostic-canvas';
		let context: WebGL2RenderingContext | WebGLRenderingContext | null = null;
		let api: 'WebGL' | 'WebGL2' | 'unknown' = 'unknown';
		try {
			context = canvas.getContext('webgl2') as WebGL2RenderingContext | null;
			if (context) api = 'WebGL2';
			else {
				context = canvas.getContext('webgl') as WebGLRenderingContext | null;
				if (context) api = 'WebGL';
			}
		} catch { /* WebGL may be unavailable or blocked by the browser. */ }
		if (!context) return { api: 'unknown' as const, source };
		const extension = context.getExtension('WEBGL_debug_renderer_info') as (WEBGL_debug_renderer_info & { UNMASKED_VENDOR_WEBGL: number; UNMASKED_RENDERER_WEBGL: number }) | null;
		return {
			api,
			vendor: extension ? context.getParameter(extension.UNMASKED_VENDOR_WEBGL) as string : context.getParameter(context.VENDOR) as string,
			renderer: extension ? context.getParameter(extension.UNMASKED_RENDERER_WEBGL) as string : context.getParameter(context.RENDERER) as string,
			version: context.getParameter(context.VERSION) as string,
			source
		};
	}

	function browserProvenance(): BenchProvenance {
		const userAgent = navigator.userAgent;
		return {
			commitSha: data.commitSha,
			policyCommitSha: data.policyCommitSha,
			treeDirty: data.treeDirty,
			date: new Date().toISOString(),
			browser: { ...browserName(userAgent), userAgent },
			deviceProfile: `${navigator.platform}; ${navigator.hardwareConcurrency || 'unknown'} logical CPUs; DPR ${window.devicePixelRatio}`,
			machine: data.machine,
			operatingSystem: data.operatingSystem,
			nodeVersion: data.nodeVersion,
			devicePixelRatio: window.devicePixelRatio,
			graphics: readGraphics(),
			warmup: WARMUP,
			samples: SAMPLES,
			methodVersion: 4,
			sessionId: crypto.randomUUID()
		};
	}

	async function fixtureContracts(): Promise<void> {
		for (const spec of P23B_MATRIX_SPECS) {
			const document = buildP23BMatrixFixture(spec);
			if (!validateWallFirstLayoutDocument(document).success || validateWallFirstTopology(document) !== undefined) {
				throw new Error(`${spec.id} did not pass the shipped layout validators`);
			}
			if (compileWallFirstLayoutGeometry(document).issues.length > 0) {
				throw new Error(`${spec.id} did not pass the shipped geometry compiler`);
			}
		}
		const rawOwner = fixtureLedger.fixtures.find((entry) => entry.id === P23B_OWNER_FIXTURE_ID);
		const ownerCanonical = serializeWallFirstLayoutDocument(P23B_OWNER_LAYOUT);
		if (!rawOwner || rawOwner.rawPayloadSha256 !== OWNER_RAW_SHA256 || await hashUtf8(ownerCanonical) !== rawOwner.canonicalLayoutSha256) {
			throw new Error('Owner fixture identity does not match the ratified ledger');
		}
		if (!validateWallFirstLayoutDocument(P23B_OWNER_LAYOUT).success || validateWallFirstTopology(P23B_OWNER_LAYOUT) !== undefined || compileWallFirstLayoutGeometry(P23B_OWNER_LAYOUT).issues.length > 0) {
			throw new Error('Owner fixture did not pass the shipped validators and compiler');
		}
		if (P23B_OWNER_LAYOUT.rooms.length !== 10 || P23B_OWNER_LAYOUT.walls.length !== 40 || P23B_OWNER_LAYOUT.walls.some((wall) => wall.centerline.kind !== 'cubic-chain')) {
			throw new Error('Owner fixture geometry does not match owner-40-curved-v1');
		}
	}

	function runtimeBrowser(sample: BenchSample): BenchSample {
		return { ...sample, runtime: 'browser' };
	}

	async function runMatrix() {
		running = true;
		issue = '';
		report = null;
		try {
			await fixtureContracts();
			const base = browserProvenance();
			const nodeOptions = { ...DEFAULT_NODE_OPTIONS, warmup: WARMUP, samples: SAMPLES, hitPoints: 200 };
			const browserOptions: BrowserTierOptions = { warmup: WARMUP, samples: SAMPLES };
			const workloadDefs = [
				...P23B_MATRIX_SPECS.map((spec) => ({
					id: spec.id,
					role: spec.role,
					document: buildP23BMatrixFixture(spec),
					rawPayloadSha256: undefined as string | undefined
				})),
				{ id: P23B_OWNER_FIXTURE_ID, role: 'owner-responsiveness' as const, document: P23B_OWNER_LAYOUT, rawPayloadSha256: OWNER_RAW_SHA256 }
			];
			const workloads: BenchWorkloadResult[] = [];
			for (const item of workloadDefs) {
				const canonical = serializeWallFirstLayoutDocument(item.document);
				const canonicalLayoutSha256 = await hashUtf8(canonical);
				const provenance = { ...base, date: new Date().toISOString() };
				const node = measureNodeTier(item.document, 'small', provenance, nodeOptions);
				const browser = measureBrowserTier(item.document, 'small', provenance, browserOptions);
				workloads.push({
					fixtureId: item.id,
					semanticClass: 5,
					role: item.role,
					canonicalLayoutSha256,
					...(item.rawPayloadSha256 ? { rawPayloadSha256: item.rawPayloadSha256 } : {}),
					roomCount: item.document.rooms.length,
					provenance: { ...provenance, warmup: WARMUP, samples: SAMPLES },
					samples: [...node.samples, ...browser.samples].map(runtimeBrowser)
				});
			}
			report = {
				methodVersion: 4,
				methodVersionReason: 'v4 records the bounded editor paths with separate input, release, reactive, adapter, Svelte-flush, and browser-frame boundaries; added interaction timings remain advisory.',
				createdAt: new Date().toISOString(),
				warmup: WARMUP,
				samples: SAMPLES,
				browser: base,
			workloads,
			interactionProtocol: INTERACTION_PROTOCOL,
			nestedMarks: {},
			markNestingNote: 'Populate from existing P23.11 measures after interaction capture.',
			measurementLimitations: MEASUREMENT_LIMITATIONS,
				...(interactionResults ? { interactions: interactionResults, interactionSampleCounts: sampleCounts } : {})
			};
			(globalThis as typeof globalThis & { __P23B_REPORT__?: DurableReport }).__P23B_REPORT__ = report;
		} catch (error) {
			issue = error instanceof Error ? error.message : String(error);
		} finally {
			running = false;
		}
	}

	function startCapture() {
		performance.clearMeasures();
		performance.clearMarks();
		(globalThis as typeof globalThis & { __P2311_PERF__?: boolean }).__P2311_PERF__ = true;
		capturing = true;
		captureStartedAt = new Date().toISOString();
		interactionResults = null;
		sampleCounts = {};
	}

	function percentile(values: number[], pct: number): number {
		const sorted = [...values].sort((a, b) => a - b);
		return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * pct) - 1)] ?? 0;
	}

	function stopCapture() {
		(globalThis as typeof globalThis & { __P2311_PERF__?: boolean }).__P2311_PERF__ = false;
		capturing = false;
		const groups = new Map<string, number[]>();
		for (const entry of performance.getEntriesByType('measure')) {
			const prefix = 'p2311:p23b:';
			if (!entry.name.startsWith(prefix)) continue;
			const key = entry.name.slice(prefix.length);
			const values = groups.get(key) ?? [];
			values.push(entry.duration);
			groups.set(key, values);
		}
		const paths: BenchInteractionPath[] = ['selection', 'plan-drag-edit', 'bend-knot-edit', 'wall-authoring', 'plan-pan-zoom', 'guided-3d-navigation'];
		const boundaries: BenchInteractionBoundary[] = ['input', 'release', 'reactive', 'adapter', 'svelte-flush', 'browser-frame'];
		const results: InteractionReport = {};
		const counts: NonNullable<DurableReport['interactionSampleCounts']> = {};
		const nestedGroups = new Map<string, number[]>();
		for (const entry of performance.getEntriesByType('measure')) {
			if (!entry.name.startsWith('p2311:') || entry.name.startsWith('p2311:p23b:')) continue;
			const values = nestedGroups.get(entry.name) ?? [];
			values.push(entry.duration);
			nestedGroups.set(entry.name, values);
		}
		const nestedMarks = Object.fromEntries([...nestedGroups].map(([name, values]) => [name, {
			count: values.length,
			p50: percentile(values, 0.5),
			p95: percentile(values, 0.95)
		}]));
		for (const path of paths) {
			const pathResult: NonNullable<InteractionReport[BenchInteractionPath]> = {};
			for (const boundary of boundaries) {
				const values = groups.get(`${path}:${boundary}`) ?? [];
				const outcome: BenchInteractionBoundaryResult = values.length
					? { count: values.length, p50: percentile(values, 0.5), p95: percentile(values, 0.95) }
					: { unavailable: unavailableBoundary(path, boundary) };
				pathResult[boundary] = outcome;
			}
			results[path] = pathResult;
			counts[path] = groups.get(`${path}:input`)?.length ?? 0;
		}
		interactionResults = results;
		sampleCounts = counts;
		if (report) report = {
			...report,
			interactions: results,
			interactionSampleCounts: counts,
			nestedMarks,
			markNestingNote: 'Existing P23.11 component measures may be nested inside P23B path/boundary measures. Their distributions are listed separately and must not be summed.'
		};
		(globalThis as typeof globalThis & { __P23B_REPORT__?: P23BBrowserRunReport }).__P23B_REPORT__ = report as P23BBrowserRunReport | null ?? undefined;
	}

	function unavailableBoundary(path: BenchInteractionPath, boundary: BenchInteractionBoundary): string {
		if (boundary === 'adapter') {
			return path === 'selection' || path === 'plan-pan-zoom'
				? 'This path does not rebuild render geometry.'
				: 'No editor adapter CPU mark was observed during the captured action; GPU work is not inferred.';
		}
		if (boundary === 'reactive') {
			return path === 'selection' || path === 'plan-pan-zoom'
				? 'This path does not derive Layout geometry.'
				: 'No reactive derivation mark was observed during the captured action.';
		}
		return 'No sample was captured for this applicable boundary; repeat the fixed owner action.';
	}

	function downloadReport() {
		if (!report) return;
		const blob = new Blob([JSON.stringify({ ...report, interactionCaptureStartedAt: captureStartedAt }, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = 'p23b-browser-baseline.json';
		anchor.click();
		URL.revokeObjectURL(url);
	}
</script>

<svelte:head><title>P23B durable measurement harness</title></svelte:head>

{#if dev}
	<EditorApp projectId="p23b-owner-benchmark" initialLayout={P23B_OWNER_LAYOUT} initialScene={P23B_BENCHMARK_SCENE} />
	<aside class="harness" aria-label="P23B measurement controls">
		<p class="eyebrow">P23B.0 durable</p>
		<h1>Measurement harness</h1>
		<p>Owner project: 40 curved Walls. Baseline sampling: {WARMUP} warm-up + {SAMPLES} measured samples per workload, in this browser session.</p>
		<button disabled={running} onclick={runMatrix}>{running ? 'Measuring seven fixtures…' : 'Run seven workload baselines'}</button>
		<div class="capture-controls">
			<button disabled={capturing} onclick={startCapture}>Start interaction capture</button>
			<button disabled={!capturing} onclick={stopCapture}>Stop and summarize</button>
		</div>
		<p class="capture-hint">Start capture, repeat each fixed action, then stop. Leave Snap 0.25 m and Grid on for authoring actions; the app defaults to both on.</p>
		<details><summary>Fixed owner actions</summary><pre>{JSON.stringify(INTERACTION_PROTOCOL, null, 2)}</pre></details>
		{#if capturing}<p class="status">Capturing from {captureStartedAt}</p>{/if}
		{#if issue}<p class="error">{issue}</p>{/if}
		{#if interactionResults}
			<h2>Interaction samples</h2>
			<pre>{JSON.stringify({ sampleCounts, interactions: interactionResults }, null, 2)}</pre>
		{/if}
		{#if report}
			<button class="download" disabled={!interactionResults} onclick={downloadReport}>Download baseline JSON</button>
			<p class="status">Recorded {report.workloads.length} workloads. Browser: {report.browser.browser?.name} {report.browser.browser?.version}; DPR {report.browser.devicePixelRatio}; {report.browser.graphics?.renderer ?? 'renderer unavailable'}.</p>
		{/if}
	</aside>
{/if}

<style>
	:global(body) { margin: 0; }
	.harness { position: fixed; z-index: 10000; right: 1rem; bottom: 1rem; width: min(23rem, calc(100vw - 2rem)); max-height: min(36rem, calc(100vh - 2rem)); overflow: auto; padding: 1rem; border: 1px solid #62583c; border-radius: .6rem; background: rgb(15 16 20 / .94); color: #eee8d8; box-shadow: 0 12px 42px rgb(0 0 0 / .45); font: 13px/1.45 system-ui, sans-serif; }
	.eyebrow { margin: 0; color: #d9ba71; font-size: .68rem; letter-spacing: .12em; text-transform: uppercase; }
	h1 { margin: .2rem 0 .5rem; font-size: 1rem; }
	h2 { margin: .8rem 0 .3rem; font-size: .85rem; }
	p { margin: .45rem 0; color: #c7c4ba; }
	button { width: 100%; margin-top: .45rem; padding: .5rem .65rem; border: 1px solid #7c6b40; border-radius: .35rem; background: #29261e; color: #f1e6c8; cursor: pointer; font: inherit; }
	button:disabled { opacity: .5; cursor: default; }
	.capture-controls { display: grid; grid-template-columns: 1fr 1fr; gap: .45rem; }
	.capture-hint { font-size: .75rem; }
	details { margin-top: .5rem; }
	summary { cursor: pointer; color: #e1d4ad; }
	.status { font-size: .72rem; overflow-wrap: anywhere; }
	.error { color: #ff9c82; }
	pre { max-height: 12rem; overflow: auto; padding: .5rem; background: #090a0d; font-size: .65rem; }
</style>
