import { RangoliStroke, SymmetryAxis, generatePresetMandala, simplifyStrokeRDP } from './rangoliMath';

export type ThemeId =
  | 'royal-marigold'
  | 'midnight-indigo'
  | 'sacred-terracotta'
  | 'peacock-emerald'
  | 'lotus-rose'
  | 'jaipur-amethyst'
  | 'sandalwood-ivory';

export type BackgroundMotifId =
  | 'mandala-rings'
  | 'starlight-dust'
  | 'marigold-petals'
  | 'temple-arch';

export interface ThemeCustomization {
  accentHex: string;
  bgMotif: BackgroundMotifId;
}

export type BlessingLang = 'en' | 'hi' | 'bn' | 'mr';
export type BlessingTone = 'family' | 'friend' | 'colleague' | 'literary';
export type MessageSource = 'gemini' | 'template' | 'custom';

export interface GreetingDocument {
  id: string;
  theme: ThemeId;
  themeCustomization?: ThemeCustomization;
  recipient: {
    name: string;
    lang: BlessingLang;
    tone: BlessingTone;
  };
  message: {
    text: string;
    translation?: string;
    source: MessageSource;
  };
  rangoli: {
    symmetry: SymmetryAxis;
    palette: string[];
    strokes: RangoliStroke[];
  };
  stats: {
    opens: number;
    lit: number;
  };
  createdAt: string;
  expiresAt: string;
}

export interface AccentVariant {
  id: string;
  label: string;
  hex: string;
}

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  subtitle: string;
  bgDark: string;
  bgLit: string;
  surfaceCard: string;
  accentHex: string;
  glowHex: string;
  defaultMotif: BackgroundMotifId;
  accentVariants: AccentVariant[];
  palette: string[];
}

export const VALID_THEME_IDS: ThemeId[] = [
  'royal-marigold',
  'midnight-indigo',
  'sacred-terracotta',
  'peacock-emerald',
  'lotus-rose',
  'jaipur-amethyst',
  'sandalwood-ivory',
];

export const VALID_BG_MOTIFS: BackgroundMotifId[] = [
  'mandala-rings',
  'starlight-dust',
  'marigold-petals',
  'temple-arch',
];

export const BACKGROUND_MOTIFS: {
  id: BackgroundMotifId;
  label: string;
  description: string;
}[] = [
  {
    id: 'mandala-rings',
    label: 'Sacred Lotus Rings',
    description: 'Concentric geometric mandala rings radiating gently in the backdrop',
  },
  {
    id: 'starlight-dust',
    label: 'Starlight Diya Dust',
    description: 'Delicate twinkling constellation sparks and festival embers',
  },
  {
    id: 'marigold-petals',
    label: 'Floating Marigold Petals',
    description: 'Soft translucent blossom silhouettes drifting across the sanctuary',
  },
  {
    id: 'temple-arch',
    label: 'Jharokha Temple Lattice',
    description: 'Subtle carved sandstone arch & heritage geometric lattice',
  },
];

