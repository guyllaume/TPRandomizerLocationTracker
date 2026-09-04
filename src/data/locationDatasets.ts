import type {
  DatasetVersion,
  EntranceDefinition,
  LocationDataset,
  LocationDefinition,
} from "../types/tracker";
import rawCurrentDataset from "./locations.json";

export const CURRENT_DATASET_VERSION: DatasetVersion = "0.2";
export const LEGACY_DATASET_VERSION: DatasetVersion = "0.1";

const currentLocationDataset = rawCurrentDataset as LocationDataset;

function cloneDataset(dataset: LocationDataset): LocationDataset {
  return JSON.parse(JSON.stringify(dataset)) as LocationDataset;
}

function requireLocation(dataset: LocationDataset, locationId: string): LocationDefinition {
  const location = dataset.locations.find((candidate) => candidate.id === locationId);
  if (!location) throw new Error(`Dataset is missing ${locationId}.`);
  return location;
}

function takeEntrance(location: LocationDefinition, entranceId: string): EntranceDefinition {
  const index = location.entrances.findIndex((entrance) => entrance.id === entranceId);
  if (index < 0) throw new Error(`Dataset is missing ${entranceId}.`);
  return location.entrances.splice(index, 1)[0];
}

function insertEntranceBefore(
  location: LocationDefinition,
  beforeEntranceId: string,
  entrance: EntranceDefinition,
): void {
  const index = location.entrances.findIndex((candidate) => candidate.id === beforeEntranceId);
  if (index < 0) throw new Error(`Dataset is missing ${beforeEntranceId}.`);
  location.entrances.splice(index, 0, entrance);
}

function insertLocationBefore(
  dataset: LocationDataset,
  beforeLocationId: string,
  location: LocationDefinition,
): void {
  const index = dataset.locations.findIndex((candidate) => candidate.id === beforeLocationId);
  if (index < 0) throw new Error(`Dataset is missing ${beforeLocationId}.`);
  dataset.locations.splice(index, 0, location);
}

/**
 * Reconstructs the shipped v0.1 location definitions from the corrected v0.2
 * dataset. The rest of the application receives one resolved LocationDataset
 * and does not branch on individual location or entrance IDs.
 */
