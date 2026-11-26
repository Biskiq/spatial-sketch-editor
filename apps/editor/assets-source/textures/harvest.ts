/**
 * T2.S8 F source harvest.
 *
 * Downloads each Core set's 2K lossless source exactly once, from the API and
 * download URLs the acquisition manifest names, and writes a harvest record of
 * byte sizes, provider md5 and sha256 per file. Sources never enter git: they go
 * to `$BISKIQ_MATERIAL_SOURCES` (default `../../../../biskiq-material-sources`
 * beside the repository) under the immutable D2 key layout
 * `materials/<provider>/<assetId>/<file>`, ready for upload to the owner's
 * private retention store.
 *
 * Downloads are untrusted data: every file lands in its own empty directory, a
 * ZIP is listed before extraction and any absolute or `..` member is refused.
 * The User-Agent names the project only; no personal contact detail is sent.
 *
 * Usage: node harvest.ts [setId ...]
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../../../..');
const MANIFEST = join(HERE, 'f-acquisition-manifest.json');
export const SOURCES_ROOT = resolve(
	process.env.BISKIQ_MATERIAL_SOURCES ?? join(REPO, '..', 'biskiq-material-sources')
);
const USER_AGENT = 'biskiq-material-harvest/1.0 (curated CC0 catalogue intake)';
/** Members of an ambientCG 2K-PNG ZIP the derivation reads, by role. */
const ACG_MEMBER_ROLES: readonly [RegExp, string][] = [
	[/_Color\.png$/, 'color'],
	[/_NormalGL\.png$/, 'normal'],
	[/_Roughness\.png$/, 'roughness'],
	[/_AmbientOcclusion\.png$/, 'occlusion'],
	[/_Metalness\.png$/, 'metalness']
];

type HarvestFile = {
	role: string;
	key: string;
	bytes: number;
	sha256: string;
	md5?: string;
	url?: string;
	member?: string;
};

export type HarvestRecord = {
	setId: string;
	provider: string;
	assetId: string;
	acquiredAt: string;
	userAgent: string;
	files: HarvestFile[];
	archive?: HarvestFile;
	zipMembers?: string[];
	reverify: Record<string, unknown>;
};

function digest(bytes: Uint8Array, algorithm: 'sha256' | 'md5'): string {
	return createHash(algorithm).update(bytes).digest('hex');
}

async function fetchBytes(url: string): Promise<Uint8Array> {
	const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
	if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
	return new Uint8Array(await response.arrayBuffer());
}

async function fetchJson(url: string): Promise<any> {
	return JSON.parse(new TextDecoder().decode(await fetchBytes(url)));
}

function keyDir(provider: string, assetId: string): string {
	return join(SOURCES_ROOT, 'materials', provider, assetId);
}

function freshDir(path: string): void {
	if (existsSync(path) && readdirSync(path).length > 0) {
		throw new Error(`${path} is not empty; a source is downloaded once`);
	}
	mkdirSync(path, { recursive: true });
}

async function harvestPolyHaven(set: any, acquiredAt: string): Promise<HarvestRecord> {
	const source = set.source;
	const files = await fetchJson(source.apiFilesUrl);
	const out: HarvestFile[] = [];
	const reverify: Record<string, unknown> = {};
	for (const file of source.source.files) {
		const name = file.url.split('/').pop() as string;
		const live = findPolyHavenFile(files, file.url);
		reverify[name] = live === null ? 'not listed' : { md5: live.md5, size: live.size };
		const expectedMd5 = live?.md5 ?? file.md5;
		const dir = join(keyDir('polyhaven', source.assetId), file.role);
		freshDir(dir);
		const bytes = await fetchBytes(file.url);
		const md5 = digest(bytes, 'md5');
		if (md5 !== expectedMd5) throw new Error(`${name}: md5 ${md5} ≠ ${expectedMd5}`);
		writeFileSync(join(dir, name), bytes);
		out.push({
			role: file.role,
			key: `materials/polyhaven/${source.assetId}/${file.role}/${name}`,
			bytes: bytes.byteLength,
			sha256: digest(bytes, 'sha256'),
			md5,
			url: file.url
		});
	}
	return {
		setId: set.setId,
		provider: 'polyhaven',
		assetId: source.assetId,
		acquiredAt,
		userAgent: USER_AGENT,
		files: out,
		reverify
	};
}

