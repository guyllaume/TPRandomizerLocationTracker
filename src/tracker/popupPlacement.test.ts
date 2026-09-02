import { describe, expect, it } from "vitest";
import {
  choosePopupSide,
  getPopupOffsetForMarker,
  type ScreenRect,
} from "./popupPlacement";

function rect(left: number, top: number, width: number, height: number): ScreenRect {
  return { left, top, width, height, right: left + width, bottom: top + height };
}

describe("anchored map popup placement", () => {
  const viewport = rect(0, 0, 800, 600);
  const popup = { width: 300, height: 250 };

  it("prefers the right side when the card fits", () => {
    expect(choosePopupSide(rect(380, 280, 24, 20), viewport, popup)).toBe("right");
  });

  it("flips to the left near the right edge", () => {
    expect(choosePopupSide(rect(760, 280, 24, 20), viewport, popup)).toBe("left");
  });

  it("uses an above or below placement when neither side fits cleanly", () => {
    expect(choosePopupSide(rect(380, 570, 24, 20), viewport, popup)).toBe("top");
    expect(choosePopupSide(rect(380, 5, 24, 20), viewport, popup)).toBe("bottom");
  });

  it("keeps the popup gap aligned to a constant-size marker across zoom levels", () => {
    expect(getPopupOffsetForMarker("right", 0.25)).toBe(24.75);
    expect(getPopupOffsetForMarker("right", 1)).toBe(12);
    expect(getPopupOffsetForMarker("right", 2)).toBe(-5);
  });
});
