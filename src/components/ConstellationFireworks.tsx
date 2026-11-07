import React, { useEffect, useRef, useCallback } from 'react';
import { sitarAudio } from '../utils/sitarAudio';

interface ConstellationFireworksProps {
  recipientName: string;
  palette: string[];
  triggerCount: number; // Incrementing this launches a signature Name Constellation firework
  reducedMotion?: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetX?: number;
  targetY?: number;
  color: string;
  alpha: number;
  decay: number;
  size: number;
  mode: 'radial' | 'constellation';
  holdFrames: number;
}

export const ConstellationFireworks: React.FC<ConstellationFireworksProps> = ({
  recipientName,
  palette,
  triggerCount,
  reducedMotion = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const namePointsCacheRef = useRef<{ x: number; y: number }[]>([]);
  const adaptiveCapRef = useRef<number>(220);

  // Sample the recipient's name (supports Latin, Devanagari, Bengali) from an offscreen 2D canvas
  const sampleNameCoordinates = useCallback((name: string): { x: number; y: number }[] => {
    const clean = (name || 'Diwali').trim().slice(0, 18);
    const offscreen = document.createElement('canvas');
    const w = 360;
    const h = 100;
    offscreen.width = w;
    offscreen.height = h;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return [];

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const fontSize = clean.length > 10 ? 38 : 48;
    ctx.font = `700 ${fontSize}px "Plus Jakarta Sans", "Noto Sans Devanagari", "Noto Sans Bengali", sans-serif`;
    ctx.fillText(clean, w / 2, h / 2);

    const imgData = ctx.getImageData(0, 0, w, h).data;
    const coords: { x: number; y: number }[] = [];
    const step = 3;

    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const alpha = imgData[(y * w + x) * 4 + 3];
        if (alpha > 128) {
          coords.push({
            x: (x - w / 2) / w, // normalized [-0.5, 0.5]
            y: (y - h / 2) / h,
          });
        }
      }
    }
    return coords;
  }, []);

  useEffect(() => {
    namePointsCacheRef.current = sampleNameCoordinates(recipientName);
  }, [recipientName, sampleNameCoordinates]);

  const spawnNameConstellationBurst = useCallback(
    (centerX: number, centerY: number, canvasWidth: number) => {
      if (reducedMotion) return;
      sitarAudio.playFireworkBurst();

      const coords = namePointsCacheRef.current;
      const colors = palette.length > 0 ? palette : ['#FFD54F', '#F4A300', '#FF7043'];
      const spreadWidth = Math.min(canvasWidth * 0.72, 420);
      const spreadHeight = spreadWidth * 0.28;

      const cap = adaptiveCapRef.current;
      const stride = Math.max(1, Math.ceil(coords.length / cap));

      for (let i = 0; i < coords.length; i += stride) {
        const pt = coords[i];
        const targetX = centerX + pt.x * spreadWidth;
        const targetY = centerY + pt.y * spreadHeight;
        const color = i % 3 === 0 ? '#FFF8E1' : colors[i % colors.length];

        particlesRef.current.push({
          x: centerX + (Math.random() - 0.5) * 24,
          y: centerY + 60,
          vx: (Math.random() - 0.5) * 6,
          vy: (Math.random() - 0.5) * 6,
          targetX,
          targetY,
          color,
          alpha: 1,
          decay: 0.011 + Math.random() * 0.005,
          size: 2.1,
          mode: 'constellation',
          holdFrames: 52,
        });
      }

      // Surround with a golden halo ring
      for (let j = 0; j < 36; j++) {
        const angle = (j / 36) * Math.PI * 2;
        const speed = 2.2 + Math.random() * 2.5;
        particlesRef.current.push({
          x: centerX,
          y: centerY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: colors[j % colors.length],
          alpha: 0.95,
          decay: 0.016,
          size: 2.2,
          mode: 'radial',
          holdFrames: 0,
        });
      }
    },
    [palette, reducedMotion]
  );

  // Launch when parent increments triggerCount
  useEffect(() => {
    if (triggerCount <= 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = Math.min(115, Math.max(78, rect.height * 0.14));
    spawnNameConstellationBurst(cx, cy, rect.width);
  }, [triggerCount, spawnNameConstellationBurst]);

  // Main 60fps Canvas loop with adaptive frame-time monitor
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let lastTime = performance.now();

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const render = (now: number) => {
      const dt = now - lastTime;
      lastTime = now;

      // Adaptive quality monitor: lower particle cap if frame time exceeds 26ms (<38fps)
      if (dt > 28 && adaptiveCapRef.current > 90) {
        adaptiveCapRef.current = Math.max(90, adaptiveCapRef.current - 15);
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const list = particlesRef.current;
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        if (p.mode === 'constellation' && p.targetX !== undefined && p.targetY !== undefined) {
          if (p.holdFrames > 0) {
            p.x += (p.targetX - p.x) * 0.16;
            p.y += (p.targetY - p.y) * 0.16;
            p.holdFrames -= 1;
          } else {
            p.y += 0.35; // gentle golden ember drift
            p.x += Math.sin(p.y * 0.05) * 0.25;
            p.alpha -= p.decay;
          }
        } else {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.045; // gravity
          p.vx *= 0.985;
          p.alpha -= p.decay;
        }

        if (p.alpha <= 0.02) {
          list.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    spawnNameConstellationBurst(x, y, rect.width);
  };

  return (
    <canvas
      ref={canvasRef}
      data-testid="constellation-fireworks-canvas"
      onClick={handleCanvasClick}
      className="absolute inset-0 w-full h-full cursor-pointer z-10"
      title={`Click anywhere in the night sky to launch ${recipientName}'s constellation fireworks`}
    />
  );
};