export const THEMES: Record<ThemeId, ThemeConfig> = {
  'royal-marigold': {
    id: 'royal-marigold',
    name: 'Royal Marigold',
    subtitle: 'Saffron petals, kumkum vermilion & temple brass',
    bgDark: '#1C0D06',
    bgLit: '#3D1E0B',
    surfaceCard: '#241309',
    accentHex: '#F4A300',
    glowHex: '#FF9E1B',
    defaultMotif: 'marigold-petals',
    accentVariants: [
      { id: 'saffron', label: 'Saffron Gold', hex: '#F4A300' },
      { id: 'vermilion', label: 'Kumkum Red', hex: '#E11D48' },
      { id: 'amber', label: 'Sunlit Amber', hex: '#FF7043' },
    ],
    palette: ['#F4A300', '#D81B60', '#FF7043', '#2E7D32', '#FFD54F'],
  },
  'midnight-indigo': {
    id: 'midnight-indigo',
    name: 'Midnight Indigo',
    subtitle: 'Starlit courtyard, deep indigo & golden marigold',
    bgDark: '#0D1026',
    bgLit: '#1E254B',
    surfaceCard: '#141936',
    accentHex: '#F4A300',
    glowHex: '#6366F1',
    defaultMotif: 'starlight-dust',
    accentVariants: [
      { id: 'marigold', label: 'Starlit Gold', hex: '#F4A300' },
      { id: 'indigo', label: 'Celestial Blue', hex: '#6366F1' },
      { id: 'rose', label: 'Crimson Spark', hex: '#EC4899' },
    ],
    palette: ['#F4A300', '#C2185B', '#3949AB', '#10B981', '#FBBF24'],
  },
  'sacred-terracotta': {
    id: 'sacred-terracotta',
    name: 'Sacred Terracotta',
    subtitle: 'Hand-spun earthen clay, sandalwood & leaf green',
    bgDark: '#1F0F0B',
    bgLit: '#3B1C14',
    surfaceCard: '#28130E',
    accentHex: '#E66C37',
    glowHex: '#F97316',
    defaultMotif: 'mandala-rings',
    accentVariants: [
      { id: 'terracotta', label: 'Earthen Clay', hex: '#E66C37' },
      { id: 'turmeric', label: 'Turmeric Gold', hex: '#EAB308' },
      { id: 'mango', label: 'Mango Leaf', hex: '#16A34A' },
    ],
    palette: ['#E66C37', '#F4A300', '#8E24AA', '#15803D', '#FDE047'],
  },
  'peacock-emerald': {
    id: 'peacock-emerald',
    name: 'Peacock Emerald',
    subtitle: 'Mayura teal, temple emerald & antique brass',
    bgDark: '#072227',
    bgLit: '#0F3D3E',
    surfaceCard: '#0A2E33',
    accentHex: '#10B981',
    glowHex: '#06B6D4',
    defaultMotif: 'temple-arch',
    accentVariants: [
      { id: 'emerald', label: 'Mayura Emerald', hex: '#10B981' },
      { id: 'turquoise', label: 'Peacock Plume', hex: '#06B6D4' },
      { id: 'brass', label: 'Temple Brass', hex: '#F59E0B' },
    ],
    palette: ['#10B981', '#06B6D4', '#F59E0B', '#EC4899', '#A7F3D0'],
  },
  'lotus-rose': {
    id: 'lotus-rose',
    name: 'Lotus Rose Quartz',
    subtitle: 'Padma pink petals, rosewater & champagne gold',
    bgDark: '#2B0B1E',
    bgLit: '#4C1434',
    surfaceCard: '#380E27',
    accentHex: '#F43F5E',
    glowHex: '#FB7185',
    defaultMotif: 'marigold-petals',
    accentVariants: [
      { id: 'lotus', label: 'Padma Rose', hex: '#F43F5E' },
      { id: 'champagne', label: 'Champagne Gold', hex: '#FBBF24' },
      { id: 'orchid', label: 'Gulaal Magenta', hex: '#D946EF' },
    ],
    palette: ['#F43F5E', '#FBBF24', '#D946EF', '#14B8A6', '#FDA4AF'],
  },
  'jaipur-amethyst': {
    id: 'jaipur-amethyst',
    name: 'Jaipur Amethyst',
    subtitle: 'Hawa Mahal twilight, royal plum & meenakari gold',
    bgDark: '#1E0B30',
    bgLit: '#381557',
    surfaceCard: '#280E40',
    accentHex: '#A855F7',
    glowHex: '#C084FC',
    defaultMotif: 'temple-arch',
    accentVariants: [
      { id: 'amethyst', label: 'Royal Amethyst', hex: '#A855F7' },
      { id: 'kundan', label: 'Kundan Gold', hex: '#F59E0B' },
      { id: 'ruby', label: 'Jaipur Ruby', hex: '#E11D48' },
    ],
    palette: ['#A855F7', '#F59E0B', '#E11D48', '#2DD4BF', '#E9D5FF'],
  },
  'sandalwood-ivory': {
    id: 'sandalwood-ivory',
    name: 'Sandalwood Ivory',
    subtitle: 'Chandan parchment, sacred turmeric & warmamber',
    bgDark: '#261A0E',
    bgLit: '#453019',
    surfaceCard: '#332312',
    accentHex: '#D97706',
    glowHex: '#F59E0B',
    defaultMotif: 'mandala-rings',
    accentVariants: [
      { id: 'chandan', label: 'Chandan Amber', hex: '#D97706' },
      { id: 'kumkum', label: 'Sacred Sindoor', hex: '#DC2626' },
      { id: 'cardamom', label: 'Cardamom Sage', hex: '#059669' },
    ],
    palette: ['#D97706', '#DC2626', '#059669', '#7C3AED', '#FDE68A'],
  },
};

