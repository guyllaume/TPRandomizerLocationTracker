# Changelog

All notable changes to the Twilight Princess Randomizer Location Tracker will be documented here.

## [Unreleased]

### Added

### Changed

### Fixed

### Compatibility

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
