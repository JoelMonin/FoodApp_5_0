/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  importStockOnly,
  exportJSON,
  resetCart,
  resetAllData,
  toggleCart,
  deleteIngredient
} from '../src/actions';
import { state, shoppingChecked, sanitizeGlobalState, applyExternalState } from '../src/state';
import { FB_URL } from '../src/constants';
import { DEFAULT_DB } from '../src/data';

function makeIngredient(overrides = {}) {
  return {
    id: 'ing_1',
    name: 'Pomme',
    emoji: '🍎',
    category: 'Fruits',
    inStock: false,
    inCart: false,
    pinned: false,
    frozen: false,
    shoppingSource: null,
    ...overrides
  };
}

function defaultTestAiConfig(overrides = {}) {
  return {
    apiKey: '',
    models: {},
    diet: [], exceptions: '', cuisines: [], equip: [],
    meal: 'indifferent', time: 'libre', diff: 'indifferent', ppl: '2',
    creativity: 50, exclusions: '',
    ...overrides
  };
}

// LOT 008 — Données en sécurité : ferme les 4 chemins par lesquels l'app pouvait
// détruire ou divulguer des données (import, export, reset, incohérences d'état).
describe('Actions — LOT 008 Données en sécurité', () => {
  let errorSpy;
  let confirmSpy;
  let reloadSpy;
  let capturedBlobParts;

  beforeEach(() => {
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

    // Reset complet de l'état : singleton de module partagé entre les tests
    // (même précaution que tests/state.test.js).
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
      showInCartOnly: false,
      aiConfig: defaultTestAiConfig()
    });
    shoppingChecked.clear();

    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    // jsdom refuse de redéfinir window.location.reload via spyOn : on remplace
    // l'objet location entier par un clone doté d'un reload mocké.
    reloadSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: reloadSpy },
      configurable: true,
      writable: true
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, statusText: 'OK' }));

    capturedBlobParts = null;
    // function classique (pas une flèche) : Blob est instancié via `new`.
    vi.stubGlobal('Blob', vi.fn(function (parts) { capturedBlobParts = parts; return {}; }));
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() });
  });

  afterEach(() => {
    errorSpy.mockRestore();
    confirmSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  describe('Chantier 1 — importStockOnly (casse C2)', () => {
    it('met à jour un id connu, fusionne un nom approché, ajoute un inconnu — favoris et aiConfig intacts', () => {
      state.ingredients = [
        makeIngredient({ id: 'ing_1', name: 'Pomme' }),
        makeIngredient({ id: 'ing_2', name: 'Poire' })
      ];
      state.favorites = [{ id: 'fav_1', name: 'Tarte' }];
      state.aiConfig = defaultTestAiConfig({ apiKey: 'ma-cle-secrete', creativity: 77 });
      const favoritesBefore = JSON.stringify(state.favorites);
      const aiConfigBefore = JSON.stringify(state.aiConfig);

      const fileContent = JSON.stringify({
        ingredients: [
          { id: 'ing_1', inStock: true, inCart: false, pinned: true, frozen: false }, // id connu
          { id: 'unknown_id', name: 'Poires', inStock: true }, // nom approché de "Poire"
          { id: 'custom_new', name: 'Mangue', inStock: true } // totalement inconnu
        ]
      });
      const file = { text: fileContent };
      const FakeFileReader = function () {
        this.readAsText = () => { this.onload({ target: { result: fileContent } }); };
      };
      vi.stubGlobal('FileReader', FakeFileReader);

      importStockOnly(file);

      const pomme = state.ingredients.find(i => i.id === 'ing_1');
      expect(pomme.inStock).toBe(true);
      expect(pomme.pinned).toBe(true);

      const poire = state.ingredients.find(i => i.id === 'ing_2');
      expect(poire.inStock).toBe(true); // fusionnée par nom approché, pas dupliquée

      expect(state.ingredients.some(i => i.name === 'Mangue')).toBe(true);
      expect(state.ingredients.length).toBe(3); // 2 existants + 1 vraiment inconnu

      expect(JSON.stringify(state.favorites)).toBe(favoritesBefore);
      expect(JSON.stringify(state.aiConfig)).toBe(aiConfigBefore);
    });

    it('ne modifie jamais aiConfig.apiKey', () => {
      state.ingredients = [makeIngredient({ id: 'ing_1' })];
      state.aiConfig = defaultTestAiConfig({ apiKey: 'cle-locale' });

      const fileContent = JSON.stringify({
        ingredients: [{ id: 'ing_1', inStock: true }],
        aiConfig: { apiKey: 'cle-du-fichier' }
      });
      const FakeFileReader = function () {
        this.readAsText = () => { this.onload({ target: { result: fileContent } }); };
      };
      vi.stubGlobal('FileReader', FakeFileReader);

      importStockOnly({});

      expect(state.aiConfig.apiKey).toBe('cle-locale');
    });
  });

  describe('Chantier 2 — exportJSON blanchit la clé API (casse C3a)', () => {
    it('le contenu généré contient "apiKey":"" et jamais la vraie clé', () => {
      state.ingredients = [makeIngredient()];
      state.aiConfig = defaultTestAiConfig({ apiKey: 'SECRET_KEY' });

      exportJSON();

      const exported = capturedBlobParts[0];
      expect(exported).toContain('"apiKey": ""');
      expect(exported).not.toContain('SECRET_KEY');
    });
  });

  describe('Chantier 3 — applyExternalState (casse C3b + F8)', () => {
    it('donnée externe SANS clé + clé locale présente → clé locale intacte', () => {
      state.aiConfig = defaultTestAiConfig({ apiKey: 'cle-locale' });

      applyExternalState({ ingredients: [makeIngredient()], aiConfig: {} });

      expect(state.aiConfig.apiKey).toBe('cle-locale');
    });

    it('donnée externe AVEC clé différente → clé locale intacte (F8)', () => {
      state.aiConfig = defaultTestAiConfig({ apiKey: 'cle-locale' });

      applyExternalState({ ingredients: [makeIngredient()], aiConfig: { apiKey: 'cle-etrangere' } });

      expect(state.aiConfig.apiKey).toBe('cle-locale');
    });
  });

  describe('Chantier 4 — reconstruction de l\'inventaire par défaut (casse C4a)', () => {
    it('ingredients: [] → reconstruit l\'inventaire depuis DEFAULT_DB', () => {
      state.ingredients = [];

      sanitizeGlobalState();

      // DEFAULT_DB ne contient AUJOURD'HUI que 66 entrées (pas ~273 : le fichier
      // `foodapp-data.js` source du monolithe n'a jamais existé dans ce dépôt — voir
      // le constat remonté dans le rapport de fin de lot). On vérifie donc contre la
      // taille réelle de DEFAULT_DB, jamais un chiffre en dur, pour ne pas mentir si
      // la base est un jour complétée.
      expect(state.ingredients.length).toBe(DEFAULT_DB.length);
      expect(state.ingredients[0]).toMatchObject({ inStock: false, inCart: false, pinned: false, shoppingSource: null });
    });

    it('ingredients non vide → AUCUNE reconstruction', () => {
      state.ingredients = [makeIngredient({ id: 'ing_only' })];

      sanitizeGlobalState();

      expect(state.ingredients.length).toBe(1);
      expect(state.ingredients[0].id).toBe('ing_only');
    });
  });

  describe('Chantier 5 — réinitialisation sûre (casse C4b)', () => {
    it('pousse le nouvel état par défaut vers le cloud AVANT de recharger la page', async () => {
      state.ingredients = [makeIngredient()];
      state.aiConfig = defaultTestAiConfig({ apiKey: 'cle-a-garder' });

      await resetAllData();

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(FB_URL),
        expect.objectContaining({ method: 'PUT' })
      );
      expect(reloadSpy).toHaveBeenCalled();
      // Preuve d'ordre : le push cloud doit être résolu avant le rechargement.
      const fetchCallOrder = fetch.mock.invocationCallOrder[0];
      const reloadCallOrder = reloadSpy.mock.invocationCallOrder[0];
      expect(fetchCallOrder).toBeLessThan(reloadCallOrder);
    });

    it('conserve la clé API locale après reset', async () => {
      state.aiConfig = defaultTestAiConfig({ apiKey: 'cle-a-garder' });

      await resetAllData();

      expect(state.aiConfig.apiKey).toBe('cle-a-garder');
      expect(state.ingredients.length).toBe(DEFAULT_DB.length); // repli chantier 4
    });

    it('n\'agit pas si Joel annule la confirmation', async () => {
      confirmSpy.mockReturnValue(false);
      state.ingredients = [makeIngredient()];

      await resetAllData();

      expect(fetch).not.toHaveBeenCalled();
      expect(reloadSpy).not.toHaveBeenCalled();
      expect(state.ingredients.length).toBe(1);
    });
  });

  describe('Chantier 7 — hygiène de shoppingChecked (F7)', () => {
    it('resetCart vide le Set shoppingChecked ET customCartItems', () => {
      state.ingredients = [makeIngredient({ id: 'ing_1', inCart: true })];
      state.customCartItems = [{ id: 'custom_1', name: 'Pain' }];
      shoppingChecked.add('ing_1');
      shoppingChecked.add('custom_1');

      resetCart();

      expect(shoppingChecked.size).toBe(0);
      expect(state.customCartItems).toEqual([]);
      expect(state.ingredients[0].inCart).toBe(false);
    });

    it('toggleCart (sortie du panier) retire l\'id du Set', () => {
      state.ingredients = [makeIngredient({ id: 'ing_1', inCart: true })];
      shoppingChecked.add('ing_1');

      toggleCart('ing_1'); // bascule inCart à false

      expect(shoppingChecked.has('ing_1')).toBe(false);
    });

    it('deleteIngredient retire l\'id du Set', () => {
      state.ingredients = [makeIngredient({ id: 'ing_1' })];
      shoppingChecked.add('ing_1');

      deleteIngredient('ing_1');

      expect(shoppingChecked.has('ing_1')).toBe(false);
      expect(state.ingredients.length).toBe(0);
    });
  });
});
