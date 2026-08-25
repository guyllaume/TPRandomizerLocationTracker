# TP Entrance Tracker

TP Entrance Tracker is a lightweight visual graph for recording discovered entrance connections in **The Legend of Zelda: Twilight Princess Randomizer**. It is aimed at entrance-randomized runs: drag a connection from one named entrance to another, arrange the regions to suit the run, and keep a portable JSON backup.

This repository currently contains a polished six-region prototype. The entrance names are representative sample data, not the complete TP Randomizer entrance dataset.

## MVP features

- Six draggable region nodes with a separate connection handle for every entrance
- Pan, zoom, fit-view, minimap, selectable arrows, edge deletion, edge reconnection, and configurable arrow direction
- Connected-state indicators and discovered counts on every region
- Editable run/seed name
- Configurable default direction for newly created arrows
- Automatic browser persistence for node positions, connections, settings, and run name
- Validated JSON import/export that leaves the active run untouched on a failed import
- Confirmed reset action and a visible warning when browser storage cannot be used
- Responsive light/dark styling without game artwork or external assets

## Technology

- React and TypeScript
- Vite
- [React Flow (`@xyflow/react`)](https://reactflow.dev/)
- Vitest and ESLint
- Cloudflare Workers Static Assets through the Cloudflare Vite plugin and Wrangler

Static game definitions live in `src/data/regions.ts`. Browser/run state and its versioned schema live separately under `src/types`, `src/tracker`, and `src/hooks`, so the prototype dataset can later be replaced without embedding game data in save files.

## Local setup

Requires a current Node.js LTS release and npm.

```bash
npm install
npm run dev
```

Vite prints the local development URL. Other useful commands are:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run preview
```

## Saving and backups

The app autosaves meaningful changes to the stable localStorage key `tp-entrance-tracker:run:v1`. A save includes schema and tracker versions, save timestamp, optional seed name, node positions, discovered handle-to-handle connections, and settings. It does **not** include the static Twilight Princess dataset.

Invalid or corrupt stored data is ignored instead of crashing the app. If localStorage reads or writes fail (including in restrictive/private browsing configurations), the tracker remains usable and displays a recommendation to use **Export Run**.

**Export Run** downloads a readable, versioned JSON file named from the seed or current date. **Import Run** validates the schema, timestamp, positions, region/entrance references, connection IDs, and duplicate relationships before replacing the current in-memory run. Keep exports as portable backups or to move a run between browsers.

## Cloudflare deployment

The project targets the existing Cloudflare Worker application named `tp-entrance-tracker`. `vite.config.ts` enables the official Cloudflare Vite integration; `wrangler.jsonc` supplies the application name, compatibility date, and `single-page-application` static-asset fallback. The plugin determines the Vite client build output and generates the deployment configuration during `vite build`, so no backend Worker entry point is needed.

For a local authenticated deployment:

```bash
npm run deploy
```

For Cloudflare Git deployments, use `npm run build` as the build command. The repository configuration is ready to build and serve the React SPA as Workers Static Assets; account, domain, and dashboard setup intentionally remain external.

## Prototype data limitation

Only Kakariko Village, Hyrule Field, Castle Town, Lake Hylia, Faron Woods, and Snowpeak are included. Their entrances are plausible UI test data. A later data pass should replace `src/data/regions.ts` with the authoritative TP Randomizer dataset and define any migration policy needed for saved region/entrance IDs.
