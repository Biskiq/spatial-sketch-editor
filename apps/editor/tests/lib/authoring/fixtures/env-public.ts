/**
 * `$env/dynamic/public` test double for mounted-route tests. The persistence
 * client is mocked in the suite, so the origin is only a non-empty value.
 */
export const env = { PUBLIC_API_ORIGIN: 'http://api.test' } as Record<string, string | undefined>;
