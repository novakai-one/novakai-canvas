/** TypeScript-like name grammar used by rendered interface signatures. */
import type { PortAnchor } from './records.ts';

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*(<[A-Za-z0-9_$,\s[\]<>]+>)?(\[\])*$/;
const PORT_HANDLE = /^method:(top|right|bottom|left):(0|[1-9]\d*)$/;

/** Stable React Flow handle identity for one durable method anchor. */
export function portHandleId(anchor: PortAnchor): `method:${PortAnchor['side']}:${number}` {
  return `method:${anchor.side}:${anchor.ordinal}`;
}

/** Reads a named method handle without teaching UI code its storage syntax. */
export function portAnchorFromHandle(handle: string | null | undefined): PortAnchor | undefined {
  const match = handle ? PORT_HANDLE.exec(handle) : null;
  return match ? { side: match[1] as PortAnchor['side'], ordinal: Number(match[2]) } : undefined;
}

/** Stable along-edge position that never hides beneath the ordinary centre handle. */
export function portAxisFraction(ordinal: number, methodCount: number): number {
  const count = Math.max(methodCount, ordinal + 1);
  const fraction = (ordinal + 1) / (count + 1);
  return fraction === 0.5 ? fraction - Math.min(0.15, 1 / (2 * (count + 1))) : fraction;
}

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
