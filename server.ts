import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import {
  GreetingDocument,
  SAMPLE_GREETINGS,
  THEMES,
  LANGUAGES,
  TONES,
  BlessingLang,
  BlessingTone,
  getTemplateBlessing,
  sanitizeText,
  validateGreetingInput,
  generateShortId,
} from './src/utils/greetingSchema';
import { buildKaleidoscopeSvgPaths, calculateRangoliByteSize } from './src/utils/rangoliMath';

const PORT = 3000;
const DATA_DIR = path.resolve(process.cwd(), '.data');
const STORE_FILE = path.join(DATA_DIR, 'greetings.json');

interface ServerStore {
  greetings: Record<string, GreetingDocument>;
  manageTokens: Record<string, string>;
}

function loadStore(): ServerStore {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(STORE_FILE)) {
      const raw = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8')) as ServerStore;
      return {
        greetings: { ...SAMPLE_GREETINGS, ...(raw.greetings || {}) },
        manageTokens: {
          k7Qx9mA2: 'demo_token_anika',
          m9Vr4pL8: 'demo_token_aarav',
          t3Kp8xN5: 'demo_token_sai',
          ...(raw.manageTokens || {}),
        },
      };
    }
  } catch (err) {
    console.warn('Initializing fresh greeting store:', err);
  }
  return {
    greetings: { ...SAMPLE_GREETINGS },
    manageTokens: {
      k7Qx9mA2: 'demo_token_anika',
      m9Vr4pL8: 'demo_token_aarav',
      t3Kp8xN5: 'demo_token_sai',
    },
  };
}

function saveStore(store: ServerStore): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf8');
  } catch (err) {
    console.warn('Could not persist store to disk:', err);
  }
}

const store = loadStore();

