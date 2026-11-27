/**
 * Immutable shipped-model byte pins and the append-only pin ledger.
 *
 * One shipped id names one byte revision forever. A pin records the exact
 * production GLB digest and size; a typed `asset` resource's content revision is
 * `sha256-${sha256}`. Reprocessing an asset ships a new id, file and pin — it
 * never repoints an existing id.
 *
 * `SHIPPED_MODEL_PINS` is the machine-checked baseline; the committed
 * `shipped-model-pins.json` ledger is the regression guard that refuses a changed
 * or removed pin. Both are compared by `shippedModelPinLedgerIssues`.
 */

/** One shipped model's exact production bytes. */
export type ShippedModelPin = {
	/** Lowercase hex digest without the `sha256-` prefix. */
	readonly sha256: string;
	readonly byteSize: number;
	readonly mime: 'model/gltf-binary';
};

/** The committed pin ledger's format version. */
export const SHIPPED_MODEL_PIN_LEDGER_VERSION = 1 as const;

const SHA256_HEX = /^[0-9a-f]{64}$/;

/** The exact production bytes of every pinned shipped model, by asset id. */
export const SHIPPED_MODEL_PINS = {
	'paris-grand-piano': {
		sha256: 'a360b6fcbad835f5b82fe0ba7d347538695230974d27767483a4d6fd4a08d660',
		byteSize: 245788,
		mime: 'model/gltf-binary',
	},
	'paris-salon-chair': {
		sha256: '480698dafa0c4d17960db4d218e7db462a327ea86a8e7d22a8f49fb25ab6ff9e',
		byteSize: 298300,
		mime: 'model/gltf-binary',
	},
	'paris-salon-sofa': {
		sha256: 'a16592847a589c3edd658f076845f9bae4b53c299f3740822f27c77a6798eb9b',
		byteSize: 307128,
		mime: 'model/gltf-binary',
	},
	'paris-salon-table': {
		sha256: '454a5a35caa3fd49e4173e029f634d342d92be4a54ea0bb422e7c4ae2bae3cd0',
		byteSize: 198956,
		mime: 'model/gltf-binary',
	},
	'paris-chandelier': {
		sha256: '83e188c2179e8aa15a2ae87d46c8ab62a0cdc824d184903f8b25d3c2fb8e2fde',
		byteSize: 567424,
		mime: 'model/gltf-binary',
	},
	'paris-table-lamp': {
		sha256: 'c093a2d3b32e5f2e1be71a7efe8a5109c384735d06a789bac7af2a8251553fc2',
		byteSize: 264424,
		mime: 'model/gltf-binary',
	},
	'paris-grandfather-clock': {
		sha256: 'c44bfabd45da819470038502130b56f7bc6863daaadc0d48909c9d14e6361420',
		byteSize: 532884,
		mime: 'model/gltf-binary',
	},
} as const satisfies Record<string, ShippedModelPin>;

/** The one content-revision form a typed `asset` resource pins. */
export function shippedModelContentRevision(pin: ShippedModelPin): string {
	return `sha256-${pin.sha256}`;
}

function samePin(left: ShippedModelPin, right: ShippedModelPin): boolean {
	return (
		left.sha256 === right.sha256 && left.byteSize === right.byteSize && left.mime === right.mime
	);
}

/**
 * Compare the current registry and ledger with the baseline landed on the base
 * branch (read from git, never from the working tree).
 *
 * This is the independent append-only guard: even if a change updates the
 * registry, the ledger and the production bytes together, an existing baseline
 * id must still exist with the same pin and a production file, and the current
 * ledger must still carry that pin. New ids may be appended; baseline ids may
 * never be removed, repointed or downgraded to fallback-only.
 */
