/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  state,
  shoppingChecked,
  saveState,
  registerSyncScheduler,
  defaultAiConfig
} from '../src/state';
import {
  scheduleSyncPush,
  requestSyncOp,
  performSyncSend,
  performSyncPull,
  initSyncEngine,
  isSyncPending,
  __resetSyncEngineForTests
} from '../js/app.js';

// LOT 007 — moteur de synchro (spec §4.3-4.9) : temporisation, drapeau « EN
// ATTENTE », anti-boucle, retry unique et garde-fous. Le moteur vit dans js/app.js
// (décision de spec §4.2 : aucun nouveau module) ; ses points d'entrée sont
// exportés uniquement pour ces tests.
//
// Harnais : un FAUX FIREBASE en mémoire — le GET rend ce que le dernier PUT a
// stocké, comme le vrai. `putCalls()` isole les envois dans l'historique fetch.

function makeIngredient(overrides = {}) {
  return {
    id: 'ing_1', name: 'Pomme', emoji: '🍎', category: 'Fruits',
    inStock: false, inCart: false, pinned: false, frozen: false,
    shoppingSource: null, ...overrides
  };
}

describe('Moteur de synchro — LOT 007', () => {
  let cloudStore; // contenu du faux Firebase (chaîne JSON ou null)
  let warnSpy;
  let errorSpy;

  const putCalls = () => fetch.mock.calls.filter(c => c[1]?.method === 'PUT');
  const getCalls = () => fetch.mock.calls.filter(c => !c[1]?.method);

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();

    document.body.innerHTML = `
      <div id="ing-grid"></div><div id="ing-empty"></div>
      <div id="sync-indicator-desktop" class="sync-indicator"><span class="sync-label">Cloud Sync</span></div>
      <div id="sync-indicator-mobile" class="sync-indicator"><span class="sync-label">Cloud Sync</span></div>
      <div id="info-last-sync">--</div>
      <div id="info-network">--</div>
    `;

    // Reset du singleton d'état partagé entre les tests.
    Object.assign(state, {
      ingredients: [makeIngredient()],
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
      aiConfig: defaultAiConfig()
    });
    shoppingChecked.clear();
    __resetSyncEngineForTests();
    registerSyncScheduler(scheduleSyncPush);

    cloudStore = null;
    vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
      if (options.method === 'PUT') {
        cloudStore = options.body;
        return { ok: true, status: 200, statusText: 'OK' };
      }
      return {
        ok: true, status: 200, statusText: 'OK',
        json: async () => (cloudStore ? JSON.parse(cloudStore) : null)
      };
    }));

    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    registerSyncScheduler(null);
    __resetSyncEngineForTests();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  describe('Temporisation de l\'envoi (§4.4)', () => {
    it('une modification ne part pas immédiatement, mais après 2 s', async () => {
      state.ingredients[0].inStock = true;
      saveState();

      expect(putCalls()).toHaveLength(0);
      await vi.advanceTimersByTimeAsync(2000);
      expect(putCalls()).toHaveLength(1);
    });

    it('15 modifications d\'affilée → UN seul envoi (§6.2 : cocher en rayon)', async () => {
      for (let i = 0; i < 15; i++) {
        state.ingredients[0].inStock = !state.ingredients[0].inStock;
        saveState();
        await vi.advanceTimersByTimeAsync(100); // gestes espacés de 100 ms
      }
      await vi.advanceTimersByTimeAsync(2000);
      expect(putCalls()).toHaveLength(1);
    });
  });

  describe('Anti-boucle (§4.5)', () => {
    it('un document identique au dernier envoyé n\'est PAS renvoyé', async () => {
      saveState();
      await vi.advanceTimersByTimeAsync(2000);
      expect(putCalls()).toHaveLength(1);

      // Sauvegarde sans AUCUN changement de donnée synchronisée.
      saveState();
      await vi.advanceTimersByTimeAsync(2000);
      expect(putCalls()).toHaveLength(1); // toujours un seul
      expect(isSyncPending()).toBe(false); // drapeau baissé sans requête réseau
    });

    it('une application issue de la synchro ne planifie AUCUN envoi', async () => {
      cloudStore = JSON.stringify({
        ingredients: [makeIngredient({ id: 'cloud_1', name: 'Poire' })],
        favorites: [], extraIngredients: [], customCartItems: [],
        aiConfig: {}, shoppingChecked: ['cloud_1']
      });

      await performSyncPull();
      await vi.advanceTimersByTimeAsync(5000);

      expect(state.ingredients[0].id).toBe('cloud_1'); // données bien appliquées
      expect([...shoppingChecked]).toEqual(['cloud_1']); // Set reconstruit (§4.1)
      expect(putCalls()).toHaveLength(0); // et rien ne repart
    });

    it('après un pull appliqué, sauvegarder un champ NON synchronisé ne déclenche aucun envoi (constat Codex)', async () => {
      cloudStore = JSON.stringify({
        ingredients: [makeIngredient({ id: 'cloud_1', name: 'Poire' })],
        favorites: [], extraIngredients: [], customCartItems: [],
        aiConfig: {}, shoppingChecked: []
      });
      await performSyncPull();

      state.filter = 'Fruits'; // champ d'affichage, hors périmètre §4.1
      saveState();
      await vi.advanceTimersByTimeAsync(2000);

      expect(putCalls()).toHaveLength(0); // référence = dernier cloud connu → identique
    });
  });

  describe('Drapeau « EN ATTENTE » (§4.3-4.4)', () => {
    it('drapeau levé → une récupération ENVOIE d\'abord, ne s\'applique qu\'ensuite', async () => {
      state.ingredients[0].name = 'Modif locale';
      saveState(); // drapeau levé, envoi temporisé pas encore parti

      await requestSyncOp('pull');

      // Ordre des requêtes : l'envoi PRÉCÈDE la récupération.
      expect(fetch.mock.calls[0][1]?.method).toBe('PUT');
      expect(getCalls()).toHaveLength(1);
      // Le pull a rendu notre propre document : la modification locale a survécu.
      expect(state.ingredients[0].name).toBe('Modif locale');
    });

    it('drapeau persisté : un démarrage avec des modifications non envoyées ENVOIE avant tout pull', async () => {
      localStorage.setItem('pantry_v5_sync_pending', '1'); // fermeture précipitée simulée
      cloudStore = JSON.stringify({
        ingredients: [makeIngredient({ id: 'vieux_cloud', name: 'Périmé' })],
        favorites: [], extraIngredients: [], customCartItems: [],
        aiConfig: {}, shoppingChecked: []
      });

      initSyncEngine();
      await vi.advanceTimersByTimeAsync(1);

      expect(fetch.mock.calls[0][1]?.method).toBe('PUT'); // l'état local part D'ABORD
      expect(state.ingredients[0].id).toBe('ing_1'); // jamais écrasé par le vieux cloud
    });

    it('si l\'envoi échoue, la récupération n\'est PAS appliquée (§4.4)', async () => {
      fetch.mockImplementation(async (url, options = {}) => {
        if (options.method === 'PUT') return { ok: false, status: 500, statusText: 'Server Error' };
        return { ok: true, status: 200, statusText: 'OK', json: async () => JSON.parse(cloudStore) };
      });
      cloudStore = JSON.stringify({
        ingredients: [makeIngredient({ id: 'cloud_1' })],
        favorites: [], extraIngredients: [], customCartItems: [],
        aiConfig: {}, shoppingChecked: []
      });

      state.ingredients[0].name = 'Jamais envoyée';
      saveState();
      await requestSyncOp('pull');

      expect(getCalls()).toHaveLength(0); // aucun GET : pas de pull destructif
      expect(state.ingredients[0].name).toBe('Jamais envoyée');
      expect(isSyncPending()).toBe(true); // la modification reste protégée
    });
  });

  describe('Échecs et retry (§4.7, §4.9)', () => {
    it('échec récupérable → UNE seule nouvelle tentative à 10 s, puis arrêt', async () => {
      fetch.mockImplementation(async () => ({ ok: false, status: 500, statusText: 'Server Error' }));

      saveState();
      await vi.advanceTimersByTimeAsync(2000);
      expect(putCalls()).toHaveLength(1); // 1er essai échoué

      await vi.advanceTimersByTimeAsync(10000);
      expect(putCalls()).toHaveLength(2); // le retry unique

      await vi.advanceTimersByTimeAsync(60000);
      expect(putCalls()).toHaveLength(2); // puis plus rien
      expect(isSyncPending()).toBe(true); // rien n'est perdu : drapeau maintenu
    });

    it('une modification pendant un retry programmé ANNULE le retry — un seul timer d\'envoi', async () => {
      let failing = true;
      fetch.mockImplementation(async (url, options = {}) => {
        if (options.method === 'PUT') {
          if (failing) return { ok: false, status: 500, statusText: 'Server Error' };
          cloudStore = options.body;
          return { ok: true, status: 200, statusText: 'OK' };
        }
        return { ok: true, status: 200, statusText: 'OK', json: async () => null };
      });

      saveState();
      await vi.advanceTimersByTimeAsync(2000); // échec, retry armé à 10 s
      expect(putCalls()).toHaveLength(1);

      failing = false;
      state.ingredients[0].name = 'Nouvelle modif';
      saveState(); // annule le retry, re-temporise à 2 s

      await vi.advanceTimersByTimeAsync(2000);
      expect(putCalls()).toHaveLength(2); // l'envoi normal

      await vi.advanceTimersByTimeAsync(10000);
      expect(putCalls()).toHaveLength(2); // le retry annulé n'a JAMAIS tiré
    });

    it('refus serveur 4xx → drapeau MAINTENU, AUCUN retry automatique (constat Codex)', async () => {
      fetch.mockImplementation(async () => ({ ok: false, status: 403, statusText: 'Forbidden' }));

      saveState();
      await vi.advanceTimersByTimeAsync(2000);
      expect(putCalls()).toHaveLength(1);

      await vi.advanceTimersByTimeAsync(120000);
      expect(putCalls()).toHaveLength(1); // pas de retry
      expect(isSyncPending()).toBe(true); // données valides jamais envoyées : protégées
    });

    it('garde-fou sortant : un état sans ingrédient exploitable n\'est JAMAIS envoyé, drapeau BAISSÉ (constat Flash)', async () => {
      saveState();
      await vi.advanceTimersByTimeAsync(2000);
      expect(putCalls()).toHaveLength(1); // le cloud a connu un inventaire non vide

      state.ingredients = []; // corruption simulée (sans passer par sanitize)
      saveState();
      await vi.advanceTimersByTimeAsync(2000);

      expect(putCalls()).toHaveLength(1); // l'envoi destructeur n'est jamais parti
      expect(isSyncPending()).toBe(false); // et l'appareil n'est pas verrouillé
      expect(JSON.parse(cloudStore).ingredients).toHaveLength(1); // cloud intact
    });
  });

  describe('Garde-fous entrants (§4.9.2)', () => {
    it('un document malformé (ingredients non-tableau) est ignoré sans exception', async () => {
      cloudStore = JSON.stringify({ ingredients: 'corrompu' });

      const ok = await performSyncPull();

      expect(ok).toBe(false);
      expect(state.ingredients[0].id).toBe('ing_1'); // état local intact
    });

    it('une base vide (null) n\'applique rien et n\'est pas une erreur', async () => {
      cloudStore = null;

      const ok = await performSyncPull();

      expect(ok).toBe(true);
      expect(state.ingredients[0].id).toBe('ing_1');
    });

    it('des gestes pendant la requête de pull écartent la photo cloud (garde-fou d\'empreinte, LOT 005 généralisé)', async () => {
      cloudStore = JSON.stringify({
        ingredients: [makeIngredient({ id: 'cloud_1', name: 'Photo périmée' })],
        favorites: [], extraIngredients: [], customCartItems: [],
        aiConfig: {}, shoppingChecked: []
      });
      // Le GET aboutit APRÈS un geste local : la réponse est une photo d'avant.
      fetch.mockImplementation(async (url, options = {}) => {
        state.ingredients.push(makeIngredient({ id: 'geste_pendant_vol', name: 'Ajout' }));
        return { ok: true, status: 200, statusText: 'OK', json: async () => JSON.parse(cloudStore) };
      });

      await performSyncPull();

      expect(state.ingredients.some(i => i.id === 'geste_pendant_vol')).toBe(true); // rien de perdu
      expect(state.ingredients.some(i => i.id === 'cloud_1')).toBe(false); // photo écartée
    });
  });

  describe('Voyant d\'état (§4.8)', () => {
    it('envoi réussi → « À jour ✓ », puis retour à « Cloud Sync » après 2 s', async () => {
      const desktop = document.getElementById('sync-indicator-desktop');
      const label = desktop.querySelector('.sync-label');

      await performSyncSend();

      expect(desktop.className).toContain('success');
      expect(label.textContent).toBe('À jour ✓');

      await vi.advanceTimersByTimeAsync(2000);
      expect(desktop.className).toBe('sync-indicator');
      expect(label.textContent).toBe('Cloud Sync');
    });

    it('la date de dernière synchro est enregistrée et affichée (#info-last-sync)', async () => {
      await performSyncSend();

      expect(localStorage.getItem('pantry_v5_last_sync')).toBeTruthy();
      expect(document.getElementById('info-last-sync').textContent).not.toBe('--');
      expect(document.getElementById('info-network').textContent).toBe('🌐 Connecté');
    });
  });
});
