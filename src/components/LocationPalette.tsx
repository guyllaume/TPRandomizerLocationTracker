import { memo, useMemo, useState } from "react";
import greenWarpIcon from "../../icons/ezgif-482ef2a92ce44a3f.png";
import redWarpIcon from "../../icons/ezgif-4cc6456631015bee.png";
import type { LocationDefinition } from "../types/tracker";

interface LocationPaletteProps {
  locations: LocationDefinition[];
  placedLocationIds: Set<string>;
  activatedWarpLocationIds: ReadonlySet<string>;
  hidePlaced: boolean;
  onHidePlacedChange: (hide: boolean) => void;
  onAddLocation: (locationId: string) => void;
}

function LocationPaletteComponent({
  locations,
  placedLocationIds,
  activatedWarpLocationIds,
  hidePlaced,
  onHidePlacedChange,
  onAddLocation,
}: LocationPaletteProps) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const groups = useMemo(() => {
    const filtered = locations.filter((location) => {
      if (hidePlaced && placedLocationIds.has(location.id)) return false;
      if (!normalizedQuery) return true;
      return location.name.toLocaleLowerCase().includes(normalizedQuery) ||
        location.entrances.some((entrance) =>
          entrance.name.toLocaleLowerCase().includes(normalizedQuery),
        );
    });

    const grouped = new Map<string, LocationDefinition[]>();
    for (const location of filtered) {
      const group = grouped.get(location.primaryGroup) ?? [];
      group.push(location);
      grouped.set(location.primaryGroup, group);
    }
    return grouped;
  }, [hidePlaced, locations, normalizedQuery, placedLocationIds]);

  const matchCount = [...groups.values()].reduce((total, group) => total + group.length, 0);

  return (
    <aside className="location-palette" aria-label="Add or search locations">
      <div className="palette-header">
        <div>
          <h2>Locations</h2>
          <p>{placedLocationIds.size} / {locations.length} on canvas</p>
        </div>
        <label className="hide-placed">
          <input
            type="checkbox"
            checked={hidePlaced}
            onChange={(event) => onHidePlacedChange(event.target.checked)}
          />
          Hide added
        </label>
      </div>
      <label className="location-search">
        <span className="visually-hidden">Search by location or entrance name</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search locations or entrances…"
        />
      </label>
      <p className="palette-results" aria-live="polite">
        {matchCount} location{matchCount === 1 ? "" : "s"}
      </p>
      <div className="palette-groups">
        {[...groups.entries()].map(([group, groupLocations]) => (
          <section className="palette-group" key={group}>
            <h3>{group}</h3>
            <ul>
              {groupLocations.map((location) => {
                const placed = placedLocationIds.has(location.id);
                const matchingEntrances = normalizedQuery
                  ? location.entrances.filter((entrance) =>
                    entrance.name.toLocaleLowerCase().includes(normalizedQuery),
                  )
                  : [];
                return (
                  <li key={location.id}>
                    <button
                      type="button"
                      className={placed ? "is-added" : ""}
                      disabled={placed}
                      onClick={() => onAddLocation(location.id)}
                    >
                      <span className="palette-add-mark">{placed ? "✓" : "+"}</span>
                      <span>
                        <span className="palette-location-name">
                          <strong>{location.name}</strong>
                          {location.hasWarp && (
                            <img
                              className="palette-warp-icon"
                              src={activatedWarpLocationIds.has(location.id) ? greenWarpIcon : redWarpIcon}
                              alt={activatedWarpLocationIds.has(location.id) ? "Active warp" : "Inactive warp"}
                              title={activatedWarpLocationIds.has(location.id) ? "Active warp" : "Inactive warp"}
                            />
                          )}
                        </span>
                        {matchingEntrances.length > 0 &&
                          !location.name.toLocaleLowerCase().includes(normalizedQuery) && (
                            <small>{matchingEntrances.map((entrance) => entrance.name).join(", ")}</small>
                          )}
                      </span>
                      <span className="palette-entrance-count">{location.entrances.length}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        {matchCount === 0 && <p className="palette-empty">No matching locations or entrances.</p>}
      </div>
    </aside>
  );
}

export const LocationPalette = memo(LocationPaletteComponent);
