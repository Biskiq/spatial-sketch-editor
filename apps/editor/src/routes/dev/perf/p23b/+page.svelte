<script lang="ts">
	import { dev } from '$app/environment';
	import EditorApp from '$lib/editor/app/EditorApp.svelte';
	import {
		buildP23BMatrixFixture,
		P23B_MATRIX_SPECS,
		P23B_OWNER_FIXTURE_ID,
		P23B_OWNER_LAYOUT,
		p23bMatrixFixtureById
	} from '$lib/bench/p23b-fixtures';
	import { createEmptyWorldLocalSceneDocument, type SceneDocument } from '$lib/content/scene';
	import { measureBrowserTier, type BrowserTierOptions } from '$lib/bench/browser-bench';
	import { DEFAULT_NODE_OPTIONS, measureNodeTier } from '$lib/bench/plan-bench';
	import { serializeWallFirstLayoutDocument, validateWallFirstLayoutDocument, validateWallFirstTopology, compileWallFirstLayoutGeometry } from '@portfolio/layout-core';
	import type {
		BenchDeferredInteractionPaths,
		BenchInteractionBoundary,
		BenchInteractionFixtureCapture,
		BenchInteractionPath,
		BenchInteractionProtocol,
		BenchMarkSummary,
		BenchNotApplicableInteractionPaths,
		BenchProvenance,
		BenchSample,
		BenchWorkloadResult,
		P23BBrowserRunReport,
		P23BCaptureLedger
	} from '$lib/bench/bench-types';
	import {
		buildP23BContainment,
		summarizeContainmentByPath,
		type P23BContainmentNode,
		type P23BContainmentRecord
	} from '$lib/bench/p23b-containment';
	import {
		p2311MeshIdentityRecords,
		type P23BMeshIdentityRecord
	} from '$lib/editor/layout/p23b-mesh-identity';
	import {
		p23bBeginInteractionCapture,
		p23bEndInteractionCapture,
		p23bInteractionCaptureLedger,
		p23bRecordFixtureReset,
		p23bSettleInteractionCapture,
		percentile,
		summarizeInteractionCapture
	} from '$lib/editor/layout/p23b-interaction-measure';
	import {
		p23bGestureSamplingEnabled,
		p23bGestureSamplingState,
		p23bResetGestureSampling,
		p23bStopGestureSampling,
		p23bSubscribeGestureSampling,
		type P23BGestureSamplingState
	} from '$lib/editor/layout/p23b-gesture-sampling-report';
	import {
		createP23BCaptureDriver,
		DRIVE_ACTIONS_PER_PATH,
		DRIVE_ACTION_TIMEOUT_MS,
		P23B11_S1_FIXTURE_ORDER,
		P23B_M1_ACTION_CLASSES,
		P23B_M1_COLD_PREFIX,
		P23B_M1_FIXTURE_ORDER,
		P23B_M1_PREFIX,
		type P23BDriveFixture,
		type P23BDriveProgress
	} from './drive';
	import { p23bM1FrameTiming, p23bM1LongFramesFor } from '$lib/bench/p23b-m1-frame-timing';
	import { p23bM1ActionArms } from '$lib/editor/layout/p23b-m1-room-drag-arm';
