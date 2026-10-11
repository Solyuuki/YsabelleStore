import type { CategoryCoverPosition } from "@/services/categoryApi";

export type CategoryCoverHorizontalFocus = "LEFT" | "CENTER" | "RIGHT";
export type CategoryCoverVerticalFocus = "TOP" | "CENTER" | "BOTTOM";

export type CategoryCoverCropState = {
  horizontalActive: boolean;
  horizontalPx: number;
  verticalActive: boolean;
  verticalPx: number;
};

export function splitCoverPosition(position: CategoryCoverPosition): {
  horizontal: CategoryCoverHorizontalFocus;
  vertical: CategoryCoverVerticalFocus;
} {
  switch (position) {
    case "TOP_LEFT":
      return { horizontal: "LEFT", vertical: "TOP" };
    case "TOP":
      return { horizontal: "CENTER", vertical: "TOP" };
    case "TOP_RIGHT":
      return { horizontal: "RIGHT", vertical: "TOP" };
    case "LEFT":
      return { horizontal: "LEFT", vertical: "CENTER" };
    case "RIGHT":
      return { horizontal: "RIGHT", vertical: "CENTER" };
    case "BOTTOM_LEFT":
      return { horizontal: "LEFT", vertical: "BOTTOM" };
    case "BOTTOM":
      return { horizontal: "CENTER", vertical: "BOTTOM" };
    case "BOTTOM_RIGHT":
      return { horizontal: "RIGHT", vertical: "BOTTOM" };
    default:
      return { horizontal: "CENTER", vertical: "CENTER" };
  }
}

export function composeCoverPosition(
  horizontal: CategoryCoverHorizontalFocus,
  vertical: CategoryCoverVerticalFocus
): CategoryCoverPosition {
  if (vertical === "TOP") {
    if (horizontal === "LEFT") return "TOP_LEFT";
    if (horizontal === "RIGHT") return "TOP_RIGHT";
    return "TOP";
  }

  if (vertical === "BOTTOM") {
    if (horizontal === "LEFT") return "BOTTOM_LEFT";
    if (horizontal === "RIGHT") return "BOTTOM_RIGHT";
    return "BOTTOM";
  }

  return horizontal;
}

export function categoryCoverObjectPosition(position: CategoryCoverPosition) {
  const focus = splitCoverPosition(position);
  return `${focus.horizontal.toLowerCase()} ${focus.vertical.toLowerCase()}`;
}

export function calculateCategoryCoverCrop(
  sourceWidth: number,
  sourceHeight: number,
  frameWidth: number,
  frameHeight: number
): CategoryCoverCropState {
  if (sourceWidth <= 0 || sourceHeight <= 0 || frameWidth <= 0 || frameHeight <= 0) {
    return {
      horizontalActive: false,
      horizontalPx: 0,
      verticalActive: false,
      verticalPx: 0
    };
  }

  const scale = Math.max(frameWidth / sourceWidth, frameHeight / sourceHeight);
  const renderedWidth = sourceWidth * scale;
  const renderedHeight = sourceHeight * scale;
  const horizontalPx = Math.max(0, renderedWidth - frameWidth);
  const verticalPx = Math.max(0, renderedHeight - frameHeight);

  return {
    horizontalActive: horizontalPx > 0.5,
    horizontalPx,
    verticalActive: verticalPx > 0.5,
    verticalPx
  };
}
