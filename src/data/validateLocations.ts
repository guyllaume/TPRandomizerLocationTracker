import type {
  EntranceDirection,
  EntranceType,
  LocationDataset,
  SpecialFlag,
} from "../types/tracker";

const ENTRANCE_TYPES = new Set<EntranceType>([
  "overworld",
  "interior",
  "cave",
  "grotto",
  "one-way",
  "dungeons",
  "boss-room",
]);
const DIRECTIONS = new Set<EntranceDirection>(["both", "in", "out"]);
const SPECIAL_FLAGS = new Set<SpecialFlag>(["hyrule-castle"]);

export interface DatasetValidation {
  errors: string[];
  warnings: string[];
}

export function validateLocationDataset(dataset: LocationDataset): DatasetValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const locationIds = new Set<string>();
  const entranceIds = new Set<string>();
  const rawDataset = dataset as unknown as Record<string, unknown>;

  if (
    (Array.isArray(rawDataset.connections) && rawDataset.connections.length > 0) ||
    (Array.isArray(rawDataset.edges) && rawDataset.edges.length > 0)
  ) {
    errors.push("The static dataset must not contain graph connections.");
  }

  for (const location of dataset.locations) {
    if (locationIds.has(location.id)) errors.push(`Duplicate location ID: ${location.id}.`);
    locationIds.add(location.id);
    if (location.entrances.length === 0) {
      errors.push(`Location ${location.id} does not contain an entrance.`);
    }

    for (const flag of location.specialFlags ?? []) {
      if (!SPECIAL_FLAGS.has(flag)) errors.push(`Unknown special flag: ${flag}.`);
    }
    for (const entrance of location.entrances) {
      if (entranceIds.has(entrance.id)) errors.push(`Duplicate entrance ID: ${entrance.id}.`);
      entranceIds.add(entrance.id);
      if (!ENTRANCE_TYPES.has(entrance.type)) {
        errors.push(`Unknown entrance type on ${entrance.id}: ${entrance.type}.`);
      }
      if (!DIRECTIONS.has(entrance.direction)) {
        errors.push(`Unknown entrance direction on ${entrance.id}: ${entrance.direction}.`);
      }
      for (const flag of entrance.specialFlags ?? []) {
        if (!SPECIAL_FLAGS.has(flag)) errors.push(`Unknown special flag: ${flag}.`);
      }
    }
  }

  const hyruleCastle = dataset.locations.find((location) => location.id === "hyrule-castle");
  if (!hyruleCastle?.specialFlags?.includes("hyrule-castle")) {
    errors.push("Hyrule Castle is missing its recognized special flag.");
  }
  if (!dataset.locations.some((location) =>
    location.entrances.some((entrance) => entrance.specialFlags?.includes("hyrule-castle")),
  )) {
    errors.push("No entrance retains the recognized Hyrule Castle special flag.");
  }

  const entrances = dataset.locations.flatMap((location) => location.entrances);
  const oneWayOutCount = entrances.filter((entrance) => entrance.direction === "out").length;
  const oneWayInCount = entrances.filter((entrance) => entrance.direction === "in").length;
  if (oneWayOutCount !== oneWayInCount) {
    warnings.push(
      `One-way handle counts are unbalanced (${oneWayOutCount} out, ${oneWayInCount} in).`,
    );
  }

  return { errors, warnings };
}
