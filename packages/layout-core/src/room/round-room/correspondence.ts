/** Operation-local correspondence emitted by C2 Round Room planners. */
export type RoundOperationRoomCorrespondence = {
	readonly roomId: string;
	readonly status: 'preserved' | 'cleared-round' | 'retired';
};

export type RoundOperationWallCorrespondence =
	| {
			readonly kind: 'subdivision';
			readonly sourceWallId: string;
			readonly fragmentWallIds: readonly string[];
	  }
	| {
			readonly kind: 'repack';
			readonly sourceWallIds: readonly string[];
			readonly survivorWallId: string;
	  };

export type RoundOperationJunctionCorrespondence =
	| { readonly kind: 'preserved'; readonly junctionId: string }
	| {
			readonly kind: 'born';
			readonly junctionId: string;
			readonly sourceWallId: string;
			readonly station: number;
	  }
	| { readonly kind: 'retired'; readonly junctionId: string; readonly after: null };

export type RoundOperationOpeningCorrespondence = {
	readonly openingId: string;
	readonly beforeWallId: string;
	readonly afterWallId: string;
};

export type RoundOperationCorrespondence = {
	readonly rooms: readonly RoundOperationRoomCorrespondence[];
	readonly walls: readonly RoundOperationWallCorrespondence[];
	readonly junctions: readonly RoundOperationJunctionCorrespondence[];
	readonly openings: readonly RoundOperationOpeningCorrespondence[];
};
