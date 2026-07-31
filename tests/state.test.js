/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { state, loadState, saveState, sanitizeGlobalState, shoppingChecked, setState, defaultAiConfig } from '../src/state';
import { LOCAL_STORAGE_KEY, LOCAL_STORAGE_CHECKED_KEY } from '../src/constants';

describe('State Management', () => {
  let errorSpy;

  beforeEach(() => {
    // Mock localStorage : le store repond PAR CLE. Un mock qui renvoie la meme valeur
    // quelle que soit la cle faisait recevoir a `pantry_v5_checked` le JSON de
    // l'inventaire, ce qui levait un TypeError avale par le try/catch de loadState.
    const localStorageMock = (() => {
      let store = {};
      return {
        getItem: vi.fn(key => store[key] ?? null),
        setItem: vi.fn((key, value) => { store[key] = String(value); }),
        removeItem: vi.fn(key => { delete store[key]; }),
        clear: vi.fn(() => { store = {}; })
      };
    })();
    Object.defineProperty(window, 'localStorage', { value: localStorageMock, configurable: true });

    // Reset COMPLET de l'etat : `state` est un singleton de module partage entre les
    // tests, un reset partiel laissait fuir filtres, favoris et config d'un test a l'autre.
    Object.assign(state, {
      ingredients: [],
      customCartItems: [],
      favorites: [],
      extraIngredients: [],
      currentView: 'pantry',
      filter: 'all',
      search: '',
      aiSuggestions: null,
      currentSuggestionIdx: null,
      lastSync: null,
      showInStockOnly: false,
      showInCartOnly: false
    });
    shoppingChecked.clear();

    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('should sanitize ingredients correctly', () => {
    state.ingredients = [{ n: 'Pomme', inStock: 1 }]; // Old format
    sanitizeGlobalState();
    expect(state.ingredients[0].name).toBe('Pomme');
    expect(state.ingredients[0].inStock).toBe(true);
    expect(state.ingredients[0].category).toBe('Autres');
  });

  it('should load state from localStorage', () => {
    const mockData = { ingredients: [{ id: '1', name: 'Test' }] };
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(mockData));

    loadState();

    expect(state.ingredients.length).toBe(1);
    expect(state.ingredients[0].name).toBe('Test');
  });

  it('should load the shopping checklist without swallowing an error', () => {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ ingredients: [] }));
    window.localStorage.setItem(LOCAL_STORAGE_CHECKED_KEY, JSON.stringify(['ing_1', 'ing_2']));

    loadState();

    expect([...shoppingChecked]).toEqual(['ing_1', 'ing_2']);
    // Oracle : loadState ne doit lever AUCUNE erreur silencieuse sur un stockage sain.
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('should save state to localStorage', () => {
    state.ingredients = [{ id: '2', name: 'Save Test' }];
    saveState(false);

    expect(window.localStorage.setItem).toHaveBeenCalledWith(
      LOCAL_STORAGE_KEY,
      expect.stringContaining('Save Test')
    );
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // LOT 014, VOLET B — l'état est MUTÉ, jamais remplacé.
  //
  // Ce que ce bloc protège : `js/app.js` garde un alias local de l'état
  // (`const state = moduleState`, js/app.js:29) capturé UNE FOIS à l'import. Tant que
  // `src/state.js` mute son objet, cet alias reste valide pour toujours. S'il le
  // remplaçait, l'alias pointerait sur l'ancien objet et l'app travaillerait sur des
  // données périmées sans aucun signal — le défaut le plus silencieux du projet. Trois
  // rattrapages manuels compensaient cela ; ils ont été supprimés, ce bloc les remplace.
  //
  // La fiche du lot exigeait explicitement de DÉMONTRER PAR UN TEST l'équivalence stricte
  // sur `aiConfig` et sur les tableaux — c'est l'objet des trois derniers tests.
  // ═══════════════════════════════════════════════════════════════════════════════
  describe('LOT 014 §B — identité de l\'état préservée', () => {
    it('setState ne REMPLACE jamais l\'objet d\'état : un alias capturé avant reste valide', () => {
      const aliasCaptureAvant = state; // ce que fait js/app.js:29, une fois pour toutes

      setState({ search: 'brocoli' }, { scheduleSync: false });

      expect(state).toBe(aliasCaptureAvant);          // même objet, pas une copie
      expect(aliasCaptureAvant.search).toBe('brocoli'); // l'alias voit la modification
    });

    it('loadState non plus ne remplace l\'objet d\'état', () => {
      const aliasCaptureAvant = state;
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ ingredients: [{ id: '9', name: 'Chou' }] }));

      loadState();

      expect(state).toBe(aliasCaptureAvant);
      expect(aliasCaptureAvant.ingredients[0].name).toBe('Chou');
    });

    it('loadState ne remplace pas non plus le Set des coches (contrat de replaceShoppingChecked)', () => {
      const setCaptureAvant = shoppingChecked;
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({ ingredients: [] }));
      window.localStorage.setItem(LOCAL_STORAGE_CHECKED_KEY, JSON.stringify(['a', 'b']));

      loadState();

      expect(shoppingChecked).toBe(setCaptureAvant);
      expect([...setCaptureAvant]).toEqual(['a', 'b']);
    });

    // ÉQUIVALENCE EXIGÉE PAR LA FICHE, point 1 : `aiConfig` est REMPLACÉ EN ENTIER.
    // C'est le comportement du spread d'origine, et il doit survivre au changement : une
    // fusion en profondeur ferait survivre des réglages venus d'un ancien cloud par-dessus
    // ceux qu'on applique.
    it('aiConfig est REMPLACÉ en entier, jamais fusionné en profondeur', () => {
      state.aiConfig = { ...defaultAiConfig(), apiKey: 'CLE', creativity: 90, exclusions: 'ancien' };

      setState({ aiConfig: { apiKey: 'NOUVELLE' } }, { scheduleSync: false });

      expect(state.aiConfig.apiKey).toBe('NOUVELLE');
      // `creativity` et `exclusions` ne DOIVENT PAS survivre : l'objet entier a été remplacé.
      // (`models` fait exception, sanitizeGlobalState le repose systématiquement.)
      expect(state.aiConfig.creativity).toBeUndefined();
      expect(state.aiConfig.exclusions).toBeUndefined();
    });

    // ÉQUIVALENCE EXIGÉE PAR LA FICHE, point 2 : les tableaux sont REMPLACÉS, jamais
    // concaténés ni fusionnés élément par élément.
    it('les tableaux sont REMPLACÉS, jamais concaténés', () => {
      state.ingredients = [{ id: 'a', name: 'Ail' }, { id: 'b', name: 'Basilic' }];

      setState({ ingredients: [{ id: 'c', name: 'Cumin' }] }, { scheduleSync: false });

      expect(state.ingredients).toHaveLength(1);
      expect(state.ingredients[0].name).toBe('Cumin');
    });

    it('une clé ABSENTE du partial est conservée telle quelle', () => {
      state.favorites = [{ id: 'fav_1', name: 'Tarte' }];
      state.currentView = 'shopping';

      setState({ search: 'pomme' }, { scheduleSync: false });

      expect(state.favorites).toHaveLength(1);
      expect(state.currentView).toBe('shopping');
      expect(state.search).toBe('pomme');
    });
  });
});
