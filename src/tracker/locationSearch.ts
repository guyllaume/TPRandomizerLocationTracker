export interface LocationSearchItem {
  id: string;
  name: string;
}

export interface IndexedLocationSearchItem extends LocationSearchItem {
  normalizedName: string;
  order: number;
}

export function normalizeLocationQuery(query: string): string {
  return query.trim().toLocaleLowerCase();
}

export function createLocationSearchIndex(
  locations: readonly LocationSearchItem[],
): IndexedLocationSearchItem[] {
  return locations.map((location, order) => ({
    ...location,
    normalizedName: normalizeLocationQuery(location.name),
    order,
  }));
}

export function searchLocationIndex(
  index: readonly IndexedLocationSearchItem[],
  query: string,
): IndexedLocationSearchItem[] {
  const normalizedQuery = normalizeLocationQuery(query);
  if (!normalizedQuery) return [];

  return index
    .map((location) => {
      let rank: number | undefined;
      if (location.normalizedName === normalizedQuery) rank = 0;
      else if (location.normalizedName.startsWith(normalizedQuery)) rank = 1;
      else if (location.normalizedName.includes(normalizedQuery)) rank = 2;
      return rank === undefined ? undefined : { location, rank };
    })
    .filter((match): match is { location: IndexedLocationSearchItem; rank: number } =>
      match !== undefined,
    )
    .sort((left, right) => left.rank - right.rank || left.location.order - right.location.order)
    .map((match) => match.location);
}

export function nextLocationSearchHighlight(
  currentIndex: number,
  direction: 1 | -1,
  resultCount: number,
): number {
  if (resultCount === 0) return -1;
  if (currentIndex < 0) return direction === 1 ? 0 : resultCount - 1;
  return (currentIndex + direction + resultCount) % resultCount;
}

export interface LocationSearchState {
  query: string;
  open: boolean;
  highlightedIndex: number;
}

export const INITIAL_LOCATION_SEARCH_STATE: LocationSearchState = {
  query: "",
  open: false,
  highlightedIndex: -1,
};

export type LocationSearchAction =
  | { type: "query"; query: string }
  | { type: "open" }
  | { type: "close" }
  | { type: "move"; direction: 1 | -1; resultCount: number }
  | { type: "highlight"; index: number }
  | { type: "select" }
  | { type: "escape" };

export function reduceLocationSearchState(
  state: LocationSearchState,
  action: LocationSearchAction,
): LocationSearchState {
  switch (action.type) {
    case "query":
      return {
        query: action.query,
        open: normalizeLocationQuery(action.query).length > 0,
        highlightedIndex: -1,
      };
    case "open":
      return normalizeLocationQuery(state.query)
        ? { ...state, open: true }
        : state;
    case "close":
      return state.open ? { ...state, open: false } : state;
    case "move":
      return {
        ...state,
        open: action.resultCount > 0,
        highlightedIndex: nextLocationSearchHighlight(
          state.highlightedIndex,
          action.direction,
          action.resultCount,
        ),
      };
    case "highlight":
      return { ...state, highlightedIndex: action.index };
    case "select":
    case "escape":
      return INITIAL_LOCATION_SEARCH_STATE;
  }
}

export function locationSearchResultForEnter<T>(
  results: readonly T[],
  highlightedIndex: number,
): T | undefined {
  if (results.length === 0) return undefined;
  if (highlightedIndex < 0) return results[0];
  return results[Math.min(highlightedIndex, results.length - 1)];
}

export function isTextEditingTarget(target: EventTarget | null): boolean {
  if (!target) return false;

  const element = target as EventTarget & {
    tagName?: string;
    isContentEditable?: boolean;
    getAttribute?: (name: string) => string | null;
  };
  const tagName = element.tagName?.toLocaleLowerCase();
  if (tagName === "input" || tagName === "textarea" || tagName === "select") return true;
  if (element.isContentEditable) return true;

  const role = element.getAttribute?.("role")?.toLocaleLowerCase();
  return role === "textbox" || role === "searchbox" || role === "combobox";
}

interface LocationSearchShortcutEvent {
  key: string;
  defaultPrevented: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  target: EventTarget | null;
}

export function shouldActivateLocationSearchShortcut(event: LocationSearchShortcutEvent): boolean {
  return event.key === "/" &&
    !event.defaultPrevented &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    !isTextEditingTarget(event.target);
}
