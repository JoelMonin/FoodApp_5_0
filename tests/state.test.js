/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { state, loadState, saveState, sanitizeGlobalState, shoppingChecked } from '../src/state';
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
});
