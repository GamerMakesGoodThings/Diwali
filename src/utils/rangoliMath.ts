export type Point2D = [number, number];

export interface RangoliStroke {
  color: number; // Index into palette array
  width: number; // Stroke width (1 to 8)
  points: Point2D[]; // Normalized coordinates [0..1, 0..1]
}

export type SymmetryAxis = 6 | 8 | 12;

/**
 * Quantizes a normalized coordinate to 3 decimal places in [0, 1].
 */
export function quantizeCoord(val: number): number {
  const clamped = Math.max(0, Math.min(1, val));
  return Math.round(clamped * 1000) / 1000;
}

/**
 * Computes perpendicular distance from point P to segment AB.
 */
export function perpendicularDistance(pt: Point2D, lineStart: Point2D, lineEnd: Point2D): number {
  const dx = lineEnd[0] - lineStart[0];
  const dy = lineEnd[1] - lineStart[1];
  const magSq = dx * dx + dy * dy;
  if (magSq === 0) {
    return Math.hypot(pt[0] - lineStart[0], pt[1] - lineStart[1]);
  }
  const u = ((pt[0] - lineStart[0]) * dx + (pt[1] - lineStart[1]) * dy) / magSq;
  const clampedU = Math.max(0, Math.min(1, u));
  const projX = lineStart[0] + clampedU * dx;
  const projY = lineStart[1] + clampedU * dy;
  return Math.hypot(pt[0] - projX, pt[1] - projY);
}

/**
 * Ramer-Douglas-Peucker (RDP) polyline simplification algorithm.
 * Reduces raw pointer drag points to compact, smooth geometric keypoints.
 */
export function simplifyStrokeRDP(points: Point2D[], epsilon = 0.006): Point2D[] {
  if (points.length <= 2) {
    return points.map(([x, y]) => [quantizeCoord(x), quantizeCoord(y)]);
  }

  let maxDist = 0;
  let index = 0;
  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], start, end);
    if (dist > maxDist) {
      index = i;
      maxDist = dist;
    }
  }

  if (maxDist > epsilon) {
    const left = simplifyStrokeRDP(points.slice(0, index + 1), epsilon);
    const right = simplifyStrokeRDP(points.slice(index), epsilon);
    return [...left.slice(0, -1), ...right];
  }

  return [
    [quantizeCoord(start[0]), quantizeCoord(start[1])],
    [quantizeCoord(end[0]), quantizeCoord(end[1])],
  ];
}

/**
 * Transforms a single normalized point [x, y] around center [0.5, 0.5]
 * by rotation angle (radians) and optional mirror reflection across the axis.
 */
export function transformKaleidoscopePoint(
  pt: Point2D,
  angleRad: number,
  reflect: boolean
): Point2D {
  const cx = 0.5;
  const cy = 0.5;
  const dx = pt[0] - cx;
  const dy = reflect ? -(pt[1] - cy) : pt[1] - cy;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const rx = cx + dx * cos - dy * sin;
  const ry = cy + dx * sin + dy * cos;
  return [rx, ry];
}

/**
 * Converts a sequence of normalized points into a smooth SVG quadratic Bezier path string.
 */
