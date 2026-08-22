/** TypeScript-like name grammar used by rendered interface signatures. */
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*(<[A-Za-z0-9_$,\s[\]<>]+>)?(\[\])*$/;

/** True when a value can be rendered as one TypeScript-like signature name. */
export function isSignatureName(value: string): boolean {
  return IDENTIFIER.test(value.trim());
}

/** Returns the exact validation failure for a signature, or undefined when valid. */
export function signatureFailure(
  name: string | undefined,
  accepts: readonly string[] | undefined,
  returns: readonly string[] | undefined,
): string | undefined {
  if (name !== undefined) {
    if (name.trim().length === 0) return 'interface-name-empty';
    if (!isSignatureName(name)) return `interface-name-not-an-identifier:${name}`;
  }
  for (const [role, list] of [['accepts', accepts], ['returns', returns]] as const) {
    for (const entry of list ?? []) {
      if (!isSignatureName(entry)) return `${role}-not-a-type:${entry}`;
    }
  }
  return undefined;
}
