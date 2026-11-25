/**
 * One process, one build: every API contract file loads here and node:test
 * drains the shared root. Files register top-level tests and own their pools
 * and schemas, so import order carries no state.
 */
import './health-config-shutdown.test.mjs';
import './auth-session-origin.test.mjs';
import './projects.test.mjs';
import './project-write-lease.test.mjs';
import './project-lifecycle.test.mjs';
import './save.test.mjs';
import './save-units.test.mjs';
import './model-resources.test.mjs';
import './form-library.test.mjs';
import './material-library.test.mjs';
import './assets.test.mjs';
import './asset-repair.test.mjs';
import './migration.test.mjs';
import './migration-fence.test.mjs';
import './r2-purge.test.mjs';
import './publication.test.mjs';
import './test-auth.test.mjs';