import {
	p23bM1ActionLabelArmRecordsFor,
	p23bM1GridBuildKeys
} from '$lib/editor/layout/p23b-m1-room-label-arm';
	import {
		buildP23BM1Record,
		m1ClassLedger,
		summarizeM1Class,
		type P23BM1ClassRow,
		type P23BM1Record
	} from '$lib/bench/p23b-m1-record';
	import {
		buildP23B11ConnectedCase,
		P23B11_CONNECTED_CASE_ID,
		P23B11_CONNECTED_CASE_LABEL
	} from '$lib/bench/p23b11-connected-case';
	import type { LayoutDocumentWallFirst } from '$lib/layout/layout-wall-first-types';
	import fixtureLedger from '../../../../../../../docs/roadmap/p23b-geometry-performance/p23b.0-measurement-foundation/fixture-ledger.json';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
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

	/**
	 * Owner decision 2026-09-24: the guided 3D navigation capture is deferred
	 * because the reported whole-editor slowdown is currently in the Plan (2D)
	 * paths. A deferred path keeps its boundaries explicitly unavailable instead
	 * of being silently omitted or replaced with invented samples.
	 */
	const DEFERRED_INTERACTION_PATHS: BenchDeferredInteractionPaths = {
		'guided-3d-navigation':
			'Owner decision 2026-09-24: 3D guided-navigation sampling is deferred; the reported slowdown is in the Plan (2D) paths, so this path carries no interaction sample in this baseline.'
	};
	/** Matrix sampling (unchanged): 5 warm-up + 20 measured workload samples per input. */
	const WARMUP = 5;
	const SAMPLES = 20;
	/**
	 * Interaction sampling mirrors the matrix: the leading five completed actions
	 * of every path are excluded as warm-up by the summarizer, and the exclusion is
	 * recorded per path. It is enforced in code, not asserted in prose.
	 */
	const INTERACTION_WARMUP = 5;
	const OWNER_RAW_SHA256 = '63f15ed8745d08bf5f65ab2c85829d1b9f1df6f36b3a9137147b70d5d09f5e05';
	const INTERACTION_PATHS: readonly BenchInteractionPath[] = [
		'selection', 'plan-drag-edit', 'bend-knot-edit', 'wall-authoring', 'plan-pan-zoom', 'guided-3d-navigation'
	];
	const INTERACTION_BOUNDARIES: readonly BenchInteractionBoundary[] = [
		'input', 'release', 'reactive', 'plan-apply', 'adapter', 'svelte-flush', 'browser-frame'
	];

	/**
	 * Equivalent targets. Each hosted fixture is measured on the SAME relative
	 * target — room 0's boundary edge 0 for selection and for the bend, room 0's
	 * boundary edge 1 at 25% of its chord for the ordinary drag, and a 4 m
	 * partition Wall in a clear region outside room 0 for authoring — at the same
	 * px/m, with the same increments. Only the fixture's own coordinates differ.
	 */
	type HostedTargets = {
		selectionWallId: string;
		dragWallId: string;
		dragGrabFraction: number;
		bendWallId: string;
		bendKnotId: string;
		authoringFrom: [number, number];
		authoringTo: [number, number];
	};
	/**
	 * The connected grid's targets: the authoring segment runs inside grid cell
	 * (0,0) — the confined interior that still pays the whole-document proof — and
	 * the Rect Room is drawn in the clear region beside the grid, so it lands as a
	 * new independent island while the grid stays one connected group.
	 */
	const CONNECTED_TARGETS: HostedTargets = {
		selectionWallId: 'grid:h-0-0',
		dragWallId: 'grid:v-0-0',
		dragGrabFraction: 0.5,
		bendWallId: 'grid:h-0-0',
		bendKnotId: 'grid:h-0-0:knot:1',
		authoringFrom: [3, 5],
		authoringTo: [7, 5]
	};
	const OWNER_TARGETS: HostedTargets = {
		selectionWallId: 'wall-chain-1',
		dragWallId: 'wall-chain-1.2',
		dragGrabFraction: 0.25,
		bendWallId: 'wall-chain-1',
		bendKnotId: 'wall-chain-1:knot:1',
		authoringFrom: [24, 24],
		authoringTo: [28, 24]
	};
	const MATRIX_TARGETS: HostedTargets = {
		selectionWallId: 'room-0:wall-0',
		dragWallId: 'room-0:wall-1',
		dragGrabFraction: 0.25,
		bendWallId: 'room-0:wall-0',
		bendKnotId: 'room-0:wall-0:knot:1',
		authoringFrom: [14, 5],
		authoringTo: [18, 5]
	};

	type HostedFixture = {
		id: string;
		label: string;
		role: BenchWorkloadResult['role'];
		document: LayoutDocumentWallFirst;
		canonicalLayoutSha256: string;
		rawPayloadSha256?: string;
		targets: HostedTargets;
		protocol: BenchInteractionProtocol;
		notApplicable: BenchNotApplicableInteractionPaths;
	};

	function ledgerEntry(id: string) {
		const entry = fixtureLedger.fixtures.find((fixture) => fixture.id === id);
		if (!entry) throw new Error(`P23B fixture ledger is missing ${id}`);
		return entry;
	}

	function protocolFor(targets: HostedTargets, geometryNote: string): BenchInteractionProtocol {
		return {
			selection: { target: `Select boundary Wall ${targets.selectionWallId} (room 0, boundary edge 0) in the Plan viewport`, snapGrid: 'Not applicable' },
			'plan-drag-edit': { target: `Grab Wall ${targets.dragWallId} (room 0, boundary edge 1) at ${targets.dragGrabFraction * 100}% of its chord and move one 0.25 m grid increment, then release`, snapGrid: 'Snap 0.25 m on; grid on' },
			'bend-knot-edit': { target: `Bend Wall ${targets.bendWallId} at knot ${targets.bendKnotId} by one 0.25 m grid increment, then release`, snapGrid: 'Snap 0.25 m on; grid on' },
			'wall-authoring': { target: `Create a partition Wall between [${targets.authoringFrom.join(', ')}] and [${targets.authoringTo.join(', ')}] (4 m, ${geometryNote})`, snapGrid: 'Snap 0.25 m on; grid on' },
			'plan-pan-zoom': { target: 'Middle-button pan and wheel zoom in the Plan viewport, in the same px/m view as every other hosted fixture', snapGrid: 'Not applicable' },
			'guided-3d-navigation': { target: 'Play the existing PerspectiveCamera edge p23b-nav-edge from p23b-nav-start to p23b-nav-end', snapGrid: 'Not applicable' }
		};
	}

	function hostedFixture(id: string, targets: HostedTargets, geometryNote: string): HostedFixture {
		const entry = ledgerEntry(id);
		const spec = p23bMatrixFixtureById(id);
		const document = id === P23B_OWNER_FIXTURE_ID ? P23B_OWNER_LAYOUT : buildP23BMatrixFixture(spec!);
		return {
			id,
			label: id,
			role: entry.role as BenchWorkloadResult['role'],
			document,
			canonicalLayoutSha256: entry.canonicalLayoutSha256,
			...(entry.rawPayloadSha256 ? { rawPayloadSha256: entry.rawPayloadSha256 } : {}),
			targets,
			protocol: protocolFor(targets, geometryNote),
			notApplicable:
				spec?.curvature === 'straight'
					? {
							'bend-knot-edit':
								`${id} has no knots: every centerline in the all-straight control fixture is a straight segment, so the bend/knot path cannot exist on this fixture and is recorded as not applicable rather than captured or converted.`
						}
					: {}
		};
	}

	/**
	 * The hosted fixtures: the exact owner workload plus the two size-40 matrix
	 * cells that isolate curvature at constant size and topology. The other four
	 * matrix cells stay in the deterministic workload matrix only, so all six
	 * matrix identities and their hashes are preserved untouched.
	 */
	const HOSTED_FIXTURES: readonly HostedFixture[] = [
		hostedFixture(P23B_OWNER_FIXTURE_ID, OWNER_TARGETS, 'in the clear region outside the owner layout'),
		hostedFixture('p23b-40-wall-straight-v1', MATRIX_TARGETS, 'in the clear gap between room-0 and room-1'),
		hostedFixture('p23b-40-wall-all-curved-v1', MATRIX_TARGETS, 'in the clear gap between room-0 and room-1')
	];

	/**
	 * P23B.11 S1 — the CONNECTED case's hosted fixture.
	 *
	 * Generated, never recorded: it is not a `P23BMatrixSpec` and it is absent
	 * from `fixture-ledger.json`, so it carries an explicit `unrecorded:` marker
	 * where a ledger hash would go. That is sound because its captures are
	 * action-class sessions, which the harness keeps as containment records only
	 * — nothing about this fixture can reach `g3-baseline.json`, and the scripted
	 * baseline capture still runs the three committed fixtures alone.
	 */
	const CONNECTED_CASE_HOSTED: HostedFixture = {
		id: P23B11_CONNECTED_CASE_ID,
		label: P23B11_CONNECTED_CASE_LABEL,
		role: 'timing-target',
		document: buildP23B11ConnectedCase(),
		canonicalLayoutSha256: `unrecorded:${P23B11_CONNECTED_CASE_ID}`,
		targets: CONNECTED_TARGETS,
		protocol: protocolFor(CONNECTED_TARGETS, 'inside grid cell 0,0 and beside the grid'),
		notApplicable: {}
	};
	const ALL_HOSTED_FIXTURES: readonly HostedFixture[] = [...HOSTED_FIXTURES, CONNECTED_CASE_HOSTED];

	let hostedFixtureId = $state<string>(P23B_OWNER_FIXTURE_ID);
	let hostedRevision = $state(0);
	const hosted = $derived(ALL_HOSTED_FIXTURES.find((fixture) => fixture.id === hostedFixtureId) ?? ALL_HOSTED_FIXTURES[0]!);

	let running = $state(false);
	let issue = $state('');
	let report = $state<P23BBrowserRunReport | null>(null);
	let captureSessionId = $state<string | null>(null);
	let captureStartedAt = $state<string | null>(null);
	let captures = $state<BenchInteractionFixtureCapture[]>([]);
	let lastCaptureNote = $state('');
	let currentCaptureActionClass = $state<string | null>(null);
	/**
	 * Measurement-only step — one containment record per hosted fixture. Kept out
	 * of the baseline report on purpose: this is a separate record (no budget, no
	 * `g3-baseline.json` write), and it is what turns the pooled `nestedMarks` into
	 * an action-attributed tree.
	 */
	type ContainmentFixtureEntry = {
		fixtureId: string;
		sessionId: string;
		actionClass: string | null;
		record: P23BContainmentRecord;
		/**
		 * The session's ledger, SNAPSHOTTED at the moment the class closes.
		 *
		 * The live registry keeps only the most recent few sessions readable
		 * (`p23b-interaction-measure.ts`'s `SESSION_HISTORY`), so a record built after
		 * a run of many class sessions cannot look a closed session up again — the
		 * lookup returns null and every population column in that record reads as
		 * missing. The snapshot is taken while the session is still readable, which is
		 * the only moment the data is guaranteed to be there.
		 */
		ledger: P23BCaptureLedger | null;
	};
	let containmentFixtures = $state<ContainmentFixtureEntry[]>([]);
	const capturing = $derived(captureSessionId !== null);

	const MEASUREMENT_LIMITATIONS = [
		'Svelte tick records flush completion; it does not establish GPU upload or painted presentation.',
		'requestAnimationFrame records a browser-frame boundary that starts where the synchronous input ended, so it encloses that input\'s flush and is never additive with it; presented-frame latency is unavailable.',
		'WebGL and BufferGeometry marks cover observable CPU work only; GPU upload and driver execution are unavailable.',
		'plan-apply (the canonical planner/apply call) and adapter (Three geometry adaptation) are separate boundaries and are never summed with each other or with interaction latency.',
		'Interaction samples are classified by outcome; setup, rejected, suppressed and unclassified actions are recorded as counts but excluded from the accepted distributions.',
		'Interaction timings are advisory wall-clock samples from one developer machine, one browser session and one DEV server; they are not a budget and they do not establish native-Chrome behaviour.'
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
			methodVersion: 5,
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
		// The hosted interaction fixtures must keep the ledger's identity, and the
		// all-straight control must stay straight: its centerlines are never converted.
		for (const fixture of HOSTED_FIXTURES) {
			const canonical = serializeWallFirstLayoutDocument(fixture.document);
			if (await hashUtf8(canonical) !== fixture.canonicalLayoutSha256) {
				throw new Error(`Hosted fixture identity changed: ${fixture.id}`);
			}
		}
		const straight = HOSTED_FIXTURES.find((fixture) => fixture.id === 'p23b-40-wall-straight-v1')!;
		if (straight.document.walls.some((wall) => wall.centerline.kind !== 'line')) {
			throw new Error('The all-straight control fixture must keep every straight centerline');
		}
	}

	function runtimeBrowser(sample: BenchSample): BenchSample {
		return { ...sample, runtime: 'browser' };
	}

	async function runMatrix() {
		running = true;
		issue = '';
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
				methodVersion: 5,
				methodVersionReason:
					'v5 fixes the interaction evidence: deferred boundaries always start where the synchronous input ended (so a frame encloses its own flush instead of pooling two origins), the canonical planner/apply call is its own plan-apply boundary rather than adapter CPU work, every action is classified by the outcome it actually reached (accepted/setup/rejected/suppressed/unclassified) with the reported distribution restricted to warm-up-excluded accepted samples, capture sessions are isolated and settled before summarizing, and the interaction capture runs on the owner workload plus the size-40 straight and all-curved matrix cells in one session. Interaction timings remain advisory.',
				createdAt: new Date().toISOString(),
				warmup: WARMUP,
				samples: SAMPLES,
				browser: base,
				workloads,
				interactionFixtures: captures,
				deferredInteractionPaths: DEFERRED_INTERACTION_PATHS,
				markNestingNote:
					'Existing P23.11 component measures nest inside the P23B path/boundary measures and are listed separately; deferred boundaries start where their synchronous input ended, so browser-frame encloses svelte-flush for the same input. None of these distributions may be summed.',
				measurementLimitations: MEASUREMENT_LIMITATIONS
			};
			publishReport();
		} catch (error) {
			issue = error instanceof Error ? error.message : String(error);
		} finally {
			running = false;
		}
	}

	function nestedMarks(): Record<string, BenchMarkSummary> {
		const groups = new Map<string, number[]>();
		for (const entry of performance.getEntriesByType('measure')) {
			if (!entry.name.startsWith('p2311:') || entry.name.startsWith('p2311:p23b:')) continue;
			const values = groups.get(entry.name) ?? [];
			values.push(entry.duration);
			groups.set(entry.name, values);
		}
		return Object.fromEntries([...groups].map(([name, values]) => [name, {
			count: values.length,
			p50: percentile(values, 0.5),
			p95: percentile(values, 0.95)
		}]));
	}

	function unavailableBoundary(
		fixture: HostedFixture,
		path: BenchInteractionPath,
		boundary: BenchInteractionBoundary
	): string {
		const deferral = DEFERRED_INTERACTION_PATHS[path];
		if (deferral && (boundary === 'input' || boundary === 'release')) return deferral;
		const notApplicable = fixture.notApplicable[path];
		if (notApplicable) return notApplicable;
		if (boundary === 'plan-apply') {
			return path === 'selection' || path === 'plan-pan-zoom'
				? 'This path performs no canonical planning or install call.'
				: 'No canonical planner call was observed during the captured action.';
		}
		if (boundary === 'adapter') {
			return path === 'selection' || path === 'plan-pan-zoom'
				? 'This path does not rebuild render geometry.'
				: 'No Three adapter CPU mark was observed during the captured action; GPU work is not inferred.';
		}
		if (boundary === 'reactive') {
			return path === 'selection' || path === 'plan-pan-zoom'
				? 'This path does not derive Layout geometry.'
				: 'No reactive derivation mark was observed during the captured action.';
		}
		return 'No sample was captured for this applicable boundary; repeat the fixed action.';
	}

	function resetHostedFixture() {
		if (capturing) {
			issue = 'Stop the capture before re-seeding the hosted fixture; a re-seed remounts the editor at the default view.';
			return;
		}
		hostedRevision += 1;
		p23bRecordFixtureReset();
	}

	function hostFixture(id: string) {
		if (capturing) {
			issue = 'Stop the current capture before hosting another fixture.';
			return;
		}
		issue = '';
		hostedFixtureId = ALL_HOSTED_FIXTURES.some((fixture) => fixture.id === id) ? id : P23B_OWNER_FIXTURE_ID;
		hostedRevision += 1;
	}

	/**
	 * P23B.5 M-3 — the live drag-reuse readout.
	 *
	 * The bounded gesture-scoped sample store reports its own counters; this is
	 * the read path. It needs the same DEV measurement switch the capture uses
	 * (there is no second switch and no production path), and it is deliberately
	 * independent of the capture session: reuse can be watched during ordinary
	 * dragging, with or without a capture open. Nothing here is recorded into the
	 * capture ledger or the baseline.
	 */
	let samplingState = $state<P23BGestureSamplingState>({ live: null, history: [] });
	let samplingSwitch = $state(false);

	$effect(() => {
		samplingSwitch = p23bGestureSamplingEnabled();
		samplingState = p23bGestureSamplingState();
		return p23bSubscribeGestureSampling((next) => {
			samplingState = next;
			samplingSwitch = p23bGestureSamplingEnabled();
		});
	});

	function setSamplingSwitch(enabled: boolean) {
		if (!enabled) p23bStopGestureSampling();
		(globalThis as typeof globalThis & { __P2311_PERF__?: boolean }).__P2311_PERF__ = enabled;
		samplingSwitch = enabled;
		samplingState = p23bGestureSamplingState();
	}

	function percent(value: number): string {
		return `${(value * 100).toFixed(0)}%`;
	}

	/**
	 * Start one isolated capture session for the hosted fixture. Each hosted
	 * fixture gets its own session, so a boundary scheduled in one fixture's
	 * capture can never be written into another's.
	 */
	function startCapture(actionClass: string | null = null) {
		if (capturing) return;
		issue = '';
		performance.clearMeasures();
		performance.clearMarks();
		(globalThis as typeof globalThis & { __P2311_PERF__?: boolean }).__P2311_PERF__ = true;
		samplingSwitch = true;
		captureSessionId = p23bBeginInteractionCapture();
		captureStartedAt = new Date().toISOString();
		currentCaptureActionClass = actionClass;
		lastCaptureNote = '';
	}

	/**
	 * Stop the session: drain in-flight deferred boundaries first, then close the
	 * session, then give any straggler one more frame so a dropped boundary is
	 * counted instead of landing in the next session, then summarize.
	 */
	async function stopCapture() {
		const sessionId = captureSessionId;
		if (!sessionId) return;
		const settled = await p23bSettleInteractionCapture(1500);
		p23bEndInteractionCapture();
		await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));			(globalThis as typeof globalThis & { __P2311_PERF__?: boolean }).__P2311_PERF__ = false;
			samplingSwitch = false;
			p23bStopGestureSampling();
			const ledger = p23bInteractionCaptureLedger(sessionId);
		if (!ledger) {
			issue = 'The capture session could not be read back.';
			captureSessionId = null;
			currentCaptureActionClass = null;
			return;
		}
		const summary = summarizeInteractionCapture(ledger, {
			warmup: INTERACTION_WARMUP,
			paths: INTERACTION_PATHS,
			boundaries: INTERACTION_BOUNDARIES,
			unavailable: (path, boundary) => unavailableBoundary(hosted, path, boundary)
		});
		const record: BenchInteractionFixtureCapture = {
			fixtureId: hosted.id,
			semanticClass: 5,
			role: hosted.role,
			canonicalLayoutSha256: hosted.canonicalLayoutSha256,
			...(hosted.rawPayloadSha256 ? { rawPayloadSha256: hosted.rawPayloadSha256 } : {}),
			sessionId,
			startedAt: captureStartedAt ?? new Date().toISOString(),
			endedAt: new Date().toISOString(),
			protocol: hosted.protocol,
			notApplicableInteractionPaths: hosted.notApplicable,
			planView: summary.planView,
			interactions: summary.interactions,
			interactionSampleCounts: summary.interactionSampleCounts,
			capture: summary.capture,
			nestedMarks: nestedMarks()
		};
		if (currentCaptureActionClass === null) captures = [...captures, record];
		// Measurement-only step: bind the marks this fixture's actions produced to
		// the action and outcome that enclose them, before the next fixture clears
		// the marks. The pooled `nestedMarks` above stays for contract compatibility.
		containmentFixtures = [
			...containmentFixtures,
			{
				fixtureId: hosted.id,
				sessionId,
				actionClass: currentCaptureActionClass,
				record: buildP23BContainment(ledger, readMarks()),
				// Kept from the read-back above, taken while the session was still in the
				// registry: a long run evicts old sessions, so a later lookup reads null.
				ledger
			}
		];
		captureSessionId = null;
		currentCaptureActionClass = null;
		lastCaptureNote = settled
			? `Settled. ${Object.entries(record.capture.completedActions).map(([path, count]) => `${path} ${count}`).join(' · ') || `${ledger.actions.length} action(s) recorded`}`
			: 'Settlement budget expired: in-flight boundaries were dropped and counted, not averaged in.';
		publishReport();
	}

	function publishReport() {
		const current = report;
		if (current) report = { ...current, interactionFixtures: captures };
		(globalThis as typeof globalThis & { __P23B_REPORT__?: P23BBrowserRunReport }).__P23B_REPORT__ = report ?? undefined;
		(globalThis as typeof globalThis & { __P23B_CONTAINMENT__?: unknown }).__P23B_CONTAINMENT__ = containmentFixtures;
		// The summary the measurement record reports: the interaction report's own
		// population rule (warm-up excluded, accepted only) applied to containment, so
		// a containment number and the boundary number beside it describe the same
		// actions. Full trees stay on `__P23B_CONTAINMENT__`.
		(globalThis as typeof globalThis & { __P23B_CONTAINMENT_SUMMARY__?: unknown }).__P23B_CONTAINMENT_SUMMARY__ =
			containmentFixtures.map((fixture) => ({
				fixtureId: fixture.fixtureId,
				marks: fixture.record.marks,
				unattributed: fixture.record.unattributed,
				byPath: summarizeContainmentByPath(fixture.record, {
					warmup: INTERACTION_WARMUP,
					outcomes: ['accepted']
				})
			}));
		(globalThis as typeof globalThis & { __P23B_CAPTURE__?: unknown }).__P23B_CAPTURE__ = {
			capturing,
			hostedFixtureId,
			captures: captures.map((entry) => ({
				fixtureId: entry.fixtureId,
				sessionId: entry.sessionId,
				completedActions: entry.capture.completedActions,
				incompleteActions: entry.capture.incompleteActions,
				settled: entry.capture.settled
			}))
		};
	}

	/**
	 * The scripted capture: the fixed protocol as code. It hosts every fixture in
	 * turn, puts the Plan viewport on the one shared px/m ladder, performs the
	 * fixed actions and verifies each action's own path/outcome against the live
	 * ledger before the capture is summarized. Anything it cannot verify is
	 * repeated (and recorded as a retry) or fails loudly here.
	 */
	function driveFixtureOf(fixture: HostedFixture): P23BDriveFixture {
		return {
			id: fixture.id,
			label: fixture.label,
			document: fixture.document,
			targets: fixture.targets,
			notApplicable: fixture.notApplicable
		};
	}

	/**
	 * The scripted baseline capture stays on the three committed fixtures; the
	 * connected case is appended only for the P23B.11 S1/S7 run, whose capture
	 * sessions are action-class (containment-only) by construction.
	 */
	const driveFixtures: readonly P23BDriveFixture[] = HOSTED_FIXTURES.map(driveFixtureOf);
	const withConnectedDriveFixtures: readonly P23BDriveFixture[] = [
		...driveFixtures,
		driveFixtureOf(CONNECTED_CASE_HOSTED)
	];
	/**
	 * Pre-P23B.8 follow-up M1 — the same list: the three committed fixtures in
	 * harness order, then the connected case LAST as advisory evidence. The connected
	 * case is never recorded (its classes are containment-only action-class
	 * sessions), so nothing about it can reach a baseline.
	 */
	const m1DriveFixtures: readonly P23BDriveFixture[] = withConnectedDriveFixtures;

	let driveRunning = $state(false);
	let driveLog = $state<string[]>([]);
	let driveStep = $state('');
	let drivePathProgress = $state<P23BDriveProgress['paths']>({});
	let driveFailure = $state('');
	/** Shared px/m ladder the P23B.11 S1 run left every hosted fixture on. */
	let p23b11LadderPixelsPerMeter = $state<number | null>(null);
	/**
	 * Pre-P23B.8 follow-up M1 — the session's own state. The recorded ladder is
	 * M1's (the protocol puts every fixture on the same px/m ladder; the number is
	 * reported, not assumed), and the failure is kept separate from the driver
	 * log's other runs so an M1 failure is never read as a P23B.11 one.
	 */
	let m1Running = $state(false);
	let m1Failure = $state('');
	let m1Record = $state<P23BM1Record | null>(null);
	let m1LadderPixelsPerMeter = $state<number | null>(null);
	/**
	 * The same, for the Room-label arm run: a switch over every class (the placer
	 * runs on every Plan render), so it gets its own flag, its own protocol id
	 * and its own note.
	 */
	let m1LabelArmsRun = $state(false);
	/**
	 * The same again, for the COLD pass (§16): the same classes, the same arms, with
	 * the camera moved between attempts. It runs BOTH workloads in one session, so the
	 * flag marks a record that carries the repeat rows AND the cold rows.
	 */
	let m1ColdLabelArmsRun = $state(false);

	function driveNote(line: string) {
		driveLog = [...driveLog, `${new Date().toISOString().slice(11, 19)} ${line}`];
	}

	async function runScriptedCapture() {
		if (driveRunning || capturing || running) return;
		driveRunning = true;
		driveFailure = '';
		driveLog = [];
		driveStep = 'starting';
		drivePathProgress = {};
		const driver = createP23BCaptureDriver({
			fixtures: () => driveFixtures,
			host: (fixtureId) => hostFixture(fixtureId),
			startCapture: (actionClass) => {
				startCapture(actionClass ?? null);
				if (!captureSessionId) throw new Error('The capture session did not open');
				return captureSessionId;
			},
			stopCapture: () => stopCapture(),
			ledger: (sessionId) => p23bInteractionCaptureLedger(sessionId),
			captureCount: () => captures.length,
			recordFixtureReset: () => p23bRecordFixtureReset(),
			log: driveNote,
			progress: (next) => {
				driveStep = next.step;
				drivePathProgress = next.paths;
			}
		});
		try {
			await driver.run();
			driveNote(`scripted capture complete: ${captures.length} interaction fixture(s) recorded`);
		} catch (error) {
			driveFailure = error instanceof Error ? error.message : String(error);
			driveNote(`FAILED: ${driveFailure}`);
		} finally {
			driveRunning = false;
		}
	}

	async function runP23B6S1Capture() {
		if (driveRunning || capturing || running) return;
		driveRunning = true;
		driveFailure = '';
		driveLog = [];
		driveStep = 'P23B.6 S1 starting';
		drivePathProgress = {};
		(globalThis as typeof globalThis & { __P23B6_S1_IDLE_FRAMES__?: Array<{ fixtureId: string; samples: number[] }> }).__P23B6_S1_IDLE_FRAMES__ = [];
		const driver = createP23BCaptureDriver({
			fixtures: () => driveFixtures,
			host: (fixtureId) => hostFixture(fixtureId),
			startCapture: (actionClass) => {
				startCapture(actionClass ?? null);
				if (!captureSessionId) throw new Error('The S1 capture session did not open');
				return captureSessionId;
			},
			stopCapture: () => stopCapture(),
			ledger: (sessionId) => p23bInteractionCaptureLedger(sessionId),
			captureCount: () => captures.length,
			recordFixtureReset: () => p23bRecordFixtureReset(),
			log: driveNote,
			progress: (next) => {
				driveStep = next.step;
				drivePathProgress = next.paths;
			}
		});
		try {
			await driver.runP23B6S1();
			(globalThis as typeof globalThis & { __P23B6_S1_RECORD__?: unknown }).__P23B6_S1_RECORD__ = measurementRecord();
			driveNote('P23B.6 S1 targeted Plan attribution capture complete');
		} catch (error) {
			driveFailure = error instanceof Error ? error.message : String(error);
			driveNote(`FAILED: ${driveFailure}`);
		} finally {
			driveRunning = false;
		}
	}

	/**
	 * P23B.11 S1/S7 — the focused wall-chain run: the three committed fixtures
	 * plus the generated connected case, two action classes each, on the same S6
	 * protocol as the P23B.6 attribution run.
	 */
	async function runP23B11S1Capture() {
		if (driveRunning || capturing || running) return;
		driveRunning = true;
		driveFailure = '';
		driveLog = [];
		driveStep = 'P23B.11 S1 starting';
		drivePathProgress = {};
		const driver = createP23BCaptureDriver({
		fixtures: () => withConnectedDriveFixtures,
		host: (fixtureId) => hostFixture(fixtureId),
		startCapture: (actionClass) => {
			startCapture(actionClass ?? null);
			if (!captureSessionId) throw new Error('The S1 capture session did not open');
			return captureSessionId;
		},
			stopCapture: () => stopCapture(),
			ledger: (sessionId) => p23bInteractionCaptureLedger(sessionId),
			captureCount: () => captures.length,
			recordFixtureReset: () => p23bRecordFixtureReset(),
			log: driveNote,
			progress: (next) => {
				driveStep = next.step;
				drivePathProgress = next.paths;
			}
		});
		try {
			await driver.runP23B11S1();
			p23b11LadderPixelsPerMeter = driver.ladderPixelsPerMeter();
			(globalThis as typeof globalThis & { __P23B11_S1_RECORD__?: unknown }).__P23B11_S1_RECORD__ =
				p23b11S1Record();
			driveNote(
				`P23B.11 S1 wall-chain capture complete: ${p23b11S1FixturesLabel()} · expected fixture order ${P23B11_S1_FIXTURE_ORDER.join(', ')}`
			);
		} catch (error) {
			driveFailure = error instanceof Error ? error.message : String(error);
			driveNote(`FAILED: ${driveFailure}`);
		} finally {
			driveRunning = false;
		}
	}

	function p23b11S1FixturesLabel(): string {
		return withConnectedDriveFixtures.map((fixture) => fixture.id).join(', ');
	}

	/** The `p2311:` marks observed since the capture cleared them. */
	function readMarks() {
		return performance.getEntriesByType('measure').map((entry) => ({
			name: entry.name,
			startTime: entry.startTime,
			duration: entry.duration
		}));
	}

	function s1Percentile(values: readonly number[], percentile: number): number | null {
		if (values.length === 0) return null;
		const sorted = [...values].sort((a, b) => a - b);
		return sorted[Math.min(sorted.length - 1, Math.ceil((percentile / 100) * sorted.length) - 1)] ?? null;
	}

	function s1Distribution(values: readonly number[]) {
		return { n: values.length, p50Ms: s1Percentile(values, 50), p95Ms: s1Percentile(values, 95) };
	}

	function s1ContainmentByClass(
		fixture: (typeof containmentFixtures)[number],
		path: BenchInteractionPath | null
	) {
		const candidateActions = path === null
			? []
			: fixture.record.actions.filter((action) => action.path === path && action.outcome === 'accepted');
		const measuredActions = candidateActions.slice(INTERACTION_WARMUP);
		const marks = new Map<string, { totals: number[]; self: number[]; selfWithheld: number }>();
		const boundaries = new Map<string, { totals: number[]; self: number[]; selfWithheld: number }>();
		const unbound = new Map<string, number[]>();
		const visit = (nodes: readonly P23BContainmentNode[], onAction: (node: P23BContainmentNode) => void): void => {
			for (const node of nodes) {
				onAction(node);
				visit(node.children, onAction);
			}
		};
		for (const action of measuredActions) {
			visit(action.roots, (node) => {
				const groups = node.kind === 'mark' ? marks : boundaries;
				const entry = groups.get(node.label) ?? { totals: [], self: [], selfWithheld: 0 };
				entry.totals.push(node.total);
				if (node.self === null) entry.selfWithheld += 1;
				else entry.self.push(node.self);
				groups.set(node.label, entry);
			});
			for (const entry of action.unbound) {
				const values = unbound.get(entry.name) ?? [];
				values.push(entry.duration);
				unbound.set(entry.name, values);
			}
		}
		const rows = (source: typeof marks) => Object.fromEntries([...source].map(([label, entry]) => [label, {
			...s1Distribution(entry.totals),
			exclusiveSelf: entry.selfWithheld === 0 && entry.self.length === entry.totals.length
				? s1Distribution(entry.self)
				: null,
			exclusiveSelfWithheld: entry.selfWithheld
		}]));
		return {
			path,
			acceptedActionsIncludingWarmup: candidateActions.length,
			warmupExcluded: Math.min(INTERACTION_WARMUP, candidateActions.length),
			measuredAcceptedActions: measuredActions.length,
			boundaries: rows(boundaries),
			marks: rows(marks),
			unbound: Object.fromEntries([...unbound].map(([name, values]) => [name, s1Distribution(values)]))
		};
	}

	function s1MarkLayer(name: string): 'authoredDocuments' | 'compiledGeometry' | 'preparedMeshes' | 'adapterResources' | 'reactivePresentation' | 'unattributed' {
		const label = name.replace(/^p2311:/, '');
		if (/^(authoring-release|gesture-commit|preview-install|baseline-restore|restore-project-clone|restore-reactive-write)$/.test(label)) return 'authoredDocuments';
		if (/^preview-compile/.test(label)) return 'compiledGeometry';
		if (/mesh/.test(label)) return 'preparedMeshes';
		if (/adapter|^3d-/.test(label)) return 'adapterResources';
		if (/^(plan-render-model|plan-salience|plan-presentation|plan-svg-|svg-attributes)/.test(label)) return 'reactivePresentation';
		return 'unattributed';
	}

	function s1ActionClassRecord(fixture: (typeof containmentFixtures)[number]) {
		if (!fixture.actionClass) return null;
		const actionPathByClass: Record<string, BenchInteractionPath | null> = {
			'p23b6:rigid-wall-drag': 'plan-drag-edit',
			'p23b6:bend': 'bend-knot-edit',
			'p23b6:whole-room-move-bridge': 'plan-drag-edit',
			'p23b6:wall-authoring': 'wall-authoring',
			'p23b6:room-creation-commit': 'wall-authoring',
			'p23b6:persistent-pan-zoom': 'plan-pan-zoom',
			'p23b6:idle-frames': null
		};
		const attribution = s1ContainmentByClass(fixture, actionPathByClass[fixture.actionClass] ?? null);
		const names = Object.keys(attribution.marks);
		const layerNames = ['authoredDocuments', 'compiledGeometry', 'preparedMeshes', 'adapterResources', 'reactivePresentation', 'unattributed'] as const;
		const markLayer = Object.fromEntries(layerNames.map((layer) => [layer, names.filter((name) => s1MarkLayer(name) === layer)]));
		return {
			fixtureId: fixture.fixtureId,
			sessionId: fixture.sessionId,
			actionClass: fixture.actionClass,
			populationRule: 'first five accepted actions excluded within this class; rejected, setup, suppressed, incomplete and unresolved actions excluded from distributions',
			attribution,
			fiveLayerSplit: {
				layerMarkNames: markLayer,
				unattributedRemainder: {
					markNames: markLayer.unattributed,
					unbound: attribution.unbound,
					actionsOutsideBoundaries: fixture.record.marks.unbound,
					marksOutsideActions: fixture.record.unattributed
				}
			},
			containmentRecord: fixture.record
		};
	}

	/**
	 * P23B.11 S1/S7 — the wall-chain release-delay profile record.
	 *
	 * Measurement-only and separate from every baseline: the classes this run
	 * opens are `p23b11:wall-authoring` and `p23b11:room-creation-commit`, and an
	 * action-class session is kept as a containment record (never as a
	 * `captures` entry). Per fixture and class it reports the p50/p95 TOTALS of
	 * every `p2311:` mark inside the accepted actions — the six wall-chain marks
	 * name the split — with exclusive self withheld wherever the enclosed marks
	 * are not provably disjoint (`buildP23BContainment`'s rule), plus the explicit
	 * unattributed remainder. Nothing is summed across nested nodes.
	 */
	function p23b11S1Record() {
		const classes = containmentFixtures
			.filter((entry) => entry.actionClass?.startsWith('p23b11:'))
			.map((entry) => {
				const ledger = p23bInteractionCaptureLedger(entry.sessionId);
				return {
					fixtureId: entry.fixtureId,
					sessionId: entry.sessionId,
					actionClass: entry.actionClass,
					actionPath: 'wall-authoring' as BenchInteractionPath,
					recordedActions: ledger?.actions.length ?? null,
					fixtureResets: ledger?.fixtureResets ?? null,
					droppedBoundaries: ledger?.droppedBoundaries ?? null,
					settled: ledger?.settled ?? null,
					attribution: s1ContainmentByClass(entry, 'wall-authoring'),
					containment: entry.record
				};
			});
		return {
			protocol:
				'P23B.11 S1/S7 wall-chain browser profile; action-class sessions on the S6 protocol (settled, zero dropped boundaries), paths wall-authoring and room-creation-commit, fixtures straight-40 · all-curved-40 · owner-40-curved · connected-curved-grid-v1 (advisory); no baseline and no ratchet is read or written',
			provenance: {
				capturedAt: new Date().toISOString(),
				location: globalThis.location?.href ?? null,
				userAgent: globalThis.navigator?.userAgent ?? null,
				devicePixelRatio: globalThis.devicePixelRatio ?? null,
				markNames: [...new Set(classes.flatMap((entry) => Object.keys(entry.attribution.marks)))].sort(),
				warmupExcludedPerClass: INTERACTION_WARMUP,
				actionsPerClass: DRIVE_ACTIONS_PER_PATH,
				planViewLadderPixelsPerMeter: p23b11LadderPixelsPerMeter
			},
			classes
		};
	}

	/**
	 * Which M1 class a recorded session name belongs to, or `null`.
	 *
	 * TWO prefixes, ONE class list: `p23b-m1:` is the repeat workload and
	 * `p23b-m1-cold:` (§16) the same classes with the camera moved between attempts.
	 * The prefix is STRIPPED against itself, so a class can only ever be found under
	 * the workload whose prefix it carries — the two populations have different rows
	 * and neither can be read as the other's.
	 */
	function m1ClassSpecOf(
		actionClass: string
	): { spec: (typeof P23B_M1_ACTION_CLASSES)[number]; cold: boolean } | null {
		const cold = actionClass.startsWith(P23B_M1_COLD_PREFIX);
		const prefix = cold ? P23B_M1_COLD_PREFIX : P23B_M1_PREFIX;
		if (!actionClass.startsWith(prefix)) return null;
		const spec = P23B_M1_ACTION_CLASSES.find(
			(candidate) => candidate.actionClass === actionClass.slice(prefix.length)
		);
		return spec ? { spec, cold } : null;
	}

	/**
	 * Pre-P23B.8 follow-up M1 — the session's class rows.
	 *
	 * One row per M1 class — the repeat workload's five and, when the cold pass ran,
	 * its five again under the cold prefix — taken over the SAME population the
	 * interaction report uses (completed, resolved path, warm-up slots excluded per
	 * path, accepted only). The gesture REGISTRY is handed to `summarizeM1Class`, not a
	 * pre-merged series: the class's own measured population decides which registered
	 * brackets may be merged, so warm-up drags and retried attempts can never enter a
	 * row that reports the measured class. The long-frame window is looked up by
	 * fixture+class under the same key.
	 */
	function p23bM1ClassRows(): P23BM1ClassRow[] {
		const timing = p23bM1FrameTiming();
		const rows: P23BM1ClassRow[] = [];
		for (const entry of containmentFixtures) {
			const actionClass = entry.actionClass ?? '';
			const resolved = m1ClassSpecOf(actionClass);
			if (!resolved) continue;
			const spec = resolved.spec;
			rows.push(					summarizeM1Class({
						fixtureId: entry.fixtureId,
						sessionId: entry.sessionId,
						actionClass,
						// The cold pass's row is flagged so no table can take it for the
						// repeat class's (the two names differ only in a prefix).
						cold: resolved.cold,
					actionPath: spec.path,
					// The close-time snapshot first, the live lookup only as a fallback:
					// see `m1ClassLedger` and `ContainmentFixtureEntry.ledger`.
					ledger: m1ClassLedger(entry, p23bInteractionCaptureLedger),
					containment: entry.record,
					warmup: INTERACTION_WARMUP,
					actionsPerClass: DRIVE_ACTIONS_PER_PATH,
					gestureRegistry: timing,
					// The class's BEFORE/AFTER arm assignments, or an empty map for a
					// class that ran one path: `summarizeM1Class` turns the empty map
					// into a `null` arms block rather than an empty one.
					actionArms: p23bM1ActionArms(entry.fixtureId, actionClass),
					// The Room-label arm assignments, with the grid-build count each
					// attempt paid for: a DIFFERENT arm over a DIFFERENT population (every
					// class, not one), handed to the record beside the room-drag one so the
					// runner can split its windows by either.
					actionLabelArms: p23bM1ActionLabelArmRecordsFor(entry.fixtureId, actionClass),
					// …and the class's grid-build KEYS, which is what turns the build count
					// into a repeat rate: how many of those builds used inputs the class had
					// already built.
					actionLabelArmKeys: p23bM1GridBuildKeys(entry.fixtureId, actionClass),
					longFrameWindow: p23bM1LongFramesFor(timing, entry.fixtureId, actionClass)
				})
			);
		}
		return rows;
	}

	/**
	 * The M1 record for THIS runtime. The presented-frame section is left as the
	 * labelled `browser-frame` PROXY here; the CDP runner is the only thing that may
	 * replace it with a presentation-grade row, and it says so in the file it writes.
	 */
	function p23bM1Record(
		labelArms = m1LabelArmsRun,
		coldLabelArms = m1ColdLabelArmsRun
	): P23BM1Record {
		return buildP23BM1Record({
			protocol:
				'pre-P23B.8 follow-up M1 — one protocol, one runtime: the three committed fixtures in harness order plus the connected case LAST (advisory, never recorded), five action classes each in its own isolated settled session under the `p23b-m1:` prefix, 25 accepted actions per class with the leading five excluded as warm-up, every mutating action restored with the editor\'s own undo, DEV build, Plan only, one harness document.',
			provenance: {
				capturedAt: new Date().toISOString(),
				mode: 'DEV',
				runtime: browserName(navigator.userAgent).name,
				userAgent: navigator.userAgent,
				viewport: { width: window.innerWidth, height: window.innerHeight },
				devicePixelRatio: window.devicePixelRatio,
				commitSha: data.commitSha,
				treeDirty: data.treeDirty,
				machine: data.machine,
				operatingSystem: data.operatingSystem,
				nodeVersion: data.nodeVersion,
				protocolId: coldLabelArms
					? 'pre-P23B.8-follow-up-M1-cold-label-arms'
					: labelArms
						? 'pre-P23B.8-follow-up-M1-label-arms'
						: 'pre-P23B.8-follow-up-M1',
				protocolRevision: coldLabelArms ? 5 : labelArms ? 4 : 1,
				arms: 'not run — one path per class (P23B.8 S8: the BEFORE/AFTER comparison is retired)',
				labelArms: labelArms
					? 'seeded-grid · no-memo-grid, interleaved per attempt in EVERY class (the Room-label placer runs on every Plan render), recorded per resolved action index — seeded-grid is the SHIPPED path through the placer\'s own bounded candidate cache; no-memo-grid (the SAME grid with that cache BYPASSED) is read against seeded-grid as the reuse delta, from the cache\'s own hit counters; see each class row\'s labelArms block (P23B.8 S8: the pre-change/per-cell and previous/pruned arms are retired)'
					: 'not run — one grid per class',
				coldWorkload: coldLabelArms
					? 'RUN, in the same session as the repeat workload: after each fixture\'s five repeat classes, the SAME five classes run again under the `p23b-m1-cold:` prefix with one pan before every attempt, whose direction advances by the golden angle — a camera walk that never returns to a projection an earlier attempt drew. It is a PAN and not a zoom, so the projected polygon is translated and nothing else: the placer does the same work per action and only the cache key moves, which is what makes the cold pass a controlled read of the reuse rather than a second workload. The camera move is its own ledger action and is deliberately left unassigned to any arm, so its windows are counted as `unassignedWindows` and never merged into a class\'s gesture windows. Read the cold rows as the LOW end of the bracket (a session shape that gives a persistent cache the least) and the `p23b-m1:` rows as the HIGH end (the undo between attempts returns the geometry to a state the previous attempt already drew); the within-settle reuse that generalises sits between them and near the low end.'
					: 'not run — only the repeat workload',
				warmupExcluded: INTERACTION_WARMUP,
				actionsPerClass: DRIVE_ACTIONS_PER_PATH,
				actionGuardMs: DRIVE_ACTION_TIMEOUT_MS,
				fixtureOrder: P23B_M1_FIXTURE_ORDER,
				planViewLadderPixelsPerMeter: m1LadderPixelsPerMeter,
				instrumentation: {
					gestureFrames: '§4.2 (a) — rAF callback intervals bracketed around the drag workloads',
					longFrames: '§4.3 (b2) — long-animation-frame observer, per class window',
					presentedFrame:
						'§4.3 (b1) — added by the CDP runner (presentation-grade) or reported as the browser-frame PROXY'
				}
			},
			classes: p23bM1ClassRows(),
			fixtureOrder: P23B_M1_FIXTURE_ORDER,
			limitations: MEASUREMENT_LIMITATIONS
		});
	}

	function downloadM1Record() {
		const record = m1Record ?? p23bM1Record();
		const blob = new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = 'p23b-m1-record.json';
		anchor.click();
		URL.revokeObjectURL(url);
	}

	/**
	 * Pre-P23B.8 follow-up M1 — the run.
	 *
	 * One driver, one protocol, this runtime. Nothing is written to a baseline: the
	 * five classes it opens are `p23b-m1:`-prefixed action-class sessions, which the
	 * harness keeps as containment records only, and the connected case is advisory.
	 */
	async function runM1Capture(
		labelArms = false,
		coldLabelArms = false
	): Promise<P23BM1Record | null> {
		if (driveRunning || m1Running || capturing || running) return null;
		m1Running = true;
		m1LabelArmsRun = labelArms;
		m1ColdLabelArmsRun = coldLabelArms;
		m1Failure = '';
		m1Record = null;
		driveLog = [];
		driveStep = 'M1 starting';
		drivePathProgress = {};
		const driver = createP23BCaptureDriver({
			fixtures: () => m1DriveFixtures,
			host: (fixtureId) => hostFixture(fixtureId),
			startCapture: (actionClass) => {
				startCapture(actionClass ?? null);
				if (!captureSessionId) throw new Error('The M1 capture session did not open');
				return captureSessionId;
			},
			stopCapture: () => stopCapture(),
			ledger: (sessionId) => p23bInteractionCaptureLedger(sessionId),
			captureCount: () => captures.length,
			recordFixtureReset: () => p23bRecordFixtureReset(),
			log: driveNote,
			progress: (next) => {
				driveStep = next.step;
				drivePathProgress = next.paths;
				(globalThis as typeof globalThis & { __P23B_M1_STATUS__?: unknown }).__P23B_M1_STATUS__ = {
					running: true,
					step: next.step,
					fixtureId: next.fixtureId
				};
			}
		});
		try {
			await driver.runM1(labelArms, coldLabelArms);
			m1LadderPixelsPerMeter = driver.ladderPixelsPerMeter();
			const record = p23bM1Record(labelArms, coldLabelArms);
			m1Record = record;
			(globalThis as typeof globalThis & { __P23B_M1_RECORD__?: unknown }).__P23B_M1_RECORD__ = record;
			(globalThis as typeof globalThis & { __P23B_M1_STATUS__?: unknown }).__P23B_M1_STATUS__ = {
				running: false,
				step: 'M1 complete',
				classes: record.fixtures.reduce((sum, fixture) => sum + fixture.classes.length, 0)
			};
			driveNote(`M1 capture complete: ${record.fixtures.length} fixture(s)`);
			return record;
		} catch (error) {
			m1Failure = error instanceof Error ? error.message : String(error);
			(globalThis as typeof globalThis & { __P23B_M1_STATUS__?: unknown }).__P23B_M1_STATUS__ = {
				running: false,
				step: 'M1 failed',
				failure: m1Failure,
				// The driver's own recent lines, so a failed leg can say WHICH attempt was
				// refused and how — the `repeatPath` retry note names the path and outcome
				// every rejected attempt recorded, which the runner cannot see from here.
				logTail: driveLog.slice(-16)
			};
			driveNote(`M1 FAILED: ${m1Failure}`);
			return null;
		} finally {
			m1Running = false;
		}
	}

	/**
	 * The CDP runner's entry point for this runtime (DEV only). One call runs the
	 * whole M1 protocol on the page; the runner supplies the presentation-grade
	 * clock and the viewport and merges them into the JSON it writes.
	 */
	$effect(() => {
		if (!dev) return;
		const globals = globalThis as typeof globalThis & {
			__P23B_M1_RUN__?: () => Promise<P23BM1Record | null>;
			__P23B_M1_RUN_LABEL_ARMS__?: () => Promise<P23BM1Record | null>;
			__P23B_M1_RUN_LABEL_ARMS_COLD__?: () => Promise<P23BM1Record | null>;
		};
		globals.__P23B_M1_RUN__ = () => runM1Capture();
		globals.__P23B_M1_RUN_LABEL_ARMS__ = () => runM1Capture(true);
		globals.__P23B_M1_RUN_LABEL_ARMS_COLD__ = () => runM1Capture(true, true);
		return () => {
			delete globals.__P23B_M1_RUN__;
			delete globals.__P23B_M1_RUN_LABEL_ARMS__;
			delete globals.__P23B_M1_RUN_LABEL_ARMS_COLD__;
		};
	});

	function downloadP23B11S1Record() {
		const record = (globalThis as typeof globalThis & { __P23B11_S1_RECORD__?: unknown }).__P23B11_S1_RECORD__ ?? p23b11S1Record();
		const blob = new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = 'p23b11-s1-browser-profile.json';
		anchor.click();
		URL.revokeObjectURL(url);
	}

	/**
	 * The measurement-only step's record: containment per fixture plus the
	 * post-release flush/frame distributions the capture already holds. Separate
	 * from the baseline report — nothing here is written to `g3-baseline.json` or
	 * asserted as a budget.
	 */
	function measurementRecord() {
		return {
			note: 'DEV-only measurement record for the P23B measurement-only step. ADVISORY: one machine, one session. NOT the baseline: no budget is asserted, no metric is enforced and g3-baseline.json is neither read nor written here. Every containment number is a per-action distribution or one action tree; nothing in this record may be summed.',
			methodVersion: 5,
			createdAt: new Date().toISOString(),
			provenance: {
				commitSha: data.commitSha,
				treeDirty: data.treeDirty,
				machine: data.machine,
				operatingSystem: data.operatingSystem,
				browser: navigator.userAgent,
				devicePixelRatio: window.devicePixelRatio,
				sessionId: report?.browser.sessionId ?? null
			},
			population: 'Baseline sessions use the interaction report rule. P23B.6 classes exclude the first five accepted actions within each class; accepted outcomes only.',
			fixtures: containmentFixtures.map((fixture) => ({
				fixtureId: fixture.fixtureId,
				sessionId: fixture.sessionId,
				actionClass: fixture.actionClass,
				marks: fixture.record.marks,
				unattributed: fixture.record.unattributed,
				byPath: summarizeContainmentByPath(fixture.record, {
					warmup: INTERACTION_WARMUP,
					outcomes: ['accepted']
				})
			})),
			p23b6S1Attribution: {
				note: 'Separate DEV-only S1 capture sessions by fixture and action class; the actionClass key is measurement metadata and does not alter the P23B baseline ledger/schema. Layer buckets route individual mark names only; nested distributions are never summed. Adapter resources are present as measured terms only if the Plan-only session reaches them.',
				actionClasses: containmentFixtures.map(s1ActionClassRecord).filter((entry) => entry !== null),
				idleFrames: ((globalThis as typeof globalThis & { __P23B6_S1_IDLE_FRAMES__?: Array<{ fixtureId: string; samples: number[] }> }).__P23B6_S1_IDLE_FRAMES__ ?? []).map((entry) => ({
					fixtureId: entry.fixtureId,
					note: 'requestAnimationFrame callback interval only; not presented-frame latency or GPU work',
					...s1Distribution(entry.samples)
				}))
			},
			meshIdentity: {
				note: 'DEV-only identity probe for the commit-time wall-mesh cache miss. `stateProxy` is tested by `structuredClone` throwing a DataCloneError; `sameAsInstall` compares this object against the geometry the last install cached. The full log lives on `globalThis.__P2311_MESH_IDENTITY__`; this record carries the counts and the first 60 rows.',
				total: p2311MeshIdentityRecords().length,
				byPhase: p2311MeshIdentityRecords().reduce<Record<string, number>>((counts, record) => {
					counts[record.phase] = (counts[record.phase] ?? 0) + 1;
					return counts;
				}, {}),
				records: p2311MeshIdentityRecords()
					.slice(0, 60)
					.map((record) => ({ ...record, at: Math.round(record.at * 10) / 10 }))
			},
			postRelease: captures.map((capture) => ({
				fixtureId: capture.fixtureId,
				boundaries: Object.fromEntries(
					(['svelte-flush', 'browser-frame'] as const).map((boundary) => [
						boundary,
						Object.fromEntries(
							Object.entries(capture.interactions).map(([path, report]) => {
								const entry = report?.[boundary];
								return [path, entry && 'accepted' in entry ? entry.accepted ?? null : null];
							})
						)
					])
				)
			}))
		};
	}

	function downloadMeasurementRecord() {
		const blob = new Blob([JSON.stringify(measurementRecord(), null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = 'p23b-measurement-record.json';
		anchor.click();
		URL.revokeObjectURL(url);
	}

	function downloadReport() {
		if (!report) return;
		const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = `p23b-browser-${hostedFixtureId}.json`;
		anchor.click();
		URL.revokeObjectURL(url);
	}
</script>

<svelte:head><title>P23B durable measurement harness</title></svelte:head>

{#if dev}
	{#key `${hostedFixtureId}:${hostedRevision}`}
		<EditorApp projectId={`p23b-host-${hostedFixtureId}`} initialLayout={hosted.document} initialScene={P23B_BENCHMARK_SCENE} />
	{/key}
	<aside class="harness" aria-label="P23B measurement controls">
		<p class="eyebrow">P23B.0 durable</p>
		<h1>Measurement harness</h1>
		<p>Workload sampling: {WARMUP} warm-up + {SAMPLES} measured samples per input. Interaction sampling: {INTERACTION_WARMUP} warm-up + measured actions per path, warm-up excluded in code.</p>
		<button disabled={running} onclick={runMatrix}>{running ? 'Measuring seven fixtures…' : 'Run seven workload baselines'}</button>

		<h2>Hosted interaction fixture</h2>
		{#each HOSTED_FIXTURES as fixture (fixture.id)}
			<button class:active={fixture.id === hostedFixtureId} disabled={capturing || fixture.id === hostedFixtureId} onclick={() => hostFixture(fixture.id)}>
				Host {fixture.label}
			</button>
		{/each}
		<p class="status">Hosting {hosted.id} ({hosted.role}); not applicable: {Object.keys(hosted.notApplicable).join(', ') || 'none'}.</p>
		<button disabled={capturing} onclick={resetHostedFixture}>Re-seed hosted fixture</button>

		<h2>Interaction capture</h2>
		<div class="capture-controls">
			<button disabled={capturing} onclick={() => startCapture()}>Start capture</button>
			<button disabled={!capturing} onclick={stopCapture}>Stop and summarize</button>
		</div>
		<p class="capture-hint">Start capture, repeat each fixed action, then stop. Leave Snap 0.25 m and Grid on. After each authoring action, press “Record fixture reset”.</p>

		<h2>Scripted capture (all hosted fixtures)</h2>
		<p class="capture-hint">
			Runs the fixed protocol on {driveFixtures.length} hosted fixtures in one session: the same target per fixture, the same
			shared px/m ladder, {DRIVE_ACTIONS_PER_PATH} accepted actions per path, each verified against the live ledger, with every
			mutation put back through the editor's own undo before the next action.
		</p>
		<button disabled={capturing || driveRunning || running} onclick={runScriptedCapture}>Run scripted capture</button>
		<h2>P23B.6 S1 targeted attribution</h2>
		<p class="capture-hint">
			One DEV-only Plan capture on the straight, all-curved and owner fixtures. Rigid Wall drag, bend,
			whole-Room move, Wall authoring, Rect Room commit, persistent pan/zoom and idle-frame intervals
			are stored in separate measurement sessions. Each editing action is restored with editor Undo.
		</p>
		<button disabled={capturing || driveRunning || running} onclick={runP23B6S1Capture}>Run P23B.6 S1 attribution capture</button>
		<h2>P23B.11 S1 wall-chain profile</h2>
		<p class="capture-hint">
			The focused wall-chain release profile: the three committed fixtures plus the generated connected
			curved grid (advisory), on the same S6 protocol, measuring only wall authoring and Rect Room
			commit. Its action-class sessions are containment-only and never enter the baseline report.
			Fixtures: {p23b11S1FixturesLabel()}.
		</p>
		<button disabled={capturing || driveRunning || running} onclick={runP23B11S1Capture}>Run P23B.11 S1 wall-chain capture</button>
		{#if (globalThis as { __P23B11_S1_RECORD__?: unknown }).__P23B11_S1_RECORD__}
			<button class="download" onclick={downloadP23B11S1Record}>Download P23B.11 S1 record JSON</button>
		{/if}
		<h2>Pre-P23B.8 M1 (one protocol, this runtime)</h2>
		<p class="capture-hint">
			The follow-up's M1 session: the three committed fixtures in harness order plus the connected case
			last (advisory, never recorded), five action classes each in its own settled session under the
			<code>p23b-m1:</code> prefix — rigid Wall drag, bend, whole-Room move, Wall authoring and Rect Room
			commit. {DRIVE_ACTIONS_PER_PATH} accepted actions per class, leading five excluded as warm-up, every
			mutation restored with editor Undo. The drags carry the gesture-frame series; the long-frame observer
			listens per class. Run it once per runtime; the CDP runner adds the presentation-grade release row.
			No baseline and no ratchet is read or written.
		</p>
		<button disabled={capturing || driveRunning || running || m1Running} onclick={() => runM1Capture()}>
			{m1Running ? 'Running M1…' : 'Run M1 protocol'}
		</button>
		<p class="capture-hint">
			<strong>Room-label arms.</strong> The same protocol again, but the Room-label placer's
			eligibility grid runs two implementations in one session, interleaved per attempt: the shipped
			<code>seeded-grid</code> (through the placer's own bounded candidate cache) and the bypass arm
			<code>no-memo-grid</code> (the same grid with that cache skipped), both reachable behind a DEV-only arm
			switch. (P23B.8 S8: the pre-change and previous grids are retired.) The placer runs on every Plan render, so EVERY class takes these arms — the rows they move are
			the post-release windows, which the CDP runner reports per arm and per class.
		</p>
		<button disabled={capturing || driveRunning || running || m1Running} onclick={() => runM1Capture(true)}>
			{m1Running ? 'Running M1…' : 'Run M1 room-label arms'}
		</button>
		<p class="capture-hint">
			<strong>Room-label arms, cold workload.</strong> The room-label arms again, plus a SECOND pass over the
			same five classes under the <code>p23b-m1-cold:</code> prefix, where one pan is dispatched before every
			attempt with its direction advancing by the golden angle. A pan translates the projected polygon and
			changes nothing else, so the placer does the same work per action and only the cache key moves — which
			makes this a controlled read of the reuse and not a second workload. It brackets the repeat run: the
			undo between attempts is what lets a persistent cache serve the next attempt, and the camera walk takes
			that away. Read the repeat rows as the high end and the cold rows as the low end.
		</p>
		<button disabled={capturing || driveRunning || running || m1Running} onclick={() => runM1Capture(true, true)}>
			{m1Running ? 'Running M1…' : 'Run M1 room-label arms (cold workload)'}
		</button>
		{#if m1Failure}<p class="error">M1 failed: {m1Failure}</p>{/if}
		{#if m1Record}
			<button class="download" onclick={downloadM1Record}>Download M1 record JSON</button>
		{/if}
		{#if driveStep}<p class="status">Driver: {driveStep}</p>{/if}
		{#each Object.entries(drivePathProgress) as [path, progress] (path)}
			<p class="status">{path}: {progress.accepted} accepted of {progress.attempted} attempts</p>
		{/each}
		{#if driveFailure}<p class="error">Driver failed: {driveFailure}</p>{/if}
		{#if driveLog.length > 0}<pre class="drive-log">{driveLog.join('\n')}</pre>{/if}
		<button disabled={!capturing} onclick={() => p23bRecordFixtureReset()}>Record fixture reset</button>

		<h2>Live drag sampling reuse</h2>
		<p class="capture-hint">
			Per direct-edit gesture on the Plan canvas, the bounded gesture-scoped sampler's own counters:
			requests split into cold misses (this store had not served the Wall yet), changed-input refusals
			(an endpoint, traversal or centreline object moved) and hits. Needs the DEV measurement switch
			the capture also uses, and is separate from it: nothing here enters the capture ledger or the
			baseline.
		</p>
		{#if samplingSwitch}
			<button onclick={() => setSamplingSwitch(false)}>Stop watching drag reuse</button>
		{:else}
			<button disabled={capturing} onclick={() => setSamplingSwitch(true)}>Watch drag reuse live</button>
		{/if}
		{#if samplingState.live}
			{@const live = samplingState.live}
			<p class="status">
				gesture {live.gesture}{live.path ? ` · ${live.path}` : ''} · {live.reports} report{live.reports === 1 ? '' : 's'}
				· {live.requests} requests · {live.hits} hits ({percent(live.reuseRatio)}) · {live.coldMisses} cold misses
				· {live.refusals} refusals · {live.entries} retained keys{#if live.failedDerivations > 0} · {live.failedDerivations} failed{/if}{#if live.cachedUndefined > 0} · {live.cachedUndefined} cached-undefined{/if}
			</p>
		{:else}
			<p class="status">No live gesture. With the switch on, drag a Wall, its bend point or a Junction in the Plan canvas.</p>
		{/if}
		{#if samplingState.history.length > 0}
			<button onclick={() => p23bResetGestureSampling()}>Clear readout</button>
			<pre>{JSON.stringify(samplingState.history.slice(-8).map((entry) => ({
				gesture: entry.gesture,
				path: entry.path,
				reports: entry.reports,
				requests: entry.requests,
				hits: entry.hits,
				coldMisses: entry.coldMisses,
				refusals: entry.refusals,
				entries: entry.entries,
				reuse: percent(entry.reuseRatio),
				release: entry.release
			})), null, 2)}</pre>
		{/if}
		<details><summary>Fixed owner actions</summary><pre>{JSON.stringify(hosted.protocol, null, 2)}</pre></details>
		{#if capturing}<p class="status">Capturing {hosted.id} from {captureStartedAt}</p>{/if}
		{#if issue}<p class="error">{issue}</p>{/if}
		{#if lastCaptureNote}<p class="status">{lastCaptureNote}</p>{/if}
		{#if containmentFixtures.length > 0}
			<h2>Action containment (measurement-only step)</h2>
			<p class="capture-hint">
				Every <code>p2311:</code> mark bound to the action and outcome whose boundary interval encloses it.
				Exclusive time is reported only where the enclosed marks are disjoint and fully contained; anything
				outside an action is pooled as unattributed and never guessed into one. Nothing here may be summed.
			</p>
			<pre>{JSON.stringify(containmentFixtures.map((entry) => ({
				fixtureId: entry.fixtureId,
				marks: entry.record.marks,
				unattributed: entry.record.unattributed,
				byPath: summarizeContainmentByPath(entry.record)
			})), null, 2)}</pre>
			<button class="download" onclick={downloadMeasurementRecord}>Download measurement record JSON</button>
		{/if}
		{#if p2311MeshIdentityRecords().length > 0}
			<h2>Mesh identity probe (DEV)</h2>
			<p class="capture-hint">
				Which geometry identity each phase hands in, and whether it is a <code>$state</code> proxy
				(tested by <code>structuredClone</code> throwing). <code>sameAsInstall</code> compares the record
				against the identity the last install cached in <code>derivedWallMeshes</code>.
			</p>
			<pre>{JSON.stringify(p2311MeshIdentityRecords().slice(-25).map((record) => ({ at: Math.round(record.at), phase: record.phase, id: record.geometryId, proxy: record.stateProxy, walls: record.walls, sameAsInstall: record.sameAsInstall, liveId: record.liveId, sameAsLive: record.sameAsLive })), null, 2)}</pre>
		{/if}
		{#if captures.length > 0}
			<h2>Captured fixtures</h2>
			<pre>{JSON.stringify(captures.map((entry) => ({
				fixtureId: entry.fixtureId,
				sessionId: entry.sessionId,
				planView: entry.planView,
				counts: entry.interactionSampleCounts,
				capture: entry.capture
			})), null, 2)}</pre>
		{/if}
		{#if report}
			<button class="download" onclick={downloadReport}>Download baseline JSON</button>
			<p class="status">Recorded {report.methodVersion ? report.workloads.length : 0} workloads and {captures.length} interaction fixtures. Browser: {report.browser.browser?.name} {report.browser.browser?.version}; DPR {report.browser.devicePixelRatio}; {report.browser.graphics?.renderer ?? 'renderer unavailable'}.</p>
		{/if}
	</aside>
{/if}

<style>
	:global(body) { margin: 0; }
	.harness { position: fixed; z-index: 10000; right: 1rem; bottom: 1rem; width: min(25rem, calc(100vw - 2rem)); max-height: min(40rem, calc(100vh - 2rem)); overflow: auto; padding: 1rem; border: 1px solid #62583c; border-radius: .6rem; background: rgb(15 16 20 / .94); color: #eee8d8; box-shadow: 0 12px 42px rgb(0 0 0 / .45); font: 13px/1.45 system-ui, sans-serif; }
	.eyebrow { margin: 0; color: #d9ba71; font-size: .68rem; letter-spacing: .12em; text-transform: uppercase; }
	h1 { margin: .2rem 0 .5rem; font-size: 1rem; }
	h2 { margin: .8rem 0 .3rem; font-size: .85rem; }
	p { margin: .45rem 0; color: #c7c4ba; }
	button { width: 100%; margin-top: .45rem; padding: .5rem .65rem; border: 1px solid #7c6b40; border-radius: .35rem; background: #29261e; color: #f1e6c8; cursor: pointer; font: inherit; }
	button:disabled { opacity: .5; cursor: default; }
	button.active { border-color: #d9ba71; background: #3a3524; }
	.capture-controls { display: grid; grid-template-columns: 1fr 1fr; gap: .45rem; }
	.capture-hint { font-size: .75rem; }
	details { margin-top: .5rem; }
	summary { cursor: pointer; color: #e1d4ad; }
	.status { font-size: .72rem; overflow-wrap: anywhere; }
	.drive-log { max-height: 12rem; overflow: auto; font-size: .68rem; white-space: pre-wrap; }
	.error { color: #ff9c82; }
	pre { max-height: 12rem; overflow: auto; padding: .5rem; background: #090a0d; font-size: .65rem; }
</style>
