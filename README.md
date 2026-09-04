# TP Entrance Tracker

TP Entrance Tracker is a visual graph for recording discovered entrance connections in **The Legend of Zelda: Twilight Princess Randomizer**. Add only the locations relevant to the current run, connect their entrance handles as relationships are discovered, arrange the graph freely, and keep a portable JSON backup.

The tracker uses a normalized TP Randomizer entrance dataset derived from the TP entrance spreadsheet. The corrected v0.2 dataset contains 113 location cards and 278 entrance handles across the `overworld`, `interior`, `cave`, `grotto`, `one-way`, `dungeons`, and `boss-room` shuffle categories; the temporary legacy v0.1 dataset retains the original 117 locations and 282 entrances. The data is still undergoing manual gameplay review and should not yet be treated as definitively complete or perfect.

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

The canonical current dataset is [`src/data/locations.json`](src/data/locations.json). `src/data/locationDatasets.ts` resolves either the corrected v0.2 definitions or the temporary reconstructed v0.1 legacy definitions, while the rest of the tracker consumes one resolved dataset. Dataset tests verify ID uniqueness, entrance coverage, recognized types and directions, absence of static connections, and the archived legacy definitions.

## Saving and migration

Run schema v1 stores only user state. Application, schema, and location-dataset versions are independent:

```text
schemaVersion, appVersion, datasetVersion, seedName, startLocationId, savedAt,
placedLocationIds, positions, connections, activatedWarpLocationIds,
clearedLocationIds, settings
```

Browser state uses the stable localStorage key `tp-entrance-tracker:run`. New runs default to dataset v0.2. Saves created before dataset selection existed are classified as dataset v0.1 so their original locations and entrance IDs remain available. Dataset selection is persisted with the run and cannot be changed after connections are recorded. A narrow compatibility bridge also recognizes the immediately previous build's `tp-entrance-tracker:run:v2` format, validates it, and converts its metadata to schema 1 before writing to the stable key; the original value is not overwritten during migration. Older experimental formats are intentionally unsupported. A newer or unknown schema or dataset is not loaded, changed, or overwritten; the tracker shows a compatibility message and pauses autosave until the user explicitly imports a compatible run or resets. If localStorage is unavailable, the tracker remains usable and recommends **Export Run**.

Imports first resolve the save's dataset version, then validate placed location IDs, position values, entrance IDs, connection IDs, duplicate relationships, and one-way endpoint direction against those definitions before replacing the active run. Exports do not embed static location definitions.

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
