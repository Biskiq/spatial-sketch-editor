/**
 * Docker cleanup for one local stack.
 *
 * The runner is injectable so the failure paths are unit-tested without Docker.
 * A nonzero exit is always reported: reset callers keep the persisted state so
 * cleanup can be retried instead of losing the only recovery record.
 */
import { spawnSync } from 'node:child_process';

function defaultDocker(args, { encoding = null } = {}) {
	return spawnSync('docker', args, {
		encoding: encoding ?? undefined,
		stdio: encoding ? ['ignore', 'pipe', 'pipe'] : 'inherit'
	});
}

function failure(label, result) {
	const stderr =
		typeof result?.stderr === 'string' ? result.stderr.trim() : String(result?.stderr ?? '').trim();
	return new Error(`${label} failed with exit ${String(result?.status)}${stderr ? `: ${stderr}` : ''}`);
}

function checked(exec, args, label, options) {
	const result = exec(args, options);
	if (result?.error) throw new Error(`${label} could not run: ${result.error.message}`);
	if (result?.status !== 0) throw failure(label, result);
	return result;
}

function containerIds(stack, exec, all) {
	const listed = checked(
		exec,
		['ps', ...(all ? ['-aq'] : ['-q']), '--filter', `label=com.docker.compose.project=${stack}`],
		'docker ps',
		{ encoding: 'utf8' }
	);
	return String(listed.stdout ?? '')
		.split(/\s+/)
		.filter(Boolean);
}

/** Stop running containers only; the stack's data stays in place. */
export function stopProjectContainers(stack, exec = defaultDocker) {
	const ids = containerIds(stack, exec, false);
	if (ids.length === 0) return 0;
	checked(exec, ['stop', ...ids], 'docker stop');
	return ids.length;
}

/** Remove every container, running or stopped, before volume cleanup. */
export function removeProjectContainers(stack, exec = defaultDocker) {
	const ids = containerIds(stack, exec, true);
	if (ids.length === 0) return;
	checked(exec, ['rm', '-f', ...ids], 'docker rm');
}

/**
 * Remove the two project-scoped volumes. Listing first keeps a missing volume
 * idempotent while still surfacing a real daemon or in-use failure.
 */
export function removeProjectVolumes(stack, exec = defaultDocker) {
	const listed = checked(exec, ['volume', 'ls', '-q'], 'docker volume ls', { encoding: 'utf8' });
	const existing = new Set(
		String(listed.stdout ?? '')
			.split(/\s+/)
			.filter(Boolean)
	);
	const names = [`${stack}_pgdata`, `${stack}_s3data`].filter((name) => existing.has(name));
	if (names.length === 0) return;
	checked(exec, ['volume', 'rm', ...names], 'docker volume rm');
}
