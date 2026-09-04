import { currentLocationDataset } from "./locationDatasets";

// These convenience exports retain the current-dataset API for non-runtime
// helpers and tests. App resolves its seed's selected dataset independently.
export const locationDataset = currentLocationDataset;
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

export const entranceDirectionsById = new Map(
  locations.flatMap((location) =>
    location.entrances.map((entrance) => [entrance.id, entrance.direction] as const),
  ),
);
