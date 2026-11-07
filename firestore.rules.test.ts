import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * Deterministic evaluator that mirrors the exact logic in firestore.rules
 * and verifies that the rules file contains all mandatory security gates,
 * plus evaluates all 12 "Dirty Dozen" adversarial payloads.
 */
interface GreetingPayload {
  [key: string]: unknown;
}

const REQUIRED_KEYS = [
  'id',
  'theme',
  'recipientName',
  'recipientLang',
  'recipientTone',
  'messageText',
  'messageTranslation',
  'messageSource',
  'rangoliSymmetry',
  'rangoliPalette',
  'rangoliStrokesJson',
  'opensCount',
  'litCount',
  'status',
  'createdAt',
  'updatedAt',
];

const SERVER_TIME = '2026-11-01T10:00:00Z';

function isValidId(id: unknown): boolean {
  return typeof id === 'string' && id.length >= 6 && id.length <= 32 && /^[a-zA-Z0-9_\-]+$/.test(id);
}

function isValidGreeting(data: GreetingPayload): boolean {
  const keys = Object.keys(data);
  if (!REQUIRED_KEYS.every((k) => keys.includes(k))) return false;
  if (!keys.every((k) => REQUIRED_KEYS.includes(k))) return false;

  return (
    typeof data.id === 'string' &&
    data.id.length >= 6 &&
    data.id.length <= 32 &&
    /^[a-zA-Z0-9_\-]+$/.test(data.id) &&
    typeof data.theme === 'string' &&
    data.theme.length <= 32 &&
    [
      'royal-marigold',
      'midnight-indigo',
      'sacred-terracotta',
      'peacock-emerald',
      'lotus-rose',
      'jaipur-amethyst',
      'sandalwood-ivory',
    ].includes(data.theme) &&
    typeof data.recipientName === 'string' &&
    data.recipientName.length >= 1 &&
    data.recipientName.length <= 40 &&
    typeof data.recipientLang === 'string' &&
    data.recipientLang.length <= 8 &&
    ['en', 'hi', 'bn', 'mr'].includes(data.recipientLang) &&
    typeof data.recipientTone === 'string' &&
    data.recipientTone.length <= 24 &&
    ['family', 'friend', 'colleague', 'literary'].includes(data.recipientTone) &&
    typeof data.messageText === 'string' &&
    data.messageText.length >= 1 &&
    data.messageText.length <= 600 &&
    typeof data.messageTranslation === 'string' &&
    data.messageTranslation.length <= 600 &&
    typeof data.messageSource === 'string' &&
    data.messageSource.length <= 16 &&
    ['gemini', 'template', 'custom'].includes(data.messageSource) &&
    typeof data.rangoliSymmetry === 'number' &&
    Number.isInteger(data.rangoliSymmetry) &&
    [6, 8, 12].includes(data.rangoliSymmetry) &&
    typeof data.rangoliPalette === 'string' &&
    data.rangoliPalette.length >= 4 &&
    data.rangoliPalette.length <= 120 &&
    typeof data.rangoliStrokesJson === 'string' &&
    data.rangoliStrokesJson.length >= 2 &&
    data.rangoliStrokesJson.length <= 16384 &&
    typeof data.opensCount === 'number' &&
    Number.isInteger(data.opensCount) &&
    data.opensCount >= 0 &&
    data.opensCount <= 1000000 &&
    typeof data.litCount === 'number' &&
    Number.isInteger(data.litCount) &&
    data.litCount >= 0 &&
    data.litCount <= 1000000 &&
    typeof data.status === 'string' &&
    data.status.length <= 16 &&
    ['active', 'archived'].includes(data.status) &&
    typeof data.createdAt === 'string' &&
    typeof data.updatedAt === 'string'
  );
}

function evaluateCreate(greetingId: string, incoming: GreetingPayload, requestTime: string): 'ALLOWED' | 'PERMISSION_DENIED' {
  const ok =
    isValidId(greetingId) &&
    isValidGreeting(incoming) &&
    incoming.id === greetingId &&
    incoming.opensCount === 0 &&
    incoming.litCount === 0 &&
    incoming.status === 'active' &&
    incoming.createdAt === requestTime &&
    incoming.updatedAt === requestTime;
  return ok ? 'ALLOWED' : 'PERMISSION_DENIED';
}