function buildLegacyLocationDataset(): LocationDataset {
  const legacy = cloneDataset(currentLocationDataset);
  legacy.datasetVersion = LEGACY_DATASET_VERSION;
  legacy.stats = {
    ...legacy.stats,
    locationCount: 117,
    entranceCount: 282,
    entrancesByType: {
      ...legacy.stats.entrancesByType,
      interior: 76,
      overworld: 79,
    },
  };

  const aliasIndex = legacy.normalizedAliases.findIndex(
    (alias) => alias.source === "Sacred Grove Past Behind Window",
  );
  legacy.normalizedAliases.splice(aliasIndex < 0 ? legacy.normalizedAliases.length : aliasIndex, 0, {
    source: "South Faron Woods Behind Gate / South Cave Entrance",
    normalized: "South Faron Woods – Behind Gate / South Cave Entrance",
  });

  const fishingHole = requireLocation(legacy, "fishing-hole");
  takeEntrance(fishingHole, "fishing-hole--fishing-hole-house-door");
  fishingHole.entrances[0].sourceRows?.push({
    sheet: "Lanayru Province",
    row: 57,
    group: "Zora's River",
    vanillaEntrance: "Fishing Hole → Fishing Hole House",
  });

  requireLocation(legacy, "snowpeak-ice-keese-grotto").name = "Snowpeak Ice Keese Grotto";

  const kakarikoVillage = requireLocation(legacy, "kakariko-village");
  const watchtowerEntrance = takeEntrance(
    kakarikoVillage,
    "top-of-kakariko-watchtower--kakariko-watchtower-upper-door",
  );
  insertLocationBefore(legacy, "lake-hylia", {
    id: "top-of-kakariko-watchtower",
    name: "Top of Kakariko Watchtower",
    locationKind: "overworld",
    primaryGroup: "Eldin Province",
    sourceSheets: ["Eldin Province"],
    sourceGroups: ["Kakariko Village"],
    entrances: [watchtowerEntrance],
  });

  const lakeHyliaBridge = requireLocation(legacy, "lake-hylia-bridge");
  const grottoLedgeEntrance = takeEntrance(
    lakeHyliaBridge,
    "lake-hylia-bridge-grotto-ledge--entrance",
  );
  grottoLedgeEntrance.name = "Entrance";
  insertLocationBefore(legacy, "lake-hylia-water-toadpoli-grotto", {
    id: "lake-hylia-bridge-grotto-ledge",
    name: "Lake Hylia Bridge Grotto Ledge",
    locationKind: "grotto",
    primaryGroup: "Lanayru Province",
    sourceSheets: ["Lanayru Province"],
    sourceGroups: ["Lake Hylia"],
    entrances: [grottoLedgeEntrance],
  });

  const ordonSpring = requireLocation(legacy, "ordon-spring");
  const ordonSpringEntrance = ordonSpring.entrances.find(
    (entrance) => entrance.id === "ordon-spring--ordon-bridge",
  );
  if (!ordonSpringEntrance) throw new Error("Dataset is missing ordon-spring--ordon-bridge.");
  ordonSpringEntrance.name = "Ordon Bridge";

  const southFaronWoods = requireLocation(legacy, "south-faron-woods");
  const bridgeToSpringEntrance = takeEntrance(southFaronWoods, "ordon-bridge--ordon-spring");
  bridgeToSpringEntrance.name = "Ordon Spring";

  insertEntranceBefore(southFaronWoods, "south-faron-woods--faron-field", {
    id: "south-faron-woods--behind-gate",
    name: "Behind Gate / South Cave Entrance",
    type: "overworld",
    direction: "both",
    sourceLabels: [
      "South Faron Woods Behind Gate",
      "South Faron Woods South Cave Entrance",
    ],
    sourceRows: [{
      sheet: "Faron Province",
      row: 6,
      group: "South Faron Woods",
      vanillaEntrance: "South Faron Woods Behind Gate → South Faron Woods South Cave Entrance",
    }],
  });
  insertEntranceBefore(
    southFaronWoods,
    "south-faron-woods--faron-woods-owl-statue-chest",
    {
      id: "south-faron-woods--faron-woods",
      name: "Faron Woods",
      type: "overworld",
      direction: "both",
      sourceLabels: ["South Faron Woods North Cave Entrance"],
      sourceRows: [{
        sheet: "Faron Province",
        row: 14,
        group: "Faron Woods",
        vanillaEntrance: "Faron Woods → South Faron Woods North Cave Entrance",
      }],
    },
  );
  insertEntranceBefore(southFaronWoods, "south-faron-woods--coro-s-house-lower", {
    id: "south-faron-woods--ordon-bridge",
    name: "Ordon Bridge",
    type: "overworld",
    direction: "both",
    sourceLabels: ["South Faron Woods"],
    sourceRows: [{
      sheet: "Ordona Province",
      row: 9,
      group: "Ordon Link's House",
      vanillaEntrance: "Ordon Bridge → South Faron Woods",
    }, {
      sheet: "Faron Province",
      row: 5,
      group: "South Faron Woods",
      vanillaEntrance: "South Faron Woods → Ordon Bridge",
    }],
  });

  const faronWoods = requireLocation(legacy, "faron-woods");
  insertEntranceBefore(faronWoods, "faron-woods--mist-cave", {
    id: "faron-woods--south-faron-woods-north-cave",
    name: "South Faron Woods – North Cave",
    type: "overworld",
    direction: "both",
    sourceLabels: ["Faron Woods"],
    sourceRows: [{
      sheet: "Faron Province",
      row: 14,
      group: "Faron Woods",
      vanillaEntrance: "Faron Woods → South Faron Woods North Cave Entrance",
    }],
  });

  insertLocationBefore(legacy, "south-faron-woods", {
    id: "ordon-bridge",
    name: "Ordon Bridge",
    locationKind: "overworld",
    primaryGroup: "Ordona Province",
    sourceSheets: ["Ordona Province", "Faron Province"],
    sourceGroups: ["Ordon Link's House", "South Faron Woods"],
    entrances: [bridgeToSpringEntrance, {
      id: "ordon-bridge--south-faron-woods",
      name: "South Faron Woods",
      type: "overworld",
      direction: "both",
      sourceLabels: ["Ordon Bridge"],
      sourceRows: [{
        sheet: "Ordona Province",
        row: 9,
        group: "Ordon Link's House",
        vanillaEntrance: "Ordon Bridge → South Faron Woods",
      }, {
        sheet: "Faron Province",
        row: 5,
        group: "South Faron Woods",
        vanillaEntrance: "South Faron Woods → Ordon Bridge",
      }],
    }],
  });

  const eldinField = requireLocation(legacy, "eldin-field");
  const grottoPlatformEntrance = takeEntrance(
    eldinField,
    "eldin-field-grotto-platform--entrance",
  );
  grottoPlatformEntrance.name = "Entrance";
  insertLocationBefore(legacy, "eldin-field-stalfos-grotto", {
    id: "eldin-field-grotto-platform",
    name: "Eldin Field Grotto Platform",
    locationKind: "grotto",
    primaryGroup: "Eldin Province",
    sourceSheets: ["Eldin Province"],
    sourceGroups: ["Eldin Field"],
    entrances: [grottoPlatformEntrance],
  });

  return legacy;
}

export const legacyLocationDataset = buildLegacyLocationDataset();
export { currentLocationDataset };

export const locationDatasets: Readonly<Record<DatasetVersion, LocationDataset>> = {
  "0.1": legacyLocationDataset,
  "0.2": currentLocationDataset,
};

export const locationDefinitionsByDatasetVersion: Readonly<
  Record<DatasetVersion, LocationDefinition[]>
> = {
  "0.1": legacyLocationDataset.locations,
  "0.2": currentLocationDataset.locations,
};

export function isDatasetVersion(value: unknown): value is DatasetVersion {
  return value === LEGACY_DATASET_VERSION || value === CURRENT_DATASET_VERSION;
}

export function resolveLocationDataset(version: DatasetVersion): LocationDataset {
  return locationDatasets[version];
}
