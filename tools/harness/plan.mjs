import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const SHA = /^[0-9a-f]{40}$/;
const EDITOR = 'apps/editor/';
const PROFILES = ['minimal', 'focused', 'full'];
const PROTECTED_TEST = /\.(?:test\.(?:ts|mjs|js)|spec\.(?:ts|js))$/;
const CONFIG = /(?:^|\/)(?:\.[^/]+|[^/]*config[^/]*|package(?:-lock)?\.json|Dockerfile[^/]*)$/i;
const CRITICAL = /(?:^|[\/.-])(?:auth|security|login|session|persist\w*|serializ\w*|schema|contract|kernel|geometry|topology|native-form|boundary|release|publication|save)(?=[\/.-]|$)/i;
const DOCS = /^(?:(?:docs|broad-research|Repo-Audit)\/.*\.md|(?:README|CONTRIBUTING)\.md)$/i;

function git(...args) {
	return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
}

// A deliberately narrow proof: one plain, terminal style block and identical
// bytes outside it. Refuse angle brackets in the body, preprocessors, and
// changes to CSS that can introduce new resource dependencies.
function simpleStyle(source) {
	return !/@import\b|url\s*\(|\\/i.test(source);
}

export function styleOnly(before, after) {
	const block = /^(?<prefix>[\s\S]*\n)<style>(?<css>[^<]*)<\/style>(?<suffix>\s*)$/;
	const a = block.exec(before)?.groups;
	const b = block.exec(after)?.groups;
	return Boolean(a && b && a.prefix === b.prefix && a.suffix === b.suffix &&
		!/<\/?style\b/i.test(a.prefix) && simpleStyle(a.css) && simpleStyle(b.css));
}

function fileProfile({ path, status, oldMode, newMode }, read) {
	if ([oldMode, newMode].some((mode) => !['000000', '100644'].includes(mode))) return 'full';
	if (PROTECTED_TEST.test(path) || CONFIG.test(path) ||
		/^(?:docs\/(?:README|workflow)\.md|focus\.md|AGENTS\.md)$/i.test(path)) return 'full';
	if (DOCS.test(path)) return 'minimal';
	if (!/^apps\/editor\/(?:src|static)\//.test(path)) return 'full';
	if (path.endsWith('.css') && status !== 'D' && (path.startsWith(EDITOR + 'static/') ||
		simpleStyle(read('head', path)) && (status === 'A' || simpleStyle(read('base', path))))) {
		return 'minimal';
	}
	if (path.endsWith('.svelte') && status === 'M' && styleOnly(read('base', path), read('head', path))) {
		return 'minimal';
	}
	if (/^apps\/editor\/src\/(?:lib\/(?:layout|platform|visitor|types|museum\/layout|authoring\/(?:f4|layout|adapters|project-session))\/|routes\/p\/|hooks\.)/.test(path) ||
		CRITICAL.test(path) || /\.(?:json|wasm|sql|ya?ml|toml)$/.test(path)) return 'full';
	return 'focused';
}

export function createPlan(eventName, event, head) {
	if (!SHA.test(head ?? '') || git('rev-parse', 'HEAD').trim() !== head) {
		throw new Error('checkout does not match the tested SHA');
	}
	if (['schedule', 'workflow_dispatch'].includes(eventName)) return { profile: 'full', head };
	const group = eventName === 'merge_group';
	if (!group && eventName !== 'pull_request') throw new Error('unsupported CI event');
	const base = group ? event.merge_group?.base_sha : event.pull_request?.base?.sha;
	if (!SHA.test(base ?? '') || (group && event.merge_group?.head_sha !== head)) {
		throw new Error('invalid event comparison SHAs');
	}
	git('merge-base', '--is-ancestor', base, head);
	// Disable rename detection so the previous path is always classified as well.
	const fields = git('diff', '--raw', '--no-renames', '-z', base, head).split('\0');
	if (fields.pop() !== '' || fields.length % 2 !== 0) throw new Error('unreadable git delta');
	const changes = [];
	for (let i = 0; i < fields.length; i += 2) {
		const match = /^:(\d{6}) (\d{6}) [\da-f]+ [\da-f]+ ([AMDT])$/.exec(fields[i]);
		const path = fields[i + 1];
		if (!match || !path || path.includes('\uFFFD')) throw new Error('unreadable changed path or mode');
		const [, oldMode, newMode, status] = match;
		const profile = fileProfile({ path, status, oldMode, newMode },
			(side, file) => git('show', `${side === 'base' ? base : head}:${file}`));
		changes.push({ path, profile });
	}
	const profile = PROFILES.findLast((level) => changes.some((change) => change.profile === level)) ?? 'minimal';
	return { profile, head, base, changes };
}

export function eventPlan() {
	return createPlan(process.env.GITHUB_EVENT_NAME,
		JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')), process.env.GITHUB_SHA);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const plan = eventPlan();
	console.log(JSON.stringify(plan, null, 2));
	appendFileSync(process.env.GITHUB_OUTPUT, `profile=${plan.profile}\nbase=${plan.base ?? ''}\n`);
}