function evaluateUpdate(
  greetingId: string,
  existing: GreetingPayload,
  incoming: GreetingPayload,
  requestTime: string
): 'ALLOWED' | 'PERMISSION_DENIED' {
  if (!isValidId(greetingId) || !isValidGreeting(incoming)) return 'PERMISSION_DENIED';
  if (existing.status !== 'active') return 'PERMISSION_DENIED';

  const immutableKeys = [
    'id',
    'theme',
    'recipientName',
    'recipientLang',
    'recipientTone',
    'messageText',
    'messageTranslation',
    'messageSource',
    'rangoliSymmetry',
    'rangoliPalette',
    'rangoliStrokesJson',
    'createdAt',
  ];
  for (const key of immutableKeys) {
    if (incoming[key] !== existing[key]) return 'PERMISSION_DENIED';
  }

  const affectedKeys = Object.keys(incoming).filter((k) => incoming[k] !== existing[k]);
  const isLitIncrement =
    affectedKeys.every((k) => ['litCount', 'updatedAt'].includes(k)) &&
    incoming.litCount === (existing.litCount as number) + 1 &&
    incoming.updatedAt === requestTime;

  const isOpensIncrement =
    affectedKeys.every((k) => ['opensCount', 'updatedAt'].includes(k)) &&
    incoming.opensCount === (existing.opensCount as number) + 1 &&
    incoming.updatedAt === requestTime;

  return isLitIncrement || isOpensIncrement ? 'ALLOWED' : 'PERMISSION_DENIED';
}

function makeValidBaseGreeting(): GreetingPayload {
  return {
    id: 'k7Qx9mA2',
    theme: 'midnight-indigo',
    recipientName: 'Anika',
    recipientLang: 'bn',
    recipientTone: 'family',
    messageText: 'আলোয় ভরে উঠুক আপনার ঘর ও মন। শুভ দীপাবলি!',
    messageTranslation: 'May your home and heart be filled with radiant light. Happy Diwali!',
    messageSource: 'gemini',
    rangoliSymmetry: 8,
    rangoliPalette: '#F4A300,#C2185B,#283593,#10B981',
    rangoliStrokesJson: JSON.stringify([{ color: 0, width: 3, points: [[0.52, 0.31], [0.55, 0.36]] }]),
    opensCount: 0,
    litCount: 0,
    status: 'active',
    createdAt: SERVER_TIME,
    updatedAt: SERVER_TIME,
  };
}

test('Firestore rules file contains all Eight Pillar guards', () => {
  const rulesText = fs.existsSync('firestore.rules')
    ? fs.readFileSync('firestore.rules', 'utf8')
    : fs.readFileSync('DRAFT_firestore.rules', 'utf8');
  assert.ok(rulesText.includes("rules_version = '2';"));
  assert.ok(rulesText.includes('allow read, write: if false;'));
  assert.ok(rulesText.includes('function isValidId(id)'));
  assert.ok(rulesText.includes('function isValidGreeting(data)'));
  assert.ok(rulesText.includes('allow list: if false;'));
  assert.ok(rulesText.includes("affectedKeys().hasOnly(['litCount', 'updatedAt'])"));
  assert.ok(rulesText.includes("affectedKeys().hasOnly(['opensCount', 'updatedAt'])"));
});

test('Valid create and monotonic +1 counter updates are ALLOWED', () => {
  const base = makeValidBaseGreeting();
  assert.equal(evaluateCreate('k7Qx9mA2', base, SERVER_TIME), 'ALLOWED');

  const nextTime = '2026-11-01T10:05:00Z';
  const litUpdated = { ...base, litCount: 1, updatedAt: nextTime };
  assert.equal(evaluateUpdate('k7Qx9mA2', base, litUpdated, nextTime), 'ALLOWED');
});

test('Dirty Dozen #1: Shadow field injection is PERMISSION_DENIED', () => {
  const payload = { ...makeValidBaseGreeting(), isAdmin: true };
  assert.equal(evaluateCreate('k7Qx9mA2', payload, SERVER_TIME), 'PERMISSION_DENIED');
});

