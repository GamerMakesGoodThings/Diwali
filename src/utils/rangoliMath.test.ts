import test from 'node:test';
import assert from 'node:assert/strict';
import {
  quantizeCoord,
  perpendicularDistance,
  simplifyStrokeRDP,
  transformKaleidoscopePoint,
  buildKaleidoscopeSvgPaths,
  calculateRangoliByteSize,
  generatePresetMandala,
  Point2D,
} from './rangoliMath';

test('quantizeCoord clamps to [0, 1] and rounds to 3 decimals', () => {
  assert.equal(quantizeCoord(0.52349), 0.523);
  assert.equal(quantizeCoord(-0.4), 0);
  assert.equal(quantizeCoord(1.8), 1);
});

test('perpendicularDistance computes zero for collinear points and positive for offset points', () => {
  assert.equal(perpendicularDistance([0.5, 0.5], [0, 0], [1, 1]), 0);
  const dist = perpendicularDistance([0, 1], [0, 0], [1, 0]);
  assert.ok(Math.abs(dist - 1) < 1e-6);
});

test('simplifyStrokeRDP compresses collinear drag points while preserving corners', () => {
  const collinear: Point2D[] = [
    [0.1, 0.1],
    [0.2, 0.2],
    [0.3, 0.3],
    [0.4, 0.4],
    [0.5, 0.5],
  ];
  const simplified = simplifyStrokeRDP(collinear, 0.005);
  assert.equal(simplified.length, 2);
  assert.deepEqual(simplified[0], [0.1, 0.1]);
  assert.deepEqual(simplified[1], [0.5, 0.5]);

  const cornered: Point2D[] = [
    [0.1, 0.1],
    [0.3, 0.1],
    [0.5, 0.1],
    [0.5, 0.4],
    [0.5, 0.7],
  ];
  const simplifiedCorner = simplifyStrokeRDP(cornered, 0.005);
  assert.equal(simplifiedCorner.length, 3);
  assert.deepEqual(simplifiedCorner[1], [0.5, 0.1]);
});

test('transformKaleidoscopePoint preserves center [0.5, 0.5]', () => {
  const pt = transformKaleidoscopePoint([0.5, 0.5], Math.PI / 3, true);
  assert.ok(Math.abs(pt[0] - 0.5) < 1e-6);
  assert.ok(Math.abs(pt[1] - 0.5) < 1e-6);
});

test('buildKaleidoscopeSvgPaths generates 2 * symmetry mirrored paths per stroke', () => {
  const strokes = generatePresetMandala('lotus-bloom');
  const paths8 = buildKaleidoscopeSvgPaths(strokes, 8, ['#F4A300', '#C2185B']);
  assert.equal(paths8.length, strokes.length * 8 * 2);
  assert.ok(paths8.every((p) => p.d.startsWith('M ')));
});

test('calculateRangoliByteSize keeps preset mandala well under 2 KB', () => {
  const strokes = generatePresetMandala('lotus-bloom');
  const bytes = calculateRangoliByteSize(strokes, 8, ['#F4A300', '#C2185B', '#283593']);
  assert.ok(bytes > 50 && bytes < 2048);
});
