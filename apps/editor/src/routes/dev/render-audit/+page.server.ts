import { dev } from '$app/environment';
import { error } from '@sveltejs/kit';

/**
 * The render audit is a development bench, not a product route.
 * It is retained only while S0 re-runs need it; see the Gate A report.
 */
export const load = () => {
  if (!dev) throw error(404, 'Not found');
  return {};
};
