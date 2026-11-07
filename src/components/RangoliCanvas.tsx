import React, { useEffect, useRef, useState } from 'react';
import {
  Point2D,
  RangoliStroke,
  SymmetryAxis,
  buildKaleidoscopeSvgPaths,
  quantizeCoord,
  simplifyStrokeRDP,
} from '../utils/rangoliMath';

interface RangoliCanvasProps {
  strokes: RangoliStroke[];
  symmetry: SymmetryAxis;
  palette: string[];
  accentHex?: string;
  activeColorIndex?: number;
  activeStrokeWidth?: number;
  interactive?: boolean;
  isBlooming?: boolean;
  onAddStroke?: (stroke: RangoliStroke) => void;
  size?: number;
}

export const RangoliCanvas: React.FC<RangoliCanvasProps> = ({
  strokes,
  symmetry,
  palette,
  accentHex,
  activeColorIndex = 0,
  activeStrokeWidth = 3,
  interactive = false,
  isBlooming = false,
  onAddStroke,
  size = 400,
}) => {
  const effectiveAccent = accentHex || palette[0] || '#F59E0B';
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [draftPoints, setDraftPoints] = useState<Point2D[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPulsing, setIsPulsing] = useState(false);
  const prevStrokeCountRef = useRef<number>(strokes.length);
  const pulseTimerRef = useRef<number | null>(null);

  const triggerStrokePulse = () => {
    if (pulseTimerRef.current) {
      window.clearTimeout(pulseTimerRef.current);
    }
    setIsPulsing(false);
    // Re-trigger CSS animation on next frame for consecutive strokes
    requestAnimationFrame(() => {
      setIsPulsing(true);
      pulseTimerRef.current = window.setTimeout(() => {
        setIsPulsing(false);
      }, 540);
    });
  };

  useEffect(() => {
    if (strokes.length > prevStrokeCountRef.current) {
      triggerStrokePulse();
    }
    prevStrokeCountRef.current = strokes.length;
  }, [strokes.length]);

  useEffect(() => {
    return () => {
      if (pulseTimerRef.current) {
        window.clearTimeout(pulseTimerRef.current);
      }
    };
  }, []);

  const getNormalizedPoint = (e: React.PointerEvent<SVGSVGElement>): Point2D | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const x = quantizeCoord((e.clientX - rect.left) / rect.width);
    const y = quantizeCoord((e.clientY - rect.top) / rect.height);
    return [x, y];
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!interactive || !onAddStroke) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = getNormalizedPoint(e);
    if (!pt) return;
    setIsDrawing(true);
    setDraftPoints([pt]);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!interactive || !isDrawing) return;
    const pt = getNormalizedPoint(e);
    if (!pt) return;
    setDraftPoints((prev) => {
      if (prev.length === 0) return [pt];
      const last = prev[prev.length - 1];
      const dist = Math.hypot(pt[0] - last[0], pt[1] - last[1]);
      if (dist < 0.008) return prev;
      return [...prev, pt];
    });
  };

  const finishStroke = () => {
    if (!interactive || !isDrawing || !onAddStroke) return;
    setIsDrawing(false);
    if (draftPoints.length >= 2) {
      const simplified = simplifyStrokeRDP(draftPoints, 0.005);
      onAddStroke({
        color: activeColorIndex,
        width: activeStrokeWidth,
        points: simplified,
      });
      triggerStrokePulse();
    } else if (draftPoints.length === 1) {
      const [x, y] = draftPoints[0];
      onAddStroke({
        color: activeColorIndex,
        width: activeStrokeWidth,
        points: [
          [x, y],
          [quantizeCoord(x + 0.02), quantizeCoord(y + 0.02)],
        ],
      });
      triggerStrokePulse();
    }
    setDraftPoints([]);
  };

  const allStrokes: RangoliStroke[] =
    draftPoints.length > 0
      ? [
          ...strokes,
          {
            color: activeColorIndex,
            width: activeStrokeWidth,
            points: draftPoints,
          },
        ]
      : strokes;

  const renderedPaths = buildKaleidoscopeSvgPaths(allStrokes, symmetry, palette, size);
  const center = size / 2;
  const angleStep = 360 / symmetry;

  return (
    <div
      data-testid="rangoli-canvas-container"
      data-pulsing={isPulsing ? 'true' : 'false'}
      className={`relative flex items-center justify-center select-none ${
        isPulsing || isBlooming ? 'animate-mandala-pulse' : ''
      }`}
    >
      <svg
        ref={svgRef}
        data-testid="rangoli-svg-canvas"
        viewBox={`0 0 ${size} ${size}`}
        className={`w-full h-full max-w-[380px] max-h-[380px] rounded-full transition-transform duration-700 ${
          interactive ? 'cursor-crosshair touch-none' : ''
        } ${isBlooming ? 'scale-105' : 'scale-100'}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishStroke}
        onPointerCancel={finishStroke}
        role="img"
        aria-label={`Kaleidoscope mandala rangoli with ${symmetry}-axis symmetry`}
      >
        <defs>
          <radialGradient id="mandalaField" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#432352" stopOpacity="0.96" />
            <stop offset="65%" stopColor="#261438" stopOpacity="0.98" />
            <stop offset="100%" stopColor="#160B24" stopOpacity="1" />
          </radialGradient>
        </defs>

        {/* Base circular mandala medallion surface */}
        <circle
          cx={center}
          cy={center}
          r={center - 4}
          fill="url(#mandalaField)"
          stroke={effectiveAccent}
          strokeOpacity="0.78"
          strokeWidth="2.5"
        />

        {/* Subtle geometric guide rings and radial symmetry axes */}
        <circle
          cx={center}
          cy={center}
          r={center * 0.72}
          fill="none"
          stroke={effectiveAccent}
          strokeOpacity="0.16"
          strokeDasharray="3 5"
        />
        <circle
          cx={center}
          cy={center}
          r={center * 0.42}
          fill="none"
          stroke={effectiveAccent}
          strokeOpacity="0.16"
          strokeDasharray="2 4"
        />

        {interactive &&
          Array.from({ length: symmetry }).map((_, idx) => {
            const rad = ((idx * angleStep) * Math.PI) / 180;
            const x2 = center + Math.cos(rad) * (center - 10);
            const y2 = center + Math.sin(rad) * (center - 10);
            return (
              <line
                key={idx}
                x1={center}
                y1={center}
                x2={x2}
                y2={y2}
                stroke="#F8F3EB"
                strokeOpacity="0.07"
                strokeWidth="1"
              />
            );
          })}

        {/* Mirrored Kaleidoscope Mandala Paths */}
        <g
          className="transition-all duration-500"
          style={{
            transformOrigin: `${center}px ${center}px`,
            transform: isBlooming ? 'rotate(15deg) scale(1.03)' : 'rotate(0deg) scale(1)',
          }}
        >
          {renderedPaths.map((p, idx) => (
            <path
              key={idx}
              d={p.d}
              fill="none"
              stroke={p.color}
              strokeWidth={p.width}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.94}
            />
          ))}
        </g>

        {/* Center Bindu lotus focal point */}
        <circle cx={center} cy={center} r={8} fill={effectiveAccent} fillOpacity="0.35" />
        <circle cx={center} cy={center} r={3.5} fill="#FFE082" />
      </svg>
    </div>
  );
};
