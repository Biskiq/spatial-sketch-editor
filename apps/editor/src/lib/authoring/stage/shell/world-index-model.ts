import type { LayoutUnitPayload } from '@portfolio/project-model/units';
/** A navigation projection only. It never changes source, selection or Camera. */
export type WorldScope = 'project' | 'free' | `room:${string}`;
export type WorldIndexItem = {
	sourceId: string;
	label: string;
	authored: boolean;
	kind: string;
	eligible: boolean;
	revealed: boolean;
	membership: string;
	group: string;
	context?: WorldScope;
	relations: readonly string[];
};
export type WorldIndexModel = ReturnType<ReturnType<typeof createWorldIndexModel>>;
export function createWorldIndexModel() {
	let previous: LayoutUnitPayload | null | undefined;
	let relations:
		| {
				roomsByWall: Map<string, string[]>;
				openingHosts: Map<string, string>;
				objectRooms: Map<string, string>;
		  }
		| undefined;
	return function worldIndexModel(
		layout: LayoutUnitPayload | null,
		items: readonly Omit<WorldIndexItem, 'relations' | 'context'>[],
		projectName: string,
		sceneRooms: ReadonlyMap<string, string> = new Map()
	) {
		const contexts = [
			{ id: 'project' as WorldScope, label: projectName, parent: null as WorldScope | null }
		];
		if (layout) {
			contexts.push({ id: 'free', label: 'Free objects', parent: 'project' });
			for (const room of layout.rooms)
				contexts.push({ id: `room:${room.id}`, label: room.name || 'Room', parent: 'project' });
		}
		if (layout !== previous || relations === undefined) {
			const roomsByWall = new Map<string, string[]>();
			for (const room of layout?.rooms ?? [])
				for (const ref of room.boundary)
					roomsByWall.set(ref.wallId, [...(roomsByWall.get(ref.wallId) ?? []), room.id]);
			const openingHosts = new Map(layout?.openings.map((o) => [o.id, o.wallId]) ?? []);
			const objectRooms = new Map(
				layout?.objects.filter((o) => o.roomId).map((o) => [o.id, o.roomId!]) ?? []
			);
			relations = { roomsByWall, openingHosts, objectRooms };
			previous = layout;
		}
		const { roomsByWall, openingHosts, objectRooms } = relations;
		const rows: WorldIndexItem[] = items.map((item) => {
			const relations: string[] = [];
			let context: WorldScope | undefined;
			if (item.sourceId.startsWith('layout:')) {
				const [, kind, ...tail] = item.sourceId.split(':');
				const id = tail.join(':');
				if (kind === 'room-floor' || kind === 'room') {
					context = `room:${id}`;
					relations.push(`room:${id}`);
				}
				if (kind === 'wall')
					for (const roomId of roomsByWall.get(id) ?? []) relations.push(`room:${roomId}`);
				if (kind === 'opening') {
					const host = openingHosts.get(id);
					if (host) {
						relations.push(`layout:wall:${host}`);
						for (const roomId of roomsByWall.get(host) ?? []) relations.push(`room:${roomId}`);
					}
				}
				if (kind === 'object') {
					const roomId = objectRooms.get(id);
					if (roomId && layout?.rooms.some(room => room.id === roomId)) relations.push(`room:${roomId}`);
					else relations.push('free');
				}

			}
			if (item.sourceId.startsWith('scene:entity:')) {
				const room = sceneRooms.get(item.sourceId.slice('scene:entity:'.length));
				if (room && layout?.rooms.some(candidate => candidate.id === room)) relations.push(`room:${room}`);
				else relations.push('free');
			}
			return { ...item, context, relations };
		});
		return { contexts, rows };
	};
}
export const worldIndexModel = createWorldIndexModel();
export function resolveWorldScope(model: WorldIndexModel, scope: WorldScope): WorldScope {
	return model.contexts.some((c) => c.id === scope)
		? scope
		: 'project';
}
export function worldScopeRows(
	model: WorldIndexModel,
	scope: WorldScope,
	facet: string,
	query: string,
	limit = 40
) {
	const needle = query.trim().toLowerCase();
	const rows = model.rows.filter(
		(row) =>
			(scope === 'project' || row.relations.includes(scope)) && row.context !== scope &&
			(facet === 'all' || row.group === facet || (facet === 'objects' && (row.group === 'object' || row.group === 'scene'))) &&
			(!needle || `${row.label} ${row.kind} ${row.sourceId}`.toLowerCase().includes(needle))
	);
	// All at project/Floor shows Rooms and loose subjects; explicit facets flatten the scope.
	const visible =
		facet === 'all' && !needle && !scope.startsWith('room:')
			? rows.filter((row) => row.context || !row.relations.some((r) => r.startsWith('room:')))
			: rows;
	return { rows: visible.slice(0, limit), total: visible.length };
}
