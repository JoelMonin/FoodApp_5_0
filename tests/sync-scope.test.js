/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildSyncDocument, extractSyncedState } from '../src/services/firebase';
import {
  state,
  shoppingChecked,
  replaceShoppingChecked,
  applyExternalState,
  defaultAiConfig
} from '../src/state';

// LOT 007 — périmètre du document synchronisé (spec §4.1) et application clé par
// clé (§4.3). Ces tests verrouillent CE QUI part au cloud et CE QUI en revient :
// toute clé qui entre ou sort du périmètre doit faire échouer une assertion ici.

function fullTestState(overrides = {}) {
  return {
    ingredients: [{ id: 'ing_1', name: 'Pomme', emoji: '🍎', category: 'Fruits', inStock: true }],
    customCartItems: [{ id: 'cci_1', name: 'Pain' }],
    favorites: [{ id: 'fav_1', name: 'Tarte' }],
    extraIngredients: [{ name: 'Safran' }],
    aiConfig: {
      apiKey: 'CLE_SECRETE',
      models: { recipeGeneration: 'un-modele' },
      diet: ['vegetarien'], exceptions: '', cuisines: [], equip: [],
      meal: 'indifferent', time: 'libre', diff: 'indifferent', ppl: '2',
      creativity: 30, exclusions: ''
    },
    currentView: 'shopping',
    filter: 'Fruits',
    search: 'pom',
    aiSuggestions: [{ name: 'Recette volatile' }],
    currentSuggestionIdx: 2,
    lastSync: '2026-07-28T10:00:00.000Z',
    showInStockOnly: true,
    showInCartOnly: true,
    ...overrides
  };
}

describe('buildSyncDocument — ce qui part au cloud (§4.1)', () => {
  it('ne contient JAMAIS la clé API (invariant §4.6)', () => {
    const doc = buildSyncDocument(fullTestState(), []);
    expect(JSON.stringify(doc)).not.toContain('CLE_SECRETE');
    expect(doc.aiConfig).not.toHaveProperty('apiKey');
  });

  it('ne contient ni les champs d\'affichage, ni aiSuggestions, ni lastSync (F6, §4.1)', () => {
    const doc = buildSyncDocument(fullTestState(), []);
    for (const forbidden of ['currentView', 'filter', 'search', 'showInStockOnly',
      'showInCartOnly', 'currentSuggestionIdx', 'aiSuggestions', 'lastSync']) {
      expect(doc).not.toHaveProperty(forbidden);
    }
  });

  it('ne contient pas aiConfig.models (SSOT AI_ROLES — correction Codex)', () => {
    const doc = buildSyncDocument(fullTestState(), []);
    expect(doc.aiConfig).not.toHaveProperty('models');
  });

  it('contient shoppingChecked sous forme de tableau d\'identifiants', () => {
    const doc = buildSyncDocument(fullTestState(), ['ing_1', 'cci_1']);
    expect(doc.shoppingChecked).toEqual(['ing_1', 'cci_1']);
  });

  it('contient les quatre tableaux de données et les réglages IA', () => {
    const doc = buildSyncDocument(fullTestState(), []);
    expect(doc.ingredients).toHaveLength(1);
    expect(doc.customCartItems).toHaveLength(1);
    expect(doc.favorites).toHaveLength(1);
    expect(doc.extraIngredients).toHaveLength(1);
    expect(doc.aiConfig.diet).toEqual(['vegetarien']);
    expect(doc.aiConfig.creativity).toBe(30);
  });

  it('est une copie profonde : modifier le document ne touche pas l\'état', () => {
    const source = fullTestState();
    const doc = buildSyncDocument(source, []);
    doc.ingredients[0].name = 'Corrompu';
    expect(source.ingredients[0].name).toBe('Pomme');
  });
});

