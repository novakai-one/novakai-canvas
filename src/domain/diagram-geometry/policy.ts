/** Private geometry constants shared by placement and routing. */

/** Straight run out of an endpoint before the first possible bend. */
export const ENDPOINT_EGRESS = 22;

/** Air maintained between a detour and a node body. */
export const OBSTACLE_CLEARANCE = 14;

/** Coordinate difference below which a route reads as aligned rather than as a deliberate jog. */
export const ROUTE_ALIGNMENT_TOLERANCE = 1;

/** Screen-independent diagram distance within which manual route guides attract a segment. */
export const ROUTE_SNAP_DISTANCE = 8;

/**
 * Minimum edge-to-edge room for two facing connected siblings.
 *
 * Each endpoint receives its egress plus clearance, so the line and arrow never have to double
 * back into either card. Authored container gap remains a lower bound above this policy.
 */
export function minimumConnectionSeparation(): number {
  return (ENDPOINT_EGRESS + OBSTACLE_CLEARANCE) * 2;
}