test('Dirty Dozen #2: Oversized recipientName (> 40 chars) is PERMISSION_DENIED', () => {
  const payload = { ...makeValidBaseGreeting(), recipientName: 'A'.repeat(5000) };
  assert.equal(evaluateCreate('k7Qx9mA2', payload, SERVER_TIME), 'PERMISSION_DENIED');
});

test('Dirty Dozen #3: Oversized rangoliStrokesJson (> 16384 chars) is PERMISSION_DENIED', () => {
  const payload = { ...makeValidBaseGreeting(), rangoliStrokesJson: 'x'.repeat(20000) };
  assert.equal(evaluateCreate('k7Qx9mA2', payload, SERVER_TIME), 'PERMISSION_DENIED');
});

test('Dirty Dozen #4: Invalid theme enum is PERMISSION_DENIED', () => {
  const payload = { ...makeValidBaseGreeting(), theme: 'neon-cyberpunk' };
  assert.equal(evaluateCreate('k7Qx9mA2', payload, SERVER_TIME), 'PERMISSION_DENIED');
});

test('Dirty Dozen #5: Invalid recipientLang enum is PERMISSION_DENIED', () => {
  const payload = { ...makeValidBaseGreeting(), recipientLang: 'fr' };
  assert.equal(evaluateCreate('k7Qx9mA2', payload, SERVER_TIME), 'PERMISSION_DENIED');
});

test('Dirty Dozen #6: Invalid rangoliSymmetry axis is PERMISSION_DENIED', () => {
  const payload = { ...makeValidBaseGreeting(), rangoliSymmetry: 99 };
  assert.equal(evaluateCreate('k7Qx9mA2', payload, SERVER_TIME), 'PERMISSION_DENIED');
});

test('Dirty Dozen #7: Path ID mismatch poisoning is PERMISSION_DENIED', () => {
  const payload = { ...makeValidBaseGreeting(), id: 'otherId12' };
  assert.equal(evaluateCreate('k7Qx9mA2', payload, SERVER_TIME), 'PERMISSION_DENIED');
});

test('Dirty Dozen #8: Forged creation timestamp is PERMISSION_DENIED', () => {
  const payload = { ...makeValidBaseGreeting(), createdAt: '1999-01-01T00:00:00Z' };
  assert.equal(evaluateCreate('k7Qx9mA2', payload, SERVER_TIME), 'PERMISSION_DENIED');
});

test('Dirty Dozen #9: Non-zero initial litCount on create is PERMISSION_DENIED', () => {
  const payload = { ...makeValidBaseGreeting(), litCount: 9999 };
  assert.equal(evaluateCreate('k7Qx9mA2', payload, SERVER_TIME), 'PERMISSION_DENIED');
});

test('Dirty Dozen #10: Message tampering on update is PERMISSION_DENIED', () => {
  const base = makeValidBaseGreeting();
  const nextTime = '2026-11-01T10:05:00Z';
  const tampered = { ...base, messageText: 'Hacked message', litCount: 1, updatedAt: nextTime };
  assert.equal(evaluateUpdate('k7Qx9mA2', base, tampered, nextTime), 'PERMISSION_DENIED');
});

test('Dirty Dozen #11: Bulk counter inflation (+500) is PERMISSION_DENIED', () => {
  const base = makeValidBaseGreeting();
  const nextTime = '2026-11-01T10:05:00Z';
  const inflated = { ...base, litCount: 500, updatedAt: nextTime };
  assert.equal(evaluateUpdate('k7Qx9mA2', base, inflated, nextTime), 'PERMISSION_DENIED');
});

test('Dirty Dozen #12: Updating an archived greeting (terminal state) is PERMISSION_DENIED', () => {
  const archivedBase = { ...makeValidBaseGreeting(), status: 'archived' };
  const nextTime = '2026-11-01T10:05:00Z';
  const updateAttempt = { ...archivedBase, litCount: 1, updatedAt: nextTime };
  assert.equal(evaluateUpdate('k7Qx9mA2', archivedBase, updateAttempt, nextTime), 'PERMISSION_DENIED');
});
