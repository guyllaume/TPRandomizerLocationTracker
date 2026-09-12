import type { XYPosition } from "@xyflow/react";

export const NODE_DRAG_THRESHOLD = 4;

export interface LocationSelectionChange {
  id: string;
  selected: boolean;
}

export function updateLocationSelection(
  selectedLocationIds: readonly string[],
  locationId: string,
  toggle: boolean,
): string[] {
  if (!toggle) return [locationId];
  if (selectedLocationIds.includes(locationId)) {
    return selectedLocationIds.filter((id) => id !== locationId);
  }
  return [...selectedLocationIds, locationId];
}

export function applyLocationSelectionChanges(
  selectedLocationIds: readonly string[],
  changes: readonly LocationSelectionChange[],
): string[] {
  const nextSelection = new Set(selectedLocationIds);
  for (const change of changes) {
    if (change.selected) {
      nextSelection.add(change.id);
    } else {
      nextSelection.delete(change.id);
    }
  }
  return [...nextSelection];
}

export function locationsMovedByDrag(
  selectedLocationIds: readonly string[],
  draggedLocationId: string,
): string[] {
  return selectedLocationIds.includes(draggedLocationId)
    ? [...selectedLocationIds]
    : [draggedLocationId];
}

export function groupDragPositions(
  startingPositions: Readonly<Record<string, XYPosition>>,
  movedLocationIds: readonly string[],
  draggedLocationId: string,
  draggedPosition: XYPosition,
): Record<string, XYPosition> {
  const draggedStart = startingPositions[draggedLocationId];
  if (!draggedStart) return {};

  const deltaX = draggedPosition.x - draggedStart.x;
  const deltaY = draggedPosition.y - draggedStart.y;
  return Object.fromEntries(movedLocationIds.flatMap((locationId) => {
    const start = startingPositions[locationId];
    return start
      ? [[locationId, { x: start.x + deltaX, y: start.y + deltaY }] as const]
      : [];
  }));
}

export function positionsChanged(
  before: Readonly<Record<string, XYPosition>>,
  after: Readonly<Record<string, XYPosition>>,
  locationIds: readonly string[],
): boolean {
  return locationIds.some((locationId) => {
    const previous = before[locationId];
    const next = after[locationId];
    return previous?.x !== next?.x || previous?.y !== next?.y;
  });
}
