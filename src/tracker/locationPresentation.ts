import type { LocationNodeData } from "../types/tracker";

type LocationFocusState = LocationNodeData["focusState"];

const EXPANDED_FOCUS_STATES: ReadonlySet<LocationFocusState> = new Set([
  "selected",
  "related",
  "warp-route",
  "warp-destination",
]);

/**
 * Cleared is persistent player state. Expansion is transient presentation
 * derived from how relevant the card is to the current focus interaction.
 */
export function deriveLocationPresentation(
  cleared: boolean,
  focusState: LocationFocusState,
): LocationNodeData["presentation"] {
  return !cleared || EXPANDED_FOCUS_STATES.has(focusState) ? "expanded" : "minimized";
}

export function toggleClearedLocationId(
  clearedLocationIds: readonly string[],
  locationId: string,
): string[] {
  return clearedLocationIds.includes(locationId)
    ? clearedLocationIds.filter((id) => id !== locationId)
    : [...clearedLocationIds, locationId].sort();
}
