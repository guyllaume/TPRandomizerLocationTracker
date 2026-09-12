import type { ChangeEvent, RefObject } from "react";
import tpRandomizerMainIcon from "../../icons/TPrandomizerMainIcon.jpg";
import { APP_VERSION } from "../tracker/constants";
import type { LocationSearchItem } from "../tracker/locationSearch";
import type { ThemePreference } from "../tracker/uiPreferences";
import type { ArrowMode, DatasetVersion } from "../types/tracker";
import { LocationQuickJump } from "./LocationQuickJump";

interface TrackerToolbarProps {
  seedName: string;
  datasetVersion: DatasetVersion;
  datasetVersionLocked: boolean;
  locations: readonly LocationSearchItem[];
  placedLocationIds: ReadonlySet<string>;
  connectionCount: number;
  selectedLocationCount: number;
  canUndo: boolean;
  canRedo: boolean;
  showMinimap: boolean;
  defaultArrowMode: ArrowMode;
  theme: ThemePreference;
  importInputRef: RefObject<HTMLInputElement | null>;
  onSeedNameChange: (value: string) => void;
  onDatasetVersionChange: (version: DatasetVersion) => void;
  onSelectLocation: (locationId: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
  onImportClick: () => void;
  onImportFile: (event: ChangeEvent<HTMLInputElement>) => void;
  onReset: () => void;
  onFitView: () => void;
  onToggleMinimap: () => void;
  onDefaultArrowModeChange: (mode: ArrowMode) => void;
  onThemeChange: (theme: ThemePreference) => void;
}

export function TrackerToolbar({
  seedName,
  datasetVersion,
  datasetVersionLocked,
  locations,
  placedLocationIds,
  connectionCount,
  selectedLocationCount,
  canUndo,
  canRedo,
  showMinimap,
  defaultArrowMode,
  theme,
  importInputRef,
  onSeedNameChange,
  onDatasetVersionChange,
  onSelectLocation,
  onUndo,
  onRedo,
  onExport,
  onImportClick,
  onImportFile,
  onReset,
  onFitView,
  onToggleMinimap,
  onDefaultArrowModeChange,
  onThemeChange,
}: TrackerToolbarProps) {
  return (
    <header className="tracker-toolbar">
      <div className="brand">
        <div className="brand-mark" aria-hidden="true">
          <img src={tpRandomizerMainIcon} alt="" />
        </div>
        <div className="brand-copy">
          <h1>Entrance Tracker</h1>
          <p>
            {connectionCount} connection{connectionCount === 1 ? "" : "s"}
            <span className="app-version"> &middot; v{APP_VERSION}</span>
          </p>
        </div>
      </div>

      <div className="toolbar-groups">
        <section className="toolbar-group run-group" aria-label="Run controls">
          <span className="toolbar-group-label">Run</span>
          <label className="seed-field">
            <span className="visually-hidden">Run name</span>
            <input
              value={seedName}
              onChange={(event) => onSeedNameChange(event.target.value)}
              placeholder="Run name / seed"
              maxLength={100}
            />
          </label>
          <details className="toolbar-menu">
            <summary>Run actions</summary>
            <div className="toolbar-menu-popover run-menu-popover">
              <label className="menu-field">
                <span>Location dataset</span>
                <select
                  value={datasetVersion}
                  disabled={datasetVersionLocked}
                  onChange={(event) => onDatasetVersionChange(event.target.value as DatasetVersion)}
                  title={datasetVersionLocked
                    ? "Remove recorded connections before changing location datasets"
                    : "Choose the location definitions for this run"}
                >
                  <option value="0.2">v0.2 Current (recommended)</option>
                  <option value="0.1">v0.1 Legacy / pre-v0.2</option>
                </select>
              </label>
              <div className="menu-actions">
                <button type="button" onClick={onExport}>Export Run</button>
                <button type="button" onClick={onImportClick}>Import Run</button>
                <button type="button" className="danger-button" onClick={onReset}>Reset Run</button>
              </div>
            </div>
          </details>
          <input
            ref={importInputRef}
            className="visually-hidden"
            type="file"
            accept="application/json,.json"
            onChange={onImportFile}
            tabIndex={-1}
          />
        </section>

        <section className="toolbar-group navigation-group" aria-label="Navigation controls">
          <span className="toolbar-group-label">Navigation</span>
          <LocationQuickJump
            locations={locations}
            includedLocationIds={placedLocationIds}
            onSelectLocation={onSelectLocation}
          />
          <button type="button" className="toolbar-button" onClick={onFitView}>Fit View</button>
        </section>

        <section className="toolbar-group editing-group" aria-label="Editing controls">
          <span className="toolbar-group-label">Editing</span>
          <div className="editing-actions">
            <button
              type="button"
              className="toolbar-button"
              onClick={onUndo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
            >Undo</button>
            <button
              type="button"
              className="toolbar-button"
              onClick={onRedo}
              disabled={!canRedo}
              title="Redo (Ctrl+Y or Ctrl+Shift+Z)"
            >Redo</button>
          </div>
          <p
            className={`selection-count ${selectedLocationCount > 1 ? "" : "is-placeholder"}`.trim()}
            role="status"
            aria-hidden={selectedLocationCount <= 1}
          >
            {selectedLocationCount > 1 ? `${selectedLocationCount} selected` : "0 selected"}
          </p>
        </section>

        <section className="toolbar-group view-group" aria-label="View and settings controls">
          <span className="toolbar-group-label">View</span>
          <label className="theme-field">
            <span className="visually-hidden">Theme</span>
            <select
              value={theme}
              onChange={(event) => onThemeChange(event.target.value as ThemePreference)}
              aria-label="Application theme"
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <details className="toolbar-menu toolbar-menu-align-right">
            <summary>Settings</summary>
            <div className="toolbar-menu-popover view-menu-popover">
              <label className="menu-field">
                <span>New connection arrows</span>
                <select
                  value={defaultArrowMode}
                  onChange={(event) => onDefaultArrowModeChange(event.target.value as ArrowMode)}
                >
                  <option value="forward">→ Forward</option>
                  <option value="reverse">← Reverse</option>
                  <option value="bidirectional">↔ Bidirectional</option>
                </select>
              </label>
              <button type="button" onClick={onToggleMinimap} aria-pressed={showMinimap}>
                {showMinimap ? "Hide minimap" : "Show minimap"}
              </button>
            </div>
          </details>
        </section>
      </div>
    </header>
  );
}
