import { describe, expect, it } from "vitest";
import { locationDataset } from "./locations";
import { validateLocationDataset } from "./validateLocations";

describe("normalized location dataset", () => {
  it("passes the static-data integrity checks", () => {
    const result = validateLocationDataset(locationDataset);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([
      "One-way handle counts are unbalanced (17 out, 16 in).",
    ]);
  });

  it("retains the reviewed dataset totals and normalized Coro's House card", () => {
    expect(locationDataset.locations).toHaveLength(113);
    expect(locationDataset.stats.entranceCount).toBe(278);

    const coro = locationDataset.locations.find((location) => location.id === "coro-s-house");
    expect(coro?.entrances.map((entrance) => [entrance.id, entrance.name])).toEqual([
      ["coro-s-house--lower", "Lower"],
      ["coro-s-house--upper", "Upper"],
    ]);
  });

  it("contains the v0.2.0 entrance and location corrections", () => {
    const byId = new Map(locationDataset.locations.map((location) => [location.id, location]));

    expect(byId.get("fishing-hole")?.entrances.map((entrance) => entrance.id)).toEqual([
      "fishing-hole--upper-zora-s-river",
      "fishing-hole--fishing-hole-house-door",
    ]);
    expect(byId.get("lake-hylia-bridge")?.entrances.find(
      (entrance) => entrance.id === "lake-hylia-bridge-grotto-ledge--entrance",
    )).toMatchObject({
      name: "Lake Hylia Bridge Bubble Grotto",
      type: "grotto",
      direction: "both",
    });
    expect(byId.get("lake-hylia-bridge-bubble-grotto")?.entrances.map(
      (entrance) => entrance.id,
    )).toEqual(["lake-hylia-bridge-bubble-grotto--entrance"]);
    expect(byId.has("lake-hylia-bridge-grotto-ledge")).toBe(false);

    expect(byId.get("kakariko-village")?.entrances.find(
      (entrance) =>
        entrance.id === "top-of-kakariko-watchtower--kakariko-watchtower-upper-door",
    )).toMatchObject({
      name: "Kakariko Watchtower – Upper Door",
      type: "interior",
      direction: "both",
    });
    expect(byId.has("top-of-kakariko-watchtower")).toBe(false);

    const snowpeak = byId.get("snowpeak-ice-keese-grotto");
    expect(snowpeak?.name).toBe("Snowpeak Ice Keese Grotto (Snowpeak Chu Grotto)");
    expect(snowpeak?.entrances.map((entrance) => entrance.id)).toEqual([
      "snowpeak-ice-keese-grotto--entrance",
    ]);
    expect(locationDataset.locations.filter((location) =>
      location.name.includes("Ice Keese Grotto") || location.name.includes("Snowpeak Chu Grotto"),
    )).toHaveLength(1);
  });

  it("contains the revised South Faron, Ordon, and Eldin groupings", () => {
    const byId = new Map(locationDataset.locations.map((location) => [location.id, location]));

    expect(byId.has("ordon-bridge")).toBe(false);
    expect(byId.get("ordon-spring")?.entrances.find(
      (entrance) => entrance.id === "ordon-spring--ordon-bridge",
    )).toMatchObject({ name: "South Faron Woods – Bridge", direction: "both" });
    expect(byId.get("south-faron-woods")?.entrances.map(
      (entrance) => [entrance.id, entrance.name],
    )).toEqual([
      ["south-faron-woods--faron-field", "Faron Field"],
      ["south-faron-woods--faron-woods-owl-statue-chest", "Faron Woods – Owl Statue Chest"],
      ["ordon-bridge--ordon-spring", "Ordon Spring – Bridge"],
      ["south-faron-woods--coro-s-house-lower", "Coro's House – Lower"],
      ["south-faron-woods--coro-s-house-upper", "Coro's House – Upper"],
      ["south-faron-woods--south-faron-cave", "South Faron Cave"],
      [
        "south-faron-woods--arrival-from-forest-temple-boss-room-exit-warp--in",
        "Arrival from Forest Temple Boss Room – Exit / Warp",
      ],
    ]);

    expect(byId.get("faron-woods")?.entrances.map((entrance) => entrance.id)).not.toContain(
      "faron-woods--south-faron-woods-north-cave",
    );
    expect(byId.get("faron-woods")?.entrances.find(
      (entrance) => entrance.id === "faron-woods--south-faron-cave-north",
    )).toMatchObject({ name: "South Faron Cave – North", direction: "both" });

    expect(byId.has("eldin-field-grotto-platform")).toBe(false);
    expect(byId.get("eldin-field")?.entrances.find(
      (entrance) => entrance.id === "eldin-field-grotto-platform--entrance",
    )).toMatchObject({
      name: "Eldin Field Stalfos Grotto",
      type: "grotto",
      direction: "both",
    });
    expect(byId.get("eldin-field-stalfos-grotto")?.entrances.map(
      (entrance) => entrance.id,
    )).toEqual(["eldin-field-stalfos-grotto--entrance"]);
  });

  it("contains no static connection collection", () => {
    expect(locationDataset).not.toHaveProperty("connections");
    expect(locationDataset).not.toHaveProperty("edges");
  });

  it("marks every fixed Twilight Princess warp destination on its existing location", () => {
    expect(
      locationDataset.locations
        .filter((location) => location.hasWarp)
        .map((location) => location.id)
        .sort(),
    ).toEqual([
      "death-mountain",
      "eldin-field",
      "gerudo-desert",
      "kakariko-gorge",
      "kakariko-village",
      "lake-hylia",
      "mirror-chamber",
      "north-faron-woods",
      "ordon-spring",
      "sacred-grove",
      "snowpeak-summit",
      "south-faron-woods",
      "upper-zora-s-river",
      "west-castle-town-field",
      "zora-throne-room",
    ]);
  });
});
