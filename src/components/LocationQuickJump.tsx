import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useReducer,
  useRef,
  type KeyboardEvent,
} from "react";
import {
  createLocationSearchIndex,
  INITIAL_LOCATION_SEARCH_STATE,
  locationSearchResultForEnter,
  normalizeLocationQuery,
  reduceLocationSearchState,
  searchLocationIndex,
  shouldActivateLocationSearchShortcut,
  type LocationSearchItem,
} from "../tracker/locationSearch";

interface LocationQuickJumpProps {
  locations: readonly LocationSearchItem[];
  includedLocationIds: ReadonlySet<string>;
  onSelectLocation: (locationId: string) => void;
}

export function LocationQuickJump({
  locations,
  includedLocationIds,
  onSelectLocation,
}: LocationQuickJumpProps) {
  const [searchState, dispatch] = useReducer(
    reduceLocationSearchState,
    INITIAL_LOCATION_SEARCH_STATE,
  );
  const { query, open, highlightedIndex } = searchState;
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const searchIndex = useMemo(() => createLocationSearchIndex(locations), [locations]);
  const results = useMemo(
    () => searchLocationIndex(searchIndex, query)
      .filter((location) => includedLocationIds.has(location.id)),
    [includedLocationIds, query, searchIndex],
  );
  const normalizedQuery = normalizeLocationQuery(query);
  const activeIndex = highlightedIndex >= 0 && results.length > 0
    ? Math.min(highlightedIndex, results.length - 1)
    : -1;
  const resultsVisible = open && normalizedQuery.length > 0;

  const clearSearch = useCallback((blur: boolean) => {
    dispatch({ type: "escape" });
    if (blur) inputRef.current?.blur();
  }, []);

  const chooseLocation = useCallback((locationId: string) => {
    dispatch({ type: "select" });
    onSelectLocation(locationId);
  }, [onSelectLocation]);

  useEffect(() => {
    const handleShortcut = (event: globalThis.KeyboardEvent) => {
      if (!shouldActivateLocationSearchShortcut(event)) return;
      event.preventDefault();
      inputRef.current?.focus();
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      clearSearch(true);
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (results.length === 0) return;
      event.preventDefault();
      dispatch({
        type: "move",
        direction: event.key === "ArrowDown" ? 1 : -1,
        resultCount: results.length,
      });
      return;
    }

    if (event.key === "Enter" && results.length > 0) {
      event.preventDefault();
      const location = locationSearchResultForEnter(results, activeIndex);
      if (location) chooseLocation(location.id);
    }
  };

  return (
    <div className="location-quick-jump">
      <label htmlFor={`${listboxId}-input`}>Jump to location</label>
      <div className="location-quick-jump-control">
        <input
          ref={inputRef}
          id={`${listboxId}-input`}
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={resultsVisible}
          aria-activedescendant={
            resultsVisible && activeIndex >= 0 ? `${listboxId}-option-${results[activeIndex].id}` : undefined
          }
          aria-keyshortcuts="/"
          autoComplete="off"
          value={query}
          onChange={(event) => dispatch({ type: "query", query: event.target.value })}
          onFocus={() => dispatch({ type: "open" })}
          onBlur={() => dispatch({ type: "close" })}
          onKeyDown={handleKeyDown}
          placeholder="Find a placed card…"
        />
        <kbd aria-hidden="true">/</kbd>
      </div>

      {resultsVisible && (
        <div id={listboxId} className="location-quick-jump-results" role="listbox">
          {results.map((location, index) => (
            <button
              key={location.id}
              id={`${listboxId}-option-${location.id}`}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              onMouseEnter={() => dispatch({ type: "highlight", index })}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => chooseLocation(location.id)}
            >
              {location.name}
            </button>
          ))}
          {results.length === 0 && (
            <p className="location-quick-jump-empty" role="status">No locations found</p>
          )}
        </div>
      )}
    </div>
  );
}
