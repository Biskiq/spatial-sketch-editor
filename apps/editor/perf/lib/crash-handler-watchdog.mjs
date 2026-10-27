#!/usr/bin/env node
/**
 * Crash-handler watchdog for one bench pass (T1.P02.S06).
 *
 *   node perf/lib/crash-handler-watchdog.mjs <log> [<pid> …]   # pids present at the pass start
 *   node perf/lib/crash-handler-watchdog.mjs --once <log> [<pid> …]
 *
 * Branded Chrome's `chrome_crashpad_handler` can outlive a heavy session's
 * browser while still holding the browser's stderr, a socket to the Playwright
 * worker, so the worker never exits after its last test. Every 15 s this stops
 * only such orphans: a handler re-parented to launchd, not among the pids
 * present at the pass start, whose stderr is a Unix socket, at a moment when no
 * Playwright-launched Chrome (`--remote-debugging-pipe`) is running. The
 * owner's own Chrome keeps its handler (present at start, stderr /dev/null).
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

const args = process.argv.slice(2);
const once = args[0] === '--once';
const [logPath, ...startPids] = once ? args.slice(1) : args;
const preexisting = new Set(startPids);

function sh(command, commandArgs) {
	try {
		return execFileSync(command, commandArgs, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
	} catch {
		return '';
	}
}

function sweep() {
	const rows = sh('ps', ['-Ao', 'pid=,ppid=,command='])
		.split('\n')
		.map((line) => /^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(line))
		.filter((match) => match !== null);
	if (rows.some((row) => row[3].includes('Google Chrome') && row[3].includes('--remote-debugging-pipe'))) return;
	for (const [, pid, ppid, command] of rows) {
		if (ppid !== '1' || !command.includes('chrome_crashpad_handler') || preexisting.has(pid)) continue;
		if (!/\bunix\b/.test(sh('lsof', ['-a', '-p', pid, '-d', '2']))) continue;
		try {
			process.kill(Number(pid), 'SIGTERM');
			appendFileSync(logPath, `${new Date().toISOString()} stopped orphaned Chrome crash handler ${pid}\n`);
		} catch {
			// already gone
		}
	}
}

sweep();
if (!once) setInterval(sweep, 15_000);
