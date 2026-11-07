import React, { useEffect, useState } from 'react';
import { Copy, Check, RefreshCw, ExternalLink, Flame, Eye, FileJson, ArrowLeft } from 'lucide-react';
import { GreetingDocument, THEMES, LANGUAGES } from '../utils/greetingSchema';
import { calculateRangoliByteSize } from '../utils/rangoliMath';
import { subscribeToGreeting, incrementGreetingStat } from '../firebase';
import { RangoliCanvas } from './RangoliCanvas';

interface SenderManageViewProps {
  greetingId: string;
  initialGreeting: GreetingDocument;
  manageToken?: string;
  onOpenRecipientView: (greeting: GreetingDocument) => void;
  onBackToStudio: () => void;
}

export const SenderManageView: React.FC<SenderManageViewProps> = ({
  greetingId,
  initialGreeting,
  manageToken,
  onOpenRecipientView,
  onBackToStudio,
}) => {
  const [greeting, setGreeting] = useState<GreetingDocument>(initialGreeting);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedManage, setCopiedManage] = useState(false);
  const [previewVersion, setPreviewVersion] = useState(1);
  const [showJsonInspector, setShowJsonInspector] = useState(false);
  const [simulatingReaction, setSimulatingReaction] = useState(false);

  useEffect(() => {
    setGreeting(initialGreeting);
    const unsub = subscribeToGreeting(greetingId, (updated) => {
      setGreeting(updated);
    });
    return () => unsub();
  }, [greetingId, initialGreeting]);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const publicLink = `${origin}/?g=${encodeURIComponent(greeting.id)}&v=${previewVersion}`;
  const manageLink = `${origin}/?manage=${encodeURIComponent(greeting.id)}${
    manageToken ? `&token=${encodeURIComponent(manageToken)}` : ''
  }`;
  const ogImageUrl = `/api/og/${encodeURIComponent(greeting.id)}?v=${greeting.stats.lit}_${previewVersion}`;

  const theme = THEMES[greeting.theme] || THEMES['midnight-indigo'];
  const langMeta = LANGUAGES.find((l) => l.code === greeting.recipient.lang) || LANGUAGES[0];
  const rangoliBytes = calculateRangoliByteSize(
    greeting.rangoli.strokes,
    greeting.rangoli.symmetry,
    greeting.rangoli.palette
  );

  const handleCopyPublic = () => {
    navigator.clipboard?.writeText(publicLink).catch(() => {});
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyManage = () => {
    navigator.clipboard?.writeText(manageLink).catch(() => {});
    setCopiedManage(true);
    setTimeout(() => setCopiedManage(false), 2000);
  };

  const handleSimulateRecipientLit = async () => {
    setSimulatingReaction(true);
    const next = await incrementGreetingStat(greeting.id, 'lit');
    if (typeof next === 'number') {
      setGreeting((prev) => ({
        ...prev,
        stats: { ...prev.stats, lit: next },
      }));
    }
    setSimulatingReaction(false);
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <button
            type="button"
            onClick={onBackToStudio}
            className="text-xs font-semibold text-[#9A3412] hover:text-[#7C2D12] flex items-center gap-1.5 mb-2 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Rangoli Studio</span>
          </button>
          <h1 className="text-3xl sm:text-4xl font-bold text-[#1E130D]">
            Sender Live Ritual Console · {greeting.recipient.name}
          </h1>
          <p className="text-xs text-[#5C3A21] mt-1 font-medium">
            <span>Short ID: {greeting.id}</span>
            <span className="mx-2" aria-hidden="true">·</span>
            <span>{theme.name}</span>
            <span className="mx-2" aria-hidden="true">·</span>
            <span>{langMeta.label}</span>
            <span className="mx-2" aria-hidden="true">·</span>
            <span>Vector Payload: {rangoliBytes} Bytes JSON</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onOpenRecipientView(greeting)}
            className="px-4 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-[#E11D48] to-[#F59E0B] hover:opacity-95 rounded-xl shadow-md transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open Recipient Ritual</span>
          </button>
        </div>
      </div>

      {/* Live Counter KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <div className="p-6 rounded-2xl bg-white border-2 border-amber-200 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-[#9A3412] mb-2">
            <span>Live "Diya Lit" Reactions</span>
            <Flame className="w-4 h-4 text-[#E11D48] fill-current" />
          </div>
          <div
            data-testid="manage-lit-counter"
            className="text-4xl font-bold text-[#1E130D] font-mono-tabular"
          >
            {greeting.stats.lit}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-[#6B4423]">Real-time Firestore sync</span>
            <button
              type="button"
              onClick={handleSimulateRecipientLit}
              disabled={simulatingReaction}
              className="text-xs font-semibold text-[#E11D48] hover:text-[#BE123C] underline underline-offset-4 cursor-pointer"
            >
              {simulatingReaction ? 'Lighting...' : '+1 Test Lit Reaction'}
            </button>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-white border-2 border-indigo-200 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-[#4338CA] mb-2">
            <span>Ritual Link Opens</span>
            <Eye className="w-4 h-4 text-[#4338CA]" />
          </div>
          <div
            data-testid="manage-opens-counter"
            className="text-4xl font-bold text-[#1E130D] font-mono-tabular"
          >
            {greeting.stats.opens}
          </div>
          <p className="mt-3 text-xs text-[#6B4423]">
            Unguessable short ID · Zero personal data tracked
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-white border-2 border-emerald-200 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold text-[#047857] mb-2">
            <span>Firestore Vector Footprint</span>
            <FileJson className="w-4 h-4 text-[#059669]" />
          </div>
          <div className="text-4xl font-bold text-[#1E130D] font-mono-tabular">
            {(rangoliBytes / 1024).toFixed(2)} KB
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-[#6B4423]">
              {greeting.rangoli.strokes.length} RDP base strokes × {greeting.rangoli.symmetry} axes
            </span>
            <button
              type="button"
              onClick={() => setShowJsonInspector((v) => !v)}
              className="text-xs font-semibold text-[#047857] hover:text-[#065F46] underline underline-offset-4 cursor-pointer"
            >
              {showJsonInspector ? 'Hide JSON' : 'Inspect JSON'}
            </button>
          </div>
        </div>
      </div>

      {/* Share Links & Dynamic WhatsApp OpenGraph Card Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-5 space-y-6 p-6 rounded-2xl bg-white border-2 border-amber-200 shadow-sm">
          <div>
            <h2 className="text-xl font-bold text-[#1E130D] mb-1">Share Ritual Link</h2>
            <p className="text-xs text-[#5C3A21] mb-3">
              Paste into WhatsApp, iMessage, or Slack to render the custom card with {greeting.recipient.name}’s mandala.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                aria-label="Public recipient ritual link"
                value={publicLink}
                className="w-full px-3 py-2 text-xs font-mono-tabular bg-[#FFF8EB] text-[#1E130D] border border-amber-300 rounded-lg focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCopyPublic}
                className="px-3.5 py-2 text-xs font-semibold text-[#1E130D] bg-[#F59E0B] hover:bg-[#FBBF24] rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-amber-200">
            <h3 className="text-sm font-semibold text-[#1E130D] mb-1">
              Private Sender Manage Link
            </h3>
            <p className="text-xs text-[#5C3A21] mb-3">
              Bookmark this secret link to watch the live “Diya Lit” counter without creating an account.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                aria-label="Private sender manage link"
                value={manageLink}
                className="w-full px-3 py-2 text-xs font-mono-tabular bg-[#FFF8EB] text-[#4A2C18] border border-amber-300 rounded-lg focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCopyManage}
                className="px-3.5 py-2 text-xs font-semibold text-[#1E130D] bg-[#FFF2D6] hover:bg-[#FFE6B3] border border-amber-300 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {copiedManage ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedManage ? 'Copied' : 'Copy Secret'}</span>
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-amber-200 flex items-center justify-center">
            <div className="w-44 h-44">
              <RangoliCanvas
                strokes={greeting.rangoli.strokes}
                symmetry={greeting.rangoli.symmetry}
                palette={greeting.rangoli.palette}
                interactive={false}
                size={240}
              />
            </div>
          </div>
        </div>

        {/* Dynamic OpenGraph Social Card Preview */}
        <div className="lg:col-span-7 p-6 rounded-2xl bg-white border-2 border-amber-200 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-xl font-bold text-[#1E130D]">
                Server-Generated WhatsApp OpenGraph Card
              </h2>
              <p className="text-xs text-[#5C3A21]">
                Rendered dynamically at <code className="font-mono-tabular font-semibold text-[#C2410C]">/api/og/{greeting.id}</code> from stored vector strokes
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPreviewVersion((v) => v + 1)}
              className="px-3 py-1.5 text-xs font-semibold text-[#1E130D] bg-[#FFF2D6] hover:bg-[#FFE6B3] border border-amber-300 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Bust WhatsApp Cache (v{previewVersion})</span>
            </button>
          </div>

          <div className="rounded-xl overflow-hidden border-2 border-amber-300 bg-[#1B1228]">
            <img
              src={ogImageUrl}
              alt={`OpenGraph preview card for ${greeting.recipient.name}`}
              referrerPolicy="no-referrer"
              className="w-full h-auto block"
            />
            <div className="px-4 py-3 bg-[#FFF8EB] border-t border-amber-200 flex items-center justify-between text-xs text-[#1E130D]">
              <span className="truncate font-medium">
                A Diwali Diya for {greeting.recipient.name} – DiyaVerse
              </span>
              <span className="font-mono-tabular font-semibold text-[#C2410C] shrink-0 ml-3">
                1200×630 Dynamic SVG Card
              </span>
            </div>
          </div>

          {showJsonInspector && (
            <div className="mt-6 pt-4 border-t border-amber-200">
              <h3 className="text-xs font-semibold text-[#9A3412] mb-2">
                Firestore Document Schema ({rangoliBytes} Bytes Rangoli Vector Payload)
              </h3>
              <pre className="p-4 rounded-xl bg-[#1E130D] border border-amber-300 text-xs font-mono-tabular text-[#FFF8EB] overflow-x-auto max-h-64">
                {JSON.stringify(greeting, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
