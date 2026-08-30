import type { ChangeEvent, RefObject } from "react";
import type { LocationSearchItem } from "../tracker/locationSearch";
import type { ArrowMode } from "../types/tracker";
import tpRandomizerMainIcon from "../../icons/TPrandomizerMainIcon.jpg";
import { LocationQuickJump } from "./LocationQuickJump";

interface TrackerToolbarProps {
  seedName: string;
  locations: readonly LocationSearchItem[];
  placedLocationIds: ReadonlySet<string>;
  connectionCount: number;
  showMinimap: boolean;
  defaultArrowMode: ArrowMode;
  importInputRef: RefObject<HTMLInputElement | null>;
  onSeedNameChange: (value: string) => void;
  onSelectLocation: (locationId: string) => void;
  onExport: () => void;
  onImportClick: () => void;
  onImportFile: (event: ChangeEvent<HTMLInputElement>) => void;
  onReset: () => void;
  onFitView: () => void;
  onToggleMinimap: () => void;
  onDefaultArrowModeChange: (mode: ArrowMode) => void;
}

export function TrackerToolbar({
  seedName,
  locations,
  placedLocationIds,
  connectionCount,
  showMinimap,
  defaultArrowMode,
  importInputRef,
  onSeedNameChange,
  onSelectLocation,
  onExport,
  onImportClick,
  onImportFile,
  onReset,
  onFitView,
  onToggleMinimap,
  onDefaultArrowModeChange,
}: TrackerToolbarProps) {
  return (
    <header className="tracker-toolbar">
      <div className="brand">
        <div className="brand-mark" aria-hidden="true">
          <img src={tpRandomizerMainIcon} alt="Twilight Princess Randomizer logo" />
        </div>
        <div>
          <h1>Entrance Tracker</h1>
          <p>{connectionCount} discovered connection{connectionCount === 1 ? "" : "s"}</p>
        </div>
      </div>

      <LocationQuickJump
        locations={locations}
        includedLocationIds={placedLocationIds}
        onSelectLocation={onSelectLocation}
      />

      <label className="seed-field">
        <span>Run name</span>
        <input
          value={seedName}
          onChange={(event) => onSeedNameChange(event.target.value)}
          placeholder="Seed 473829"
          maxLength={100}
        />
      </label>

      <label className="default-direction-field">
        <span>New arrows</span>
        <select
          value={defaultArrowMode}
          onChange={(event) => onDefaultArrowModeChange(event.target.value as ArrowMode)}
          aria-label="Default direction for new connections"
        >
          <option value="forward">→ Forward</option>
          <option value="reverse">← Reverse</option>
          <option value="bidirectional">↔ Bidirectional</option>
        </select>
      </label>

      <div className="toolbar-actions">
        <button type="button" onClick={onFitView}>Fit View</button>
        <button type="button" onClick={onToggleMinimap} aria-pressed={showMinimap}>
          {showMinimap ? "Hide map" : "Show map"}
        </button>
        <button type="button" onClick={onExport}>Export Run</button>
        <button type="button" onClick={onImportClick}>Import Run</button>
        <input
          ref={importInputRef}
          className="visually-hidden"
          type="file"
          accept="application/json,.json"
          onChange={onImportFile}
          tabIndex={-1}
        />
        <button type="button" className="danger-button" onClick={onReset}>Reset Run</button>
      </div>
    </header>
  );
}
