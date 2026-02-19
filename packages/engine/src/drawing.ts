import type {
  Stroke,
  Point,
  BezierCurve,
  EasingFunction,
  StrokeAnimationConfig,
  BoundingBox,
} from '@classflowai/types';
import { generateId } from '@classflowai/utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default number of interpolation steps between two points. */
const DEFAULT_INTERPOLATION_STEPS = 10;

/** Minimum number of points required for path smoothing. */
const MIN_POINTS_FOR_SMOOTHING = 3;

/** Default tension parameter for Catmull-Rom spline interpolation. */
const CATMULL_ROM_TENSION = 0.5;

/** Number of sub-segments generated between each pair of control points during smoothing. */
const SMOOTH_SEGMENTS_PER_SPAN = 8;

/** Base animation speed in pixels per millisecond. */
const BASE_PX_PER_MS = 0.35;

/** Minimum stroke animation duration (ms). */
const MIN_STROKE_ANIMATION_MS = 200;

/** Maximum stroke animation duration (ms). */
const MAX_STROKE_ANIMATION_MS = 8000;

/** Complexity multiplier applied per additional point in the stroke. */
const COMPLEXITY_FACTOR_PER_POINT = 1.02;

// ---------------------------------------------------------------------------
// 1. createStroke
// ---------------------------------------------------------------------------

/**
 * Create a new {@link Stroke} with a generated unique id and a defensive
 * copy of the provided points.
 */
export function createStroke(
  points: Point[],
  color: string = '#ffffff',
  width: number = 2,
  opacity: number = 1,
): Stroke {
  return {
    id: generateId('stroke'),
    points: [...points],
    color,
    width,
    opacity,
  };
}

// ---------------------------------------------------------------------------
// 2. interpolatePoints
// ---------------------------------------------------------------------------

/**
 * Generate evenly-spaced points along the straight line between {@link start}
 * and {@link end}.
 *
 * @param steps Number of segments (the returned array has `steps + 1` points).
 */
export function interpolatePoints(
  start: Point,
  end: Point,
  steps: number = DEFAULT_INTERPOLATION_STEPS,
): Point[] {
  const safeSteps = Math.max(1, Math.round(steps));
  const points: Point[] = [];
  for (let i = 0; i <= safeSteps; i++) {
    const t = i / safeSteps;
    points.push({
      x: start.x + (end.x - start.x) * t,
      y: start.y + (end.y - start.y) * t,
    });
  }
  return points;
}

// ---------------------------------------------------------------------------
// 3. simplifyPath  (Ramer-Douglas-Peucker)
// ---------------------------------------------------------------------------

/**
 * Reduce the number of points in a path using the Ramer–Douglas–Peucker
 * algorithm while preserving overall shape within the given {@link tolerance}.
 */
export function simplifyPath(points: Point[], tolerance: number = 1.0): Point[] {
  if (points.length <= 2) return [...points];

  let maxDistance = 0;
  let maxIndex = 0;
  const first = points[0]!;
  const last = points[points.length - 1]!;

  for (let i = 1; i < points.length - 1; i++) {
    const distance = perpendicularDistance(points[i]!, first, last);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = i;
    }
  }

  if (maxDistance > tolerance) {
    const left = simplifyPath(points.slice(0, maxIndex + 1), tolerance);
    const right = simplifyPath(points.slice(maxIndex), tolerance);
    return [...left.slice(0, -1), ...right];
  }

  return [first, last];
}

// ---------------------------------------------------------------------------
// 4. createBezierCurve
// ---------------------------------------------------------------------------

/**
 * Construct a {@link BezierCurve} from four control points.
 */
export function createBezierCurve(
  start: Point,
  cp1: Point,
  cp2: Point,
  end: Point,
): BezierCurve {
  return { start, cp1, cp2, end };
}

// ---------------------------------------------------------------------------
// 5. evaluateBezierPoint
// ---------------------------------------------------------------------------

/**
 * Evaluate a cubic Bézier curve at parameter {@link t} ∈ [0, 1].
 *
 * Uses the standard cubic Bernstein polynomial:
 *   B(t) = (1-t)³·P0 + 3(1-t)²t·P1 + 3(1-t)t²·P2 + t³·P3
 */
