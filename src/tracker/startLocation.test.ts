import { describe, expect, it } from "vitest";
import {
  availableWarpDestinationIds,
  toggleStartLocationId,
} from "./startLocation";

describe("starting location", () => {
  it("sets, replaces, and clears the single START location", () => {
    expect(toggleStartLocationId(null, "ordon-spring")).toBe("ordon-spring");
    expect(toggleStartLocationId("ordon-spring", "lake-hylia")).toBe("lake-hylia");
    expect(toggleStartLocationId("lake-hylia", "lake-hylia")).toBeNull();
  });

  it("adds START to warp availability without mutating normal activation", () => {
    const activated = ["lake-hylia"];

    expect(availableWarpDestinationIds(activated, "coro-s-house")).toEqual([
      "coro-s-house",
      "lake-hylia",
    ]);
    expect(activated).toEqual(["lake-hylia"]);
  });

  it("does not duplicate an activated warp that is also START", () => {
    expect(availableWarpDestinationIds(["lake-hylia"], "lake-hylia")).toEqual([
      "lake-hylia",
    ]);
  });

  it("removes special warp availability when START is cleared", () => {
    expect(availableWarpDestinationIds(["lake-hylia"], null)).toEqual(["lake-hylia"]);
  });
});
