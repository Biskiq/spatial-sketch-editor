/** Opt-in P23.11 diagnostic marks. The editor enables this only in dev builds. */
let sequence = 0;

export function p2311Measure<T>(name: string, work: () => T): T {
	const viteDev = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV;
	if (viteDev === false || !(globalThis as { __P2311_PERF__?: boolean }).__P2311_PERF__) return work();
	const start = `p2311:${name}:start:${sequence++}`;
	const end = `${start}:end`;
	performance.mark(start);
	try {
		return work();
	} finally {
		performance.mark(end);
		performance.measure(`p2311:${name}`, start, end);
		performance.clearMarks(start);
		performance.clearMarks(end);
	}
}
