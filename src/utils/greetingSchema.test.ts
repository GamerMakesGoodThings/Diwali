import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeText,
  getTemplateBlessing,
  validateGreetingInput,
  SAMPLE_GREETINGS,
} from './greetingSchema';
import { generatePresetMandala } from './rangoliMath';

test('sanitizeText strips HTML brackets and enforces maxLength', () => {
  assert.equal(sanitizeText('  <script>Anika</script>  ', 40), 'scriptAnika/script');
  assert.equal(sanitizeText('A'.repeat(100), 40).length, 40);
});

test('getTemplateBlessing injects recipient name in Bengali, Hindi, Marathi, and English', () => {
  const bn = getTemplateBlessing('Anika', 'bn', 'family');
  assert.ok(bn.text.includes('Anika'));
  assert.ok(bn.text.includes('শুভ দীপাবলি'));
  assert.ok(bn.translation.includes('Anika'));

  const hi = getTemplateBlessing('Aarav', 'hi', 'literary');
  assert.ok(hi.text.includes('Aarav'));
  assert.ok(hi.translation.includes('Aarav'));
});

test('validateGreetingInput rejects empty name or empty message and accepts valid input', () => {
  const missingName = validateGreetingInput({
    recipientName: '   ',
    messageText: 'Happy Diwali!',
    rangoliStrokes: generatePresetMandala('lotus-bloom'),
  });
  assert.equal(missingName.valid, false);

  const missingStrokes = validateGreetingInput({
    recipientName: 'Anika',
    messageText: 'Happy Diwali!',
    rangoliStrokes: [],
  });
  assert.equal(missingStrokes.valid, false);

  const valid = validateGreetingInput({
    theme: 'midnight-indigo',
    recipientName: 'Anika',
    recipientLang: 'bn',
    recipientTone: 'family',
    messageText: 'শুভ দীপাবলি!',
    rangoliSymmetry: 8,
    rangoliStrokes: generatePresetMandala('lotus-bloom'),
  });
  assert.equal(valid.valid, true);
  assert.equal(valid.sanitized?.recipientName, 'Anika');
  assert.equal(valid.sanitized?.rangoliSymmetry, 8);
});

test('SAMPLE_GREETINGS contains the canonical k7Qx9mA2 greeting for Anika', () => {
  const sample = SAMPLE_GREETINGS.k7Qx9mA2;
  assert.ok(sample);
  assert.equal(sample.recipient.name, 'Anika');
  assert.equal(sample.recipient.lang, 'bn');
  assert.equal(sample.rangoli.symmetry, 8);
});

test('validateGreetingInput supports new themes and custom accent/background motif settings', () => {
  const res = validateGreetingInput({
    theme: 'jaipur-amethyst',
    themeCustomization: {
      accentHex: '#e11d48',
      bgMotif: 'temple-arch',
    },
    recipientName: 'Meera',
    recipientLang: 'hi',
    recipientTone: 'friend',
    messageText: 'शुभ दीपावली!',
    rangoliSymmetry: 12,
    rangoliStrokes: generatePresetMandala('solar-chakra'),
  });
  assert.equal(res.valid, true);
  assert.equal(res.sanitized?.theme, 'jaipur-amethyst');
  assert.equal(res.sanitized?.themeCustomization.accentHex, '#E11D48');
  assert.equal(res.sanitized?.themeCustomization.bgMotif, 'temple-arch');
  assert.equal(res.sanitized?.rangoliPalette[0], '#E11D48');
});