function findPolyHavenFile(node: any, url: string): { md5: string; size: number } | null {
	if (node === null || typeof node !== 'object') return null;
	if (node.url === url && typeof node.md5 === 'string') return { md5: node.md5, size: node.size };
	for (const value of Object.values(node)) {
		const found = findPolyHavenFile(value, url);
		if (found !== null) return found;
	}
	return null;
}

function safeMember(member: string): boolean {
	return member.length > 0 && !isAbsolute(member) && !member.split(/[\\/]/).includes('..');
}

async function harvestAmbientCg(set: any, acquiredAt: string): Promise<HarvestRecord> {
	const source = set.source;
	const api = await fetchJson(source.apiUrl);
	const zip = source.source.zip;
	const name = new URL(zip.url).searchParams.get('file') as string;
	const live = JSON.stringify(api).includes(name)
		? findAcgDownload(api, name)
		: null;
	const base = keyDir('ambientcg', source.assetId);
	const archiveDir = join(base, 'archive');
	freshDir(archiveDir);
	const bytes = await fetchBytes(zip.url);
	if (live !== null && live !== bytes.byteLength) {
		throw new Error(`${name}: ${bytes.byteLength} bytes ≠ API ${live}`);
	}
	const archivePath = join(archiveDir, name);
	writeFileSync(archivePath, bytes);
	const members = execFileSync('unzip', ['-Z1', archivePath], { encoding: 'utf8' })
		.split('\n')
		.filter((line) => line.length > 0);
	const unsafe = members.filter((member) => !safeMember(member));
	if (unsafe.length > 0) throw new Error(`${name}: unsafe members ${unsafe.join(', ')}`);
	const files: HarvestFile[] = [];
	for (const member of members) {
		const match = ACG_MEMBER_ROLES.find(([pattern]) => pattern.test(member));
		if (match === undefined) continue;
		const role = match[1];
		const dir = join(base, role);
		freshDir(dir);
		execFileSync('unzip', ['-q', '-j', archivePath, member, '-d', dir]);
		const file = member.split('/').pop() as string;
		const data = readFileSync(join(dir, file));
		files.push({
			role,
			key: `materials/ambientcg/${source.assetId}/${role}/${file}`,
			bytes: data.byteLength,
			sha256: digest(data, 'sha256'),
			member
		});
	}
	if (!files.some((file) => file.role === 'normal')) {
		throw new Error(`${name}: no *_NormalGL.png member`);
	}
	return {
		setId: set.setId,
		provider: 'ambientcg',
		assetId: source.assetId,
		acquiredAt,
		userAgent: USER_AGENT,
		archive: {
			role: 'archive',
			key: `materials/ambientcg/${source.assetId}/archive/${name}`,
			bytes: bytes.byteLength,
			sha256: digest(bytes, 'sha256'),
			url: zip.url
		},
		zipMembers: members,
		files,
		reverify: { zipBytesManifest: zip.bytes, zipBytesApi: live }
	};
}

function findAcgDownload(node: any, name: string): number | null {
	if (node === null || typeof node !== 'object') return null;
	const values = Object.values(node) as any[];
	if (values.some((value) => typeof value === 'string' && value.includes(name))) {
		const size = node.size ?? node.fileSize ?? node.bytes;
		if (typeof size === 'number') return size;
	}
	for (const value of values) {
		const found = findAcgDownload(value, name);
		if (found !== null) return found;
	}
	return null;
}

async function main(): Promise<void> {
	const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
	const wanted = new Set(process.argv.slice(2));
	const sets = (manifest.assetSets as any[]).filter((set) =>
		wanted.size === 0 ? set.tier === 'core' : wanted.has(set.setId)
	);
	const acquiredAt = new Date().toISOString().slice(0, 10);
	mkdirSync(join(SOURCES_ROOT, 'records'), { recursive: true });
	for (const set of sets) {
		const recordPath = join(SOURCES_ROOT, 'records', `${set.setId}.harvest.json`);
		if (existsSync(recordPath)) {
			console.log(`${set.setId}: already harvested`);
			continue;
		}
		const record =
			set.source.provider === 'polyhaven'
				? await harvestPolyHaven(set, acquiredAt)
				: await harvestAmbientCg(set, acquiredAt);
		writeFileSync(recordPath, `${JSON.stringify(record, null, '\t')}\n`);
		console.log(`${set.setId}: ${record.files.length} files`);
	}
}

if (import.meta.url === `file://${process.argv[1]}`) {
	await main();
}
