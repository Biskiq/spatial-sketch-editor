import type { StageAdapterBinding, StageAdapterContext, StageDomainPick, StagePickQuery } from './stage-facade';

/** A binding supplies exactly one winner, after applying its own policy. */
export type StagePickProvider = {
	readonly adapterId: string;
	readonly binding: StageAdapterBinding;
};

export type StagePickWinner = { readonly adapterId: string; readonly pick: StageDomainPick };

/** Arbitrate only between domain winners. The mark tier remains reserved for S07. */
export function resolveStagePick(
	query: StagePickQuery,
	providers: readonly StagePickProvider[],
	context: StageAdapterContext,
	reading: 'plan' | '3d',
	toolOwner: string | null = null
): StagePickWinner | null {
	const winners: StagePickWinner[] = [];
	for (const { adapterId, binding } of providers) {
		if (query.purpose === 'tool') {
			if (query.tool === null) continue;
			if (query.tool.scope === 'domain' && adapterId !== toolOwner) continue;
			if (query.tool.scope === 'host' && !binding.hostTools?.includes(query.tool.kind)) continue;
		}
		const pick = binding.pick?.(query, context);
		if (pick != null) winners.push({ adapterId, pick });
	}
	if (winners.length === 0) return null;
	// Determine the spatial front first, then apply the tie policy. This avoids
	// order-dependent comparisons when several 3D depths lie within one millimetre.
	const finiteDepth = (depth: number | null): depth is number =>
		depth !== null && Number.isFinite(depth) && depth >= 0;
	const depthWinners = reading === '3d' ? winners.filter(({ pick }) => finiteDepth(pick.depthMeters)) : winners;
	const ranked = depthWinners.length > 0 ? depthWinners : winners;
	const spatial = reading === 'plan'
		? Math.max(...ranked.map(({ pick }) => pick.planLayer ?? -Infinity))
		: Math.min(...ranked.map(({ pick }) => finiteDepth(pick.depthMeters) ? pick.depthMeters : Infinity));
	const tied = ranked.filter(({ pick }) => reading === 'plan'
		? (pick.planLayer ?? -Infinity) === spatial
		: spatial === Infinity || (finiteDepth(pick.depthMeters) && pick.depthMeters <= spatial + 0.001));
	tied.sort((a, b) => a.pick.cssDistance - b.pick.cssDistance || (a.adapterId < b.adapterId ? -1 : a.adapterId > b.adapterId ? 1 : 0));
	return tied[0] ?? null;
}
