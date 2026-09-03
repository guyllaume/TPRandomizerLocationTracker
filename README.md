# TP Entrance Tracker

TP Entrance Tracker is a visual graph for recording discovered entrance connections in **The Legend of Zelda: Twilight Princess Randomizer**. Add only the locations relevant to the current run, connect their entrance handles as relationships are discovered, arrange the graph freely, and keep a portable JSON backup.

The tracker now uses the first normalized TP Randomizer entrance dataset. It was normalized from the TP entrance spreadsheet and currently contains 117 location cards and 282 entrance handles across the `overworld`, `interior`, `cave`, `grotto`, `one-way`, `dungeons`, and `boss-room` shuffle categories. The data is still undergoing manual gameplay review and should not yet be treated as definitively complete or perfect.

## Features

- Search the location and entrance catalog, then add only the cards needed for your run
- Arrange cards freely, pan and zoom the canvas, use Fit View, or navigate with the minimap
- Record entrance connections with one-way direction support, editable arrow directions, reconnection, and deletion
- Mark locations as cleared and activate warp points; selecting a card highlights related connections and routes to active warps
- Jump directly to any placed location using the toolbar search or the `/` keyboard shortcut
- Name each run and save progress automatically in the current browser, with no account required
- Import and export validated JSON backups without risking the active run when an import fails
- Safely remove disconnected cards or reset the entire run after confirmation

## Data model

The tracker intentionally separates static game data from player-discovered run state:

```text
Location   = one draggable graph card
Entrance   = one connectable handle on that card
Connection = one randomized relationship discovered by the player
```

Provinces and groups organize the searchable location palette; they are not graph nodes. Dataset location and entrance IDs are stable persistence keys and must not be renamed after release. Display names may change independently without changing their IDs. Spreadsheet provenance remains in the static JSON for debugging, but it is not displayed in the normal tracker UI and is never interpreted as a graph edge. A fresh or reset run therefore has no placed locations and `connections: []`.

The single canonical dataset is [`src/data/locations.json`](src/data/locations.json). Typed access lives in `src/data/locations.ts`, and `src/data/validateLocations.test.ts` verifies ID uniqueness, entrance coverage, recognized types and directions, absence of static connections, and Hyrule Castle metadata.

## Saving and migration

Run schema v1 stores only user state. The application release and save schema are versioned independently:

```text
schemaVersion, appVersion, seedName, savedAt,
placedLocationIds, positions, connections, activatedWarpLocationIds,
clearedLocationIds, settings
```

Browser state uses the stable localStorage key `tp-entrance-tracker:run`. A narrow compatibility bridge also recognizes the immediately previous build's `tp-entrance-tracker:run:v2` format, validates it, and converts its metadata to schema 1 before writing to the stable key; the original value is not overwritten during migration. Older experimental formats are intentionally unsupported. Application releases do not need a new schema number, so later releases remain compatible while they use schema 1. A newer or unknown schema is not loaded, changed, or overwritten; the tracker shows a compatibility message and pauses autosave until the user explicitly imports a compatible run or resets. If localStorage is unavailable, the tracker remains usable and recommends **Export Run**.

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