export function evaluateBezierPoint(curve: BezierCurve, t: number): Point {
  const ct = clamp01(t);
  const u = 1 - ct;
  const u2 = u * u;
  const u3 = u2 * u;
  const ct2 = ct * ct;
  const ct3 = ct2 * ct;

  return {
    x: u3 * curve.start.x + 3 * u2 * ct * curve.cp1.x + 3 * u * ct2 * curve.cp2.x + ct3 * curve.end.x,
    y: u3 * curve.start.y + 3 * u2 * ct * curve.cp1.y + 3 * u * ct2 * curve.cp2.y + ct3 * curve.end.y,
  };
}

// ---------------------------------------------------------------------------
// 6. splitBezierAt
// ---------------------------------------------------------------------------

/**
 * Split a cubic Bézier curve at parameter {@link t} using De Casteljau's
 * algorithm, returning two new sub-curves.
 */
export function splitBezierAt(
  curve: BezierCurve,
  t: number,
): [BezierCurve, BezierCurve] {
  const ct = clamp01(t);

  const a = lerpPoint(curve.start, curve.cp1, ct);
  const b = lerpPoint(curve.cp1, curve.cp2, ct);
  const c = lerpPoint(curve.cp2, curve.end, ct);

  const d = lerpPoint(a, b, ct);
  const e = lerpPoint(b, c, ct);

  const mid = lerpPoint(d, e, ct);

  const left: BezierCurve = { start: curve.start, cp1: a, cp2: d, end: mid };
  const right: BezierCurve = { start: mid, cp1: e, cp2: c, end: curve.end };

  return [left, right];
}

// ---------------------------------------------------------------------------
// 7. flattenBezier
// ---------------------------------------------------------------------------

/**
 * Flatten a cubic Bézier curve into an array of {@link Point}s by sampling
 * it at {@link segments} evenly-spaced parameter values.
 */
export function flattenBezier(curve: BezierCurve, segments: number = 20): Point[] {
  const safeSegments = Math.max(1, Math.round(segments));
  const points: Point[] = [];
  for (let i = 0; i <= safeSegments; i++) {
    points.push(evaluateBezierPoint(curve, i / safeSegments));
  }
  return points;
}

// ---------------------------------------------------------------------------
// 8. Easing Functions
// ---------------------------------------------------------------------------

/** Linear easing – no acceleration. */
export const easeLinear: EasingFunction = (t: number): number => clamp01(t);

/** Quadratic ease-in – starts slow. */
export const easeIn: EasingFunction = (t: number): number => {
  const ct = clamp01(t);
  return ct * ct;
};

/** Quadratic ease-out – ends slow. */
export const easeOut: EasingFunction = (t: number): number => {
  const ct = clamp01(t);
  return ct * (2 - ct);
};

/** Quadratic ease-in-out – starts and ends slow. */
export const easeInOut: EasingFunction = (t: number): number => {
  const ct = clamp01(t);
  return ct < 0.5 ? 2 * ct * ct : -1 + (4 - 2 * ct) * ct;
};

/**
 * Look up an {@link EasingFunction} by its string name.
 */
export function getEasingFunction(
  name: StrokeAnimationConfig['easing'],
): EasingFunction {
  switch (name) {
    case 'easeIn':
      return easeIn;
    case 'easeOut':
      return easeOut;
    case 'easeInOut':
      return easeInOut;
    case 'linear':
    default:
      return easeLinear;
  }
}

// ---------------------------------------------------------------------------
// 9. createStrokeAnimationConfig
// ---------------------------------------------------------------------------

/**
 * Build a {@link StrokeAnimationConfig} for a given stroke, optionally
 * overriding duration, easing, and delay.
 *
 * If {@link duration} is omitted it is estimated automatically via
 * {@link calculateStrokeAnimationDuration}.
 */
export function createStrokeAnimationConfig(
  stroke: Stroke,
  duration?: number,
  easing: StrokeAnimationConfig['easing'] = 'easeInOut',
  delay: number = 0,
): StrokeAnimationConfig {
  return {
    strokeId: stroke.id,
    duration: duration ?? calculateStrokeAnimationDuration(stroke),
    easing,
    delay,
  };
}

// ---------------------------------------------------------------------------
// 10. calculateBoundingBox
// ---------------------------------------------------------------------------

/**
 * Compute the axis-aligned {@link BoundingBox} that encloses all points in
 * a {@link Stroke}, accounting for the stroke's width.
 *
 * Returns a zero-area box at the origin for empty strokes.
 */
export function calculateBoundingBox(stroke: Stroke): BoundingBox {
  if (stroke.points.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const point of stroke.points) {
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.x > maxX) maxX = point.x;
    if (point.y > maxY) maxY = point.y;
  }

  const halfWidth = stroke.width / 2;

  return {
    x: minX - halfWidth,
    y: minY - halfWidth,
    width: maxX - minX + stroke.width,
    height: maxY - minY + stroke.width,
  };
}

