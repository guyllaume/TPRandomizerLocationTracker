# TP Entrance Tracker

TP Entrance Tracker is a visual graph for recording discovered entrance connections in **The Legend of Zelda: Twilight Princess Randomizer**. Add only the locations relevant to the current run, connect their entrance handles as relationships are discovered, arrange the graph freely, and keep a portable JSON backup.

The tracker now uses the first normalized TP Randomizer entrance dataset. It was normalized from the TP entrance spreadsheet and currently contains 117 location cards and 282 entrance handles across the `overworld`, `interior`, `cave`, `grotto`, `one-way`, `dungeons`, and `boss-room` shuffle categories. The data is still undergoing manual gameplay review and should not yet be treated as definitively complete or perfect.

## Data model

The tracker intentionally separates static game data from player-discovered run state:

```text
Location   = one draggable graph card
Entrance   = one connectable handle on that card
Connection = one randomized relationship discovered by the player
```

Provinces and groups organize the searchable location palette; they are not graph nodes. Dataset IDs are stable and used directly for both cards and handles. Spreadsheet provenance remains in the static JSON for debugging, but it is not displayed in the normal tracker UI and is never interpreted as a graph edge. A fresh or reset run therefore has no placed locations and `connections: []`.

The single canonical dataset is [`src/data/locations.json`](src/data/locations.json). Typed access lives in `src/data/locations.ts`, and `src/data/validateLocations.test.ts` verifies ID uniqueness, entrance coverage, recognized types and directions, absence of static connections, and Hyrule Castle metadata.

## Features

- Search all locations by location or entrance name, grouped by province/group
- Add locations gradually without duplicates, with an optional **Hide added** palette filter
- Draggable React Flow cards with distinct type badges, connected counts, wrapped long names, and Hyrule Castle metadata
- Direction-aware one-way handles: `out` starts a connection, `in` receives one, and `both` participates normally
- Pan, zoom, Fit View, minimap, selectable arrows, edge deletion, edge reconnection, and configurable arrow display direction
- Safe card removal: connected locations must be disconnected first
- Editable run/seed name and automatic browser persistence
- Validated JSON import/export that excludes the static dataset and leaves the active run untouched on failure
- Confirmed reset action that returns to an empty graph

## Saving and migration

Run schema v2 stores only user state:

```text
schemaVersion, trackerVersion, seedName, savedAt,
placedLocationIds, positions, connections, activatedWarpLocationIds, settings
```

Browser state uses the localStorage key `tp-entrance-tracker:run:v2`. The loader can migrate an old v1 prototype save, preserving valid positions and connections where their IDs still exist and reporting obsolete references that were ignored. Invalid or corrupt current saves never crash the app. If localStorage is unavailable, the tracker remains usable and recommends **Export Run**.

Imports validate placed location IDs, position values, entrance IDs, connection IDs, duplicate relationships, and one-way endpoint direction before replacing the active run. Exports do not embed `locations.json`.

## Technology and local setup

- React and TypeScript
- Vite
- [React Flow (`@xyflow/react`)](https://reactflow.dev/)
- Vitest and ESLint
- Cloudflare Workers Static Assets through the Cloudflare Vite plugin and Wrangler

Requires a current Node.js LTS release and npm.

```bash
npm install
npm run dev
```

Quality commands:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run preview
```

## Cloudflare deployment

The project targets the existing Cloudflare Worker application named `tp-entrance-tracker`. `vite.config.ts` enables the official Cloudflare Vite integration; `wrangler.jsonc` supplies the application name, compatibility date, and SPA static-asset fallback.

For a local authenticated deployment:

```bash
npm run deploy
```

For Cloudflare Git deployments, use `npm run build` as the build command. Account, domain, and dashboard setup remain external.
