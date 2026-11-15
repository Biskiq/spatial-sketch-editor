import { dev } from '$app/environment';
import { error } from '@sveltejs/kit';

/**
 * E7 is a development bench, not a product route. It is removed before merge;
 * the report keeps the numbers and the commit that reproduced them.
 */
export const load = () => {
	if (!dev) throw error(404, 'Not found');
	return {};
};