// ---------------------------------------------------------------------------
// 11. calculateBoundingBoxForPoints
// ---------------------------------------------------------------------------

/**
 * Compute the axis-aligned {@link BoundingBox} for a raw array of points.
 *
 * Returns a zero-area box at the origin for empty arrays.
 */
export function calculateBoundingBoxForPoints(points: Point[]): BoundingBox {
  if (points.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const point of points) {
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.x > maxX) maxX = point.x;
    if (point.y > maxY) maxY = point.y;
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

// ---------------------------------------------------------------------------
// 12. calculatePathLength
// ---------------------------------------------------------------------------

/**
 * Calculate the total arc-length of a polyline defined by an ordered array
 * of {@link Point}s.
 */
export function calculatePathLength(points: Point[]): number {
  if (points.length < 2) return 0;

  let length = 0;
  for (let i = 1; i < points.length; i++) {
    length += distance(points[i - 1]!, points[i]!);
  }
  return length;
}

// ---------------------------------------------------------------------------
// 13. getPointAtDistance
// ---------------------------------------------------------------------------

/**
 * Walk along a polyline path and return the {@link Point} at the given
 * cumulative {@link targetDistance} from the start.
 *
 * If the target distance exceeds the path length, the last point is returned.
 * If the path is empty, `{ x: 0, y: 0 }` is returned.
 */
export function getPointAtDistance(points: Point[], targetDistance: number): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1 || targetDistance <= 0) return { ...points[0]! };

  let accumulated = 0;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]!;
    const curr = points[i]!;
    const segLen = distance(prev, curr);

    if (accumulated + segLen >= targetDistance) {
      const remaining = targetDistance - accumulated;
      const t = segLen === 0 ? 0 : remaining / segLen;
      return {
        x: prev.x + (curr.x - prev.x) * t,
        y: prev.y + (curr.y - prev.y) * t,
      };
    }

    accumulated += segLen;
  }

  return { ...points[points.length - 1]! };
}

// ---------------------------------------------------------------------------
// 14. getStrokeProgress
// ---------------------------------------------------------------------------

/**
 * Return the sub-path of a stroke's points that represents progress from
 * 0 (nothing drawn) to 1 (fully drawn).
 *
 * Progress is measured as a fraction of total arc-length so that animation
 * speed is uniform regardless of point density.
 */
export function getStrokeProgress(stroke: Stroke, progress: number): Point[] {
  if (stroke.points.length === 0) return [];
  if (progress <= 0) return [];
  if (progress >= 1) return [...stroke.points];

  const totalLength = calculatePathLength(stroke.points);
  const targetLength = totalLength * clamp01(progress);

  const result: Point[] = [{ ...stroke.points[0]! }];
  let accumulated = 0;

  for (let i = 1; i < stroke.points.length; i++) {
    const prev = stroke.points[i - 1]!;
    const curr = stroke.points[i]!;
    const segLen = distance(prev, curr);

    if (accumulated + segLen >= targetLength) {
      const remaining = targetLength - accumulated;
      const t = segLen === 0 ? 0 : remaining / segLen;
      result.push({
        x: prev.x + (curr.x - prev.x) * t,
        y: prev.y + (curr.y - prev.y) * t,
      });
      return result;
    }

    result.push({ ...curr });
    accumulated += segLen;
  }

  return result;
}

// ---------------------------------------------------------------------------
// 15. smoothPoints  (Catmull-Rom spline)
// ---------------------------------------------------------------------------

/**
 * Smooth a raw polyline using Catmull-Rom spline interpolation.
 *
 * For each consecutive trio of input points, the algorithm generates
 * {@link SMOOTH_SEGMENTS_PER_SPAN} intermediate points, producing a visually
 * smooth curve that still passes through every original point.
 *
 * If fewer than {@link MIN_POINTS_FOR_SMOOTHING} points are provided the
 * input is returned as-is.
 *
 * @param points  Raw input points.
 * @param tension Catmull-Rom tension (0 = uniform, 0.5 = centripetal). Defaults to `0.5`.
 */
