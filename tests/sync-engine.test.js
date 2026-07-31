/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  state,
  shoppingChecked,
  saveState,
  registerSyncScheduler,
  registerSyncBarrier,
  defaultAiConfig
} from '../src/state.js';
import {
  scheduleSyncPush,
  requestSyncOp,
  performSyncSend,
  performSyncPull,
  initSyncEngine,
  isSyncPending,
  syncEngineBarrier,
  __resetSyncEngineForTests
} from '../js/app.js';
import { resetAllData } from '../src/actions.js';
import { DEFAULT_DB } from '../src/data.js';

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
        favorites: [], extraIngredients: [],
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
        favorites: [], extraIngredients: [],
        aiConfig: {}, shoppingChecked: []
      });
      await performSyncPull();

      state.filter = 'Fruits'; // champ d'affichage, hors périmètre §4.1
      saveState();

      // Correction audit Sol (C1) : le drapeau ne se lève même PAS — une sauvegarde
      // qui ne change pas le document synchronisé n'est pas une modification.
      expect(isSyncPending()).toBe(false);

      await vi.advanceTimersByTimeAsync(2000);
      expect(putCalls()).toHaveLength(0); // référence = dernier cloud connu → identique
    });
  });

  describe('Corrections de l\'audit Dur — Codex Sol (2026-07-30)', () => {
    it('C1 : une navigation ne lève jamais le drapeau — pas d\'envoi d\'un vieil inventaire au retour réseau', async () => {
      // Un envoi réussi établit la référence « dernier cloud connu »…
      saveState();
      await vi.advanceTimersByTimeAsync(2000);
      expect(putCalls()).toHaveLength(1);

      // …qui est PERSISTÉE : elle survivra à un rechargement de page.
      expect(localStorage.getItem('pantry_v5_sync_ref')).toBe(cloudStore);

      // Changer d'écran (scénario : démarrage hors ligne + ouverture des Réglages).
      state.currentView = 'export';
      saveState();

      expect(isSyncPending()).toBe(false); // rien à envoyer : le cloud n'a rien à recevoir
      await vi.advanceTimersByTimeAsync(2000);
      expect(putCalls()).toHaveLength(1); // aucun envoi parti

      // Au « retour réseau », le pull n'a donc AUCUN envoi à faire d'abord :
      await requestSyncOp('pull');
      expect(fetch.mock.calls.at(-1)[1]?.method).toBeUndefined(); // dernier appel = GET
    });

    it('C2 : un réglage IA modifié pendant un pull en vol n\'est pas écrasé par la photo cloud', async () => {
      cloudStore = JSON.stringify({
        ingredients: [makeIngredient()],
        favorites: [], extraIngredients: [],
        aiConfig: { creativity: 50 }, shoppingChecked: []
      });
      // Le GET aboutit APRÈS que Joel a réglé la créativité de 50 à 80.
      fetch.mockImplementation(async () => {
        state.aiConfig.creativity = 80;
        saveState();
        return { ok: true, status: 200, statusText: 'OK', json: async () => JSON.parse(cloudStore) };
      });

      await performSyncPull();

      expect(state.aiConfig.creativity).toBe(80); // photo écartée, réglage préservé
      expect(isSyncPending()).toBe(true); // et il reste marqué « à envoyer »
    });

    it('D1 : après un refus 4xx, les cycles automatiques ne retentent NI envoi NI pull', async () => {
      fetch.mockImplementation(async () => ({ ok: false, status: 403, statusText: 'Forbidden' }));
      saveState();
      await vi.advanceTimersByTimeAsync(2000);
      expect(putCalls()).toHaveLength(1);
      const totalCallsAfterFailure = fetch.mock.calls.length;

      // Pull périodique / retour d'application simulés : rien ne doit partir.
      await requestSyncOp('pull');
      await requestSyncOp('pull');

      expect(fetch.mock.calls.length).toBe(totalCallsAfterFailure); // ni PUT ni GET
      expect(isSyncPending()).toBe(true); // les données restent protégées
    });

    it('D1 : un clic manuel réautorise l\'envoi après un blocage', async () => {
      let failing = true;
      fetch.mockImplementation(async (url, options = {}) => {
        if (options.method === 'PUT') {
          if (failing) return { ok: false, status: 403, statusText: 'Forbidden' };
          cloudStore = options.body;
          return { ok: true, status: 200, statusText: 'OK' };
        }
        return { ok: true, status: 200, statusText: 'OK', json: async () => JSON.parse(cloudStore) };
      });

      saveState();
      await vi.advanceTimersByTimeAsync(2000); // échec 4xx → envois automatiques suspendus

      failing = false;
      await requestSyncOp('manual'); // le geste de Joel réessaie

      expect(putCalls().length).toBeGreaterThanOrEqual(2); // l'envoi est reparti
      expect(isSyncPending()).toBe(false);
    });

    it('D2 : un démarrage hors ligne garde le voyant « Hors ligne » (aucun pull lancé)', async () => {
      Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
      try {
        initSyncEngine();
        await vi.advanceTimersByTimeAsync(1);

        expect(fetch).not.toHaveBeenCalled(); // pas de pull voué à l'échec
        const label = document.querySelector('#sync-indicator-desktop .sync-label');
        expect(label.textContent).toBe('Hors ligne'); // jamais remplacé par « Échec »
        // FAUX VERROU FV-10 (audit adversarial du 2026-07-31, mutation M40) : ce test ne
        // vérifiait QUE le libellé. `setSyncStatus` mappe 'offline' sur la classe CSS
        // `error` (js/app.js:178) parce qu'aucune classe `.sync-indicator.offline` n'existe
        // dans css/style.css — supprimer ce mappage laissait le voyant sans couleur
        // d'alerte, et le test restait vert.
        expect(document.getElementById('sync-indicator-desktop').className).toContain('error');
      } finally {
        Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // FAUX VERROUS COMBLÉS — audit adversarial du 2026-07-31 (49 mutations réelles sur
  // js/app.js, 12 survivantes). Six d'entre elles vivaient dans ce moteur : le code
  // pouvait être cassé sur ces six points sans qu'aucun des 559 tests ne bronche.
  // Chaque test ci-dessous a été re-vérifié en réappliquant sa mutation d'origine.
  // ═══════════════════════════════════════════════════════════════════════════════
  describe('Faux verrous du moteur comblés (audit adversarial du 2026-07-31)', () => {

    // FV-3 / mutation M06 — js/app.js:434. Le moteur a DEUX empreintes distinctes :
    // celle du document synchronisé (`currentSyncDocJson`, :390/:410, testée par C2) et
    // celle du FORMULAIRE IA non sauvegardé (`aiFormFingerprint`, :391/:434). Seule la
    // première était couverte. Remplacer la seconde par `if (true)` laissait 559 tests
    // verts, alors qu'un pull revenant pendant que Joel tape sa clé API écrasait sa saisie.
    it('FV-3 : une saisie EN COURS dans le formulaire IA n\'est jamais réécrite par un pull '
       + '(acquis LOT 005 — empreinte distincte de celle du document)', async () => {
      document.body.insertAdjacentHTML('beforeend', `
        <div class="ai-settings">
          <input id="api-key-input" value="">
          <input id="ai-exceptions" value="">
          <input id="ai-exclusions" value="">
        </div>
      `);
      // Le cloud porte des exclusions déjà enregistrées, différentes de la saisie en cours.
      cloudStore = JSON.stringify({
        ingredients: [makeIngredient({ inStock: true })],
        favorites: [], extraIngredients: [],
        shoppingChecked: [],
        aiConfig: { ...defaultAiConfig(), exclusions: 'valeur venue du cloud' }
      });

      let resoudreGet;
      fetch.mockImplementation(async (url, options = {}) => {
        if (options.method === 'PUT') { cloudStore = options.body; return { ok: true, status: 200, statusText: 'OK' }; }
        await new Promise(r => { resoudreGet = r; });
        return { ok: true, status: 200, statusText: 'OK', json: async () => JSON.parse(cloudStore) };
      });

      const enVol = performSyncPull({ manual: false });
      await vi.advanceTimersByTimeAsync(0);

      // Joel tape pendant que la requête est en vol, SANS cliquer sur « Sauvegarder ».
      document.getElementById('ai-exclusions').value = 'ce que Joel est en train de taper';

      resoudreGet();
      await enVol;

      // Sa saisie survit : `restoreAIConfig` n'a pas été appelée.
      expect(document.getElementById('ai-exclusions').value).toBe('ce que Joel est en train de taper');
    });

    // FV-8 / mutation M10 — js/app.js:337. La même expression `_syncDirtyGen === genAtBuild`
    // existe deux fois : :325 (branche anti-boucle, sans réseau) et :337 (après un envoi
    // réseau réussi). Seule la première était effleurée. Sans la seconde, une modification
    // faite PENDANT l'envoi voyait son drapeau baissé — elle ne partait jamais et le pull
    // suivant l'écrasait.
    it('FV-8 : une modification faite PENDANT un envoi en vol reste protégée après le succès', async () => {
      let resoudrePut;
      fetch.mockImplementation(async (url, options = {}) => {
        if (options.method === 'PUT') {
          cloudStore = options.body;
          await new Promise(r => { resoudrePut = r; });
          return { ok: true, status: 200, statusText: 'OK' };
        }
        return { ok: true, status: 200, statusText: 'OK', json: async () => (cloudStore ? JSON.parse(cloudStore) : null) };
      });

      state.ingredients[0].inStock = true;
      saveState();
      await vi.advanceTimersByTimeAsync(2000); // l'envoi part, il est en vol
      expect(isSyncPending()).toBe(true);

      // Joel modifie encore, pendant que la requête voyage.
      state.ingredients[0].pinned = true;
      saveState();

      resoudrePut();
      await vi.advanceTimersByTimeAsync(0);

      // Le succès concernait l'ANCIEN document : le drapeau doit rester levé pour la
      // modification qui n'est pas encore partie.
      expect(isSyncPending()).toBe(true);
    });

    // FV-6a / mutation M49 — js/app.js:219. Trois déclencheurs sont censés réautoriser
    // l'envoi après un refus 4xx (js/app.js:119-121) : un geste, un clic manuel, le retour
    // réseau. Seul le clic manuel était testé (D1).
    //
    // PRÉCISION TROUVÉE EN ÉCRIVANT CE TEST : `_syncSendBlocked` ne garde QUE le chemin du
    // pull (js/app.js:249) — une opération 'send' n'est jamais gardée par lui. Un test qui se
    // contente d'attendre le minuteur de 2 s passe donc dans les deux cas et ne prouve rien.
    // C'est le CYCLE AUTOMATIQUE (pull) qu'il faut provoquer : sans la réautorisation, il
    // refuse de repartir et l'appareil reste muet jusqu'au prochain clic manuel.
    it('FV-6a : après un refus 4xx, une VRAIE MODIFICATION réautorise le cycle automatique', async () => {
      let failing = true;
      fetch.mockImplementation(async (url, options = {}) => {
        if (options.method === 'PUT') {
          if (failing) return { ok: false, status: 403, statusText: 'Forbidden' };
          cloudStore = options.body;
          return { ok: true, status: 200, statusText: 'OK' };
        }
        return { ok: true, status: 200, statusText: 'OK', json: async () => (cloudStore ? JSON.parse(cloudStore) : null) };
      });

      state.ingredients[0].inStock = true;
      saveState();
      await vi.advanceTimersByTimeAsync(2000); // 403 → cycles automatiques suspendus
      expect(putCalls()).toHaveLength(1);
      expect(isSyncPending()).toBe(true);

      // Un cycle automatique AVANT tout nouveau geste : il doit rester muet.
      await requestSyncOp('pull');
      expect(fetch.mock.calls.length).toBe(1); // ni PUT ni GET

      failing = false;
      // Un geste de Joel, et rien d'autre : pas de clic sur « Cloud Sync ».
      state.ingredients[0].pinned = true;
      saveState();

      // Le cycle automatique suivant doit repartir grâce à ce geste.
      await requestSyncOp('pull');

      expect(putCalls().length).toBeGreaterThanOrEqual(2);
      expect(isSyncPending()).toBe(false);
    });

    // FV-6b / mutation M43 — js/app.js:489, l'écouteur `online`.
    it('FV-6b : après un refus 4xx, le RETOUR DU RÉSEAU réautorise l\'envoi', async () => {
      let failing = true;
      fetch.mockImplementation(async (url, options = {}) => {
        if (options.method === 'PUT') {
          if (failing) return { ok: false, status: 403, statusText: 'Forbidden' };
          cloudStore = options.body;
          return { ok: true, status: 200, statusText: 'OK' };
        }
        return { ok: true, status: 200, statusText: 'OK', json: async () => (cloudStore ? JSON.parse(cloudStore) : null) };
      });

      initSyncEngine(); // c'est lui qui pose l'écouteur `online`
      await vi.advanceTimersByTimeAsync(0);

      state.ingredients[0].inStock = true;
      saveState();
      await vi.advanceTimersByTimeAsync(2000); // 403 → bloqué
      const putsApresBlocage = putCalls().length;

      failing = false;
      window.dispatchEvent(new Event('online'));
      await vi.advanceTimersByTimeAsync(2000);

      expect(putCalls().length).toBeGreaterThan(putsApresBlocage);
    });

    // FV-7a / mutation M45 — js/app.js:234, règle §4.4 « un clic manuel n'est jamais
    // rétrogradé ». Aucun test ne mettait un `manual` en file pendant une opération en vol.
    it('FV-7a : un clic manuel mis en file pendant une opération en vol n\'est PAS rétrogradé', async () => {
      let resoudrePut;
      fetch.mockImplementation(async (url, options = {}) => {
        if (options.method === 'PUT') {
          cloudStore = options.body;
          await new Promise(r => { resoudrePut = r; });
          return { ok: true, status: 200, statusText: 'OK' };
        }
        return { ok: true, status: 200, statusText: 'OK', json: async () => (cloudStore ? JSON.parse(cloudStore) : null) };
      });

      state.ingredients[0].inStock = true;
      saveState();
      await vi.advanceTimersByTimeAsync(2000); // un 'send' est en vol

      // Joel clique « Cloud Sync » PUIS un cycle automatique arrive : le manuel doit gagner.
      requestSyncOp('manual');
      requestSyncOp('pull');

      resoudrePut();
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(0);

      // PRÉCISION TROUVÉE EN ÉCRIVANT CE TEST : compter les GET ne distingue PAS les deux
      // opérations — un 'pull' rétrogradé en fait un aussi. Ce qui les sépare, c'est que
      // seul le chemin MANUEL rend compte à Joel (js/app.js:439). Un cycle automatique est
      // silencieux par construction : si la file avait rétrogradé son clic, il n'aurait
      // eu aucun retour à l'écran.
      const messages = [...document.querySelectorAll('#toast-container .toast')].map(t => t.textContent);
      expect(messages).toContain('☁️ Données chargées du Cloud');
    });

    // FV-7b / mutation M47 — js/app.js:264, le renvoi silencieux qui suit le pull manuel.
    //
    // TROUVÉ EN ÉCRIVANT CE TEST, et c'est la vraie leçon : quand le pull APPLIQUE une photo
    // cloud, il met aussitôt la référence anti-boucle à jour (js/app.js:427). Le renvoi qui
    // suit construit alors un document identique à cette référence et s'arrête AVANT le
    // réseau (:324) — il est structurellement inobservable. Un test bâti sur ce scénario
    // aurait été un faux verrou de plus.
    //
    // Le seul cas où ce renvoi fait réellement quelque chose est le CLOUD VIDE : le pull
    // rend `true` sans toucher à la référence (:397-401), et le renvoi dépose alors
    // l'inventaire local. C'est ce cas — le seul qui compte — que ce test fige.
    it('FV-7b : un clic manuel sur un cloud VIDE y dépose l\'inventaire local (aller-retour)', async () => {
      cloudStore = null; // première synchro : la base est vide

      const putsAvant = putCalls().length;
      await requestSyncOp('manual');
      await vi.advanceTimersByTimeAsync(0);

      expect(getCalls().length).toBeGreaterThan(0);          // le cloud a bien été interrogé
      expect(putCalls().length).toBeGreaterThan(putsAvant);  // et l'inventaire local y est monté
      expect(cloudStore).toBeTruthy();
      expect(JSON.parse(cloudStore).ingredients).toHaveLength(1);
    });
  });

  describe('Contre-vérification audit Sol (2026-07-30) — référence absente et frontière reset↔moteur', () => {
    let confirmSpy;
    let reloadSpy;

    beforeEach(() => {
      confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      reloadSpy = vi.fn();
      Object.defineProperty(window, 'location', {
        value: { ...window.location, reload: reloadSpy },
        configurable: true,
        writable: true
      });
      registerSyncBarrier(syncEngineBarrier);
    });

    afterEach(() => {
      confirmSpy.mockRestore();
      registerSyncBarrier(null);
    });

    it('C1 : référence ABSENTE + démarrage hors ligne + navigation + retour réseau → aucun PUT furtif avant le GET', async () => {
      // Premier lancement de cette version : pas de pantry_v5_sync_ref en stockage.
      expect(localStorage.getItem('pantry_v5_sync_ref')).toBeNull();
      Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true });
      try {
        initSyncEngine(); // amorce la référence depuis l'état local (drapeau baissé)
        await vi.advanceTimersByTimeAsync(1);
        expect(fetch).not.toHaveBeenCalled();

        // Navigation hors ligne : une sauvegarde qui ne change AUCUNE donnée synchronisée.
        state.currentView = 'export';
        saveState();
        expect(isSyncPending()).toBe(false);

        // Le cloud, lui, a été mis à jour par un autre appareil entre-temps.
        cloudStore = JSON.stringify({
          ingredients: [makeIngredient({ id: 'cloud_recent', name: 'Plus récent' })],
          favorites: [], extraIngredients: [],
          aiConfig: {}, shoppingChecked: []
        });

        Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });
        window.dispatchEvent(new Event('online'));
        await vi.advanceTimersByTimeAsync(1);

        expect(putCalls()).toHaveLength(0); // AUCUN vieil inventaire envoyé
        expect(getCalls().length).toBeGreaterThan(0); // le cloud a bien été LU
        expect(state.ingredients[0].id).toBe('cloud_recent'); // et appliqué
      } finally {
        Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true });
      }
    });

    it('C1 : drapeau persisté + référence absente → PAS d\'amorçage, les modifications en attente partent d\'abord', async () => {
      // L'amorçage ne doit jamais faire passer des modifications non envoyées
      // pour « déjà envoyées » (elles seraient écrasées par le premier pull).
      localStorage.setItem('pantry_v5_sync_pending', '1');
      cloudStore = JSON.stringify({
        ingredients: [makeIngredient({ id: 'vieux_cloud' })],
        favorites: [], extraIngredients: [],
        aiConfig: {}, shoppingChecked: []
      });

      initSyncEngine();
      await vi.advanceTimersByTimeAsync(1);

      expect(fetch.mock.calls[0][1]?.method).toBe('PUT'); // l'état local part D'ABORD
      expect(state.ingredients[0].id).toBe('ing_1'); // jamais écrasé
    });

    it('C3 : un envoi du moteur EN VOL au moment du reset ne peut pas écrire APRÈS le PUT du reset', async () => {
      const writes = []; // ordre RÉEL des écritures cloud abouties
      let releaseEnginePut = null;
      fetch.mockImplementation((url, options = {}) => {
        if (options.method === 'PUT') {
          if (!releaseEnginePut) {
            // 1er PUT = l'envoi du moteur : retenu EN VOL jusqu'à releaseEnginePut()
            return new Promise(resolve => {
              releaseEnginePut = () => {
                writes.push('moteur');
                cloudStore = options.body;
                resolve({ ok: true, status: 200, statusText: 'OK' });
              };
            });
          }
          writes.push('reset');
          cloudStore = options.body;
          return Promise.resolve({ ok: true, status: 200, statusText: 'OK' });
        }
        return Promise.resolve({
          ok: true, status: 200, statusText: 'OK',
          json: async () => (cloudStore ? JSON.parse(cloudStore) : null)
        });
      });

      state.ingredients[0].name = 'Avant reset';
      saveState();
      await vi.advanceTimersByTimeAsync(2000); // l'envoi du moteur part… et reste en vol
      expect(releaseEnginePut).toBeTruthy();

      const resetPromise = resetAllData(); // la barrière fait ATTENDRE le reset
      await vi.advanceTimersByTimeAsync(0);
      expect(writes).toEqual([]); // le reset n'a PAS écrit pendant que l'envoi vole

      releaseEnginePut(); // l'envoi antérieur aboutit enfin
      await resetPromise;

      expect(writes).toEqual(['moteur', 'reset']); // le reset écrit STRICTEMENT en dernier
      expect(JSON.parse(cloudStore).ingredients).toHaveLength(DEFAULT_DB.length); // cloud final = reset
      expect(reloadSpy).toHaveBeenCalled();
    });

    it('C3 : un envoi temporisé pas encore parti est ANNULÉ par le reset — un seul PUT, celui du reset', async () => {
      state.ingredients[0].name = 'Modif juste avant le clic';
      saveState(); // timer de 2 s armé, envoi pas encore parti

      await resetAllData(); // barrière : le timer est annulé avant le PUT du reset

      expect(putCalls()).toHaveLength(1); // le SEUL envoi est celui du reset
      await vi.advanceTimersByTimeAsync(15000);
      expect(putCalls()).toHaveLength(1); // le timer annulé ne tire jamais
      expect(JSON.parse(cloudStore).ingredients).toHaveLength(DEFAULT_DB.length);
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
        favorites: [], extraIngredients: [],
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
        favorites: [], extraIngredients: [],
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
        favorites: [], extraIngredients: [],
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

    // LOT 013 — audit adversarial du diff : la matrice de couverture citait ce describe
    // pour « les DEUX voyants, sans toast » alors que seul le desktop était vérifié, et
    // qu'aucune assertion ne portait sur l'ABSENCE de toast. Comblé ici.
    it('le voyant MOBILE suit le même cycle que le desktop', async () => {
      const mobile = document.getElementById('sync-indicator-mobile');
      const label = mobile.querySelector('.sync-label');

      await performSyncSend();
      expect(mobile.className).toContain('success');
      expect(label.textContent).toBe('À jour ✓');

      await vi.advanceTimersByTimeAsync(2000);
      expect(mobile.className).toBe('sync-indicator');
      expect(label.textContent).toBe('Cloud Sync');
    });

    it('une synchro automatique réussie n\'affiche AUCUN toast (le voyant suffit)', async () => {
      await performSyncSend();
      expect(document.querySelectorAll('.toast').length).toBe(0);
    });
  });

  // LOT 013 — l'acquis LOT 007 « récupération au retour d'onglet » n'était couvert par
  // AUCUN test (audit adversarial du diff : `initSyncEngine` teste le drapeau, jamais
  // l'écouteur `visibilitychange` lui-même, js/app.js:493-495).
  describe('Retour d\'onglet déclenche une récupération (§4.4, LOT 007)', () => {
    it('document redevenu visible, en ligne → une récupération est lancée', async () => {
      initSyncEngine();
      // `initSyncEngine` lance elle-même un pull initial SANS l'attendre : il faut le
      // laisser se résoudre en entier avant de mesurer `avant`, sinon `_syncInFlight`
      // est encore vrai et la récupération suivante serait mise en FILE plutôt que
      // réellement relancée (même s'il n'y a pas de vrai timer à avancer ici, il faut
      // laisser les micro-tâches déjà en attente se dérouler).
      await vi.advanceTimersByTimeAsync(0);
      const avant = getCalls().length;

      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
      await vi.advanceTimersByTimeAsync(0);

      // Robuste au nombre EXACT d'écouteurs déjà accumulés par d'autres tests du même
      // fichier (`initSyncEngine` en ajoute un nouveau à chaque appel, jamais retiré) :
      // ce qui compte ici est qu'AU MOINS une récupération parte, pas laquelle.
      expect(getCalls().length).toBeGreaterThan(avant);
    });

    it('document redevenu visible mais HORS LIGNE → aucune récupération', () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
      try {
        initSyncEngine();
        const avant = getCalls().length;

        Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
        document.dispatchEvent(new Event('visibilitychange'));

        expect(getCalls().length).toBe(avant);
      } finally {
        Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // LOT 015 — trou de la barrière de quiescence, trouvé à l'audit adversarial.
  //
  // La barrière promet à un chemin explicite (remise à zéro, restauration de fichier)
  // qu'il pourra écrire sans qu'un envoi du moteur ne le double. Elle vide bien la file
  // à son appel — mais une opération pouvait être remise en file APRÈS, pendant l'attente
  // (retour du réseau, retour sur l'app, pull périodique). À la levée, le `finally`
  // relançait cette opération de façon SYNCHRONE, alors que la reprise du chemin explicite
  // n'est qu'une microtâche : l'envoi construisait donc son document avec l'état d'AVANT,
  // et le pull qui suivait réappliquait ce vieux document par-dessus la restauration.
  // ─────────────────────────────────────────────────────────────────────
  describe('Barrière de quiescence — priorité au chemin explicite (LOT 015)', () => {
    it('une opération mise en file PENDANT l\'attente n\'est PAS relancée à la levée : '
       + 'elle porterait l\'état d\'avant le chemin explicite', async () => {
      state.ingredients = [makeIngredient({ id: 'avant' })];
      saveState(); // lève le drapeau « en attente »
      expect(isSyncPending()).toBe(true);

      // Un envoi part et reste en vol (le PUT ne se résout pas tout de suite).
      let terminerLePut;
      fetch.mockImplementationOnce(() => new Promise(resolve => {
        terminerLePut = () => resolve({ ok: true, status: 200, statusText: 'OK' });
      }));
      const envoiEnVol = requestSyncOp('send');
      await Promise.resolve();

      // Le chemin explicite demande la quiescence et ATTEND.
      let barriereLevee = false;
      const attente = syncEngineBarrier().then(() => { barriereLevee = true; });

      // Pendant l'attente : retour du réseau / de l'app → une opération est mise en file.
      requestSyncOp('pull');

      const putsAvant = putCalls().length;
      terminerLePut();
      await envoiEnVol;
      await attente;

      expect(barriereLevee).toBe(true);
      // Aucun nouvel envoi n'a été construit derrière le dos du chemin explicite.
      expect(putCalls().length).toBe(putsAvant);
      expect(getCalls().length).toBe(0);
    });

    it('sans barrière en attente, une opération mise en file EST bien relancée '
       + '— le comportement normal du moteur n\'est pas cassé', async () => {
      state.ingredients = [makeIngredient({ id: 'a' })];

      let terminerLePut;
      fetch.mockImplementationOnce(() => new Promise(resolve => {
        terminerLePut = () => resolve({ ok: true, status: 200, statusText: 'OK' });
      }));
      const envoiEnVol = requestSyncOp('send');
      await Promise.resolve();

      requestSyncOp('pull');

      terminerLePut();
      await envoiEnVol;
      await vi.advanceTimersByTimeAsync(0);

      expect(getCalls().length).toBeGreaterThan(0);
    });
  });
});
