import type { MiniMapNodeProps } from "@xyflow/react";
import greenWarpIcon from "../../icons/ezgif-482ef2a92ce44a3f.png";
import redWarpIcon from "../../icons/ezgif-4cc6456631015bee.png";

export function TrackerMiniMapNode({
  id,
  x,
  y,
  width,
  height,
  borderRadius,
  className,
  color,
  strokeColor,
  strokeWidth,
  shapeRendering,
  selected,
  onClick,
}: MiniMapNodeProps) {
  const isStart = className.includes("is-start");
  const hasActiveWarp = className.includes("has-active-warp");
  const hasInactiveWarp = className.includes("has-inactive-warp");
  const markerSize = Math.max(44, Math.min(width, height) * 0.68);
  const markerX = x + width / 2;
  const markerY = y + height / 2;
  const startMarkerSize = Math.max(52, Math.min(width, height) * 0.72);

  return (
    <g
      className={`tracker-minimap-node ${className} ${selected ? "is-selected" : ""}`.trim()}
      onClick={onClick ? (event) => onClick(event, id) : undefined}
    >
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={borderRadius}
        ry={borderRadius}
        fill={color}
        stroke={selected ? "var(--accent-bright)" : strokeColor}
        strokeWidth={selected ? Math.max(5, strokeWidth ?? 0) : strokeWidth}
        shapeRendering={shapeRendering}
        vectorEffect="non-scaling-stroke"
      />
      {isStart && (
        <text
          className="tracker-minimap-start"
          x={x + width / 2}
          y={y + height / 2}
          fontSize={startMarkerSize}
          textAnchor="middle"
          dominantBaseline="central"
          aria-hidden="true"
        >S</text>
      )}
      {!isStart && (hasActiveWarp || hasInactiveWarp) && (
        <image
          className="tracker-minimap-warp"
          href={hasActiveWarp ? greenWarpIcon : redWarpIcon}
          x={markerX - markerSize / 2}
          y={markerY - markerSize / 2}
          width={markerSize}
          height={markerSize}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        />
      )}
    </g>
  );
}
