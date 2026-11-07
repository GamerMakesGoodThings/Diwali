import React from 'react';
import { BackgroundMotifId } from '../utils/greetingSchema';

interface ThemeBackgroundMotifProps {
  motif: BackgroundMotifId;
  accentHex: string;
  opacity?: number;
  className?: string;
}

/**
 * Renders a subtle, culturally inspired SVG background motif tinted with the sender's
 * custom accent color (Sacred Lotus Rings, Starlight Diya Dust, Floating Marigold Petals,
 * or Jharokha Temple Lattice).
 */
export const ThemeBackgroundMotif: React.FC<ThemeBackgroundMotifProps> = ({
  motif,
  accentHex,
  opacity = 0.22,
  className = '',
}) => {
  return (
    <div
      data-testid="theme-background-motif"
      data-motif={motif}
      data-accent={accentHex}
      className={`pointer-events-none absolute inset-0 overflow-hidden select-none ${className}`}
      style={{ opacity }}
      aria-hidden="true"
    >
      {motif === 'mandala-rings' && (
        <svg
          viewBox="0 0 800 800"
          className="w-full h-full object-cover"
          preserveAspectRatio="xMidYMid slice"
        >
          <g transform="translate(400, 400)" fill="none" stroke={accentHex}>
            <circle r="120" strokeWidth="1.5" strokeDasharray="6 8" />
            <circle r="190" strokeWidth="1.2" />
            <circle r="260" strokeWidth="1.5" strokeDasharray="4 10" />
            <circle r="335" strokeWidth="1.2" />
            <circle r="390" strokeWidth="1" strokeDasharray="12 12" />
            {Array.from({ length: 12 }).map((_, i) => {
              const deg = i * 30;
              return (
                <g key={i} transform={`rotate(${deg})`}>
                  <path
                    d="M 0 -120 Q 34 -190 0 -260 Q -34 -190 0 -120 Z"
                    strokeWidth="1.2"
                  />
                  <circle cx="0" cy="-300" r="4" fill={accentHex} />
                </g>
              );
            })}
          </g>
        </svg>
      )}

      {motif === 'starlight-dust' && (
        <svg
          viewBox="0 0 800 600"
          className="w-full h-full object-cover"
          preserveAspectRatio="xMidYMid slice"
        >
          <g fill={accentHex} stroke={accentHex}>
            {[
              [95, 85, 1.4],
              [210, 140, 0.9],
              [340, 70, 1.2],
              [480, 110, 1.5],
              [640, 80, 1.1],
              [720, 165, 1.3],
              [130, 290, 1.1],
              [275, 250, 1.4],
              [540, 240, 1.0],
              [690, 310, 1.5],
              [85, 470, 1.3],
              [240, 490, 1.1],
              [410, 520, 1.4],
              [590, 460, 1.2],
              [730, 495, 1.0],
            ].map(([cx, cy, s], idx) => (
              <g key={idx} transform={`translate(${cx}, ${cy}) scale(${s})`}>
                <path
                  d="M 0 -10 L 2.5 -2.5 L 10 0 L 2.5 2.5 L 0 10 L -2.5 2.5 L -10 0 L -2.5 -2.5 Z"
                  strokeWidth="0.5"
                />
                <circle cx="18" cy="-12" r="1.8" />
                <circle cx="-15" cy="14" r="1.4" />
              </g>
            ))}
            <path
              d="M 95 85 Q 210 140 340 70 T 640 80"
              fill="none"
              strokeWidth="0.8"
              strokeDasharray="3 7"
            />
            <path
              d="M 130 290 Q 275 250 540 240 T 690 310"
              fill="none"
              strokeWidth="0.8"
              strokeDasharray="3 7"
            />
          </g>
        </svg>
      )}

      {motif === 'marigold-petals' && (
        <svg
          viewBox="0 0 800 600"
          className="w-full h-full object-cover"
          preserveAspectRatio="xMidYMid slice"
        >
          <g fill={accentHex} stroke={accentHex}>
            {[
              [110, 110, 25, 1.1],
              [260, 85, -18, 0.85],
              [430, 120, 42, 0.95],
              [610, 95, -30, 1.15],
              [715, 210, 15, 0.9],
              [90, 320, -40, 1.0],
              [230, 440, 20, 1.1],
              [395, 485, -12, 0.9],
              [575, 430, 35, 1.05],
              [710, 470, -22, 0.95],
            ].map(([x, y, rot, sc], idx) => (
              <g key={idx} transform={`translate(${x}, ${y}) rotate(${rot}) scale(${sc})`}>
                {Array.from({ length: 8 }).map((__, pIdx) => (
                  <path
                    key={pIdx}
                    transform={`rotate(${pIdx * 45})`}
                    d="M 0 0 C 8 -14, 16 -26, 0 -34 C -16 -26, -8 -14, 0 0 Z"
                    fillOpacity="0.28"
                    strokeWidth="1.1"
                  />
                ))}
                <circle r="5" fill={accentHex} />
              </g>
            ))}
          </g>
        </svg>
      )}

      {motif === 'temple-arch' && (
        <svg
          viewBox="0 0 800 600"
          className="w-full h-full object-cover"
          preserveAspectRatio="xMidYMid slice"
        >
          <g fill="none" stroke={accentHex} strokeWidth="1.5">
            {/* Traditional Scalloped Jharokha Arch Frame */}
            <path d="M 60 580 L 60 220 Q 60 110 190 95 Q 290 60 400 28 Q 510 60 610 95 Q 740 110 740 220 L 740 580" />
            <path
              d="M 88 580 L 88 230 Q 88 135 205 120 Q 300 85 400 54 Q 500 85 595 120 Q 712 135 712 230 L 712 580"
              strokeDasharray="5 5"
            />
            {/* Hanging Temple Bell & Lotus Finial */}
            <line x1="400" y1="28" x2="400" y2="95" strokeWidth="1.8" />
            <path d="M 386 95 Q 400 80 414 95 L 420 115 L 380 115 Z" fill={accentHex} fillOpacity="0.25" />
            <circle cx="400" cy="121" r="4" fill={accentHex} />
            {/* Corner Lattice Rosettes */}
            <circle cx="130" cy="140" r="26" />
            <circle cx="130" cy="140" r="14" strokeDasharray="3 3" />
            <circle cx="670" cy="140" r="26" />
            <circle cx="670" cy="140" r="14" strokeDasharray="3 3" />
          </g>
        </svg>
      )}
    </div>
  );
};
