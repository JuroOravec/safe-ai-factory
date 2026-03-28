/**
 * Maps npm `package.json` "name" to a short slug for Docker resources, sandboxes, etc.
 * Scoped packages (`@scope/pkg`) use the unscoped segment only so names stay valid for Docker.
 */
export function npmPackageNameToProjectSlug(packageName: string): string {
  const t = packageName.trim();
  const m = /^@[^/]+\/(.+)$/.exec(t);
  return m ? m[1]! : t;
}
