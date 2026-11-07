import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import {
  GreetingDocument,
  SAMPLE_GREETINGS,
  THEMES,
  VALID_BG_MOTIFS,
  ThemeId,
  BackgroundMotifId,
  BlessingLang,
  BlessingTone,
  MessageSource,
} from './utils/greetingSchema';
import { SymmetryAxis, RangoliStroke } from './utils/rangoliMath';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid ?? null,
      email: auth.currentUser?.email ?? null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId ?? null,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate connection on boot as required by firebase-integration-rpc skill
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

function recordToGreetingDocument(id: string, data: Record<string, unknown>): GreetingDocument {
  let parsedStrokes: RangoliStroke[] = [];
  try {
    parsedStrokes = JSON.parse(String(data.rangoliStrokesJson || '[]'));
  } catch {
    parsedStrokes = [];
  }

  const themeId = ((data.theme as ThemeId) && THEMES[data.theme as ThemeId]
    ? (data.theme as ThemeId)
    : 'midnight-indigo');
  const baseTheme = THEMES[themeId];

  const paletteStr = String(data.rangoliPalette || baseTheme.palette.join(','));
  const rawTokens = paletteStr.split(',').map((s) => s.trim()).filter(Boolean);
  let decodedMotif: BackgroundMotifId = baseTheme.defaultMotif;
  const palette: string[] = [];

  for (const token of rawTokens) {
    if (token.startsWith('motif:')) {
      const m = token.slice(6) as BackgroundMotifId;
      if (VALID_BG_MOTIFS.includes(m)) {
        decodedMotif = m;
      }
    } else {
      palette.push(token);
    }
  }

  const finalPalette = palette.length > 0 ? palette : baseTheme.palette;
  const accentHex = finalPalette[0] || baseTheme.accentHex;

  const createdAtTs = data.createdAt as Timestamp | string | undefined;
  let createdAtIso = new Date().toISOString();
  if (createdAtTs && typeof (createdAtTs as Timestamp).toDate === 'function') {
    createdAtIso = (createdAtTs as Timestamp).toDate().toISOString();
  } else if (typeof createdAtTs === 'string') {
    createdAtIso = createdAtTs;
  }

  const expiresDate = new Date(new Date(createdAtIso).getTime() + 90 * 24 * 60 * 60 * 1000);

  return {
    id,
    theme: themeId,
    themeCustomization: {
      accentHex,
      bgMotif: decodedMotif,
    },
    recipient: {
      name: String(data.recipientName || 'Friend'),
      lang: (data.recipientLang as BlessingLang) || 'en',
      tone: (data.recipientTone as BlessingTone) || 'family',
    },
    message: {
      text: String(data.messageText || ''),
      translation: data.messageTranslation ? String(data.messageTranslation) : '',
      source: (data.messageSource as MessageSource) || 'template',
    },
    rangoli: {
      symmetry: ([6, 8, 12].includes(Number(data.rangoliSymmetry))
        ? Number(data.rangoliSymmetry)
        : 8) as SymmetryAxis,
      palette: finalPalette,
      strokes: parsedStrokes,
    },
    stats: {
      opens: Number(data.opensCount || 0),
      lit: Number(data.litCount || 0),
    },
    createdAt: createdAtIso,
    expiresAt: expiresDate.toISOString(),
  };
}

/**
 * Publishes a validated greeting to Firestore and mirrors it to the server for OpenGraph cards.
 */
