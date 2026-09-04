/** Selects one START location, or clears it when the active START is selected again. */
export function toggleStartLocationId(
  currentStartLocationId: string | null,
  locationId: string,
): string | null {
  return currentStartLocationId === locationId ? null : locationId;
}

/**
 * START is a guaranteed warp destination without changing normal portal
 * activation state. A Set prevents duplicate availability when it is also an
 * activated in-game warp.
 */
export function availableWarpDestinationIds(
  activatedWarpLocationIds: Iterable<string>,
  startLocationId: string | null,
): string[] {
  const available = new Set(activatedWarpLocationIds);
  if (startLocationId) available.add(startLocationId);
  return [...available].sort();
}
