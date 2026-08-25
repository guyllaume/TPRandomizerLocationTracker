import type { LocationDataset } from "../types/tracker";
import rawDataset from "./locations.json";

// The JSON file is the single canonical static dataset. Its schema and values
// are exercised by validateLocations.test.ts rather than duplicated here.
export const locationDataset = rawDataset as LocationDataset;
export const locations = locationDataset.locations;

export const locationsById = new Map(
  locations.map((location) => [location.id, location]),
);

export const entrancesById = new Map(
  locations.flatMap((location) =>
    location.entrances.map((entrance) => [
      entrance.id,
      { locationId: location.id, entrance },
    ] as const),
  ),
);
