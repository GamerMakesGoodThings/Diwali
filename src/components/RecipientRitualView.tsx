import React, { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, Sparkles, Flame, Heart, ArrowRight } from 'lucide-react';
import {
  GreetingDocument,
  THEMES,
  LANGUAGES,
  TONES,
  BACKGROUND_MOTIFS,
} from '../utils/greetingSchema';
import { calculateRangoliByteSize } from '../utils/rangoliMath';
import { RangoliCanvas } from './RangoliCanvas';
import { ConstellationFireworks } from './ConstellationFireworks';
import { InteractiveDiya3D } from './InteractiveDiya3D';
import { ThemeBackgroundMotif } from './ThemeBackgroundMotif';
import { sitarAudio } from '../utils/sitarAudio';
import { incrementGreetingStat } from '../firebase';

interface RecipientRitualViewProps {
  greeting: GreetingDocument;
  onCreateOwn: () => void;
  onOpenManage?: (id: string) => void;
  autoLight?: boolean;
}

export const RecipientRitualView: React.FC<RecipientRitualViewProps> = ({
  greeting,
  onCreateOwn,
  onOpenManage,
  autoLight = false,
}) => {
  const [isLit, setIsLit] = useState(Boolean(autoLight));
  const [isMuted, setIsMuted] = useState(false);
  const [sparkOffset, setSparkOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDraggingSpark, setIsDraggingSpark] = useState(false);
  const [fireworkTrigger, setFireworkTrigger] = useState(0);
  const [hasSentReaction, setHasSentReaction] = useState(false);
  const [litCount, setLitCount] = useState(greeting.stats.lit);
  const [opensCount, setOpensCount] = useState(greeting.stats.opens);
  const [reducedMotion, setReducedMotion] = useState(false);

  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const hasRecordedOpenRef = useRef(false);

  const theme = THEMES[greeting.theme] || THEMES['midnight-indigo'];
  const customAccentHex =
    greeting.themeCustomization?.accentHex ||
    greeting.rangoli.palette?.[0] ||
    theme.accentHex;
  const bgMotif = greeting.themeCustomization?.bgMotif || theme.defaultMotif;
  const motifMeta =
    BACKGROUND_MOTIFS.find((m) => m.id === bgMotif) || BACKGROUND_MOTIFS[0];
  const langMeta = LANGUAGES.find((l) => l.code === greeting.recipient.lang) || LANGUAGES[0];
  const toneMeta = TONES.find((t) => t.id === greeting.recipient.tone) || TONES[0];
  const rangoliBytes = calculateRangoliByteSize(
    greeting.rangoli.strokes,
    greeting.rangoli.symmetry,
    greeting.rangoli.palette
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Sync body attribute for deterministic verification & increment open count once
  useEffect(() => {
    document.body.setAttribute('data-ritual-state', isLit ? 'lit' : 'unlit');
    return () => {
      document.body.removeAttribute('data-ritual-state');
    };
  }, [isLit]);

  useEffect(() => {
    setLitCount(greeting.stats.lit);
    setOpensCount(greeting.stats.opens);
    setHasSentReaction(false);
    if (!hasRecordedOpenRef.current) {
      hasRecordedOpenRef.current = true;
      incrementGreetingStat(greeting.id, 'opens')
        .then((val) => {
          if (typeof val === 'number') setOpensCount(val);
        })
        .catch(() => {});
    }
  }, [greeting.id, greeting.stats.lit, greeting.stats.opens]);

  useEffect(() => {
    return () => {
      sitarAudio.stopAmbientLoop();
    };
  }, []);

  const igniteDiya = () => {
    if (isLit) return;
    setIsLit(true);
    setSparkOffset({ x: 0, y: 0 });
    sitarAudio.startAmbientLoop();
    setTimeout(() => {
      setFireworkTrigger((c) => c + 1);
    }, 650);
  };

  const handleSparkPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isLit) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    setIsDraggingSpark(true);
  };

  const handleSparkPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingSpark || !dragStartRef.current || isLit) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setSparkOffset({ x: dx, y: dy });

    if (dy > 45) {
      setIsDraggingSpark(false);
      igniteDiya();
    }
  };

  const handleSparkPointerUp = () => {
    if (!isDraggingSpark) return;
    setIsDraggingSpark(false);
    if (sparkOffset.y > 30) {
      igniteDiya();
    } else {
      setSparkOffset({ x: 0, y: 0 });
    }
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    sitarAudio.setMuted(next);
  };

  const handleSendLitReaction = async () => {
    if (hasSentReaction) return;
    setHasSentReaction(true);
    setLitCount((prev) => prev + 1);
    setFireworkTrigger((c) => c + 1);
    const updated = await incrementGreetingStat(greeting.id, 'lit');
    if (typeof updated === 'number') {
      setLitCount(updated);
    }
  };

  return (
    <section
      aria-label={`Diwali greeting ritual for ${greeting.recipient.name}`}
      className="relative min-h-[calc(100vh-65px)] w-full overflow-hidden flex flex-col justify-between transition-colors duration-1000"
      style={{
        background: isLit
          ? `linear-gradient(180deg, ${theme.bgDark} 0%, ${theme.bgLit} 36%, #FFE8BA 72%, #FFFBF2 100%)`
          : `radial-gradient(circle at 68% 52%, ${theme.bgLit} 0%, ${theme.bgDark} 68%, #0B0712 100%)`,
      }}
    >
      {/* Subtle Theme Background Motif Layer tinted by sender's custom accent */}
      <ThemeBackgroundMotif
        motif={bgMotif}
        accentHex={customAccentHex}
        opacity={isLit ? 0.22 : 0.14}
      />

      {/* Full-Bleed 3D Diya Background Layer (Spans the entire Ritual Sanctuary, not a pop-out box) */}
      <InteractiveDiya3D
        isLit={isLit}
        onLightDiya={igniteDiya}
        onToggleLit={(next) => {
          if (next) {
            igniteDiya();
          } else {
            setIsLit(false);
          }
        }}
        palette={greeting.rangoli.palette}
        recipientName={greeting.recipient.name}
        stageAlign={isLit ? 'left' : 'right'}
      />

      {/* Interactive Constellation Fireworks Sky Layer (active once lit in the twilight festival canopy) */}
      {isLit && (
        <ConstellationFireworks
          recipientName={greeting.recipient.name}
          palette={greeting.rangoli.palette}
          triggerCount={fireworkTrigger}
          reducedMotion={reducedMotion}
        />
      )}

      {/* Top Ritual Controls & Metadata Strip */}
      <div className="relative z-20 pointer-events-none max-w-6xl w-full mx-auto px-6 pt-6 flex flex-wrap items-center justify-between gap-4">
        <div className="text-xs text-amber-100 font-medium tracking-wide">
          <span>For {greeting.recipient.name}</span>
          <span className="mx-2" aria-hidden="true">·</span>
          <span>{theme.name}</span>
          <span className="mx-2" aria-hidden="true">·</span>
          <span>{motifMeta.label}</span>
          <span className="mx-2" aria-hidden="true">·</span>
          <span>{greeting.rangoli.symmetry}-Axis Mandala ({rangoliBytes} B JSON)</span>
          <span className="mx-2" aria-hidden="true">·</span>
          <span className="font-mono-tabular">{litCount} Diyas Lit</span>
        </div>

        <div className="flex items-center gap-3 pointer-events-auto">
          {isLit && (
            <button
              type="button"
              onClick={() => setFireworkTrigger((c) => c + 1)}
              className="px-3.5 py-2 text-xs font-semibold text-[#1E130D] bg-gradient-to-r from-[#F59E0B] to-[#FBBF24] hover:from-[#FBBF24] hover:to-[#FDE047] rounded-lg shadow-md transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Spell {greeting.recipient.name} in Fireworks
            </button>
          )}

          <button
            type="button"
            onClick={toggleMute}
            aria-label={isMuted ? 'Unmute Sitar Audio' : 'Mute Sitar Audio'}
            className="px-3 py-2 text-xs font-medium text-amber-100 bg-[#23102C] hover:bg-[#31173D] border border-amber-300/35 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isMuted ? (
              <VolumeX className="w-3.5 h-3.5 text-amber-300" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 text-amber-300" />
            )}
            <span>{isMuted ? 'Audio Muted' : 'Sitar Loop'}</span>
          </button>
        </div>
      </div>

      {/* Central Foreground Storytelling Stage (pointer-events-none wrapper so background 3D Diya is interactive everywhere) */}
      <div className="relative z-20 pointer-events-none max-w-6xl w-full mx-auto px-6 pt-12 pb-16 my-auto flex flex-col items-center">
        {!isLit ? (
          /* STATE 1: TWILIGHT SANCTUARY — SPARK OR CLICK FULL-BACKGROUND 3D DIYA TO UNLOCK */
          <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-5 pointer-events-auto flex flex-col items-center lg:items-start text-center lg:text-left">
              <p className="text-xs text-amber-300 font-semibold tracking-widest uppercase mb-2">
                A Diwali Greeting You Light, Not Just Read
              </p>
              <h1
                className="text-3xl sm:text-5xl font-bold text-[#FFFDF7] mb-3"
                style={{ textWrap: 'balance' }}
              >
                An Artisan 3D Diya Waits for {greeting.recipient.name}
              </h1>
              <p className="text-sm text-amber-100/90 mb-6 max-w-md leading-relaxed">
                Click the glowing golden spark directly on the 3D Diya wick in the background, drag the spark below, or tap the button to ignite the flame, awaken the sitar, and flood the sanctuary with festive color.
              </p>

              {/* Draggable Spark + Direct Ignition Button */}
              <div className="w-full max-w-sm p-5 rounded-2xl bg-[#22112B] border border-amber-400/35 flex flex-col items-center gap-4 shadow-2xl">
                <div
                  role="button"
                  tabIndex={0}
                  aria-label="Draggable Golden Spark — drag down to wick or press Enter to light the diya"
                  onPointerDown={handleSparkPointerDown}
                  onPointerMove={handleSparkPointerMove}
                  onPointerUp={handleSparkPointerUp}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      igniteDiya();
                    }
                  }}
                  style={{
                    transform: `translate3d(${sparkOffset.x}px, ${sparkOffset.y}px, 0)`,
                  }}
                  className="z-30 cursor-grab active:cursor-grabbing touch-none flex flex-col items-center group focus:outline-none"
                >
                  <div className="w-12 h-12 rounded-full bg-amber-400/25 border-2 border-amber-300 flex items-center justify-center shadow-[0_0_28px_rgba(245,158,11,0.85)] group-hover:scale-110 transition-transform">
                    <Sparkles className="w-5 h-5 text-amber-200" />
                  </div>
                  <span className="mt-1.5 text-xs text-amber-200 font-medium">
                    Drag Spark Down ↓ or Click 3D Diya
                  </span>
                </div>

                <button
                  type="button"
                  onClick={igniteDiya}
                  className="w-full py-3 px-6 text-sm font-semibold text-[#1E130D] bg-gradient-to-r from-[#F59E0B] via-[#FBBF24] to-[#F59E0B] hover:from-[#FBBF24] hover:to-[#FDE047] rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Flame className="w-4 h-4 fill-current" />
                  <span>Strike Spark to Light Diya</span>
                </button>
              </div>
            </div>

            {/* Right Column Open Stage for the Full-Bleed Background 3D Diya */}
            <div className="lg:col-span-7 h-[340px] lg:h-[440px] pointer-events-none" />
          </div>
        ) : (
          /* STATE 2: ILLUMINATED FESTIVAL — FULL-BLEED 3D DIYA ON LEFT + BRIGHT COLORFUL BLESSING CARD ON RIGHT */
          <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center pt-10">
            {/* Left Column Open Stage for the Illuminated Full-Bleed Background 3D Diya */}
            <div className="lg:col-span-6 h-[320px] lg:h-[440px] pointer-events-none flex flex-col justify-end items-center" />

            {/* Right Column: Sunlit Colorful Cultural Blessing Letter & Blooming Mandala (Solid surface, no backdrop-filter over WebGL) */}
            <div className="lg:col-span-6 pointer-events-auto rounded-2xl p-6 sm:p-8 bg-[#FFFDF9] text-[#1E130D] border-2 border-amber-300 shadow-2xl">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="text-xs font-semibold text-[#C2410C] mb-2">
                    <span>Shubh Deepavali</span>
                    <span className="mx-2" aria-hidden="true">·</span>
                    <span>{langMeta.label} ({langMeta.nativeLabel})</span>
                    <span className="mx-2" aria-hidden="true">·</span>
                    <span>{toneMeta.label}</span>
                  </div>

                  <h1
                    className="text-3xl sm:text-4xl font-bold text-[#1E130D]"
                    style={{ textWrap: 'balance' }}
                  >
                    Light &amp; Blessings for {greeting.recipient.name}
                  </h1>
                </div>

                {/* Compact Blooming Kaleidoscope Mandala Badge */}
                <div className="w-24 h-24 shrink-0 hidden sm:block">
                  <RangoliCanvas
                    strokes={greeting.rangoli.strokes}
                    symmetry={greeting.rangoli.symmetry}
                    palette={greeting.rangoli.palette}
                    interactive={false}
                    isBlooming={true}
                    size={220}
                  />
                </div>
              </div>

              {/* Primary Blessing in Chosen Script */}
              <blockquote className="text-lg sm:text-xl leading-relaxed text-[#1E130D] font-medium mb-4 p-4 rounded-xl bg-[#FFF6E5] border border-amber-300/70">
                “{greeting.message.text}”
              </blockquote>

              {/* Companion English Translation if Hindi / Bengali / Marathi */}
              {greeting.message.translation && greeting.recipient.lang !== 'en' && (
                <p className="text-sm text-[#5C3A21] italic leading-relaxed mb-6 pt-2">
                  “{greeting.message.translation}”
                </p>
              )}

              {/* Pass-the-Light Action Row */}
              <div className="mt-6 pt-5 border-t border-amber-200 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSendLitReaction}
                    disabled={hasSentReaction}
                    className={`px-4 py-2.5 text-xs font-semibold rounded-xl transition-all flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
                      hasSentReaction
                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-400'
                        : 'bg-gradient-to-r from-[#E11D48] to-[#F59E0B] text-white hover:opacity-95 shadow-md'
                    }`}
                  >
                    <Heart className={`w-4 h-4 ${hasSentReaction ? 'fill-emerald-600 text-emerald-600' : 'fill-current'}`} />
                    <span>
                      {hasSentReaction
                        ? `Diya Lit Sent (${litCount} Lit)`
                        : `Send "Diya Lit" Reaction (${litCount})`}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={onCreateOwn}
                    className="px-4 py-2.5 text-xs font-semibold text-[#1E130D] bg-[#FFF2D6] hover:bg-[#FFE6B3] border border-amber-300 rounded-xl transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <span>Pass the Light · Create Yours</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {onOpenManage && (
                  <button
                    type="button"
                    onClick={() => onOpenManage(greeting.id)}
                    className="text-xs font-semibold text-[#9A3412] hover:text-[#7C2D12] underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    View Sender Live Counter ({opensCount} opens)
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
