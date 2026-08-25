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
    expect(locationDataset.locations).toHaveLength(117);
    expect(locationDataset.stats.entranceCount).toBe(282);

    const coro = locationDataset.locations.find((location) => location.id === "coro-s-house");
    expect(coro?.entrances.map((entrance) => [entrance.id, entrance.name])).toEqual([
      ["coro-s-house--lower", "Lower"],
      ["coro-s-house--upper", "Upper"],
    ]);
  });

  it("contains no static connection collection", () => {
    expect(locationDataset).not.toHaveProperty("connections");
    expect(locationDataset).not.toHaveProperty("edges");
  });
});