export const LANGUAGES: { code: BlessingLang; label: string; nativeLabel: string; scriptSample: string }[] = [
  { code: 'en', label: 'English', nativeLabel: 'English', scriptSample: 'Light & Joy' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी', scriptSample: 'शुभ दीपावली' },
  { code: 'bn', label: 'Bengali', nativeLabel: 'বাংলা', scriptSample: 'শুভ দীপাবলি' },
  { code: 'mr', label: 'Marathi', nativeLabel: 'मराठी', scriptSample: 'शुभ दिवाळी' },
];

export const TONES: { id: BlessingTone; label: string; description: string }[] = [
  { id: 'family', label: 'Family Blessing', description: 'Warm, reverent wishes for home, elders, and loved ones' },
  { id: 'friend', label: 'Close Friend', description: 'Joyful, personal warmth celebrating shared memories' },
  { id: 'colleague', label: 'Gracious Colleague', description: 'Thoughtful, poised wishes for prosperity and harmony' },
  { id: 'literary', label: 'Classical Literary', description: 'Poetic cadence inspired by classic subcontinental verse' },
];

export const CULTURAL_BLESSING_TEMPLATES: Record<
  BlessingLang,
  Record<BlessingTone, { text: string; translation: string }>
> = {
  en: {
    family: {
      text: 'Dear {name}, as this single earthen diya parts the autumn night, may warmth, peace, and quiet abundance fill every corner of our home. Wishing you a luminous Diwali.',
      translation: '',
    },
    friend: {
      text: 'For {name} — may the spark you strike tonight kindle a year of bold beginnings, unhurried laughter, and bright horizons. Happy Diwali, my friend!',
      translation: '',
    },
    colleague: {
      text: 'Dear {name}, wishing you and your family a serene and prosperous Diwali. May the coming year bring clarity, shared success, and enduring light.',
      translation: '',
    },
    literary: {
      text: 'Unto the quiet dark {name} brings a solitary flame; and lo, the courtyard remembers the sun. May every shadow yield to your steadfast light this Deepavali.',
      translation: '',
    },
  },
  hi: {
    family: {
      text: 'प्रिय {name}, जैसे एक नन्हा मिट्टी का दीप अमावस के अंधकार को हर लेता है, वैसे ही आपका आँगन सुख, स्वास्थ्य और अपनों के स्नेह से सदा आलोकित रहे। शुभ दीपावली!',
      translation: 'Dear {name}, just as a small clay lamp dispels the new-moon darkness, may your courtyard remain forever illuminated with joy, health, and the warmth of loved ones. Happy Diwali!',
    },
    friend: {
      text: 'प्रिय {name}, इस दीपावली की हर लौ तुम्हारे जीवन में नई उमंग, मुस्कान और सुनहरे अवसर लेकर आए। दोस्ती की यह रोशनी यूँ ही जगमगाती रहे — शुभ दीपावली!',
      translation: 'Dear {name}, may every flame this Diwali bring fresh enthusiasm, laughter, and golden horizons into your life. May the light of our friendship shine on — Happy Diwali!',
    },
    colleague: {
      text: '{name} जी, दीपावली के पावन पर्व पर आपको और आपके परिवार को हार्दिक शुभकामनाएँ। आने वाला वर्ष आपके लिए उन्नति, शांति और नई उपलब्धियों से भरा हो।',
      translation: 'Dear {name}, warm wishes to you and your family on the auspicious festival of Diwali. May the coming year bring progress, peace, and new achievements.',
    },
    literary: {
      text: 'तमस के मौन आँगन में {name} ने जो एक दीप धरा, तो माटी ने भी नक्षत्रों का गौरव पा लिया। ज्योति के इस महापर्व पर आपका अंतर्मन सदा उजास से भरा रहे।',
      translation: 'When {name} placed a single lamp in the silent courtyard of darkness, humble clay attained the grace of stars. On this grand festival of light, may your spirit remain forever radiant.',
    },
  },
  bn: {
    family: {
      text: 'প্রিয় {name}, মাটির প্রদীপের এই স্নিগ্ধ শিখা যেমন অমাবস্যার অন্ধকার দূর করে, তেমনি আপনার ঘর ও মন ভরে উঠুক শান্তি, আনন্দ ও মঙ্গলের আলোয়। শুভ দীপাবলি!',
      translation: 'Dear {name}, as the gentle flame of this clay diya dispels the darkness of the new moon, may your home and heart be filled with the light of peace, joy, and wellbeing. Happy Diwali!',
    },
    friend: {
      text: 'প্রিয় {name}, আলোর উৎসবের প্রতিটি প্রদীপ তোমার জীবনে নিয়ে আসুক নতুন স্বপ্ন, হাসি আর অফুরন্ত আনন্দ। আমাদের বন্ধুত্বের আলো চিরকাল অমলিন থাকুক — শুভ দীপাবলি!',
      translation: 'Dear {name}, may every lamp of this festival of lights bring new dreams, laughter, and boundless joy to your life. May the light of our friendship stay timeless — Happy Diwali!',
    },
    colleague: {
      text: 'শ্রদ্ধেয় {name}, দীপাবলির এই পুণ্য লগ্নে আপনাকে ও আপনার পরিবারকে জানাই আন্তরিক শুভেচ্ছা। আগামী দিনগুলি সাফল্য, সমৃদ্ধি ও সুস্বাস্থ্যে উজ্জ্বল হয়ে উঠুক।',
      translation: 'Dear {name}, warm greetings to you and your family on this auspicious occasion of Diwali. May the days ahead shine with success, prosperity, and good health.',
    },
    literary: {
      text: 'নিশীথের নীরব প্রাঙ্গণে {name} জ্বালাল যে মাটির প্রদীপখানি, তারই শিখায় জেগে উঠল শত নক্ষত্রের বাণী। অন্ধকার পেরিয়ে আপনার পথ চিরকাল হোক জ্যোতির্ময়।',
      translation: 'In the silent courtyard of night, the earthen lamp lit by {name} awakens the song of a hundred stars. Beyond the darkness, may your path forever be luminous.',
    },
  },
  mr: {
    family: {
      text: 'प्रिय {name}, पणतीच्या एका शांत ज्योतीने जसा अंधार उजळून निघतो, तसेच तुमचे घर आणि आयुष्य सुख, समृद्धी व आरोग्याने सदैव उजळत राहो. शुभ दिवाळी!',
      translation: 'Dear {name}, just as a single serene flame of a clay lamp brightens the dark, may your home and life forever glow with happiness, prosperity, and health. Happy Diwali!',
    },
    friend: {
      text: 'प्रिय {name}, दिवाळीच्या या लक्ष दिव्यांनी तुझ्या आयुष्यात नवे रंग, आनंद आणि सोनेरी यश घेऊन येवो. आपल्या मैत्रीचा हा प्रकाश असाच तेवत राहो — शुभ दिवाळी!',
      translation: 'Dear {name}, may the countless lamps of Diwali bring vibrant joy and golden success into your life. May the light of our friendship shine on forever — Happy Diwali!',
    },
    colleague: {
      text: 'सस्नेह नमस्कार {name}, दिवाळीच्या मंगलमय पर्वावर तुम्हाला आणि तुमच्या कुटुंबीयांना मनःपूर्वक शुभेच्छा. येणारे वर्ष आपणास उत्तम आरोग्य व भरभराटीचे जावो.',
      translation: 'Warm regards {name}, heartfelt wishes to you and your family on the auspicious festival of Diwali. May the coming year bring excellent health and prosperity.',
    },
    literary: {
      text: 'तिमिराच्या शांत प्रांगणी {name} ने लावलेली एक मातीची पणती, जणू आभाळातील नक्षत्रांनाच जमिनीवर उतरवून आणते. दीपोत्सवाच्या या प्रकाशाने तुमचे अंतरंग उजळून निघो.',
      translation: 'A single clay lamp lit by {name} in the quiet courtyard of night brings the very constellations of the sky down to earth. May this festival of lights illuminate your soul.',
    },
  },
};

export function getTemplateBlessing(
  name: string,
  lang: BlessingLang,
  tone: BlessingTone
): { text: string; translation: string } {
  const cleanName = sanitizeText(name || 'Friend', 40) || 'Friend';
  const entry = CULTURAL_BLESSING_TEMPLATES[lang]?.[tone] || CULTURAL_BLESSING_TEMPLATES.en.family;
  return {
    text: entry.text.replace(/\{name\}/g, cleanName),
    translation: entry.translation ? entry.translation.replace(/\{name\}/g, cleanName) : '',
  };
}

/**
 * Sanitizes user input by stripping HTML tags and trimming to maxLength.
 */
export function sanitizeText(input: string, maxLength: number): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

/**
 * Validates a hex color string (#RRGGBB), falling back to fallbackHex if invalid.
 */
export function sanitizeHexColor(input: string | undefined, fallbackHex: string): string {
  if (typeof input !== 'string') return fallbackHex;
  const trimmed = input.trim();
  return /^#[0-9A-Fa-f]{6}$/.test(trimmed) ? trimmed.toUpperCase() : fallbackHex;
}

/**
 * Generates an 8-character unguessable alphanumeric short ID.
 */
export function generateShortId(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitized?: {
    theme: ThemeId;
    themeCustomization: ThemeCustomization;
    recipientName: string;
    recipientLang: BlessingLang;
    recipientTone: BlessingTone;
    messageText: string;
    messageTranslation: string;
    messageSource: MessageSource;
    rangoliSymmetry: SymmetryAxis;
    rangoliPalette: string[];
    rangoliStrokes: RangoliStroke[];
  };
}

export function validateGreetingInput(input: {
  theme?: string;
  themeCustomization?: {
    accentHex?: string;
    bgMotif?: string;
  };
  recipientName?: string;
  recipientLang?: string;
  recipientTone?: string;
  messageText?: string;
  messageTranslation?: string;
  messageSource?: string;
  rangoliSymmetry?: number;
  rangoliPalette?: string[];
  rangoliStrokes?: RangoliStroke[];
}): ValidationResult {
  const recipientName = sanitizeText(input.recipientName || '', 40);
  if (!recipientName) {
    return { valid: false, error: 'Please enter the recipient’s first name (1–40 characters).' };
  }

  const messageText = sanitizeText(input.messageText || '', 600);
  if (!messageText) {
    return { valid: false, error: 'Please draft or enter a Diwali blessing message.' };
  }

  const theme: ThemeId = VALID_THEME_IDS.includes(input.theme as ThemeId)
    ? (input.theme as ThemeId)
    : 'midnight-indigo';

  const baseTheme = THEMES[theme];
  const accentHex = sanitizeHexColor(
    input.themeCustomization?.accentHex,
    baseTheme.accentHex
  );
  const bgMotif: BackgroundMotifId = VALID_BG_MOTIFS.includes(
    input.themeCustomization?.bgMotif as BackgroundMotifId
  )
    ? (input.themeCustomization?.bgMotif as BackgroundMotifId)
    : baseTheme.defaultMotif;

  const recipientLang: BlessingLang =
    input.recipientLang === 'en' ||
    input.recipientLang === 'hi' ||
    input.recipientLang === 'bn' ||
    input.recipientLang === 'mr'
      ? input.recipientLang
      : 'en';

  const recipientTone: BlessingTone =
    input.recipientTone === 'family' ||
    input.recipientTone === 'friend' ||
    input.recipientTone === 'colleague' ||
    input.recipientTone === 'literary'
      ? input.recipientTone
      : 'family';

  const messageSource: MessageSource =
    input.messageSource === 'gemini' ||
    input.messageSource === 'template' ||
    input.messageSource === 'custom'
      ? input.messageSource
      : 'template';

  const rangoliSymmetry: SymmetryAxis =
    input.rangoliSymmetry === 6 || input.rangoliSymmetry === 8 || input.rangoliSymmetry === 12
      ? input.rangoliSymmetry
      : 8;

  const rawStrokes = Array.isArray(input.rangoliStrokes) ? input.rangoliStrokes : [];
  if (rawStrokes.length === 0) {
    return { valid: false, error: 'Please draw at least one stroke on the Rangoli canvas or spin a mandala.' };
  }

  const simplifiedStrokes: RangoliStroke[] = rawStrokes
    .slice(0, 40)
    .map((s) => ({
      color: Math.max(0, Math.min(10, Math.floor(Number(s.color) || 0))),
      width: Math.max(1, Math.min(8, Number(s.width) || 3)),
      points: simplifyStrokeRDP(Array.isArray(s.points) ? s.points : []),
    }))
    .filter((s) => s.points.length > 0);

  if (simplifiedStrokes.length === 0) {
    return { valid: false, error: 'Rangoli canvas must contain at least one valid stroke.' };
  }

  const rawPalette =
    Array.isArray(input.rangoliPalette) && input.rangoliPalette.length > 0
      ? input.rangoliPalette.slice(0, 5).map((c) => sanitizeText(c, 16))
      : [accentHex, ...baseTheme.palette.slice(1)];

  // Ensure primary pigment reflects custom accentHex if customized
  const palette = [accentHex, ...rawPalette.slice(1)];

  return {
    valid: true,
    sanitized: {
      theme,
      themeCustomization: {
        accentHex,
        bgMotif,
      },
      recipientName,
      recipientLang,
      recipientTone,
      messageText,
      messageTranslation: sanitizeText(input.messageTranslation || '', 600),
      messageSource,
      rangoliSymmetry,
      rangoliPalette: palette,
      rangoliStrokes: simplifiedStrokes,
    },
  };
}

/**
 * Pre-published deterministic sample greetings so live demos work even offline.
 */
export const SAMPLE_GREETINGS: Record<string, GreetingDocument> = {
  k7Qx9mA2: {
    id: 'k7Qx9mA2',
    theme: 'midnight-indigo',
    themeCustomization: {
      accentHex: '#F4A300',
      bgMotif: 'starlight-dust',
    },
    recipient: { name: 'Anika', lang: 'bn', tone: 'family' },
    message: {
      text: 'প্রিয় Anika, মাটির প্রদীপের এই স্নিগ্ধ শিখা যেমন অমাবস্যার অন্ধকার দূর করে, তেমনি আপনার ঘর ও মন ভরে উঠুক শান্তি, আনন্দ ও মঙ্গলের আলোয়। শুভ দীপাবলি!',
      translation:
        'Dear Anika, as the gentle flame of this clay diya dispels the darkness of the new moon, may your home and heart be filled with the light of peace, joy, and wellbeing. Happy Diwali!',
      source: 'gemini',
    },
    rangoli: {
      symmetry: 8,
      palette: ['#F4A300', '#C2185B', '#3949AB', '#10B981', '#FBBF24'],
      strokes: generatePresetMandala('lotus-bloom'),
    },
    stats: { opens: 14, lit: 9 },
    createdAt: '2026-11-01T10:00:00Z',
    expiresAt: '2027-02-01T10:00:00Z',
  },
  m9Vr4pL8: {
    id: 'm9Vr4pL8',
    theme: 'royal-marigold',
    themeCustomization: {
      accentHex: '#F4A300',
      bgMotif: 'marigold-petals',
    },
    recipient: { name: 'Aarav', lang: 'hi', tone: 'literary' },
    message: {
      text: 'तमस के मौन आँगन में Aarav ने जो एक दीप धरा, तो माटी ने भी नक्षत्रों का गौरव पा लिया। ज्योति के इस महापर्व पर आपका अंतर्मन सदा उजास से भरा रहे।',
      translation:
        'When Aarav placed a single lamp in the silent courtyard of darkness, humble clay attained the grace of stars. On this grand festival of light, may your spirit remain forever radiant.',
      source: 'gemini',
    },
    rangoli: {
      symmetry: 12,
      palette: ['#F4A300', '#D81B60', '#FF7043', '#2E7D32', '#FFD54F'],
      strokes: generatePresetMandala('solar-chakra'),
    },
    stats: { opens: 22, lit: 17 },
    createdAt: '2026-11-01T10:00:00Z',
    expiresAt: '2027-02-01T10:00:00Z',
  },
  t3Kp8xN5: {
    id: 't3Kp8xN5',
    theme: 'peacock-emerald',
    themeCustomization: {
      accentHex: '#10B981',
      bgMotif: 'temple-arch',
    },
    recipient: { name: 'Sai', lang: 'mr', tone: 'friend' },
    message: {
      text: 'प्रिय Sai, दिवाळीच्या या लक्ष दिव्यांनी तुझ्या आयुष्यात नवे रंग, आनंद आणि सोनेरी यश घेऊन येवो. आपल्या मैत्रीचा हा प्रकाश असाच तेवत राहो — शुभ दिवाळी!',
      translation:
        'Dear Sai, may the countless lamps of Diwali bring vibrant joy and golden success into your life. May the light of our friendship shine on forever — Happy Diwali!',
      source: 'gemini',
    },
    rangoli: {
      symmetry: 6,
      palette: ['#10B981', '#06B6D4', '#F59E0B', '#EC4899', '#A7F3D0'],
      strokes: generatePresetMandala('royal-star'),
    },
    stats: { opens: 8, lit: 6 },
    createdAt: '2026-11-01T10:00:00Z',
    expiresAt: '2027-02-01T10:00:00Z',
  },
};
