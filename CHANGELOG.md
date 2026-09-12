# Changelog

All notable changes to the Twilight Princess Randomizer Location Tracker will be documented here.

## [Unreleased]

### Added

### Changed

### Fixed

### Compatibility

## [0.3.0]

### Added

- Multi-location selection with **Ctrl-click** / **Command-click**, including a compact selected-location count.
- **Shift-drag marquee selection** for quickly selecting multiple locations on the map.
- Group dragging for selected locations while preserving their relative positions.
- **Undo / Redo** support for major tracker actions, including location movement, entrance connections, START and warp changes, and other supported run-state edits.
- Undo / Redo toolbar controls and standard keyboard shortcuts.
- Optional per-connection colors with save, export, and import support.
- **Connection focus/highlighting** when hovering a connection or one of its entrance endpoints, making dense routes easier to follow.
- Batch actions for selected connections, including color, arrow-direction, and deletion controls.
- Explicit **System, Light, and Dark** theme options instead of relying only on the browser's default theme.
- A collapsible location sidebar to reclaim additional map space.
- Location-type colors on the minimap.
- START and warp status indicators on minimap locations.
- A compact, expandable minimap legend explaining location colors and status markers.

### Changed

- Completely reworked location-card selection so **selection and dragging are separate interactions**.
  - Clicking selects a card only after release.
  - Moving beyond the drag threshold begins movement without unintentionally changing the current selection.
- Dragging any location in a multi-selection now moves the whole selection together.
- Autosave pauses while locations are actively being moved and saves their final positions when the drag completes.
- Improved the existing connection-color controls and added support for applying connection actions to multiple selected connections.
- Connection highlighting now de-emphasizes unrelated routes without changing the user's location selection.
- Reorganized the header into clearer **Run, Navigation, Editing, and View** groups.
- Increased the usable width of the **Run Name** and **Jump to Location** fields for normal desktop and 1080p displays.
- Simplified START controls:

  - once a START location is set, `Set Start` is hidden from other location cards;
  - the active START location exposes only the relevant `Clear Start` action.
- Integrated multi-selection feedback into the editing controls without increasing the header height.
- Updated the minimap so location color represents location type while START and warp state use separate markers.
- Improved general light/dark theme consistency across tracker controls, cards, overlays, connections, and minimap elements.

### Compatibility

- Existing **v0.2.x** tracker states and exported runs remain supported.
- Save data continues to use **schema version 1**.
- Existing connection IDs and entrance IDs are unchanged.
- Existing location datasets are unchanged in v0.3.0.
- Paired entrance connections retain their existing semantics and persisted representation.
- Import/export does **not** introduce separate IN/OUT or directional entrance state.
- No save migration or schema reset is required when upgrading from v0.2.x.

### Deferred

The following entrance-model changes are intentionally deferred to **v0.4.0** so they can be designed together:

- IN-left / OUT-right entrance presentation
- decoupled entrance handling
- unpaired entrance support and additional entrances
- any required directional connection or persistence changes


## [0.2.1] - 2026-09-04

### Changed

- New connections now default to bidirectional arrows.

### Fixed

- Warp-route highlighting now traverses from the active warp toward the selected destination.

## [0.2.0] - 2026-09-04

### Added

- Starting location selection and a compact map indicator.
- Guaranteed warp availability for the selected starting location.
- Temporary per-run location dataset selection between current v0.2 and legacy pre-v0.2 definitions.

### Changed

- Snowpeak Ice Keese Grotto now also identifies the location as Snowpeak Chu Grotto.
- Moved the Top of Kakariko Watchtower entrance into Kakariko Village while preserving its entrance ID.
- Simplified South Faron Woods to its canonical cave and neighboring-area entrances.
- Moved Eldin Field Grotto Platform into Eldin Field and renamed its entrance Eldin Field Stalfos Grotto.

### Fixed

- Added the missing Fishing Hole House Door entrance to Fishing Hole.
- Added the missing Bubble Grotto entrance to Lake Hylia Bridge.
- Removed the invalid Lake Hylia Bridge Grotto Ledge location.
- Removed Top of Kakariko Watchtower as an incorrect standalone location.
- Removed Ordon Bridge as a standalone location and represented the route directly between South Faron Woods and Ordon Spring.
- Removed the duplicate South Faron Woods – North Cave entrance.

### Compatibility

- Existing unversioned v0.1.x runs are classified as dataset v0.1 and retain their original location and entrance definitions.
- New runs default to dataset v0.2, and dataset selection is locked after connections are recorded.
- Existing entrance connections are preserved when retired locations are regrouped.
- Obsolete location and map references are safely normalized without resetting the run.
- No save or schema reset is required.

## [0.1.0] - 2026-09-02

### Added

- Initial versioned release of the Entrance Randomizer tracker.
- Interactive map and location tracking.
- Entrance connections between locations.
- Movable location groups and existing tracker functionality.

### Compatibility

- First supported tracker/save format (schema 1).
- Runs from the immediately previous tracker build are migrated after successful validation.
- Future application releases remain compatible while they continue using schema 1.