export function shippedModelPinBaselineIssues(
	baseline: unknown,
	registry: readonly {
		readonly assetId: string;
		readonly pin: ShippedModelPin | null;
		readonly productionFile?: string | null;
		readonly fallbackOnly?: boolean;
	}[],
	ledger: unknown,
): string[] {
	if (typeof baseline !== 'object' || baseline === null || Array.isArray(baseline)) {
		return ['baseline:not-an-object'];
	}
	const record = baseline as { readonly models?: unknown };
	if (typeof record.models !== 'object' || record.models === null || Array.isArray(record.models)) {
		return ['baseline:models-not-an-object'];
	}
	const ledgerRecord =
		typeof ledger === 'object' && ledger !== null && !Array.isArray(ledger)
			? (ledger as { readonly models?: unknown })
			: null;
	const ledgerModels =
		typeof ledgerRecord?.models === 'object' &&
		ledgerRecord.models !== null &&
		!Array.isArray(ledgerRecord.models)
			? (ledgerRecord.models as Record<string, unknown>)
			: null;
	const registryById = new Map(registry.map((entry) => [entry.assetId, entry]));
	const issues: string[] = [];
	if (ledgerModels === null) issues.push('baseline:ledger-not-an-object');
	for (const [assetId, value] of Object.entries(record.models as Record<string, unknown>)) {
		const baselinePin = value as Partial<ShippedModelPin> | null;
		if (
			typeof baselinePin !== 'object' ||
			baselinePin === null ||
			typeof baselinePin.sha256 !== 'string' ||
			!SHA256_HEX.test(baselinePin.sha256) ||
			baselinePin.mime !== 'model/gltf-binary' ||
			!Number.isSafeInteger(baselinePin.byteSize) ||
			(baselinePin.byteSize ?? 0) <= 0
		) {
			issues.push(`baseline:malformed-pin:${assetId}`);
			continue;
		}
		const entry = registryById.get(assetId);
		if (entry === undefined) {
			issues.push(`baseline:missing-registry:${assetId}`);
		} else if (entry.pin === null) {
			issues.push(`baseline:fallback-only:${assetId}`);
		} else if (!samePin(entry.pin, baselinePin as ShippedModelPin)) {
			issues.push(`baseline:changed-registry-pin:${assetId}`);
		}
		if (entry !== undefined && (entry.productionFile === null || entry.fallbackOnly === true)) {
			issues.push(`baseline:missing-production-file:${assetId}`);
		}
		if (ledgerModels === null) continue;
		if (!Object.hasOwn(ledgerModels, assetId)) {
			issues.push(`baseline:missing-ledger:${assetId}`);
			continue;
		}
		const ledgerPin = ledgerModels[assetId] as Partial<ShippedModelPin>;
		if (
			ledgerPin.sha256 !== baselinePin.sha256 ||
			ledgerPin.byteSize !== baselinePin.byteSize ||
			ledgerPin.mime !== baselinePin.mime
		) {
			issues.push(`baseline:changed-ledger-pin:${assetId}`);
		}
	}
	return issues;
}

/**
 * Compare a committed pin ledger with the registry.
 *
 * The registry is append-only: every ledger pin must still name the same
 * registry entry and the same bytes, every pinned registry entry must be in the
 * ledger, and a fallback-only entry may not gain a pin. A newly appended entry
 * passes. Findings are stable strings so a test can assert exactly which rule
 * failed.
 */
export function shippedModelPinLedgerIssues(
	ledger: unknown,
	registry: readonly {
		readonly assetId: string;
		readonly pin: ShippedModelPin | null;
	}[],
): string[] {
	const issues: string[] = [];
	if (typeof ledger !== 'object' || ledger === null || Array.isArray(ledger)) {
		return ['ledger:not-an-object'];
	}
	const record = ledger as { readonly formatVersion?: unknown; readonly models?: unknown };
	if (record.formatVersion !== SHIPPED_MODEL_PIN_LEDGER_VERSION) {
		issues.push('ledger:unsupported-format-version');
	}
	if (typeof record.models !== 'object' || record.models === null || Array.isArray(record.models)) {
		issues.push('ledger:models-not-an-object');
		return issues;
	}
	const models = record.models as Record<string, unknown>;
	const byId = new Map(registry.map((entry) => [entry.assetId, entry]));
	for (const [assetId, value] of Object.entries(models)) {
		const entry = byId.get(assetId);
		if (entry === undefined) {
			issues.push(`ledger:unknown-pin:${assetId}`);
			continue;
		}
		if (entry.pin === null) {
			issues.push(`ledger:fallback-only-pin:${assetId}`);
			continue;
		}
		const pin = value as Partial<ShippedModelPin> | null;
		if (
			typeof pin !== 'object' ||
			pin === null ||
			typeof pin.sha256 !== 'string' ||
			!SHA256_HEX.test(pin.sha256) ||
			pin.mime !== 'model/gltf-binary' ||
			!Number.isSafeInteger(pin.byteSize) ||
			(pin.byteSize ?? 0) <= 0
		) {
			issues.push(`ledger:malformed-pin:${assetId}`);
			continue;
		}
		if (
			pin.sha256 !== entry.pin.sha256 ||
			pin.byteSize !== entry.pin.byteSize ||
			pin.mime !== entry.pin.mime
		) {
			issues.push(`ledger:changed-pin:${assetId}`);
		}
	}
	for (const entry of registry) {
		if (entry.pin !== null && !Object.hasOwn(models, entry.assetId)) {
			issues.push(`ledger:missing-pin:${entry.assetId}`);
		}
	}
	return issues;
}
