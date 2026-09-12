import type { LocationKind } from "../types/tracker";

export interface MinimapLocationKindPresentation {
  kind: LocationKind;
  label: string;
  color: string;
}

export const MINIMAP_LOCATION_KINDS: readonly MinimapLocationKindPresentation[] = [
  { kind: "overworld", label: "World", color: "var(--minimap-overworld)" },
  { kind: "cave", label: "Cave", color: "var(--minimap-cave)" },
  { kind: "grotto", label: "Grotto", color: "var(--minimap-grotto)" },
  { kind: "dungeon", label: "Dungeon", color: "var(--minimap-dungeon)" },
  { kind: "interior", label: "Indoor", color: "var(--minimap-interior)" },
  { kind: "boss-room", label: "Boss room", color: "var(--minimap-boss-room)" },
];

const minimapPresentationByKind = new Map(
  MINIMAP_LOCATION_KINDS.map((presentation) => [presentation.kind, presentation]),
);

export function minimapLocationKindPresentation(
  kind: LocationKind,
): MinimapLocationKindPresentation {
  return minimapPresentationByKind.get(kind) ?? MINIMAP_LOCATION_KINDS[0];
}

export function minimapLocationMarkers(
  locationId: string,
  startLocationId: string | null,
  availableWarpLocationIds: ReadonlySet<string>,
  isWarpLocation: boolean,
): { isStart: boolean; warpState: "active" | "inactive" | null } {
  const isStart = locationId === startLocationId;
  return {
    isStart,
    warpState: isStart || !isWarpLocation
      ? null
      : availableWarpLocationIds.has(locationId) ? "active" : "inactive",
  };
}
