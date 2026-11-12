import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveTheme } from '../src/theme.js';
import { mergeSettings } from '../src/core/store/settings.js';

test('thème : clair et sombre sont forcés, auto suit l\'appareil', () => {
  assert.equal(resolveTheme('light', true), 'light');
  assert.equal(resolveTheme('dark', false), 'dark');
  assert.equal(resolveTheme('auto', true), 'dark');
  assert.equal(resolveTheme('auto', false), 'light');
});

test('réglages : thème invalide ramené à auto, nom affiché conservé', () => {
  assert.equal(mergeSettings({ theme: 'rose' }).theme, 'auto');
  assert.equal(mergeSettings({ theme: 'light' }).theme, 'light');
  assert.equal(mergeSettings({ displayName: 'Marwan' }).displayName, 'Marwan');
  assert.equal(mergeSettings(null).displayName, '');
});
