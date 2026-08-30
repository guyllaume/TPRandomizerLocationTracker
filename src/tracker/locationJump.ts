import type { FitViewOptions } from "@xyflow/react";
import type { LocationFlowNode } from "../types/tracker";

interface LocationViewport {
  fitView: (options?: FitViewOptions<LocationFlowNode>) => Promise<boolean>;
}

export function selectLocationNode(
  nodes: LocationFlowNode[],
  locationId: string,
): LocationFlowNode[] {
  if (!nodes.some((node) => node.id === locationId)) return nodes;

  return nodes.map((node) => {
    const selected = node.id === locationId;
    return node.selected === selected ? node : { ...node, selected };
  });
}

export function bringLocationIntoView(
  viewport: LocationViewport | null,
  locationId: string,
): Promise<boolean> {
  if (!viewport) return Promise.resolve(false);
  return viewport.fitView({
    nodes: [{ id: locationId }],
    padding: 0.45,
    maxZoom: 1,
    duration: 400,
  });
}