export function smoothPoints(
  points: Point[],
  tension: number = CATMULL_ROM_TENSION,
): Point[] {
  if (points.length < MIN_POINTS_FOR_SMOOTHING) return [...points];

  const result: Point[] = [{ ...points[0]! }];

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)]!;
    const p1 = points[i]!;
    const p2 = points[Math.min(i + 1, points.length - 1)]!;
    const p3 = points[Math.min(i + 2, points.length - 1)]!;

    for (let s = 1; s <= SMOOTH_SEGMENTS_PER_SPAN; s++) {
      const t = s / SMOOTH_SEGMENTS_PER_SPAN;
      result.push(catmullRom(p0, p1, p2, p3, t, tension));
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// 16. calculateStrokeAnimationDuration
// ---------------------------------------------------------------------------

/**
 * Estimate an appropriate animation duration (ms) for a stroke based on its
 * total arc-length and point complexity.
 *
 * Longer and more complex strokes take proportionally more time, clamped
 * between {@link MIN_STROKE_ANIMATION_MS} and {@link MAX_STROKE_ANIMATION_MS}.
 */
export function calculateStrokeAnimationDuration(stroke: Stroke): number {
  if (stroke.points.length < 2) return MIN_STROKE_ANIMATION_MS;

  const pathLength = calculatePathLength(stroke.points);
  const complexityMultiplier = Math.pow(
    COMPLEXITY_FACTOR_PER_POINT,
    stroke.points.length,
  );
  const rawDuration = (pathLength / BASE_PX_PER_MS) * complexityMultiplier;

  return Math.round(
    Math.min(Math.max(rawDuration, MIN_STROKE_ANIMATION_MS), MAX_STROKE_ANIMATION_MS),
  );
}

// ---------------------------------------------------------------------------
// 17. mergeStrokes
// ---------------------------------------------------------------------------

/**
 * Merge two strokes into a single stroke, concatenating their point arrays.
 * The resulting stroke inherits the visual properties (color, width, opacity)
 * of the first stroke and receives a new id.
 */
export function mergeStrokes(a: Stroke, b: Stroke): Stroke {
  return {
    id: generateId('stroke'),
    points: [...a.points, ...b.points],
    color: a.color,
    width: a.width,
    opacity: a.opacity,
  };
}

// ---------------------------------------------------------------------------
// 18. scaleStroke
// ---------------------------------------------------------------------------

/**
 * Return a new {@link Stroke} whose points have been scaled by the given
 * factors relative to the provided {@link origin} point.
 *
 * Useful for fitting strokes into different canvas sizes.
 */
export function scaleStroke(
  stroke: Stroke,
  scaleX: number,
  scaleY: number,
  origin: Point = { x: 0, y: 0 },
): Stroke {
  return {
    ...stroke,
    id: generateId('stroke'),
    points: stroke.points.map((p) => ({
      x: origin.x + (p.x - origin.x) * scaleX,
      y: origin.y + (p.y - origin.y) * scaleY,
    })),
  };
}

// ---------------------------------------------------------------------------
// 19. translateStroke
// ---------------------------------------------------------------------------

/**
 * Return a new {@link Stroke} with all points offset by (dx, dy).
 */
export function translateStroke(stroke: Stroke, dx: number, dy: number): Stroke {
  return {
    ...stroke,
    id: generateId('stroke'),
    points: stroke.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Euclidean distance between two points. */
function distance(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Perpendicular distance from a point to the line defined by two endpoints. */
function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    const pdx = point.x - lineStart.x;
    const pdy = point.y - lineStart.y;
    return Math.sqrt(pdx * pdx + pdy * pdy);
  }

  const numerator = Math.abs(
    dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x,
  );
  return numerator / Math.sqrt(lengthSq);
}

/** Linearly interpolate between two points at parameter t. */
function lerpPoint(a: Point, b: Point, t: number): Point {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

/** Clamp a value to the [0, 1] range. */
function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

/**
 * Evaluate a Catmull-Rom spline segment defined by four control points at
 * parameter {@link t} ∈ [0, 1].
 */
function catmullRom(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  t: number,
  tension: number,
): Point {
  const t2 = t * t;
  const t3 = t2 * t;

  const s = (1 - tension) / 2;

  const b0 = -s * t3 + 2 * s * t2 - s * t;
  const b1 = (2 - s) * t3 + (s - 3) * t2 + 1;
  const b2 = (s - 2) * t3 + (3 - 2 * s) * t2 + s * t;
  const b3 = s * t3 - s * t2;

  return {
    x: b0 * p0.x + b1 * p1.x + b2 * p2.x + b3 * p3.x,
    y: b0 * p0.y + b1 * p1.y + b2 * p2.y + b3 * p3.y,
  };
}
