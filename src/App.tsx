/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  Flame,
  Undo2,
  RotateCcw,
  Wand2,
  Send,
  Play,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import {
  GreetingDocument,
  SAMPLE_GREETINGS,
  THEMES,
  BACKGROUND_MOTIFS,
  LANGUAGES,
  TONES,
  ThemeId,
  BackgroundMotifId,
  BlessingLang,
  BlessingTone,
  MessageSource,
  getTemplateBlessing,
  validateGreetingInput,
  generateShortId,
} from './utils/greetingSchema';
import {
  RangoliStroke,
  SymmetryAxis,
  calculateRangoliByteSize,
  generatePresetMandala,
} from './utils/rangoliMath';
import { RangoliCanvas } from './components/RangoliCanvas';
import { InteractiveDiya3D } from './components/InteractiveDiya3D';
import { ThemeBackgroundMotif } from './components/ThemeBackgroundMotif';
import { RecipientRitualView } from './components/RecipientRitualView';
import { SenderManageView } from './components/SenderManageView';
import { fetchGreetingById, publishGreetingRecord } from './firebase';

type ActiveView = 'studio' | 'ritual' | 'manage';

export default function App() {
  // Navigation & Route State
  const [activeView, setActiveView] = useState<ActiveView>('studio');
  const [currentGreeting, setCurrentGreeting] = useState<GreetingDocument>(
    SAMPLE_GREETINGS.k7Qx9mA2
  );
  const [manageToken, setManageToken] = useState<string>('demo_token_anika');
  const [autoLightRitual, setAutoLightRitual] = useState<boolean>(false);

  // Interactive 3D Hero Diya State (lit by default on landing so the colorful 3D flame shines immediately)
  const [heroDiyaLit, setHeroDiyaLit] = useState<boolean>(true);

  // Studio Form, Theme Customization & Mandala State
  const [themeId, setThemeId] = useState<ThemeId>('midnight-indigo');
  const [customAccentHex, setCustomAccentHex] = useState<string>(
    THEMES['midnight-indigo'].accentHex
  );
  const [bgMotif, setBgMotif] = useState<BackgroundMotifId>(
    THEMES['midnight-indigo'].defaultMotif
  );
  const [symmetry, setSymmetry] = useState<SymmetryAxis>(8);
  const [strokes, setStrokes] = useState<RangoliStroke[]>(() =>
    generatePresetMandala('lotus-bloom')
  );
  const [activeColorIndex, setActiveColorIndex] = useState<number>(0);
  const [strokeWidth, setStrokeWidth] = useState<number>(3.5);
  const [isBloomingPreview, setIsBloomingPreview] = useState<boolean>(false);

  // Personalization & AI Poetics State
  const [recipientName, setRecipientName] = useState<string>('Anika');
  const [recipientLang, setRecipientLang] = useState<BlessingLang>('bn');
  const [recipientTone, setRecipientTone] = useState<BlessingTone>('family');
  const [messageText, setMessageText] = useState<string>(
    SAMPLE_GREETINGS.k7Qx9mA2.message.text
  );
  const [messageTranslation, setMessageTranslation] = useState<string>(
    SAMPLE_GREETINGS.k7Qx9mA2.message.translation || ''
  );
  const [messageSource, setMessageSource] = useState<MessageSource>('gemini');
  const [isDraftingAi, setIsDraftingAi] = useState<boolean>(false);
  const [aiLatencyMs, setAiLatencyMs] = useState<number | null>(null);

  // Publish State
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [publishSuccessBanner, setPublishSuccessBanner] = useState<string | null>(null);

  const currentTheme = THEMES[themeId];
  const effectivePalette = [customAccentHex, ...currentTheme.palette.slice(1)];
  const rangoliByteSize = calculateRangoliByteSize(
    strokes,
    symmetry,
    effectivePalette
  );

  const handleSelectTheme = (nextThemeId: ThemeId) => {
    const nextConfig = THEMES[nextThemeId];
    setThemeId(nextThemeId);
    setCustomAccentHex(nextConfig.accentHex);
    setBgMotif(nextConfig.defaultMotif);
  };

  // Inspect URL query parameters (?g=<id>, ?manage=<id>, ?autostart=1) on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gId = params.get('g');
    const mId = params.get('manage');
    const token = params.get('token');
    const autostart = params.get('autostart') === '1';

    if (token) {
      setManageToken(token);
    }

    if (gId) {
      setAutoLightRitual(autostart);
      fetchGreetingById(gId).then((found) => {
        if (found) {
          setCurrentGreeting(found);
          setActiveView('ritual');
        }
      });
    } else if (mId) {
      fetchGreetingById(mId).then((found) => {
        if (found) {
          setCurrentGreeting(found);
          setActiveView('manage');
        }
      });
    }
  }, []);

  const handleSelectLanguage = (lang: BlessingLang) => {
    setRecipientLang(lang);
    const tpl = getTemplateBlessing(recipientName || 'Friend', lang, recipientTone);
    setMessageText(tpl.text);
    setMessageTranslation(tpl.translation);
    setMessageSource('template');
  };

  const handleSelectTone = (tone: BlessingTone) => {
    setRecipientTone(tone);
    const tpl = getTemplateBlessing(recipientName || 'Friend', recipientLang, tone);
    setMessageText(tpl.text);
    setMessageTranslation(tpl.translation);
    setMessageSource('template');
  };

  const handleDraftWithAiPoetics = async () => {
    setFormError(null);
    const cleanName = recipientName.trim() || 'Friend';
    setIsDraftingAi(true);
    try {
      const res = await fetch('/api/poetics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cleanName,
          lang: recipientLang,
          tone: recipientTone,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessageText(data.text);
        setMessageTranslation(data.translation || '');
        setMessageSource(data.source === 'gemini' ? 'gemini' : 'template');
        if (typeof data.latencyMs === 'number') {
          setAiLatencyMs(data.latencyMs);
        }
      } else {
        const tpl = getTemplateBlessing(cleanName, recipientLang, recipientTone);
        setMessageText(tpl.text);
        setMessageTranslation(tpl.translation);
        setMessageSource('template');
      }
    } catch {
      const tpl = getTemplateBlessing(cleanName, recipientLang, recipientTone);
      setMessageText(tpl.text);
      setMessageTranslation(tpl.translation);
      setMessageSource('template');
    } finally {
      setIsDraftingAi(false);
    }
  };

  const handleAddStroke = (stroke: RangoliStroke) => {
    setFormError(null);
    setStrokes((prev) => [...prev, stroke]);
  };

  const handleUndoStroke = () => {
    setStrokes((prev) => prev.slice(0, -1));
  };

  const handleClearCanvas = () => {
    setStrokes([]);
  };

  const handleLoadPresetMandala = (preset: 'lotus-bloom' | 'solar-chakra' | 'royal-star') => {
    setFormError(null);
    setStrokes(generatePresetMandala(preset));
    setIsBloomingPreview(true);
    setTimeout(() => setIsBloomingPreview(false), 750);
  };

  const handlePublishGreeting = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setPublishSuccessBanner(null);

    const validation = validateGreetingInput({
      theme: themeId,
      themeCustomization: {
        accentHex: customAccentHex,
        bgMotif,
      },
      recipientName,
      recipientLang,
      recipientTone,
      messageText,
      messageTranslation,
      messageSource,
      rangoliSymmetry: symmetry,
      rangoliPalette: effectivePalette,
      rangoliStrokes: strokes,
    });

    if (!validation.valid || !validation.sanitized) {
      setFormError(validation.error || 'Please complete all fields before publishing.');
      return;
    }

    setIsPublishing(true);
    const s = validation.sanitized;
    const newId = generateShortId(8);
    const nowIso = new Date().toISOString();
    const expiresIso = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

    const docToPublish: GreetingDocument = {
      id: newId,
      theme: s.theme,
      themeCustomization: s.themeCustomization,
      recipient: {
        name: s.recipientName,
        lang: s.recipientLang,
        tone: s.recipientTone,
      },
      message: {
        text: s.messageText,
        translation: s.messageTranslation,
        source: s.messageSource,
      },
      rangoli: {
        symmetry: s.rangoliSymmetry,
        palette: s.rangoliPalette,
        strokes: s.rangoliStrokes,
      },
      stats: {
        opens: 0,
        lit: 0,
      },
      createdAt: nowIso,
      expiresAt: expiresIso,
    };

    try {
      const result = await publishGreetingRecord(docToPublish);
      setCurrentGreeting(result.greeting);
      setManageToken(result.manageToken);
      setPublishSuccessBanner(`Published ritual #${result.greeting.id} for ${result.greeting.recipient.name}`);
      window.history.replaceState({}, '', `/?manage=${encodeURIComponent(result.greeting.id)}`);
      setActiveView('manage');
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Could not publish greeting. Please try again.'
      );
    } finally {
      setIsPublishing(false);
    }
  };

  const openSampleRitual = (sample: GreetingDocument, startLit = false) => {
    setCurrentGreeting(sample);
    setAutoLightRitual(startLit);
    window.history.replaceState({}, '', `/?g=${encodeURIComponent(sample.id)}`);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    setActiveView('ritual');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FFFBF2] text-[#1E130D]">
      {/* Strict 3-Zone Top Bar Contract — Solid Festive Ivory & Marigold Header */}
      <header className="flex items-center justify-between gap-8 px-6 py-4 border-b border-amber-300/80 bg-[#FFFDF8] sticky top-0 z-50">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            window.history.replaceState({}, '', '/');
            setActiveView('studio');
          }}
          className="text-2xl font-bold tracking-tight text-[#9A1B2F] font-display whitespace-nowrap shrink-0"
        >
          DiyaVerse
        </a>

        {/* Zone 2: 4 concise single-line navigation links */}
        <nav
          aria-label="Primary Navigation"
          className="hidden md:flex items-center gap-6 text-sm font-semibold text-[#5C3A21]"
        >
          <a
            href="#studio"
            onClick={(e) => {
              e.preventDefault();
              setActiveView('studio');
            }}
            className={`hover:text-[#1E130D] transition-colors whitespace-nowrap shrink-0 ${
              activeView === 'studio'
                ? 'text-[#1E130D] underline underline-offset-8 decoration-2 decoration-[#E11D48]'
                : ''
            }`}
          >
            Rangoli Studio
          </a>
          <a
            href="#ritual"
            onClick={(e) => {
              e.preventDefault();
              openSampleRitual(currentGreeting, false);
            }}
            className={`hover:text-[#1E130D] transition-colors whitespace-nowrap shrink-0 ${
              activeView === 'ritual'
                ? 'text-[#1E130D] underline underline-offset-8 decoration-2 decoration-[#E11D48]'
                : ''
            }`}
          >
            Recipient Ritual
          </a>
          <a
            href="#manage"
            onClick={(e) => {
              e.preventDefault();
              setActiveView('manage');
            }}
            className={`hover:text-[#1E130D] transition-colors whitespace-nowrap shrink-0 ${
              activeView === 'manage'
                ? 'text-[#1E130D] underline underline-offset-8 decoration-2 decoration-[#E11D48]'
                : ''
            }`}
          >
            Sender Console
          </a>
          <a
            href="#architecture"
            onClick={(e) => {
              e.preventDefault();
              setActiveView('studio');
              setTimeout(() => {
                document.getElementById('architecture')?.scrollIntoView({ behavior: 'smooth' });
              }, 50);
            }}
            className="hover:text-[#1E130D] transition-colors whitespace-nowrap shrink-0"
          >
            Architecture
          </a>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => openSampleRitual(SAMPLE_GREETINGS.k7Qx9mA2, false)}
            className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-[#E11D48] to-[#F59E0B] hover:opacity-95 rounded-lg shadow-sm transition-all whitespace-nowrap shrink-0 cursor-pointer"
          >
            Light Sample Diya
          </button>
        </div>
      </header>

      {/* Main Content Router */}
      <main className="flex-1">
        {activeView === 'ritual' && (
          <RecipientRitualView
            greeting={currentGreeting}
            autoLight={autoLightRitual}
            onCreateOwn={() => {
              window.history.replaceState({}, '', '/');
              setActiveView('studio');
            }}
            onOpenManage={(id) => {
              window.history.replaceState({}, '', `/?manage=${encodeURIComponent(id)}`);
              setActiveView('manage');
            }}
          />
        )}

        {activeView === 'manage' && (
          <SenderManageView
            greetingId={currentGreeting.id}
            initialGreeting={currentGreeting}
            manageToken={manageToken}
            onOpenRecipientView={(g) => openSampleRitual(g, false)}
            onBackToStudio={() => {
              window.history.replaceState({}, '', '/');
              setActiveView('studio');
            }}
          />
        )}

        {activeView === 'studio' && (
          <div>
            {/* 1. BRIGHT FESTIVE HERO WITH FULL-BLEED BACKGROUND 3D DIYA */}
            <section
              className="relative min-h-[620px] lg:min-h-[650px] border-b border-amber-200 overflow-hidden flex items-center"
              style={{
                background: heroDiyaLit
                  ? 'radial-gradient(circle at 72% 48%, #FDE68A 0%, #FFE4E6 42%, #FFFDF9 82%)'
                  : 'radial-gradient(circle at 72% 48%, #E9D5FF 0%, #FFF3D6 48%, #FFFDF9 85%)',
              }}
            >
              {/* Full-Bleed 3D Diya Background Layer (Spans the entire Hero section, not a pop-out box) */}
              <InteractiveDiya3D
                isLit={heroDiyaLit}
                onLightDiya={() => setHeroDiyaLit(true)}
                onToggleLit={(next) => setHeroDiyaLit(next)}
                palette={effectivePalette}
                recipientName={recipientName || 'Anika'}
                stageAlign="right"
              />

              {/* Foreground Hero Content (pointer-events-none wrapper so background 3D Diya remains orbitable/clickable everywhere) */}
              <div className="relative z-10 pointer-events-none max-w-6xl w-full mx-auto px-6 py-12 lg:py-16 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
                {/* Left Column: Festive Story, Actions & Pre-Published Demo Rituals */}
                <div className="lg:col-span-6 pointer-events-auto">
                  <div className="text-xs font-semibold text-[#B45309] mb-3">
                    <span>Interactive 3D Artisan Diya</span>
                    <span className="mx-2" aria-hidden="true">·</span>
                    <span>Kaleidoscope Mandala Studio</span>
                    <span className="mx-2" aria-hidden="true">·</span>
                    <span>Gemini Cultural Poetics</span>
                  </div>

                  <h1
                    className="font-bold text-[#1E130D] tracking-tight mb-4"
                    style={{
                      fontSize: 'clamp(2.25rem, 3.8vw, 3.5rem)',
                      lineHeight: 1.08,
                      textWrap: 'balance',
                    }}
                  >
                    A Diwali Greeting You Light, Not Just Read.
                  </h1>

                  <p className="text-base text-[#4A2C18] leading-relaxed mb-6">
                    Turn a forwarded festive message into a vibrant, interactive ritual. Spin a radial mandala rangoli in one drag, craft a blessing in English, Hindi, Bengali, or Marathi, and share one link. Drag anywhere in the background to orbit the 3D Diya 360° or click its flame to stoke golden sparks.
                  </p>

                  <div className="flex flex-wrap items-center gap-3 mb-7">
                    <button
                      type="button"
                      onClick={() => {
                        document.getElementById('studio-workspace')?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="px-5 py-3 text-sm font-semibold text-white bg-gradient-to-r from-[#E11D48] via-[#EA580C] to-[#F59E0B] hover:opacity-95 rounded-xl shadow-md transition-all flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Flame className="w-4 h-4 fill-current" />
                      <span>Design Your Rangoli &amp; Blessing</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openSampleRitual(SAMPLE_GREETINGS.k7Qx9mA2, false)}
                      className="px-4 py-3 text-sm font-semibold text-[#1E130D] bg-white hover:bg-[#FFF8EB] border-2 border-amber-300 rounded-xl shadow-sm transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Play className="w-4 h-4 text-[#E11D48] fill-current" />
                      <span>Experience Anika’s Ritual (#k7Qx9mA2)</span>
                    </button>
                  </div>

                  {/* Compact Pre-Published Demo Rituals Strip (Solid surface, no backdrop-filter over WebGL) */}
                  <div className="p-4 rounded-2xl bg-[#FFFDF9] border border-amber-300 shadow-md">
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-xs font-bold text-[#1E130D] uppercase tracking-wider">
                        Instant Demo Rituals
                      </span>
                      <span className="text-[11px] font-medium text-[#7C2D12] font-mono-tabular">
                        3 Languages · Live 3D Diya
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {Object.values(SAMPLE_GREETINGS).map((sample) => {
                        const sLang = LANGUAGES.find((l) => l.code === sample.recipient.lang);
                        return (
                          <div
                            key={sample.id}
                            className="p-2.5 rounded-xl bg-[#FFFBF2] border border-amber-200 flex flex-col justify-between gap-2"
                          >
                            <div>
                              <div className="text-xs font-bold text-[#1E130D] truncate">
                                {sample.recipient.name} ({sLang?.nativeLabel})
                              </div>
                              <div className="text-[11px] text-[#6B4423] font-mono-tabular">
                                {sample.rangoli.symmetry} Axes · {sample.stats.lit} Lit
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openSampleRitual(sample, false)}
                                className="flex-1 py-1 px-2 text-[11px] font-semibold text-[#1E130D] bg-[#FDE68A] hover:bg-[#FCD34D] rounded-md transition-colors whitespace-nowrap cursor-pointer"
                              >
                                Open Dark
                              </button>
                              <button
                                type="button"
                                onClick={() => openSampleRitual(sample, true)}
                                className="flex-1 py-1 px-2 text-[11px] font-semibold text-white bg-[#E11D48] hover:bg-[#BE123C] rounded-md transition-colors whitespace-nowrap cursor-pointer"
                              >
                                Open Lit
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Right Column Spacer: Keeps the right half of the Hero unobstructed for the full-bleed 3D Diya */}
                <div className="lg:col-span-6 h-[340px] lg:h-[460px] pointer-events-none" />
              </div>
            </section>

            {/* 2. KALEIDOSCOPE RANGOLI STUDIO & CULTURAL AI POETICS WORKSPACE */}
            <section id="studio-workspace" className="max-w-6xl mx-auto px-6 py-12">
              <div className="mb-8">
                <div className="text-xs font-semibold text-[#C2410C] mb-1.5">
                  <span>01. Create &amp; Personalize in Under 60 Seconds</span>
                  <span className="mx-2" aria-hidden="true">·</span>
                  <span className="font-mono-tabular">
                    Current Mandala Payload: {rangoliByteSize} Bytes JSON
                  </span>
                </div>
                <h2 className="text-3xl sm:text-4xl font-bold text-[#1E130D]">
                  Kaleidoscope Rangoli Studio &amp; Cultural AI Poetics
                </h2>
              </div>

              {publishSuccessBanner && (
                <div className="mb-6 p-4 rounded-xl bg-emerald-50 border-2 border-emerald-400 flex items-center gap-3 text-sm font-medium text-emerald-950">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{publishSuccessBanner}</span>
                </div>
              )}

              {formError && (
                <div
                  role="alert"
                  className="mb-6 p-4 rounded-xl bg-rose-50 border-2 border-rose-400 flex items-center gap-3 text-sm font-medium text-rose-950"
                >
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form
                onSubmit={handlePublishGreeting}
                className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
              >
                {/* Left Column (7 cols): Interactive Mirrored SVG Rangoli Studio */}
                <div className="lg:col-span-7 p-6 sm:p-8 rounded-2xl bg-white border-2 border-amber-200 shadow-md">
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                    <div>
                      <h3 className="text-xl font-bold text-[#1E130D]">
                        1. Spin Your Kaleidoscope Mandala
                      </h3>
                      <p className="text-xs text-[#5C3A21] mt-0.5">
                        Choose from 7 festive themes, fine-tune the accent glow &amp; background motif, and drag to mirror across {symmetry} axes.
                      </p>
                    </div>

                    {/* Symmetry Axis Selector (Functional segmented buttons) */}
                    <div
                      role="group"
                      aria-label="Symmetry axes"
                      className="flex items-center gap-1 p-1 bg-[#FFF6E5] border border-amber-300 rounded-xl"
                    >
                      {([6, 8, 12] as SymmetryAxis[]).map((axis) => (
                        <button
                          key={axis}
                          type="button"
                          onClick={() => setSymmetry(axis)}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            symmetry === axis
                              ? 'bg-[#E11D48] text-white shadow-sm'
                              : 'text-[#5C3A21] hover:text-[#1E130D]'
                          }`}
                        >
                          {axis} Axes
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 7 Visual Themes Selector Grid */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-[#3D261C]">
                        Select Ritual Visual Theme (7 Curated Palettes)
                      </span>
                      <span className="text-[11px] font-medium text-[#7C2D12]">
                        Active: {currentTheme.name}
                      </span>
                    </div>
                    <div
                      role="radiogroup"
                      aria-label="Greeting Visual Theme"
                      className="grid grid-cols-1 sm:grid-cols-2 gap-2.5"
                    >
                      {(Object.values(THEMES) as typeof THEMES[ThemeId][]).map((t) => {
                        const active = themeId === t.id;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => handleSelectTheme(t.id)}
                            className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                              active
                                ? 'bg-[#FFF6E5] border-[#E11D48] shadow-sm'
                                : 'bg-[#FFFDF9] border-amber-200 hover:border-amber-400'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-xs font-bold text-[#1E130D] whitespace-nowrap">
                                {t.name}
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                <span
                                  className="w-3 h-3 rounded-sm inline-block border border-black/20"
                                  style={{ backgroundColor: t.bgLit }}
                                  title="Sanctuary Backdrop"
                                />
                                {t.palette.slice(0, 3).map((hex, i) => (
                                  <span
                                    key={i}
                                    className="w-2.5 h-2.5 rounded-full inline-block border border-black/15"
                                    style={{ backgroundColor: hex }}
                                  />
                                ))}
                              </div>
                            </div>
                            <p className="text-[11px] text-[#6B4423] line-clamp-1">{t.subtitle}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Theme Customization Panel: Fine-Tune Accent Color & Subtle Background Element */}
                  <div className="mb-6 p-4 rounded-xl bg-[#FFFDF8] border border-amber-300/90 space-y-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold text-[#1E130D]">
                          Fine-Tune {currentTheme.name} Accent &amp; Backdrop Motif
                        </div>
                        <div className="text-[11px] text-[#6B4423]">
                          Adjust the ritual’s primary accent glow or choose a subtle architectural background element.
                        </div>
                      </div>

                      {/* Accent Color Shifts + Custom Color Picker */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {currentTheme.accentVariants.map((variant) => {
                          const isSelectedAccent =
                            customAccentHex.toUpperCase() === variant.hex.toUpperCase();
                          return (
                            <button
                              key={variant.hex}
                              type="button"
                              onClick={() => setCustomAccentHex(variant.hex)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all flex items-center gap-1.5 cursor-pointer ${
                                isSelectedAccent
                                  ? 'bg-[#1E130D] text-white border-[#1E130D] shadow-xs'
                                  : 'bg-white text-[#3D261C] border-amber-300 hover:border-amber-500'
                              }`}
                            >
                              <span
                                className="w-2.5 h-2.5 rounded-full inline-block border border-white/40"
                                style={{ backgroundColor: variant.hex }}
                              />
                              <span>{variant.label}</span>
                            </button>
                          );
                        })}

                        <label
                          htmlFor="custom-accent-color-picker"
                          className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-white text-[#3D261C] border border-amber-300 hover:border-amber-500 flex items-center gap-1.5 cursor-pointer"
                          title="Fine-tune custom accent hex color"
                        >
                          <input
                            id="custom-accent-color-picker"
                            type="color"
                            value={customAccentHex}
                            onChange={(e) => setCustomAccentHex(e.target.value)}
                            className="w-4 h-4 border-0 p-0 bg-transparent cursor-pointer"
                          />
                          <span className="font-mono-tabular">{customAccentHex.toUpperCase()}</span>
                        </label>
                      </div>
                    </div>

                    {/* Subtle Background Motif Selector */}
                    <div className="pt-2.5 border-t border-amber-200/80">
                      <div className="text-[11px] font-semibold text-[#5C3A21] mb-1.5">
                        Subtle Background Element (rendered in studio &amp; recipient sanctuary):
                      </div>
                      <div
                        role="group"
                        aria-label="Subtle Background Element"
                        className="grid grid-cols-1 sm:grid-cols-2 gap-2"
                      >
                        {BACKGROUND_MOTIFS.map((motif) => {
                          const isSelectedMotif = bgMotif === motif.id;
                          return (
                            <button
                              key={motif.id}
                              type="button"
                              onClick={() => setBgMotif(motif.id)}
                              className={`px-3 py-2 rounded-lg border text-left transition-all cursor-pointer ${
                                isSelectedMotif
                                  ? 'bg-[#FFF3D6] border-[#E11D48] text-[#1E130D] shadow-2xs'
                                  : 'bg-white border-amber-200 text-[#4A2C18] hover:border-amber-400'
                              }`}
                            >
                              <div className="text-xs font-bold">{motif.label}</div>
                              <div className="text-[11px] text-[#7C2D12] line-clamp-1">
                                {motif.description}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Interactive SVG Canvas with Live Theme Backdrop & Subtle Background Motif Preview */}
                  <div
                    className="relative py-5 px-3 rounded-2xl overflow-hidden border-2 transition-colors duration-500"
                    style={{
                      background: `radial-gradient(circle at 50% 50%, ${currentTheme.bgLit} 0%, ${currentTheme.bgDark} 100%)`,
                      borderColor: `${customAccentHex}66`,
                    }}
                  >
                    <ThemeBackgroundMotif
                      motif={bgMotif}
                      accentHex={customAccentHex}
                      opacity={0.32}
                    />
                    <div className="relative z-10">
                      <RangoliCanvas
                        strokes={strokes}
                        symmetry={symmetry}
                        palette={effectivePalette}
                        accentHex={customAccentHex}
                        activeColorIndex={activeColorIndex}
                        activeStrokeWidth={strokeWidth}
                        interactive={true}
                        isBlooming={isBloomingPreview}
                        onAddStroke={handleAddStroke}
                        size={380}
                      />
                    </div>
                  </div>

                  {/* Pigment Swatches & Stroke Width */}
                  <div className="mt-6 pt-5 border-t border-amber-200 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-semibold text-[#5C3A21]">Pigment:</span>
                      {effectivePalette.map((hex, idx) => (
                        <button
                          key={`${idx}-${hex}`}
                          type="button"
                          onClick={() => setActiveColorIndex(idx)}
                          aria-label={`Select pigment color ${idx + 1}`}
                          className={`w-7 h-7 rounded-full border border-black/20 transition-transform cursor-pointer ${
                            activeColorIndex === idx
                              ? 'scale-115 ring-2 ring-[#E11D48] ring-offset-2 ring-offset-white'
                              : 'opacity-85 hover:opacity-100'
                          }`}
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <label htmlFor="stroke-width-range" className="text-xs font-semibold text-[#5C3A21]">
                        Width:
                      </label>
                      <input
                        id="stroke-width-range"
                        type="range"
                        min={1.5}
                        max={6}
                        step={0.5}
                        value={strokeWidth}
                        onChange={(e) => setStrokeWidth(Number(e.target.value))}
                        className="w-24 accent-[#E11D48]"
                      />
                    </div>
                  </div>

                  {/* Preset Mandalas & Undo/Clear Controls */}
                  <div className="mt-5 pt-4 border-t border-amber-200 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleLoadPresetMandala('lotus-bloom')}
                        className="px-3 py-1.5 text-xs font-semibold text-[#1E130D] bg-[#FFF2D6] hover:bg-[#FFE6B3] border border-amber-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Spin Lotus Mandala
                      </button>
                      <button
                        type="button"
                        onClick={() => handleLoadPresetMandala('solar-chakra')}
                        className="px-3 py-1.5 text-xs font-semibold text-[#1E130D] bg-[#FFF2D6] hover:bg-[#FFE6B3] border border-amber-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Spin Solar Chakra
                      </button>
                      <button
                        type="button"
                        onClick={() => handleLoadPresetMandala('royal-star')}
                        className="px-3 py-1.5 text-xs font-semibold text-[#1E130D] bg-[#FFF2D6] hover:bg-[#FFE6B3] border border-amber-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Spin Royal Star
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleUndoStroke}
                        disabled={strokes.length === 0}
                        className="px-3 py-1.5 text-xs font-semibold text-[#5C3A21] hover:text-[#1E130D] bg-[#FFFDF9] border border-amber-300 rounded-lg disabled:opacity-40 flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                        <span>Undo</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleClearCanvas}
                        disabled={strokes.length === 0}
                        className="px-3 py-1.5 text-xs font-semibold text-[#5C3A21] hover:text-[#1E130D] bg-[#FFFDF9] border border-amber-300 rounded-lg disabled:opacity-40 flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Clear</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Column (5 cols): Recipient Personalization & Cultural AI Poetics */}
                <div className="lg:col-span-5 p-6 sm:p-8 rounded-2xl bg-white border-2 border-amber-200 shadow-md space-y-6">
                  <div>
                    <h3 className="text-xl font-bold text-[#1E130D]">
                      2. Personalize &amp; AI Poetics
                    </h3>
                    <p className="text-xs text-[#5C3A21] mt-0.5">
                      Draft a blessing in the recipient’s native script with server-side Gemini Flash.
                    </p>
                  </div>

                  {/* Recipient First Name */}
                  <div>
                    <label
                      htmlFor="recipient-name-input"
                      className="block text-xs font-semibold text-[#3D261C] mb-1.5"
                    >
                      Recipient’s First Name (spelled in fireworks)
                    </label>
                    <input
                      id="recipient-name-input"
                      type="text"
                      maxLength={40}
                      placeholder="e.g. Anika, Aarav, अनिका, অনিকা"
                      value={recipientName}
                      onChange={(e) => {
                        setFormError(null);
                        setRecipientName(e.target.value);
                      }}
                      className="w-full px-3.5 py-2.5 text-sm bg-[#FFFDF9] text-[#1E130D] border-2 border-amber-300 rounded-xl focus:outline-none focus:border-[#E11D48]"
                    />
                  </div>

                  {/* Language Selector */}
                  <div>
                    <label className="block text-xs font-semibold text-[#3D261C] mb-1.5">
                      Blessing Language &amp; Script
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {LANGUAGES.map((l) => {
                        const active = recipientLang === l.code;
                        return (
                          <button
                            key={l.code}
                            type="button"
                            onClick={() => handleSelectLanguage(l.code)}
                            className={`px-3 py-2 rounded-xl border-2 text-left transition-colors cursor-pointer ${
                              active
                                ? 'bg-[#FFF6E5] border-[#E11D48] text-[#1E130D]'
                                : 'bg-[#FFFDF9] border-amber-200 text-[#4A2C18] hover:border-amber-400'
                            }`}
                          >
                            <div className="text-xs font-bold">
                              {l.label} · {l.nativeLabel}
                            </div>
                            <div className="text-[11px] text-[#7C2D12]">{l.scriptSample}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Relationship Tone Selector */}
                  <div>
                    <label className="block text-xs font-semibold text-[#3D261C] mb-1.5">
                      Relationship &amp; Poetic Register
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {TONES.map((t) => {
                        const active = recipientTone === t.id;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => handleSelectTone(t.id)}
                            className={`px-3 py-2 rounded-xl border-2 text-left transition-colors cursor-pointer ${
                              active
                                ? 'bg-[#FFF6E5] border-[#E11D48] text-[#1E130D]'
                                : 'bg-[#FFFDF9] border-amber-200 text-[#4A2C18] hover:border-amber-400'
                            }`}
                          >
                            <div className="text-xs font-bold">{t.label}</div>
                            <div className="text-[11px] text-[#7C2D12] line-clamp-1">
                              {t.description}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* AI Poetics Trigger & Blessing Editor */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label
                        htmlFor="blessing-message-textarea"
                        className="text-xs font-semibold text-[#3D261C]"
                      >
                        Diwali Blessing Letter
                      </label>
                      <button
                        type="button"
                        onClick={handleDraftWithAiPoetics}
                        disabled={isDraftingAi}
                        className="px-3 py-1.5 text-xs font-semibold text-[#1E130D] bg-gradient-to-r from-[#F59E0B] to-[#FBBF24] hover:from-[#FBBF24] hover:to-[#FDE047] rounded-lg shadow-sm transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                      >
                        <Wand2 className="w-3.5 h-3.5" />
                        <span>{isDraftingAi ? 'Drafting Blessing...' : 'Draft with AI Poetics'}</span>
                      </button>
                    </div>

                    <textarea
                      id="blessing-message-textarea"
                      rows={4}
                      maxLength={600}
                      value={messageText}
                      onChange={(e) => {
                        setFormError(null);
                        setMessageText(e.target.value);
                        setMessageSource('custom');
                      }}
                      className="w-full p-3.5 text-sm bg-[#FFFDF9] text-[#1E130D] border-2 border-amber-300 rounded-xl focus:outline-none focus:border-[#E11D48] leading-relaxed"
                    />

                    {recipientLang !== 'en' && (
                      <div className="mt-3">
                        <label
                          htmlFor="blessing-translation-input"
                          className="block text-xs font-medium text-[#5C3A21] mb-1"
                        >
                          Companion English Translation (shown beneath native script)
                        </label>
                        <textarea
                          id="blessing-translation-input"
                          rows={2}
                          maxLength={600}
                          value={messageTranslation}
                          onChange={(e) => setMessageTranslation(e.target.value)}
                          className="w-full p-2.5 text-xs bg-[#FFFDF9] text-[#4A2C18] border border-amber-300 rounded-lg focus:outline-none focus:border-[#E11D48]"
                        />
                      </div>
                    )}

                    <div className="mt-2 text-[11px] font-medium text-[#6B4423] flex items-center justify-between">
                      <span>
                        Source: {messageSource === 'gemini' ? 'Gemini Flash Cultural Poetics' : messageSource === 'template' ? 'Curated Cultural Template' : 'Custom Sender Verse'}
                        {aiLatencyMs !== null ? ` · ${aiLatencyMs} ms` : ''}
                      </span>
                      <span className="font-mono-tabular">{messageText.length}/600</span>
                    </div>
                  </div>

                  {/* Submit / Publish Button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isPublishing}
                      className="w-full py-3.5 px-6 text-sm font-semibold text-white bg-gradient-to-r from-[#E11D48] via-[#EA580C] to-[#F59E0B] hover:opacity-95 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" />
                      <span>
                        {isPublishing
                          ? 'Serializing to Firestore...'
                          : 'Publish Ritual Link & Generate WhatsApp Card'}
                      </span>
                    </button>
                  </div>
                </div>
              </form>
            </section>

            {/* 3. ARCHITECTURE & ENGINEERING PROOF SECTION */}
            <section
              id="architecture"
              className="border-t border-amber-200 bg-[#FFF5E0] py-14"
            >
              <div className="max-w-6xl mx-auto px-6">
                <div className="mb-10">
                  <div className="text-xs font-semibold text-[#C2410C] mb-1.5">
                    <span>02. Engineering Decisions &amp; Quantitative Proof</span>
                    <span className="mx-2" aria-hidden="true">·</span>
                    <span>Designed for Budget Mobile Devices on 4G</span>
                  </div>
                  <h2 className="text-3xl font-bold text-[#1E130D]">
                    How DiyaVerse Removes the Hidden Festive Traps
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-6 rounded-2xl bg-white border-2 border-amber-200 shadow-sm">
                    <div className="text-xs text-[#E11D48] font-bold mb-1">
                      01. Interactive 3D Diya &amp; Pointer-Up Audio Unlock
                    </div>
                    <h3 className="text-lg font-bold text-[#1E130D] mb-2">
                      Procedural Three.js PBR Lamp + Zero Blocked Autoplay
                    </h3>
                    <p className="text-sm text-[#4A2C18] leading-relaxed mb-4">
                      A 10-part procedural 3D Diya (hand-spun terracotta/brass lathe vessel, braided cotton wick, multi-layer additive flame, and marigold garland) invites direct click-to-ignite interaction while unlocking the Web Audio sitar synthesizer on pointer release.
                    </p>
                    <div className="text-xs font-semibold text-[#9A3412] font-mono-tabular">
                      Target: Diya lit within 5 seconds of link open · 0 KB external 3D/audio assets
                    </div>
                  </div>

                  <div className="p-6 rounded-2xl bg-white border-2 border-amber-200 shadow-sm">
                    <div className="text-xs text-[#D97706] font-bold mb-1">
                      02. Ramer–Douglas–Peucker Vector Serialization
                    </div>
                    <h3 className="text-lg font-bold text-[#1E130D] mb-2">
                      Entire Mandala Stored in Under 1.5 KB of Firestore JSON
                    </h3>
                    <p className="text-sm text-[#4A2C18] leading-relaxed mb-4">
                      Rather than uploading heavy PNGs to cloud storage, DiyaVerse simplifies only the base stroke with Ramer–Douglas–Peucker (ε = 0.005) and mirrors it across 6, 8, or 12 dihedral axes at render time—both in the browser and in the server-rendered `/api/og/:id` social card.
                    </p>
                    <div className="text-xs font-semibold text-[#9A3412] font-mono-tabular">
                      Live Mandala Footprint: {rangoliByteSize} Bytes UTF-8 JSON · Instant 60 FPS SVG Redraw
                    </div>
                  </div>

                  <div className="p-6 rounded-2xl bg-white border-2 border-amber-200 shadow-sm">
                    <div className="text-xs text-[#4338CA] font-bold mb-1">
                      03. Server-Side Gemini Flash with Cultural Fallback
                    </div>
                    <h3 className="text-lg font-bold text-[#1E130D] mb-2">
                      Bilingual Blessings in English, Hindi, Bengali &amp; Marathi
                    </h3>
                    <p className="text-sm text-[#4A2C18] leading-relaxed mb-4">
                      API keys never touch the browser. The Express backend calls <code className="text-[#C2410C] font-semibold">gemini-3.8-flash</code> with per-IP rate limiting and falls back automatically to curated cultural and literary templates if offline.
                    </p>
                    <div className="text-xs font-semibold text-[#4338CA] font-mono-tabular">
                      4 Languages Preloaded · Noto Sans Devanagari &amp; Bengali Subset
                    </div>
                  </div>

                  <div className="p-6 rounded-2xl bg-white border-2 border-amber-200 shadow-sm">
                    <div className="text-xs text-[#059669] font-bold mb-1">
                      04. Offscreen Glyph Constellation Fireworks
                    </div>
                    <h3 className="text-lg font-bold text-[#1E130D] mb-2">
                      Multi-Script Name Sampling with Adaptive Frame-Time Cap
                    </h3>
                    <p className="text-sm text-[#4A2C18] leading-relaxed mb-4">
                      When tapped, the festival sky samples the recipient’s name from an offscreen 2D canvas so Devanagari, Bengali, and Latin scripts all resolve into golden star constellations before drifting down as embers.
                    </p>
                    <div className="text-xs font-semibold text-[#047857] font-mono-tabular">
                      60 FPS Target · Automatic Particle Scaling &amp; Reduced-Motion Support
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* Quiet Festive Footer */}
      <footer className="border-t border-amber-300/80 px-6 py-6 text-xs text-[#5C3A21] bg-[#FFFDF8]">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div>
            <strong className="text-[#9A1B2F] font-display text-sm">DiyaVerse</strong>
            <span className="mx-2" aria-hidden="true">·</span>
            <span>A Diwali greeting you light, not just read</span>
          </div>
          <div>
            <span>Privacy-First: First Name &amp; Blessing Only</span>
            <span className="mx-2" aria-hidden="true">·</span>
            <span>90-Day Firestore TTL</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
