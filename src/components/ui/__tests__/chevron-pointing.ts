import type { Direction } from "../icons";

interface Point {
  x: number;
  y: number;
}

/** The corners of a polyline drawn with M, L and l. */
function corners(d: string): Point[] {
  const points: Point[] = [];
  let command = "M";
  let at: Point = { x: 0, y: 0 };
  const tokens = d.match(/[MLml]|-?(?:\d+\.?\d*|\.\d+)/g) ?? [];
  for (let i = 0; i < tokens.length; ) {
    if (/[MLml]/.test(tokens[i])) {
      command = tokens[i++];
      continue;
    }
    const x = Number(tokens[i++]);
    const y = Number(tokens[i++]);
    at = command === command.toLowerCase() ? { x: at.x + x, y: at.y + y } : { x, y };
    points.push(at);
  }
  return points;
}

/** Applies an SVG `rotate(angle cx cy)` transform. y points down, so a positive angle turns clockwise on screen. */
function rotated(transform: string | null) {
  if (!transform) return (p: Point) => p;
  const match = transform.match(/^rotate\((-?[\d.]+) (-?[\d.]+) (-?[\d.]+)\)$/);
  if (!match) throw new Error(`unsupported transform ${transform}`);
  const [angle, cx, cy] = match.slice(1).map(Number);
  const cos = Math.cos((angle * Math.PI) / 180);
  const sin = Math.sin((angle * Math.PI) / 180);
  return ({ x, y }: Point) => ({ x: cx + (x - cx) * cos - (y - cy) * sin, y: cy + (x - cx) * sin + (y - cy) * cos });
}

/** Where a chevron glyph points on screen: from the middle of its two ends toward its corner. */
export function chevronPointing(svg: Element): Direction {
  const path = svg.querySelector("path");
  if (!path) throw new Error("no chevron path");
  const points = corners(path.getAttribute("d") ?? "").map(rotated(path.getAttribute("transform")));
  if (points.length !== 3) throw new Error(`a chevron has three corners, got ${points.length}`);
  const [start, tip, end] = points;
  const dx = tip.x - (start.x + end.x) / 2;
  const dy = tip.y - (start.y + end.y) / 2;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}
