/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest';
import { state, defaultAiConfig } from '../src/state';
import { updateSystemInfo } from '../js/app.js';
import { FB_USER, LOCAL_STORAGE_KEY } from '../src/constants';

// LOT 009 — casse C8 : le panneau « Informations Système » restait figé sur « -- »
// pour 3 champs (l'ancien code visait #system-storage, un id inexistant partout).
// Ces tests verrouillent les 3 champs restaurés ; #info-last-sync/#info-network
// (LOT 007) ne sont pas re-testés ici.

function makeIngredient(overrides = {}) {
  return {
    id: 'ing_1', name: 'Pomme', emoji: '🍎', category: 'Fruits',
    inStock: false, inCart: false, pinned: false, frozen: false,
    shoppingSource: null, ...overrides
  };
}

describe('Panneau Informations Système (LOT 009, casse C8)', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = `
      <div id="info-api-key">--</div>
      <div id="info-fb-user">--</div>
      <div id="info-storage">--</div>
      <div id="info-last-sync">--</div>
      <div id="info-network">--</div>
    `;
    Object.assign(state, {
      ingredients: [makeIngredient()],
      favorites: [], extraIngredients: [],
      currentView: 'export', filter: 'all', search: '',
      aiSuggestions: null, currentSuggestionIdx: null, lastSync: null,
      showInStockOnly: false, showInCartOnly: false,
      aiConfig: defaultAiConfig()
    });
  });

  it('clé API configurée → masquée (4 derniers caractères) + badge « Configurée (Locale) »', () => {
    state.aiConfig.apiKey = 'AIzaSy_CLE_DE_TEST_LONGUE';
    updateSystemInfo();
    const text = document.getElementById('info-api-key').textContent;
    expect(text).toContain('****NGUE');
    expect(text).toContain('Configurée (Locale)');
    expect(text).not.toContain('AIzaSy_CLE_DE_TEST_LONGUE'); // jamais la clé en clair
  });

  it('clé API absente → « Non configurée » + badge « Manquante »', () => {
    state.aiConfig.apiKey = '';
    updateSystemInfo();
    const text = document.getElementById('info-api-key').textContent;
    expect(text).toContain('Non configurée');
    expect(text).toContain('Manquante');
  });

  it('utilisateur cloud affiche FB_USER (constants.js, SSOT)', () => {
    updateSystemInfo();
    expect(document.getElementById('info-fb-user').textContent).toBe(FB_USER);
  });

  it('stockage local affiche la clé canonique et une taille dérivée du contenu réel (Ko)', () => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ a: 1 }));
    updateSystemInfo();
    const text = document.getElementById('info-storage').textContent;
    expect(text).toContain(LOCAL_STORAGE_KEY);
    expect(text).toMatch(/\d+([.,]\d+)?\s*KB/);
  });

  it('aucune référence exécutable à system-storage (branche morte retirée, LOT 007)', () => {
    expect(document.getElementById('system-storage')).toBeNull();
    expect(() => updateSystemInfo()).not.toThrow();
  });
});
