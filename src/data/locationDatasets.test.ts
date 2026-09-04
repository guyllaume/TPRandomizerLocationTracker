import { describe, expect, it } from "vitest";
import { validateLocationDataset } from "./validateLocations";
import {
  CURRENT_DATASET_VERSION,
  currentLocationDataset,
  legacyLocationDataset,
  resolveLocationDataset,
} from "./locationDatasets";

describe("versioned location datasets", () => {
  it("uses the corrected v0.2 dataset as the current default", () => {
    expect(CURRENT_DATASET_VERSION).toBe("0.2");
    expect(resolveLocationDataset(CURRENT_DATASET_VERSION)).toBe(currentLocationDataset);
    expect(currentLocationDataset.datasetVersion).toBe("0.2");
    expect(currentLocationDataset.locations).toHaveLength(113);
    expect(currentLocationDataset.stats.entranceCount).toBe(278);
  });

  it("reconstructs valid v0.1 definitions without changing the current dataset", () => {
    expect(validateLocationDataset(legacyLocationDataset).errors).toEqual([]);
    expect(legacyLocationDataset.datasetVersion).toBe("0.1");
    expect(legacyLocationDataset.locations).toHaveLength(117);
    expect(legacyLocationDataset.stats.entranceCount).toBe(282);
    expect(currentLocationDataset.locations.some((location) => location.id === "ordon-bridge"))
      .toBe(false);
  });

  it("retains the shipped v0.1 definitions affected by v0.2 corrections", () => {
    const byId = new Map(legacyLocationDataset.locations.map((location) => [location.id, location]));

    expect(byId.get("fishing-hole")?.entrances.map((entrance) => entrance.id)).toEqual([
      "fishing-hole--upper-zora-s-river",
    ]);
    expect(byId.get("fishing-hole")?.entrances[0].sourceRows).toHaveLength(2);
    expect(byId.get("snowpeak-ice-keese-grotto")?.name).toBe("Snowpeak Ice Keese Grotto");
    expect(byId.get("top-of-kakariko-watchtower")?.entrances.map(
      (entrance) => entrance.id,
    )).toEqual(["top-of-kakariko-watchtower--kakariko-watchtower-upper-door"]);
    expect(byId.get("lake-hylia-bridge-grotto-ledge")?.entrances.map(
      (entrance) => entrance.id,
    )).toEqual(["lake-hylia-bridge-grotto-ledge--entrance"]);
    expect(byId.get("ordon-bridge")?.entrances.map((entrance) => entrance.id)).toEqual([
      "ordon-bridge--ordon-spring",
      "ordon-bridge--south-faron-woods",
    ]);
    expect(byId.get("south-faron-woods")?.entrances.map((entrance) => entrance.id)).toEqual([
      "south-faron-woods--behind-gate",
      "south-faron-woods--faron-field",
      "south-faron-woods--faron-woods",
      "south-faron-woods--faron-woods-owl-statue-chest",
      "south-faron-woods--ordon-bridge",
      "south-faron-woods--coro-s-house-lower",
      "south-faron-woods--coro-s-house-upper",
      "south-faron-woods--south-faron-cave",
      "south-faron-woods--arrival-from-forest-temple-boss-room-exit-warp--in",
    ]);
    expect(byId.get("faron-woods")?.entrances.map((entrance) => entrance.id)).toContain(
      "faron-woods--south-faron-woods-north-cave",
    );
    expect(byId.get("eldin-field-grotto-platform")?.entrances.map(
      (entrance) => entrance.id,
    )).toEqual(["eldin-field-grotto-platform--entrance"]);
  });
});