// Simple per-IP rate limiter for AI & write routes
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(ip: string, maxRequests = 25, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxRequests) {
    return false;
  }
  entry.count += 1;
  return true;
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '64kb' }));

  // 1. Cultural AI Poetics endpoint (Server-side Gemini Flash with curated fallback)
  app.post('/api/poetics', async (req, res) => {
    const startMs = Date.now();
    const clientIp = req.ip || req.socket.remoteAddress || 'local';

    const name = sanitizeText(String(req.body?.name || 'Friend'), 40) || 'Friend';
    const lang: BlessingLang = ['en', 'hi', 'bn', 'mr'].includes(req.body?.lang)
      ? req.body.lang
      : 'en';
    const tone: BlessingTone = ['family', 'friend', 'colleague', 'literary'].includes(req.body?.tone)
      ? req.body.tone
      : 'family';

    const fallback = getTemplateBlessing(name, lang, tone);

    if (!checkRateLimit(clientIp, 20, 60_000)) {
      return res.json({
        text: fallback.text,
        translation: fallback.translation,
        source: 'template',
        note: 'Rate limit reached; using curated cultural blessing.',
        latencyMs: Date.now() - startMs,
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      return res.json({
        text: fallback.text,
        translation: fallback.translation,
        source: 'template',
        latencyMs: Date.now() - startMs,
      });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const langObj = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0];
      const toneObj = TONES.find((t) => t.id === tone) || TONES[0];

      const prompt = `Write a short, deeply evocative Diwali (Deepavali) blessing for "${name}" in ${langObj.label} (${langObj.nativeLabel}).
Relationship / Register: ${toneObj.label} (${toneObj.description}).
Rules:
1. Keep the primary blessing between 22 and 45 words.
2. Address "${name}" naturally and weave imagery of lighting an earthen clay diya, dispelling darkness, and warm festive light.
3. If the language is Classical Literary, evoke the timeless cadence of classic subcontinental literary poetry without quoting any specific copyrighted poet.
4. If the language is Hindi, Bengali, or Marathi, write "text" in authentic native script (${langObj.nativeLabel}) and provide a graceful English translation in "translation". If the language is English, leave "translation" as an empty string.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction:
            'You are a master multilingual cultural poet crafting concise, heartfelt Diwali blessings in English, Hindi, Bengali, and Marathi.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              text: {
                type: Type.STRING,
                description: 'The Diwali blessing in the requested language and script.',
              },
              translation: {
                type: Type.STRING,
                description: 'English translation if the blessing is in Hindi, Bengali, or Marathi; empty string if English.',
              },
            },
            required: ['text', 'translation'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim()) as {
        text?: string;
        translation?: string;
      };

      const cleanText = sanitizeText(parsed.text || '', 600);
      const cleanTranslation = sanitizeText(parsed.translation || '', 600);

      if (!cleanText) {
        throw new Error('Empty response from Gemini');
      }

      return res.json({
        text: cleanText,
        translation: cleanTranslation,
        source: 'gemini',
        latencyMs: Date.now() - startMs,
      });
    } catch (err) {
      // Graceful fallback to curated template as designed in the spec
      return res.json({
        text: fallback.text,
        translation: fallback.translation,
        source: 'template',
        latencyMs: Date.now() - startMs,
      });
    }
  });

  // 2. Publish or sync a Greeting
  app.post('/api/greetings', (req, res) => {
    const clientIp = req.ip || req.socket.remoteAddress || 'local';
    if (!checkRateLimit(clientIp, 30, 60_000)) {
      return res.status(429).json({ error: 'Too many greetings published recently. Please wait a moment.' });
    }

    const body = req.body || {};

    // Support both nested GreetingDocument format and flat input format
    const validation = validateGreetingInput({
      theme: body.theme,
      themeCustomization: body.themeCustomization,
      recipientName: body.recipient?.name ?? body.recipientName,
      recipientLang: body.recipient?.lang ?? body.recipientLang,
      recipientTone: body.recipient?.tone ?? body.recipientTone,
      messageText: body.message?.text ?? body.messageText,
      messageTranslation: body.message?.translation ?? body.messageTranslation,
      messageSource: body.message?.source ?? body.messageSource,
      rangoliSymmetry: body.rangoli?.symmetry ?? body.rangoliSymmetry,
      rangoliPalette: body.rangoli?.palette ?? body.rangoliPalette,
      rangoliStrokes: body.rangoli?.strokes ?? body.rangoliStrokes,
    });

    if (!validation.valid || !validation.sanitized) {
      return res.status(400).json({ error: validation.error || 'Invalid greeting data.' });
    }

    const s = validation.sanitized;
    const requestedId =
      typeof body.id === 'string' && /^[a-zA-Z0-9_\-]{6,32}$/.test(body.id)
        ? body.id
        : generateShortId(8);

    const nowIso = new Date().toISOString();
    const expiresIso = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

    const greeting: GreetingDocument = {
      id: requestedId,
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

    const manageToken = crypto.randomBytes(12).toString('hex');
    store.greetings[greeting.id] = greeting;
    store.manageTokens[greeting.id] = manageToken;
    saveStore(store);

    const byteSize = calculateRangoliByteSize(
      greeting.rangoli.strokes,
      greeting.rangoli.symmetry,
      greeting.rangoli.palette
    );

    return res.status(201).json({
      id: greeting.id,
      greeting,
      manageToken,
      rangoliBytes: byteSize,
    });
  });

  // 3. Read a Greeting by ID
  app.get('/api/greetings/:id', (req, res) => {
    const id = String(req.params.id || '').trim();
    const greeting = store.greetings[id] || SAMPLE_GREETINGS[id];
    if (!greeting) {
      return res.status(404).json({ error: 'Greeting not found' });
    }
    return res.json(greeting);
  });

  // 4. Increment Reaction / Open counter
  app.post('/api/greetings/:id/react', (req, res) => {
    const id = String(req.params.id || '').trim();
    const greeting = store.greetings[id] || (SAMPLE_GREETINGS[id] ? structuredClone(SAMPLE_GREETINGS[id]) : null);
    if (!greeting) {
      return res.status(404).json({ error: 'Greeting not found' });
    }

    const type = req.body?.type === 'opens' ? 'opens' : 'lit';
    if (type === 'opens') {
      greeting.stats.opens += 1;
    } else {
      greeting.stats.lit += 1;
    }
    store.greetings[id] = greeting;
    saveStore(store);

    return res.json({ id, stats: greeting.stats });
  });

  // 5. Dynamic OpenGraph Preview Card (1200x630 SVG ImageResponse for WhatsApp / Social Cards)
  app.get('/api/og/:id', (req, res) => {
    const id = String(req.params.id || '').trim();
    const greeting = store.greetings[id] || SAMPLE_GREETINGS[id] || SAMPLE_GREETINGS.k7Qx9mA2;
    const theme = THEMES[greeting.theme] || THEMES['midnight-indigo'];
    const effectiveAccentHex = escapeXml(
      greeting.themeCustomization?.accentHex || greeting.rangoli.palette?.[0] || theme.accentHex
    );
    const mandalaPaths = buildKaleidoscopeSvgPaths(
      greeting.rangoli.symmetry ? greeting.rangoli.strokes : SAMPLE_GREETINGS.k7Qx9mA2.rangoli.strokes,
      greeting.rangoli.symmetry || 8,
      greeting.rangoli.palette || theme.palette,
      380
    );

    const recipientName = escapeXml(greeting.recipient.name);
    const rawText = greeting.message.text.trim();
    const words = rawText.split(/\s+/);
    let line1 = '';
    let line2 = '';
    for (const w of words) {
      if ((line1 + ' ' + w).trim().length <= 44) {
        line1 = (line1 + ' ' + w).trim();
      } else if ((line2 + ' ' + w).trim().length <= 44) {
        line2 = (line2 + ' ' + w).trim();
      } else {
        line2 = line2 + '…';
        break;
      }
    }
    const safeLine1 = escapeXml(line1);
    const safeLine2 = escapeXml(line2);
    const themeLabel = escapeXml(theme.name);
    const litCount = greeting.stats.lit;

    const svgPathsMarkup = mandalaPaths
      .map(
        (p) =>
          `<path d="${p.d}" fill="none" stroke="${escapeXml(p.color)}" stroke-width="${p.width * 1.15}" stroke-linecap="round" stroke-linejoin="round" opacity="0.92" />`
      )
      .join('\n');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <radialGradient id="bgGlow" cx="72%" cy="50%" r="55%">
      <stop offset="0%" stop-color="${effectiveAccentHex}" stop-opacity="0.28" />
      <stop offset="55%" stop-color="${theme.bgLit}" stop-opacity="0.95" />
      <stop offset="100%" stop-color="${theme.bgDark}" stop-opacity="1" />
    </radialGradient>
    <radialGradient id="diyaHalo" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FFE082" stop-opacity="0.9" />
      <stop offset="50%" stop-color="${effectiveAccentHex}" stop-opacity="0.35" />
      <stop offset="100%" stop-color="${effectiveAccentHex}" stop-opacity="0" />
    </radialGradient>
  </defs>

  <rect width="1200" height="630" fill="url(#bgGlow)" />
  <rect x="28" y="28" width="1144" height="574" rx="24" fill="none" stroke="${effectiveAccentHex}" stroke-opacity="0.28" stroke-width="1.5" />

  <!-- Left Column: Personalized Invitation (strictly bounded to x <= 630) -->
  <g transform="translate(76, 95)">
    <text x="0" y="0" fill="${effectiveAccentHex}" font-family="Georgia, serif" font-size="19" letter-spacing="3">DIYAVERSE · INTERACTIVE DIWALI RITUAL</text>
    <text x="0" y="72" fill="#F8F3EB" font-family="Georgia, serif" font-weight="bold" font-size="60">A Light for ${recipientName}</text>
    <text x="0" y="132" fill="#D6CEC2" font-family="sans-serif" font-size="22">“${safeLine1}${safeLine2 ? '' : '”'}</text>
    ${safeLine2 ? `<text x="0" y="166" fill="#D6CEC2" font-family="sans-serif" font-size="22">${safeLine2}”</text>` : ''}

    <!-- Diya Flame Emblem + CTA -->
    <g transform="translate(0, 225)">
      <rect x="0" y="0" width="548" height="72" rx="14" fill="${theme.surfaceCard}" stroke="${effectiveAccentHex}" stroke-opacity="0.5" stroke-width="1.5" />
      <circle cx="42" cy="36" r="18" fill="url(#diyaHalo)" />
      <path d="M42 20 C48 30, 50 38, 42 46 C34 38, 36 30, 42 20 Z" fill="#FFD54F" />
      <text x="74" y="43" fill="#F8F3EB" font-family="sans-serif" font-weight="bold" font-size="21">Open in the dark &amp; strike the spark to light</text>
    </g>

    <text x="0" y="365" fill="#9E9488" font-family="monospace" font-size="18">${themeLabel} · ${greeting.rangoli.symmetry}-Axis Mandala · ${litCount} Diyas Lit</text>
  </g>

  <!-- Right Column: Actual Mirrored Mandala Rangoli -->
  <g transform="translate(680, 125)">
    <circle cx="190" cy="190" r="195" fill="${theme.bgDark}" fill-opacity="0.7" stroke="${theme.accentHex}" stroke-opacity="0.35" stroke-width="1.5" />
    <circle cx="190" cy="190" r="140" fill="none" stroke="${theme.accentHex}" stroke-opacity="0.14" stroke-dasharray="4 6" />
    ${svgPathsMarkup}
    <circle cx="190" cy="190" r="24" fill="url(#diyaHalo)" />
    <circle cx="190" cy="190" r="7" fill="#FFF8E1" />
  </g>
</svg>`;

    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.send(svg);
  });

  // Vite middleware for SPA + dynamic OG meta tag injection on ?g=<id>
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      try {
        const url = req.originalUrl;
        let template = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);

        // If URL has ?g=<id>, inject per-greeting OpenGraph tags for WhatsApp/social crawlers
        const parsedUrl = new URL(url, `http://${req.headers.host || 'localhost:3000'}`);
        const gId = parsedUrl.searchParams.get('g');
        if (gId && (store.greetings[gId] || SAMPLE_GREETINGS[gId])) {
          const g = store.greetings[gId] || SAMPLE_GREETINGS[gId];
          const baseUrl = process.env.APP_URL && process.env.APP_URL !== 'MY_APP_URL'
            ? process.env.APP_URL.replace(/\/$/, '')
            : `${req.protocol}://${req.headers.host || 'localhost:3000'}`;
          const ogTitle = escapeXml(`A Diwali Diya for ${g.recipient.name} – DiyaVerse`);
          const ogDesc = escapeXml(
            `Open in warm darkness and strike a spark to light ${g.recipient.name}'s clay diya, reveal a custom ${g.rangoli.symmetry}-axis mandala rangoli, and launch constellation fireworks.`
          );
          const ogImage = `${baseUrl}/api/og/${encodeURIComponent(g.id)}?v=${g.stats.lit}`;

          template = template
            .replace(/<title>.*?<\/title>/, `<title>${ogTitle}</title>`)
            .replace(
              /<meta property="og:title" content=".*?" \/>/,
              `<meta property="og:title" content="${ogTitle}" />\n    <meta property="og:image" content="${ogImage}" />`
            )
            .replace(
              /<meta property="og:description" content=".*?" \/>/,
              `<meta property="og:description" content="${ogDesc}" />`
            );
        }

        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        next(e);
      }
    });
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath, { index: false }));
    app.get('*', (req, res) => {
      let html = fs.readFileSync(path.join(distPath, 'index.html'), 'utf-8');
      const parsedUrl = new URL(req.originalUrl, `http://${req.headers.host || 'localhost:3000'}`);
      const gId = parsedUrl.searchParams.get('g');
      if (gId && (store.greetings[gId] || SAMPLE_GREETINGS[gId])) {
        const g = store.greetings[gId] || SAMPLE_GREETINGS[gId];
        const baseUrl = process.env.APP_URL && process.env.APP_URL !== 'MY_APP_URL'
          ? process.env.APP_URL.replace(/\/$/, '')
          : `${req.protocol}://${req.headers.host || 'localhost:3000'}`;
        const ogTitle = escapeXml(`A Diwali Diya for ${g.recipient.name} – DiyaVerse`);
        const ogDesc = escapeXml(
          `Open in warm darkness and strike a spark to light ${g.recipient.name}'s clay diya, reveal a custom ${g.rangoli.symmetry}-axis mandala rangoli, and launch constellation fireworks.`
        );
        const ogImage = `${baseUrl}/api/og/${encodeURIComponent(g.id)}?v=${g.stats.lit}`;
        html = html
          .replace(/<title>.*?<\/title>/, `<title>${ogTitle}</title>`)
          .replace(
            /<meta property="og:title" content=".*?" \/>/,
            `<meta property="og:title" content="${ogTitle}" />\n    <meta property="og:image" content="${ogImage}" />`
          )
          .replace(
            /<meta property="og:description" content=".*?" \/>/,
            `<meta property="og:description" content="${ogDesc}" />`
          );
      }
      res.status(200).set({ 'Content-Type': 'text/html' }).send(html);
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`DiyaVerse server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
