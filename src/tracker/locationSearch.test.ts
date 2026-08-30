import { describe, expect, it } from "vitest";
import {
  createLocationSearchIndex,
  INITIAL_LOCATION_SEARCH_STATE,
  isTextEditingTarget,
  locationSearchResultForEnter,
  nextLocationSearchHighlight,
  reduceLocationSearchState,
  searchLocationIndex,
  shouldActivateLocationSearchShortcut,
} from "./locationSearch";

const locations = [
  { id: "sacred-grove", name: "Sacred Grove" },
  { id: "lake-hylia", name: "Lake Hylia" },
  { id: "north-faron", name: "North Faron Woods" },
  { id: "south-faron", name: "South Faron Woods" },
];

describe("location search", () => {
  it("continues to index and find a location carrying cleared player state", () => {
    const items = [{ id: "grotto", name: "Faron Field Grotto", cleared: true }];
    const index = createLocationSearchIndex(items);

    expect(searchLocationIndex(index, "faron").map((item) => item.id)).toEqual(["grotto"]);
  });

  const index = createLocationSearchIndex(locations);

  it("matches partial names without case or surrounding-whitespace sensitivity", () => {
    expect(searchLocationIndex(index, "sacred").map((item) => item.name)).toEqual([
      "Sacred Grove",
    ]);
    expect(searchLocationIndex(index, "FARON").map((item) => item.name)).toEqual([
      "North Faron Woods",
      "South Faron Woods",
    ]);
    expect(searchLocationIndex(index, "  lake").map((item) => item.name)).toEqual([
      "Lake Hylia",
    ]);
  });

  it("ranks exact, starts-with, and contains matches while preserving source order", () => {
    const ranked = createLocationSearchIndex([
      { id: "north", name: "North Faron Woods" },
      { id: "starts", name: "Faron Woods" },
      { id: "south", name: "South Faron Woods" },
      { id: "exact", name: "Faron" },
    ]);

    expect(searchLocationIndex(ranked, "faron").map((item) => item.id)).toEqual([
      "exact",
      "starts",
      "north",
      "south",
    ]);
  });

  it("wraps Arrow Up and Arrow Down navigation predictably", () => {
    expect(nextLocationSearchHighlight(-1, 1, 3)).toBe(0);
    expect(nextLocationSearchHighlight(-1, -1, 3)).toBe(2);
    expect(nextLocationSearchHighlight(2, 1, 3)).toBe(0);
    expect(nextLocationSearchHighlight(0, -1, 3)).toBe(2);
  });

  it("tracks query, arrow, selection, and Escape state transitions", () => {
    const queried = reduceLocationSearchState(INITIAL_LOCATION_SEARCH_STATE, {
      type: "query",
      query: "faron",
    });
    expect(queried).toEqual({ query: "faron", open: true, highlightedIndex: -1 });

    const down = reduceLocationSearchState(queried, {
      type: "move",
      direction: 1,
      resultCount: 3,
    });
    expect(down.highlightedIndex).toBe(0);
    expect(reduceLocationSearchState(down, { type: "select" })).toEqual(
      INITIAL_LOCATION_SEARCH_STATE,
    );
    expect(reduceLocationSearchState(queried, { type: "escape" })).toEqual(
      INITIAL_LOCATION_SEARCH_STATE,
    );
  });

  it("uses the first Enter result unless keyboard navigation highlighted another", () => {
    const results = ["first", "second", "third"];
    expect(locationSearchResultForEnter(results, -1)).toBe("first");
    expect(locationSearchResultForEnter(results, 1)).toBe("second");
    expect(locationSearchResultForEnter([], -1)).toBeUndefined();
  });
});

describe("location search shortcut", () => {
  const shortcutEvent = (target: EventTarget | null) => ({
    key: "/",
    defaultPrevented: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    target,
  });

  it("activates from normal page content", () => {
    expect(shouldActivateLocationSearchShortcut(shortcutEvent({
      tagName: "DIV",
    } as unknown as EventTarget))).toBe(true);
  });

  it("does not activate from form or editable controls", () => {
    for (const tagName of ["INPUT", "TEXTAREA", "SELECT"]) {
      const target = { tagName } as unknown as EventTarget;
      expect(isTextEditingTarget(target)).toBe(true);
      expect(shouldActivateLocationSearchShortcut(shortcutEvent(target))).toBe(false);
    }
    expect(isTextEditingTarget({ isContentEditable: true } as unknown as EventTarget)).toBe(true);
  });
});
