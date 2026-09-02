// @vitest-environment jsdom

import { ReactFlow, type NodeTypes } from "@xyflow/react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useMemo, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearSelectedLocationNodes, selectLocationNode } from "../tracker/locationJump";
import type { LocationFlowNode } from "../types/tracker";
import type { LocationNodeData } from "../types/tracker";
import { MapCoordinateProbe } from "./MapCoordinateProbe";
import { LocationNode } from "./LocationNode";
import { LocationMarkerButton } from "./MapLocationMarker";

afterEach(cleanup);

class TestResizeObserver implements ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = TestResizeObserver;
Object.defineProperty(window, "DOMMatrixReadOnly", {
  configurable: true,
  value: class TestDOMMatrixReadOnly {
    m22 = 1;
  },
});

const nodeTypes: NodeTypes = { location: LocationNode };

function markerData(overrides: Partial<LocationNodeData> = {}): LocationNodeData {
  return {
    location: {
      id: "ordon-spring",
      name: "Ordon Spring",
      hasWarp: true,
      mapPosition: { x: 0.48, y: 0.93 },
      locationKind: "overworld",
      primaryGroup: "Ordona Province",
      entrances: [],
    },
    connectedEntranceIds: [],
    accessible: false,
    cleared: false,
    presentation: "expanded",
    warpRouteEntranceIds: [],
    ...overrides,
  };
}

function popupNode(id: string, name: string, x: number): LocationFlowNode {
  return {
    id,
    type: "location",
    position: { x, y: 120 },
    width: 34,
    height: 28,
    origin: [0.5, 0.5],
    className: "map-positioned-node",
    draggable: false,
    focusable: false,
    data: markerData({
      location: {
        ...markerData().location,
        id,
        name,
        mapPosition: { x: x / 800, y: 0.2 },
        entrances: [{
          id: `${id}--door`,
          name: "Test entrance",
          type: "interior",
          direction: "both",
        }],
      },
    }),
  };
}

function PopupHarness() {
  const [nodes, setNodes] = useState<LocationFlowNode[]>([
    popupNode("marker-a", "Marker A", 220),
    popupNode("marker-b", "Marker B", 520),
  ]);
  const displayNodes = useMemo(() => nodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      focusState: node.selected ? "selected" as const : undefined,
      onSelectLocation: (locationId: string) => {
        setNodes((current) => selectLocationNode(current, locationId));
      },
      onClearSelection: () => setNodes(clearSelectedLocationNodes),
    },
  })), [nodes]);

  return (
    <div className="map-viewport" style={{ width: 800, height: 600 }}>
      <ReactFlow
        nodes={displayNodes}
        edges={[]}
        nodeTypes={nodeTypes}
        defaultViewport={{ x: 0, y: 0, zoom: 1.5 }}
        minZoom={0.25}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <MapCoordinateProbe />
      </ReactFlow>
    </div>
  );
}

describe("compact map location marker", () => {
  it("renders a semantic marker and a name-only tooltip instead of a location card", () => {
    const { container } = render(
      <LocationMarkerButton
        id="ordon-spring"
        data={markerData()}
        selected={false}
        onSelect={() => undefined}
      />,
    );

    expect(screen.getByRole("button", { name: /Ordon Spring/ })).toBeTruthy();
    expect(screen.getByRole("tooltip").textContent).toBe("Ordon Spring");
    expect(container.querySelector("[data-location-card]")).toBeNull();
  });

  it("selects through click, Enter, and Space activation", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <LocationMarkerButton
        id="ordon-spring"
        data={markerData()}
        selected={false}
        onSelect={onSelect}
      />,
    );
    const marker = screen.getByRole("button", { name: /Ordon Spring/ });

    await user.click(marker);
    marker.focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");

    expect(onSelect).toHaveBeenCalledTimes(3);
  });

  it("keeps cleared, warp, and focus state visible on the compact marker", () => {
    const { container } = render(
      <LocationMarkerButton
        id="ordon-spring"
        data={markerData({
          accessible: true,
          cleared: true,
          focusState: "warp-destination",
        })}
        selected
        onSelect={() => undefined}
      />,
    );
    const marker = screen.getByRole("button", {
      name: "Ordon Spring, cleared, warp active",
    });

    expect(marker.classList.contains("is-cleared")).toBe(true);
    expect(marker.classList.contains("is-selected")).toBe(true);
    expect(marker.classList.contains("is-warp-destination")).toBe(true);
    expect(container.querySelector(".map-marker-warp")).not.toBeNull();
    expect(container.querySelector(".map-marker-cleared")?.textContent).toBe("✓");
  });

  it("toggles the coordinate readout and copies the current point with C", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const { container } = render(<PopupHarness />);
    const viewport = container.querySelector(".map-viewport");

    fireEvent.click(screen.getByRole("button", { name: "Show coordinates" }));
    expect(screen.getByLabelText("Normalized map cursor coordinates").textContent)
      .toContain("Move over the map");
    expect(viewport?.classList.contains("is-coordinate-probe-active")).toBe(true);

    fireEvent.pointerMove(viewport as Element, { clientX: 600, clientY: 600 });
    await waitFor(() => {
      expect(screen.getByLabelText("Normalized map cursor coordinates").textContent)
        .toContain("{ \"x\":");
    });
    fireEvent.keyDown(window, { key: "c" });
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringMatching(
      /^\{ "x": 0\.\d{4}, "y": 0\.\d{4} \}$/,
    )));

    fireEvent.click(screen.getByRole("button", { name: "Hide coordinates" }));
    expect(screen.queryByLabelText("Normalized map cursor coordinates")).toBeNull();
    expect(viewport?.classList.contains("is-coordinate-probe-active")).toBe(false);
  });

  it("shows one reused card popup, switches it, and closes through selection clearing", async () => {
    const { container } = render(<PopupHarness />);

    fireEvent.click(screen.getByRole("button", { name: /Marker A/ }));
    expect(container.ownerDocument.querySelectorAll("[data-location-card]")).toHaveLength(1);
    expect(container.ownerDocument.querySelector("[data-location-card]")?.getAttribute("data-location-card"))
      .toBe("marker-a");
    expect((container.ownerDocument.querySelector(".map-location-popup-frame") as HTMLElement).style.transform)
      .toBe("scale(1.5)");
    expect(container.ownerDocument.querySelector(".map-location-popup .entrance-row")).not.toBeNull();
    expect(container.ownerDocument.querySelector(".map-location-popup .entrance-handle.connectablestart"))
      .not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Marker B/ }));
    expect(container.ownerDocument.querySelectorAll("[data-location-card]")).toHaveLength(1);
    expect(container.ownerDocument.querySelector("[data-location-card]")?.getAttribute("data-location-card"))
      .toBe("marker-b");

    fireEvent.click(screen.getByRole("button", { name: "Close Marker B location details" }));
    expect(container.ownerDocument.querySelector("[data-location-card]")).toBeNull();
  });
});
