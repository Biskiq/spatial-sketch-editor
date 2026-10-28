/** A typed geometry-core refusal carrying the profile issues that caused it. */
import type { ProfileIssue } from './profile';

export class GeometryCoreError extends Error {
  readonly issues: readonly ProfileIssue[];

  constructor(message: string, issues: readonly ProfileIssue[] = []) {
    super(message);
    this.name = 'GeometryCoreError';
    this.issues = issues;
  }
}
