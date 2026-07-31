/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  importStockOnly,
  exportJSON,
  resetCart,
  resetAllData,
  toggleCart,
  deleteIngredient
} from '../src/actions.js';
import { state, shoppingChecked, sanitizeGlobalState, applyExternalState, registerSyncScheduler } from '../src/state.js';
import { FB_URL } from '../src/constants.js';
import { DEFAULT_DB } from '../src/data.js';

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

  // LOT 014, §C1 — LA PORTE JUMELLE. Le LOT 015 a blindé `importJSON` (« Restaurer une
  // sauvegarde ») contre les fichiers mal formés ; `importStockOnly` (« Importer uniquement
  // le stock ») est resté avec sa garde d'origine `if (!data.ingredients)`, qui ne testait
  // que la PRÉSENCE de la clé. Ces tests sont volontairement calqués sur ceux qui protègent
  // le bouton voisin (`tests/backup-restore.test.js:290-392`), cas pour cas.
  describe('LOT 014 §C1 — importStockOnly refuse ce qui n\'est pas un inventaire', () => {
    function importerStock(contenuFichier) {
      const FakeFileReader = function () {
        this.readAsText = () => { this.onload({ target: { result: contenuFichier } }); };
      };
      vi.stubGlobal('FileReader', FakeFileReader);
      importStockOnly({});
    }

    function dernierToast() {
      const toasts = [...document.querySelectorAll('#toast-container .toast')];
      return toasts.length ? toasts[toasts.length - 1].textContent : null;
    }

    beforeEach(() => {
      document.getElementById('toast-container')?.remove();
      state.ingredients = [makeIngredient({ id: 'ing_1', name: 'Pomme' })];
    });

    // Le cas qui a motivé §C1 : le spread d'une CHAÎNE produit {0:'T',1:'o',…}, un objet
    // qui survit à sanitizeGlobalState et part au cloud sans jamais avoir de nom.
    it('une liste de simples noms est refusée — aucun ingrédient fantôme, aucun envoi cloud', () => {
      importerStock(JSON.stringify({ ingredients: ['Tomate', 'Oignon'] }));

      expect(state.ingredients.length).toBe(1);
      expect(state.ingredients[0].name).toBe('Pomme');
      expect(dernierToast()).toBe('Format non reconnu');
      expect(fetch).not.toHaveBeenCalled();
    });

    it('un inventaire qui n\'est pas un tableau (chaîne) est refusé', () => {
      importerStock(JSON.stringify({ ingredients: 'abc' }));

      expect(state.ingredients.length).toBe(1);
      expect(dernierToast()).toBe('Format non reconnu');
      expect(fetch).not.toHaveBeenCalled();
    });

    it('des objets vides sont refusés — ils ne deviennent jamais des ingrédients', () => {
      importerStock(JSON.stringify({ ingredients: [{}, {}] }));

      expect(state.ingredients.length).toBe(1);
      expect(dernierToast()).toBe('Format non reconnu');
    });

    it('des valeurs aberrantes (nombre, null) sont refusées', () => {
      importerStock(JSON.stringify({ ingredients: [42, null] }));

      expect(state.ingredients.length).toBe(1);
      expect(dernierToast()).toBe('Format non reconnu');
    });

    it('un fichier sans clé ingredients reste refusé (comportement d\'origine préservé)', () => {
      importerStock(JSON.stringify({ favorites: [] }));

      expect(state.ingredients.length).toBe(1);
      expect(dernierToast()).toBe('Format non reconnu');
    });

    // La fusion est douce par nature : une entrée illisible ne doit pas faire échouer les
    // entrées valides du même fichier — contrairement à la restauration totale, qui refuse
    // le fichier en bloc.
    it('fichier mixte : les entrées valides passent, les illisibles sont écartées', () => {
      importerStock(JSON.stringify({
        ingredients: ['Tomate', { id: 'custom_new', name: 'Mangue', inStock: true }, {}]
      }));

      expect(state.ingredients.some(i => i.name === 'Mangue')).toBe(true);
      expect(state.ingredients.length).toBe(2);
      expect(state.ingredients.every(i => typeof i.name === 'string' && i.name !== '')).toBe(true);
    });

    // Seconde fuite, plus discrète : un id qui ne correspond à RIEN localement tombait dans
    // la branche de création et fabriquait un ingrédient sans nom.
    it('un id inconnu SANS nom ne crée pas d\'ingrédient sans nom', () => {
      importerStock(JSON.stringify({ ingredients: [{ id: 'zzz_inconnu', inStock: true }] }));

      expect(state.ingredients.length).toBe(1);
      expect(state.ingredients[0].name).toBe('Pomme');
    });

    // GARDE-FOU DE NON-RÉGRESSION : un fichier peut légitimement dire « cet ingrédient-là,
    // maintenant en stock » sans répéter son nom. Une garde qui exigerait nom ET identifiant
    // (celle de importJSON) casserait ce cas — c'est pourquoi les deux portes ont des règles
    // distinctes (`estFusionnable` vs `estUnIngredientPlausible`).
    it('un id CONNU sans nom met toujours à jour le statut, sans rien créer', () => {
      importerStock(JSON.stringify({
        ingredients: [{ id: 'ing_1', inStock: true, pinned: true }]
      }));

      expect(state.ingredients.length).toBe(1);
      expect(state.ingredients[0].name).toBe('Pomme');
      expect(state.ingredients[0].inStock).toBe(true);
      expect(state.ingredients[0].pinned).toBe(true);
    });

    // Le champ `n` est l'ancien nom court des sauvegardes de l'ère monolithe : la porte
    // voisine l'accepte, celle-ci doit l'accepter aussi (même socle `aUnNomExploitable`).
    it('une entrée au champ monolithe « n » est acceptée', () => {
      importerStock(JSON.stringify({ ingredients: [{ id: 'custom_vieux', n: 'Céleri' }] }));

      expect(state.ingredients.length).toBe(2);
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

      // DEFAULT_DB contient 297 entrées, reconstruites le 2026-07-29 depuis l'export
      // réel de Joel (l'ancienne base n'en avait que 66 — le fichier `foodapp-data.js`
      // source du monolithe n'a jamais existé dans ce dépôt). On vérifie contre la
      // taille réelle de DEFAULT_DB, jamais un chiffre en dur, pour ne pas mentir si
      // la base est un jour complétée à nouveau.
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

      // Durcissement d'audit Codex : prouver que la promesse du push est RÉSOLUE
      // avant le rechargement (invocationCallOrder ne prouvait que l'invocation).
      // On garde la main sur la résolution du fetch : tant qu'il est en vol,
      // reload ne doit pas avoir été appelé.
      let resolveFetch;
      fetch.mockReturnValue(new Promise(resolve => { resolveFetch = resolve; }));

      const resetPromise = resetAllData();
      // Laisse resetAllData franchir la barrière de quiescence (immédiate ici : aucun
      // moteur inscrit) puis avancer jusqu'à l'await du push.
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(FB_URL),
        expect.objectContaining({ method: 'PUT' })
      );
      expect(reloadSpy).not.toHaveBeenCalled(); // push en vol → pas encore de reload

      resolveFetch({ ok: true, statusText: 'OK' });
      await resetPromise;

      expect(reloadSpy).toHaveBeenCalled(); // reload seulement après résolution du push
    });

    it('conserve la clé API locale après reset', async () => {
      state.aiConfig = defaultTestAiConfig({ apiKey: 'cle-a-garder' });

      await resetAllData();

      expect(state.aiConfig.apiKey).toBe('cle-a-garder');
      expect(state.ingredients.length).toBe(DEFAULT_DB.length); // repli chantier 4
    });

    it('efface les suggestions IA (audit Codex : elles survivaient au reset et se republiaient sur le cloud)', async () => {
      state.aiSuggestions = [{ name: 'Vieille recette' }, { name: 'Autre vieille recette' }];
      state.currentSuggestionIdx = 1;
      state.currentView = 'ai';

      await resetAllData();

      expect(state.aiSuggestions).toBeNull();
      expect(state.currentSuggestionIdx).toBeNull();
      expect(state.currentView).toBe('pantry');

      // Le document poussé au cloud ne doit contenir aucune suggestion résiduelle.
      // Depuis le LOT 007, le périmètre §4.1 exclut aiSuggestions du document :
      // la clé est carrément ABSENTE (plus strict encore que le null du LOT 008).
      const pushedBody = JSON.parse(fetch.mock.calls[0][1].body);
      expect(pushedBody).not.toHaveProperty('aiSuggestions');
    });

    it('ne programme AUCUN envoi fantôme via le moteur et écrit la référence anti-boucle (audit Sol C3)', async () => {
      // Le drapeau résiduel laissé par switchView provoquait, APRÈS le rechargement,
      // un second PUT du reset capable d'écraser une écriture concurrente d'un
      // autre appareil. Frontière actions ↔ moteur désormais couverte.
      const scheduler = vi.fn();
      registerSyncScheduler(scheduler);
      try {
        state.ingredients = [makeIngredient()];

        await resetAllData();

        expect(scheduler).not.toHaveBeenCalled(); // ni drapeau, ni timer d'envoi
        expect(window.localStorage.setItem).not.toHaveBeenCalledWith('pantry_v5_sync_pending', '1');
        expect(window.localStorage.setItem).toHaveBeenCalledWith('pantry_v5_sync_ref', expect.any(String));
        expect(fetch.mock.calls.filter(c => c[1]?.method === 'PUT')).toHaveLength(1); // le SEUL envoi du reset
        expect(state.currentView).toBe('pantry'); // le retour à l'inventaire est conservé
      } finally {
        registerSyncScheduler(null);
      }
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
    it('resetCart vide le Set shoppingChecked et sort tous les ingrédients du panier', () => {
      state.ingredients = [
        makeIngredient({ id: 'ing_1', inCart: true }),
        makeIngredient({ id: 'ing_2', inCart: true, inStock: true })
      ];
      shoppingChecked.add('ing_1');
      shoppingChecked.add('ing_2');

      resetCart();

      expect(shoppingChecked.size).toBe(0);
      expect(state.ingredients.every(i => i.inCart === false)).toBe(true);
      // volet G : le stock n'est PAS touché — c'est la promesse du libellé.
      expect(state.ingredients[1].inStock).toBe(true);
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