export function pointsToSmoothSvgPath(points: Point2D[], size = 400): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    const x = (points[0][0] * size).toFixed(1);
    const y = (points[0][1] * size).toFixed(1);
    return `M ${x} ${y} L ${x} ${y}`;
  }
  if (points.length === 2) {
    const x0 = (points[0][0] * size).toFixed(1);
    const y0 = (points[0][1] * size).toFixed(1);
    const x1 = (points[1][0] * size).toFixed(1);
    const y1 = (points[1][1] * size).toFixed(1);
    return `M ${x0} ${y0} L ${x1} ${y1}`;
  }

  let d = `M ${(points[0][0] * size).toFixed(1)} ${(points[0][1] * size).toFixed(1)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const curr = points[i];
    const next = points[i + 1];
    const midX = (((curr[0] + next[0]) / 2) * size).toFixed(1);
    const midY = (((curr[1] + next[1]) / 2) * size).toFixed(1);
    const cx = (curr[0] * size).toFixed(1);
    const cy = (curr[1] * size).toFixed(1);
    d += ` Q ${cx} ${cy} ${midX} ${midY}`;
  }
  const last = points[points.length - 1];
  d += ` L ${(last[0] * size).toFixed(1)} ${(last[1] * size).toFixed(1)}`;
  return d;
}

export interface RenderedMandalaPath {
  d: string;
  color: string;
  width: number;
  strokeIndex: number;
}

/**
 * Expands compact base strokes across N radial axes (with dihedral reflection)
 * into SVG path descriptors ready for rendering or OpenGraph card embedding.
 */
export function buildKaleidoscopeSvgPaths(
  strokes: RangoliStroke[],
  symmetry: SymmetryAxis,
  palette: string[],
  canvasSize = 400
): RenderedMandalaPath[] {
  const result: RenderedMandalaPath[] = [];
  const safePalette = palette.length > 0 ? palette : ['#F4A300', '#C2185B', '#283593', '#10B981'];
  const angleStep = (Math.PI * 2) / symmetry;

  strokes.forEach((stroke, strokeIndex) => {
    if (!stroke.points || stroke.points.length === 0) return;
    const colorHex = safePalette[Math.abs(stroke.color) % safePalette.length];
    const width = Math.max(1, Math.min(8, stroke.width || 3));

    for (let axis = 0; axis < symmetry; axis++) {
      const angle = axis * angleStep;

      // Primary rotated petal
      const rotatedPts = stroke.points.map((pt) => transformKaleidoscopePoint(pt, angle, false));
      result.push({
        d: pointsToSmoothSvgPath(rotatedPts, canvasSize),
        color: colorHex,
        width,
        strokeIndex,
      });

      // Mirrored dihedral petal
      const reflectedPts = stroke.points.map((pt) => transformKaleidoscopePoint(pt, angle, true));
      result.push({
        d: pointsToSmoothSvgPath(reflectedPts, canvasSize),
        color: colorHex,
        width,
        strokeIndex,
      });
    }
  });

  return result;
}

/**
 * Calculates the UTF-8 byte size of the serialized rangoli payload.
 */
export function calculateRangoliByteSize(
  strokes: RangoliStroke[],
  symmetry: SymmetryAxis,
  palette: string[]
): number {
  const payload = JSON.stringify({
    symmetry,
    palette,
    strokes,
  });
  return new TextEncoder().encode(payload).length;
}

/**
 * Generates curated preset base strokes so anyone can spin an intricate mandala in 1 second.
 */
export function generatePresetMandala(
  preset: 'lotus-bloom' | 'solar-chakra' | 'royal-star' = 'lotus-bloom'
): RangoliStroke[] {
  if (preset === 'solar-chakra') {
    return [
      {
        color: 0,
        width: 3.5,
        points: [
          [0.5, 0.44],
          [0.53, 0.39],
          [0.56, 0.33],
          [0.52, 0.28],
          [0.5, 0.24],
        ],
      },
      {
        color: 1,
        width: 2.5,
        points: [
          [0.5, 0.24],
          [0.55, 0.2],
          [0.61, 0.17],
          [0.58, 0.12],
          [0.5, 0.09],
        ],
      },
      {
        color: 2,
        width: 3,
        points: [
          [0.52, 0.36],
          [0.59, 0.34],
          [0.65, 0.29],
          [0.69, 0.23],
        ],
      },
      {
        color: 3,
        width: 2,
        points: [
          [0.5, 0.16],
          [0.53, 0.14],
          [0.5, 0.12],
        ],
      },
    ];
  }

  if (preset === 'royal-star') {
    return [
      {
        color: 0,
        width: 3,
        points: [
          [0.5, 0.45],
          [0.54, 0.38],
          [0.5, 0.3],
        ],
      },
      {
        color: 1,
        width: 3.5,
        points: [
          [0.5, 0.3],
          [0.58, 0.26],
          [0.64, 0.18],
          [0.54, 0.14],
          [0.5, 0.08],
        ],
      },
      {
        color: 3,
        width: 2.5,
        points: [
          [0.54, 0.38],
          [0.62, 0.36],
          [0.68, 0.31],
          [0.63, 0.26],
        ],
      },
    ];
  }

  // Default: 'lotus-bloom'
  return [
    {
      color: 0,
      width: 3.5,
      points: [
        [0.5, 0.43],
        [0.54, 0.38],
        [0.57, 0.31],
        [0.53, 0.24],
        [0.5, 0.19],
      ],
    },
    {
      color: 1,
      width: 3,
      points: [
        [0.52, 0.31],
        [0.58, 0.28],
        [0.63, 0.22],
        [0.57, 0.15],
        [0.5, 0.11],
      ],
    },
    {
      color: 2,
      width: 2.5,
      points: [
        [0.5, 0.46],
        [0.52, 0.44],
        [0.5, 0.41],
      ],
    },
    {
      color: 3,
      width: 2,
      points: [
        [0.55, 0.22],
        [0.61, 0.19],
        [0.66, 0.14],
      ],
    },
  ];
}
