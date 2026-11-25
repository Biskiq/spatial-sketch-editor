import type { FastifyInstance } from 'fastify';

import type { DatabasePool } from '../database.js';
import type { ObjectStore } from '../object-store.js';
import type { ProjectLifecyclePolicy } from '../project-write-lease.js';
import type { TestAuthOptions } from '../test-auth.js';

/** Everything the route families read from the application closure. */
export type RouteDeps = {
	readonly app: FastifyInstance;
	readonly pool: DatabasePool;
	readonly sessionsEnabled: boolean;
	readonly objectStore?: ObjectStore;
	readonly objectNamespace: string;
	readonly lifecyclePolicy: ProjectLifecyclePolicy;
	readonly testAuth?: TestAuthOptions;
	/** Serializes the memory-hard local credential work across requests. */
	readonly authState: { busy: boolean };
};