export async function publishGreetingRecord(greeting: GreetingDocument): Promise<{
  greeting: GreetingDocument;
  manageToken: string;
}> {
  const path = `greetings/${greeting.id}`;
  const strokesJson = JSON.stringify(greeting.rangoli.strokes).slice(0, 16384);
  const motifToken = greeting.themeCustomization?.bgMotif
    ? `,motif:${greeting.themeCustomization.bgMotif}`
    : '';
  const paletteCsv = `${greeting.rangoli.palette.slice(0, 5).join(',')}${motifToken}`.slice(0, 120);

  try {
    await setDoc(doc(db, 'greetings', greeting.id), {
      id: greeting.id,
      theme: greeting.theme,
      recipientName: greeting.recipient.name.slice(0, 40),
      recipientLang: greeting.recipient.lang,
      recipientTone: greeting.recipient.tone,
      messageText: greeting.message.text.slice(0, 600),
      messageTranslation: (greeting.message.translation || '').slice(0, 600),
      messageSource: greeting.message.source,
      rangoliSymmetry: greeting.rangoli.symmetry,
      rangoliPalette: paletteCsv,
      rangoliStrokesJson: strokesJson,
      opensCount: 0,
      litCount: 0,
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }

  // Also register on backend for OpenGraph card & manage token
  let manageToken = `mgr_${greeting.id}_local`;
  try {
    const res = await fetch('/api/greetings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(greeting),
    });
    if (res.ok) {
      const payload = await res.json();
      if (payload.manageToken) {
        manageToken = payload.manageToken;
      }
    }
  } catch {
    // Non-fatal if offline; Firestore holds primary record
  }

  return { greeting, manageToken };
}

/**
 * Fetches a greeting by short ID from Firestore (or fallback sample/server store).
 */
export async function fetchGreetingById(id: string): Promise<GreetingDocument | null> {
  const cleanId = id.trim();
  const path = `greetings/${cleanId}`;

  try {
    const snap = await getDoc(doc(db, 'greetings', cleanId));
    if (snap.exists()) {
      return recordToGreetingDocument(cleanId, snap.data() as Record<string, unknown>);
    }
  } catch (error) {
    if (SAMPLE_GREETINGS[cleanId]) {
      return SAMPLE_GREETINGS[cleanId];
    }
    handleFirestoreError(error, OperationType.GET, path);
  }

  // Fallback to server cache or sample greetings
  try {
    const res = await fetch(`/api/greetings/${encodeURIComponent(cleanId)}`);
    if (res.ok) {
      return (await res.json()) as GreetingDocument;
    }
  } catch {
    // ignore
  }

  return SAMPLE_GREETINGS[cleanId] || null;
}

/**
 * Monotonically increments either `opensCount` or `litCount` by +1 in Firestore.
 */
export async function incrementGreetingStat(
  id: string,
  field: 'opens' | 'lit'
): Promise<number | null> {
  const cleanId = id.trim();
  const path = `greetings/${cleanId}`;

  try {
    const ref = doc(db, 'greetings', cleanId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      const currentOpens = Number(data.opensCount || 0);
      const currentLit = Number(data.litCount || 0);
      const nextVal = field === 'lit' ? currentLit + 1 : currentOpens + 1;

      await updateDoc(
        ref,
        field === 'lit'
          ? { litCount: nextVal, updatedAt: serverTimestamp() }
          : { opensCount: nextVal, updatedAt: serverTimestamp() }
      );

      // Also notify server cache for OG card accuracy
      fetch(`/api/greetings/${encodeURIComponent(cleanId)}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: field }),
      }).catch(() => {});

      return nextVal;
    }
  } catch (error) {
    // If it's a pre-published sample greeting not yet seeded in Firestore, seed it first or update server
    if (SAMPLE_GREETINGS[cleanId]) {
      try {
        const res = await fetch(`/api/greetings/${encodeURIComponent(cleanId)}/react`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: field }),
        });
        if (res.ok) {
          const json = await res.json();
          return field === 'lit' ? json.stats?.lit : json.stats?.opens;
        }
      } catch {
        return null;
      }
    }
    handleFirestoreError(error, OperationType.UPDATE, path);
  }

  // Also update server for sample greetings
  try {
    const res = await fetch(`/api/greetings/${encodeURIComponent(cleanId)}/react`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: field }),
    });
    if (res.ok) {
      const json = await res.json();
      return field === 'lit' ? json.stats?.lit : json.stats?.opens;
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Real-time listener on a greeting document for the Sender Manage dashboard.
 */
export function subscribeToGreeting(
  id: string,
  onUpdate: (doc: GreetingDocument) => void
): () => void {
  const cleanId = id.trim();
  const path = `greetings/${cleanId}`;
  const ref = doc(db, 'greetings', cleanId);

  const unsubscribe = onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        onUpdate(recordToGreetingDocument(cleanId, snap.data() as Record<string, unknown>));
      } else if (SAMPLE_GREETINGS[cleanId]) {
        onUpdate(SAMPLE_GREETINGS[cleanId]);
      }
    },
    (error) => {
      if (SAMPLE_GREETINGS[cleanId]) {
        onUpdate(SAMPLE_GREETINGS[cleanId]);
        return;
      }
      handleFirestoreError(error, OperationType.GET, path);
    }
  );

  return unsubscribe;
}