describe('extractSyncedState — ce qui revient du cloud (§4.3)', () => {
  it('un champ absent devient la valeur PAR DÉFAUT, jamais la valeur locale (constat Codex)', () => {
    // Un cloud sans favorites → favoris REMPLACÉS par vide : setState fusionne,
    // donc sans cette construction explicite la valeur locale survivrait.
    const { patch } = extractSyncedState({ ingredients: [] });
    expect(patch.favorites).toEqual([]);
    expect(patch.extraIngredients).toEqual([]);
    expect(patch.customCartItems).toEqual([]);
  });

  it('document sans shoppingChecked (ancien client) → « aucune coche », jamais une erreur', () => {
    const { checkedIds } = extractSyncedState({ ingredients: [] });
    expect(checkedIds).toEqual([]);
  });

  it('n\'applique JAMAIS les champs d\'affichage ni une clé inconnue du périmètre (§4.6)', () => {
    const { patch } = extractSyncedState({
      ingredients: [],
      currentView: 'export',
      search: 'fantome',
      cleInconnue: 'jamais appliquée'
    });
    expect(patch).not.toHaveProperty('currentView');
    expect(patch).not.toHaveProperty('search');
    expect(patch).not.toHaveProperty('cleInconnue');
  });

  it('la clé API du cloud est écartée, les sous-champs IA absents retombent sur les défauts', () => {
    const { patch } = extractSyncedState({
      ingredients: [],
      aiConfig: { apiKey: 'CLE_DU_CLOUD', diet: ['vegan'] }
    });
    expect(patch.aiConfig.apiKey).toBe(''); // remplacée ensuite par la clé LOCALE
    expect(patch.aiConfig.diet).toEqual(['vegan']);
    expect(patch.aiConfig.creativity).toBe(defaultAiConfig().creativity);
  });
});

describe('replaceShoppingChecked + applyExternalState — application locale', () => {
  beforeEach(() => {
    const store = {};
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: vi.fn(k => store[k] ?? null),
        setItem: vi.fn((k, v) => { store[k] = String(v); }),
        removeItem: vi.fn(k => { delete store[k]; }),
        clear: vi.fn(() => { for (const k of Object.keys(store)) delete store[k]; })
      }
    });
    shoppingChecked.clear();
  });

  it('reconstruit le Set en place (export ESM non réassignable — piège Codex)', () => {
    const refBefore = shoppingChecked;
    shoppingChecked.add('vieux_id');

    replaceShoppingChecked(['a', 'b']);

    expect(shoppingChecked).toBe(refBefore); // même objet, muté en place
    expect(shoppingChecked.has('vieux_id')).toBe(false);
    expect([...shoppingChecked]).toEqual(['a', 'b']);
  });

  it('un document reçu avec une clé API non vide ne remplace pas la clé locale (F8)', () => {
    state.aiConfig = { ...defaultAiConfig(), apiKey: 'cle-locale' };

    const { patch } = extractSyncedState({
      ingredients: [{ id: 'i1', name: 'X' }],
      aiConfig: { apiKey: 'cle-etrangere' }
    });
    applyExternalState(patch, { scheduleSync: false });

    expect(state.aiConfig.apiKey).toBe('cle-locale');
  });

  it('un document reçu ne modifie ni la vue ni les filtres locaux (F6)', () => {
    state.currentView = 'shopping';
    state.filter = 'Fruits';
    state.search = 'pom';
    state.showInStockOnly = true;

    const { patch } = extractSyncedState({
      ingredients: [{ id: 'i1', name: 'X' }],
      currentView: 'export',
      filter: 'all',
      search: ''
    });
    applyExternalState(patch, { scheduleSync: false });

    expect(state.currentView).toBe('shopping');
    expect(state.filter).toBe('Fruits');
    expect(state.search).toBe('pom');
    expect(state.showInStockOnly).toBe(true);
  });

  it('applyExternalState({scheduleSync:false}) ne déclenche PAS le planificateur inscrit (§4.5)', async () => {
    // Le planificateur est global au module state : on l'inscrit, on vérifie,
    // puis on le désinscrit pour ne pas polluer les autres tests.
    const { registerSyncScheduler } = await import('../src/state');
    const scheduler = vi.fn();
    registerSyncScheduler(scheduler);
    try {
      applyExternalState({ ingredients: [{ id: 'i1', name: 'X' }] }, { scheduleSync: false });
      expect(scheduler).not.toHaveBeenCalled();

      applyExternalState({ ingredients: [{ id: 'i2', name: 'Y' }] }); // restauration fichier : planifie
      expect(scheduler).toHaveBeenCalledTimes(1);
    } finally {
      registerSyncScheduler(null);
    }
  });
});
