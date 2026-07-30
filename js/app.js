import {
  state as moduleState,
  loadState as loadStateFromModule,
  saveState as saveStateToModule,
  shoppingChecked,
  applyExternalState,
  registerSyncScheduler,
  registerSyncBarrier,
  replaceShoppingChecked
} from '../src/state.js';
import { h, toast } from '../src/utils/dom.js';
import {
  generateId,
  normalizeString,
  autoEmoji,
  areSimilar,
  debounce
} from '../src/utils/helpers.js';
import { CATEGORIES, DEFAULT_DB, getCategoryEmoji } from '../src/data.js';
import { AI_ROLES, LOCAL_STORAGE_SYNC_REF_KEY, FB_USER, LOCAL_STORAGE_KEY } from '../src/constants.js';
import { syncPush, syncPull, buildSyncDocument, extractSyncedState } from '../src/services/firebase.js';
import { generateRecipes, callAI, transformRecipeFromText } from '../src/services/gemini.js';
import { renderPantryGrid } from '../src/ui/pantry.js';
import { renderShoppingList } from '../src/ui/shopping.js';
import { renderRecipeCard, renderRecipeDetail } from '../src/ui/recipe.js';
import * as Actions from '../src/actions.js';

let state = moduleState;
let _isManualCategory = false;
let _localCategoryFill = false; // true = catégorie posée par détection locale faible (IA peut écraser)
let _addSuggestTimer = null;
// Incremente a chaque requete de suggestion IA : seule la derniere lancee a le droit
// d'appliquer sa reponse (cf. handleAddInput).
let _aiSuggestGenId = 0;

function saveState(updateUI = true) { saveStateToModule(updateUI); }

const expose = (fns) => {
  for (const [name, fn] of Object.entries(fns)) {
    window[name] = fn;
  }
};

window.addEventListener('DOMContentLoaded', async () => {
  loadStateFromModule();
  state = moduleState;

  // Rendu immediat depuis les donnees locales : la vue ne doit jamais attendre le reseau.
  // La synchro cloud part en arriere-plan et re-declenche un rendu via 'stateUpdated'.
  renderCurrentView();
  restoreAIConfig();
  initKeyboardShortcuts();
  initRecipeFullscreenListeners();

  // Initialize swipe-to-close and overlay click for all modals
  ['modal-shopping-bulk', 'modal-paste-recipe', 'modal-recipe-to-cart', 'modal-recipe-detail', 'modal-api-config', 'modal-edit-emoji']
    .forEach(id => {
        initSwipeToClose(id);
        const overlay = document.getElementById(id);
        if (overlay) {
            overlay.addEventListener('click', e => {
                if (e.target === overlay) closeModal(id);
            });
        }
    });

  // Synchro cloud : moteur bidirectionnel (LOT 007). Le pull de demarrage part en
  // arriere-plan — l'ecran ne depend jamais du reseau (acquis LOT 005). Les
  // garde-fous d'empreinte (donnees locales + formulaire IA) qui vivaient ici sont
  // GENERALISES a tous les pulls, dans performSyncPull.
  initSyncEngine();
});

window.addEventListener('stateUpdated', () => {
    state = moduleState;
    renderCurrentView();
});

// ═══════════════════════════════════════════════════════════════════════════
// MOTEUR DE SYNCHRO BIDIRECTIONNELLE (LOT 007, spec v3)
//
// Restauration du `saveState(push = true)` du monolithe (l.4336-4340), perdu par
// la migration, avec les ameliorations VOLONTAIRES de la spec : temporisation 2 s,
// drapeau « EN ATTENTE » persiste, anti-boucle par reference « dernier document
// cloud connu », pulls periodiques, delai d'expiration et retry unique.
// Le perimetre du document vit dans src/services/firebase.js (SSOT, §4.1).
// ═══════════════════════════════════════════════════════════════════════════

const SYNC_PENDING_KEY = 'pantry_v5_sync_pending'; // drapeau persiste (§4.3) : couvre aussi le rechargement de page
const SYNC_LAST_KEY = 'pantry_v5_last_sync';       // metadonnee locale, HORS document (§4.1, audit Codex v2)
const SYNC_PUSH_DELAY_MS = 2000;
const SYNC_RETRY_DELAY_MS = 10000;
const SYNC_PULL_INTERVAL_MS = 60000;
const SYNC_STATUS_RESET_MS = 2000;

let _syncSendTimer = null;      // il n'existe JAMAIS qu'un timer d'envoi : debounce 2 s OU retry 10 s (§4.4)
let _syncRetryUsed = false;     // une seule nouvelle tentative par echec, puis arret (§4.7)
let _syncSendBlocked = false;   // apres un 4xx ou l'epuisement du retry : les cycles AUTOMATIQUES
                                // n'essaient plus d'envoyer (audit Sol, durcissement) — un geste,
                                // un clic manuel ou le retour reseau reautorisent l'envoi
let _syncInFlight = false;      // une seule operation a la fois (§4.4)
let _syncQueuedOp = null;       // une demande en attente, jamais accumulees (§4.4)
let _syncIdleWaiters = [];      // barriere de quiescence (contre-verif Sol C3) : resolus
                                // des que l'operation en vol se termine
let _syncDirtyGen = 0;          // generation de modification : ne jamais baisser le drapeau
                                // pour des changements survenus PENDANT l'envoi en vol
let _lastCloudDocJson = null;   // reference anti-boucle « dernier document cloud connu » (§4.5) —
                                // miroir memoire de LOCAL_STORAGE_SYNC_REF_KEY, PERSISTEE (audit
                                // Sol C1 : elle doit survivre au rechargement pour que le drapeau
                                // ne se leve que sur une VRAIE modification du document synchronise)
let _lastCloudHadIngredients = false; // pour le garde-fou sortant (§4.9.1)
let _syncStatusTimer = null;    // retour du voyant a l'etat neutre (annulable, contrairement a l'oracle)

function readSyncReference() {
    try { return localStorage.getItem(LOCAL_STORAGE_SYNC_REF_KEY); } catch { return null; }
}
function setSyncReference(docJson) {
    _lastCloudDocJson = docJson;
    try { localStorage.setItem(LOCAL_STORAGE_SYNC_REF_KEY, docJson); } catch { /* miroir memoire seulement */ }
}

// Le document synchronise tel qu'il serait envoye MAINTENANT (perimetre §4.1).
function currentSyncDocJson() {
    return JSON.stringify(buildSyncDocument(moduleState, Array.from(shoppingChecked)));
}

function isSyncPending() {
    try { return localStorage.getItem(SYNC_PENDING_KEY) === '1'; } catch { return false; }
}
function raiseSyncPending() {
    try { localStorage.setItem(SYNC_PENDING_KEY, '1'); } catch { /* stockage indisponible : drapeau memoire seulement */ }
}
function clearSyncPending() {
    try { localStorage.removeItem(SYNC_PENDING_KEY); } catch { /* idem */ }
}

// Champs libres du formulaire IA : enregistres seulement au clic « Sauvegarder ».
// Une saisie en cours ne doit jamais etre reecrite par le retour d'un pull (LOT 005).
const AI_FORM_FIELD_IDS = ['api-key-input', 'ai-exceptions', 'ai-exclusions'];
const aiFormFingerprint = () => JSON.stringify(
    AI_FORM_FIELD_IDS.map(id => document.getElementById(id)?.value ?? null)
);

/**
 * Voyant d'etat — porte du monolithe (l.4348-4368), classes CSS deja presentes
 * (.thinking/.success/.error, F7). Differences assumees par la spec (§4.8) :
 * libelles francais de la spec, etat « Hors ligne », timer de retour annulable
 * (l'oracle empilait les setTimeout), et l'erreur reste affichee (pas de retour
 * automatique : « voyant erreur persistant », §4.9).
 */
function setSyncStatus(status, message = null) {
    const indicators = [
        document.getElementById('sync-indicator-desktop'),
        document.getElementById('sync-indicator-mobile')
    ].filter(Boolean);

    const cssState = status === 'offline' ? 'error' : (status === 'idle' ? '' : status);
    indicators.forEach(el => {
        el.className = ('sync-indicator ' + cssState).trim();
        const label = el.querySelector('.sync-label');
        if (label) {
            if (status === 'thinking') label.textContent = 'Synchro…';
            else if (status === 'success') label.textContent = message || 'À jour ✓';
            else if (status === 'error') label.textContent = message || 'Échec — réessayer';
            else if (status === 'offline') label.textContent = 'Hors ligne';
            else label.textContent = 'Cloud Sync';
        }
    });

    clearTimeout(_syncStatusTimer);
    if (status === 'success') {
        _syncStatusTimer = setTimeout(() => setSyncStatus('idle'), SYNC_STATUS_RESET_MS);
    }
}

function recordSyncSuccess() {
    try { localStorage.setItem(SYNC_LAST_KEY, new Date().toISOString()); } catch { /* affichage seulement */ }
    updateSystemInfo();
}

/**
 * Inscrit dans saveState via registerSyncScheduler. Une modification pendant un
 * retry programme ANNULE le retry — un seul timer d'envoi, toujours (§4.4).
 *
 * CORRECTION AUDIT SOL (C1) : le drapeau « EN ATTENTE » ne represente QUE une
 * modification du DOCUMENT SYNCHRONISE. Une sauvegarde qui ne le change pas
 * (navigation, cle API, suggestion IA) ne leve ni drapeau ni timer — sinon un
 * simple changement d'ecran hors ligne forcait, au retour du reseau, l'envoi
 * d'un vieil inventaire PAR-DESSUS un cloud plus recent.
 */
function scheduleSyncPush() {
    if (currentSyncDocJson() === _lastCloudDocJson) {
        return; // rien de synchronise n'a change : le cloud n'a rien a recevoir
    }
    raiseSyncPending();
    _syncDirtyGen++;
    _syncRetryUsed = false;
    _syncSendBlocked = false; // une vraie modification reautorise l'envoi
    clearTimeout(_syncSendTimer);
    _syncSendTimer = setTimeout(() => {
        _syncSendTimer = null;
        requestSyncOp('send');
    }, SYNC_PUSH_DELAY_MS);
}

/**
 * Point d'entree unique des operations : UNE seule a la fois. Une demande arrivant
 * pendant une operation en vol est mise en attente (une seule case, jamais
 * accumulees) et executee apres ; un clic manuel n'est jamais retrograde (§4.4).
 */
async function requestSyncOp(op) {
    if (_syncInFlight) {
        if (_syncQueuedOp !== 'manual') _syncQueuedOp = op;
        return;
    }
    _syncInFlight = true;
    try {
        if (op === 'send') {
            await performSyncSend();
        } else if (op === 'pull') {
            // §4.4 : drapeau leve → ENVOI D'ABORD, recuperation seulement si l'envoi
            // a reussi — jamais de pull destructif par-dessus des modifs non envoyees.
            if (isSyncPending()) {
                // Envoi bloque (4xx, retry epuise) : un cycle AUTOMATIQUE ne retente
                // pas — sinon le pull periodique devenait un retry toutes les 60 s
                // (audit Sol). Le pull est aussi abandonne : il ne pourrait de toute
                // facon pas etre applique par-dessus des modifs non envoyees.
                if (_syncSendBlocked) return;
                const sent = await performSyncSend();
                if (!sent) return;
            }
            await performSyncPull({ manual: false });
        } else if (op === 'manual') {
            // Clic « Cloud Sync » : recuperation PUIS envoi, immediatement (§4.4) —
            // precede d'un envoi si des modifications attendent (meme regle que pull).
            // Un clic manuel est un GESTE : il reautorise toujours l'envoi.
            _syncSendBlocked = false;
            if (isSyncPending()) {
                const sent = await performSyncSend({ manual: true });
                if (!sent) return;
            }
            const pulled = await performSyncPull({ manual: true });
            if (pulled) await performSyncSend({ manual: true, quiet: true });
        }
    } finally {
        _syncInFlight = false;
        const queued = _syncQueuedOp;
        _syncQueuedOp = null;
        while (_syncIdleWaiters.length) _syncIdleWaiters.shift()();
        if (queued) requestSyncOp(queued);
    }
}

/**
 * Barriere de quiescence (contre-verification d'audit Sol, C3), inscrite via
 * registerSyncBarrier : annule tout envoi temporise, vide la file, et attend la
 * fin de l'operation en vol. Garantit qu'aucun PUT du moteur ANTERIEUR a un
 * chemin explicite (reset) ne peut ecrire APRES le PUT de ce chemin.
 */
function syncEngineBarrier() {
    clearTimeout(_syncSendTimer);
    _syncSendTimer = null;
    _syncQueuedOp = null;
    if (!_syncInFlight) return Promise.resolve();
    return new Promise(resolve => _syncIdleWaiters.push(resolve));
}

/**
 * ENVOI (§4.3). Retourne true si le cloud est a jour (envoi reussi ou rien a envoyer).
 */
async function performSyncSend({ manual = false, quiet = false } = {}) {
    const checkedIds = Array.from(shoppingChecked);
    const doc = buildSyncDocument(moduleState, checkedIds);
    const genAtBuild = _syncDirtyGen;

    // GARDE-FOU SORTANT (§4.9.1) : jamais d'envoi d'un etat non exploitable. Un
    // document invalide n'a rien de valide a proteger : drapeau BAISSE, sinon il
    // bloquerait les pulls et verrouillerait l'appareil a jamais (constat Flash).
    // La vidange volontaire (reinitialisation, LOT 008) passe par syncPush directement.
    if (!Array.isArray(doc.ingredients) || (doc.ingredients.length === 0 && _lastCloudHadIngredients)) {
        clearSyncPending();
        setSyncStatus('error');
        toast('Synchro refusée : inventaire local vide ou illisible — le cloud est protégé', 'error');
        return false;
    }

    // ANTI-BOUCLE (§4.5) : identique au dernier document cloud connu → rien a faire,
    // abandon AVANT la requete reseau. La reference est mise a jour a chaque envoi
    // reussi ET a chaque pull applique.
    const docJson = JSON.stringify(doc);
    if (docJson === _lastCloudDocJson) {
        if (_syncDirtyGen === genAtBuild) clearSyncPending();
        if (manual && !quiet) toast('Déjà à jour ✓');
        return true;
    }

    setSyncStatus('thinking');
    try {
        await syncPush(moduleState, checkedIds);
        setSyncReference(docJson);
        _lastCloudHadIngredients = doc.ingredients.length > 0;
        // Ne baisser le drapeau que si RIEN n'a change pendant le vol de la requete :
        // une modification pendant l'envoi doit rester protegee jusqu'a SON envoi.
        if (_syncDirtyGen === genAtBuild) clearSyncPending();
        _syncRetryUsed = false;
        recordSyncSuccess();
        setSyncStatus('success');
        if (manual && !quiet) toast('Données envoyées au cloud ✓');
        return true;
    } catch (e) {
        console.error('[Sync] Envoi échoué', e);
        const status = e && e.status;
        if (status >= 400 && status < 500) {
            // REFUS SERVEUR 4xx (§4.9) : les donnees locales sont VALIDES et jamais
            // parties — drapeau MAINTENU (aucun pull ne les ecrasera), AUCUN retry
            // automatique, cycles automatiques suspendus (audit Sol). Toute nouvelle
            // modification, un clic manuel ou le retour reseau retenteront.
            _syncSendBlocked = true;
            setSyncStatus('error');
            toast('Envoi refusé par le serveur — vos données restent protégées sur cet appareil', 'error');
        } else if (!_syncRetryUsed) {
            // ECHEC RECUPERABLE (reseau, delai, 5xx) : drapeau maintenu, UNE seule
            // nouvelle tentative a 10 s (§4.7).
            _syncRetryUsed = true;
            setSyncStatus('error');
            if (manual) toast('Envoi impossible — nouvelle tentative dans 10 s', 'error');
            clearTimeout(_syncSendTimer);
            _syncSendTimer = setTimeout(() => {
                _syncSendTimer = null;
                requestSyncOp('send');
            }, SYNC_RETRY_DELAY_MS);
        } else {
            // Retry unique epuise : arret des tentatives AUTOMATIQUES (§4.7 tenu
            // meme avec les pulls periodiques actifs — audit Sol, durcissement).
            _syncSendBlocked = true;
            setSyncStatus('error');
            toast('Synchronisation impossible — vos données restent sur cet appareil', 'error');
        }
        return false;
    }
}

/**
 * RECUPERATION (§4.3). Retourne true si le pull s'est conclu sans echec reseau
 * (y compris « base vide » et « photo ecartee », qui ne sont pas des erreurs).
 */
async function performSyncPull({ manual = false } = {}) {
    // GARDE-FOU D'EMPREINTE (LOT 005, generalise du demarrage a TOUS les pulls) :
    // la reponse du cloud est une photo prise AVANT les gestes faits pendant
    // l'attente reseau. Si les donnees locales ont bouge entre l'envoi de la
    // requete et sa reponse, la photo est ecartee — les donnees locales sont plus
    // recentes, par construction. Le drapeau (leve par ces gestes) enverra ensuite.
    // CORRECTION AUDIT SOL (C2) : l'empreinte couvre le document synchronise
    // ENTIER (perimetre §4.1, reglages IA compris) — l'ancienne, limitee aux
    // quatre tableaux + coches, laissait un reglage de creativite modifie pendant
    // le vol se faire ecraser par la photo cloud, puis passer pour « deja envoye ».
    const fingerprintBefore = currentSyncDocJson();
    const aiFormBefore = aiFormFingerprint();

    setSyncStatus('thinking');
    try {
        const cloudDoc = await syncPull();

        if (!cloudDoc) {
            // Base vide : rien a appliquer, ce n'est pas une erreur (§4.3).
            setSyncStatus('idle');
            if (manual) toast('Aucune donnée dans le cloud', 'error');
            return true;
        }
        if (!Array.isArray(cloudDoc.ingredients)) {
            // GARDE-FOU ENTRANT (§4.9.2) : document malforme ignore, erreur discrete.
            console.warn('[Sync] Document cloud malformé : ignoré, rien n\'est modifié.');
            setSyncStatus('error');
            if (manual) toast('Données cloud illisibles — rien n\'a été modifié', 'error');
            return false;
        }
        if (currentSyncDocJson() !== fingerprintBefore) {
            console.warn('[Sync] Modifications locales pendant la récupération : '
                + 'données cloud écartées (aucune perte locale).');
            setSyncStatus('idle');
            return true;
        }

        // Application CLE PAR CLE du perimetre (§4.3) — cle API locale preservee
        // sans condition (§4.6), coches reconstruites en Set AVANT le rendu.
        const { patch, checkedIds } = extractSyncedState(cloudDoc);
        replaceShoppingChecked(checkedIds);
        applyExternalState(patch, { scheduleSync: false }); // issue de la synchro : ne replanifie JAMAIS d'envoi (§4.5)
        state = moduleState;

        // Reference anti-boucle = le document tel qu'il existe LOCALEMENT apres
        // application (sanitisation comprise) : ainsi une simple sauvegarde d'un
        // champ NON synchronise redonne exactement ce document → aucun envoi (§4.5).
        setSyncReference(currentSyncDocJson());
        _lastCloudHadIngredients = (moduleState.ingredients || []).length > 0;

        recordSyncSuccess();
        setSyncStatus('success');

        // Ne pas reecrire une saisie en cours dans le formulaire de config IA.
        if (aiFormFingerprint() === aiFormBefore) {
            restoreAIConfig();
        } else {
            console.warn('[Sync] Saisie en cours dans la configuration IA : champs non réécrits.');
        }
        if (manual) toast('☁️ Données chargées du Cloud');
        return true;
    } catch (e) {
        console.error('[Sync] Récupération échouée', e);
        setSyncStatus('error');
        if (manual) toast('Synchronisation impossible', 'error');
        return false;
    }
}

function updateNetworkInfo() {
    const netEl = document.getElementById('info-network');
    if (netEl) netEl.textContent = navigator.onLine ? '🌐 Connecté' : '🚫 Hors-ligne';
}

/**
 * Demarrage du moteur (§4.4) : inscription dans saveState, ecouteurs reseau et
 * visibilite, pull periodique, puis recuperation initiale — qui ENVOIE D'ABORD
 * si le drapeau persiste est leve (modifications faites juste avant une fermeture).
 */
function initSyncEngine() {
    registerSyncScheduler(scheduleSyncPush);
    registerSyncBarrier(syncEngineBarrier);

    // La reference « dernier cloud connu » survit au rechargement (audit Sol C1) :
    // sans elle, toute sauvegarde d'un demarrage hors ligne (meme une simple
    // navigation) passait pour une modification a envoyer.
    _lastCloudDocJson = readSyncReference();

    // AMORCAGE (contre-verification Sol, C1) : reference ABSENTE = premiere
    // execution de cette version. Elle devient l'etat local TEL QUEL : ainsi une
    // sauvegarde qui ne change rien (navigation) ne passe JAMAIS pour une
    // modification a envoyer — seul un vrai geste posterieur levera le drapeau.
    // EXCEPTION : drapeau deja leve = des modifications attendent reellement leur
    // envoi ; on n'amorce pas, sinon elles passeraient pour « deja envoyees » et
    // seraient ecrasees par le premier pull (garantie du drapeau persiste, §4.3).
    if (_lastCloudDocJson === null && !isSyncPending()) {
        setSyncReference(currentSyncDocJson());
    }

    // Etat reseau affiche DES le demarrage (§4.4), pas au premier evenement.
    updateNetworkInfo();
    if (!navigator.onLine) setSyncStatus('offline');

    window.addEventListener('online', () => {
        updateNetworkInfo();
        setSyncStatus('idle');
        // Un retry programme est ANNULE et absorbe par ce cycle (§4.4) : jamais
        // deux envois pour la meme cause. Le pull enverra d'abord si necessaire.
        // Le retour du reseau est une cause NOUVELLE : il reautorise l'envoi.
        _syncSendBlocked = false;
        clearTimeout(_syncSendTimer);
        _syncSendTimer = null;
        requestSyncOp('pull');
    });
    window.addEventListener('offline', () => {
        updateNetworkInfo();
        setSyncStatus('offline');
    });

    // Retour sur l'application (§4.4).
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && navigator.onLine) requestSyncOp('pull');
    });

    // Recuperation periodique, application visible et en ligne seulement (§4.4).
    setInterval(() => {
        if (document.visibilityState === 'visible' && navigator.onLine) requestSyncOp('pull');
    }, SYNC_PULL_INTERVAL_MS);

    // Pas de pull initial hors ligne (audit Sol, benin) : son echec assure
    // remplacait le voyant « Hors ligne » par « Échec — réessayer ». L'ecouteur
    // `online` declenchera la recuperation au retour du reseau.
    if (navigator.onLine) requestSyncOp('pull');
}

/**
 * Remise a zero complete du moteur — reserve aux tests unitaires
 * (tests/sync-engine.test.js) : le moteur est un singleton de module.
 */
function __resetSyncEngineForTests() {
    clearTimeout(_syncSendTimer);
    _syncSendTimer = null;
    clearTimeout(_syncStatusTimer);
    _syncStatusTimer = null;
    _syncRetryUsed = false;
    _syncSendBlocked = false;
    _syncInFlight = false;
    _syncQueuedOp = null;
    _syncIdleWaiters = [];
    _syncDirtyGen = 0;
    _lastCloudDocJson = null;
    _lastCloudHadIngredients = false;
    try { localStorage.removeItem(LOCAL_STORAGE_SYNC_REF_KEY); } catch { /* tests */ }
    clearSyncPending();
}

// Exportes UNIQUEMENT pour les tests unitaires : index.html charge ce fichier en
// module, ces exports sont sans effet a l'execution dans le navigateur.
export {
    initSyncEngine,
    scheduleSyncPush,
    requestSyncOp,
    performSyncSend,
    performSyncPull,
    setSyncStatus,
    isSyncPending,
    syncEngineBarrier,
    __resetSyncEngineForTests,
    // LOT 009 — exportés uniquement pour les tests unitaires (mêmes raisons qu'au-dessus).
    openEditEmoji,
    buildEmojiEditSuggestions,
    applyEditedEmoji,
    updateSystemInfo,
    initSwipeToClose
};

function renderCurrentView() {
    const view = state.currentView || 'pantry';
    // Show the correct view panel, hide all others
    const viewMap = { pantry: 'pantry', shopping: 'shopping', ai: 'ai', fav: 'favorites', favorites: 'favorites', add: 'add', export: 'export', settings: 'export' };
    const activePanel = viewMap[view] || view;
    document.querySelectorAll('.view-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === `view-${activePanel}`);
    });

    renderTopbar(view);
    updateBadges();
    updateApiStatus();

    if (view === 'pantry') renderPantry();
    else if (view === 'shopping') renderShopping();
    else if (view === 'ai') { renderAI(); renderExtraChips(); }
    else if (view === 'fav' || view === 'favorites') renderFavorites();
    else if (view === 'add') renderAdd();
    else if (view === 'export' || view === 'settings') updateSystemInfo();

    document.getElementById('fab-add')?.classList.toggle('hidden', view !== 'pantry');
    document.querySelectorAll('.sb-item, .bn-item').forEach(el => {
        el.classList.toggle('active', el.dataset.view === view || (view === 'favorites' && el.dataset.view === 'favorites'));
    });
}

// toast function moved to dom.js

function switchView(view) {
    if (view === 'add') _isManualCategory = false;
    state.currentView = view;
    saveState();
}

/**
 * Compte stock et panier en UNE seule passe sur l'inventaire.
 * Ces deux compteurs etaient recalcules par 4 `filter()` distincts a chaque rendu.
 */
function countStockAndCart() {
    let stock = 0, cart = 0;
    for (const i of state.ingredients) {
        if (i.inStock) stock++;
        if (i.inCart) cart++;
    }
    return { stock, cart };
}

function renderTopbar(view) {
    const titles = {
        pantry: 'Inventaire', 
        shopping: 'Mes Courses', 
        ai: 'Recettes IA', 
        fav: 'Favoris', 
        favorites: 'Favoris',
        add: 'Ajouter un ingrédient', 
        export: 'Réglages',
        settings: 'Réglages'
    };
    const subs = {
        pantry: () => countStockAndCart().stock + ' articles en stock',
        shopping: () => countStockAndCart().cart + ' articles à acheter'
    };

    // Desktop topbar
    const titleEl = document.getElementById('topbar-title');
    if (titleEl) {
        titleEl.textContent = titles[view] || view;
        if (subs[view]) {
            const span = h('span', { id: 'topbar-sub', style: { fontSize: '13px', color: 'var(--txt-soft)', marginLeft: '8px', fontWeight: '400' } }, subs[view]());
            titleEl.appendChild(span);
        }
    }

    // Render action buttons for pantry view (handled by renderPantry itself)
    const actionEl = document.getElementById('top-action-btn');
    if (actionEl) actionEl.replaceChildren();
}

function renderPantryFilters() {
    const filterEl = document.getElementById('pantry-filters');
    if (!filterEl) return;

    // Toggles indépendants (combinables avec la catégorie)
    const toggles = [
        { key: 'showInStockOnly', label: 'En-Stock',      emoji: '☑ ', cls: 'stock',  onclick: () => toggleSpecialFilter('showInStockOnly') },
        { key: 'showInCartOnly',  label: 'Liste courses', emoji: '🛒 ', cls: 'terra', onclick: () => toggleSpecialFilter('showInCartOnly') },
    ];

    // Filtres exclusifs (remplacent la catégorie)
    const exclusifs = [
        { val: 'pinned', label: 'Épinglés', emoji: '⭐ ', cls: 'gold' },
        { val: 'frozen', label: 'Surgelés', emoji: '❄️ ', cls: '' },
    ];

    const chips = [
        // "Tous" — remet tout à zéro
        h('div', {
            class: `chip ${state.filter === 'all' && !state.showInStockOnly && !state.showInCartOnly ? 'active' : ''}`,
            onclick: () => resetFilters()
        }, 'Tous'),

        // Toggles combinables
        ...toggles.map(t => h('div', {
            class: `chip ${t.cls} ${state[t.key] ? 'active' : ''}`,
            onclick: t.onclick
        }, `${t.emoji}${t.label}`)),

        // Filtres exclusifs
        ...exclusifs.map(s => h('div', {
            class: `chip ${s.cls} ${state.filter === s.val ? 'active' : ''}`,
            onclick: () => setFilter(s.val)
        }, `${s.emoji}${s.label}`)),

        // Catégories
        ...CATEGORIES.map(cat => h('div', {
            class: `chip ${state.filter === cat ? 'active' : ''}`,
            onclick: () => setFilter(cat)
        }, `${getCategoryEmoji(cat)} ${cat}`))
    ];

    filterEl.replaceChildren(...chips);
}

function renderPantry() {
    renderPantryFilters();
    renderPantryGrid(
        document.getElementById('ing-grid'),
        document.getElementById('ing-empty'),
        getFilteredIngredients(),
        { toggleStock, togglePin, toggleCart, deleteIngredient, openEditEmoji }
    );
}

function renderShopping() {
    renderShoppingList(
        document.getElementById('shopping-scroll'),
        state.ingredients.filter(i => i.inCart),
        shoppingChecked,
        { toggleShoppingCheck, removeFromCart }
    );
}

function getFilteredIngredients() {
    let list = [...state.ingredients];

    // 1. Toggles indépendants (cumulatifs)
    if (state.showInStockOnly) list = list.filter(i => i.inStock);
    if (state.showInCartOnly)  list = list.filter(i => i.inCart);

    // 2. Filtre de catégorie ou filtre exclusif
    if (state.filter === 'pinned') list = list.filter(i => i.pinned);
    else if (state.filter === 'frozen') list = list.filter(i => i.frozen);
    else if (state.filter && state.filter !== 'all') {
        list = list.filter(i => i.category === state.filter);
    }

    // 3. Recherche texte
    if (state.search) {
        const s = normalizeString(state.search);
        list = list.filter(i => normalizeString(i.name).includes(s));
    }
    return list;
}

// Le filtrage normalise chaque nom d'ingredient : trop couteux a chaque touche frappee.
const _renderPantryDebounced = debounce(() => renderPantry(), 200);

// Deux barres de recherche coexistent : celle du bureau et celle du mobile.
const SEARCH_INPUT_IDS = ['search-input', 'mobile-search'];
const SEARCH_CLEAR_IDS = ['clear-search-desktop', 'clear-search-mobile'];

/** Affiche la croix d'effacement uniquement quand une recherche est en cours. */
function updateSearchClearButtons() {
    const hasQuery = !!state.search;
    SEARCH_CLEAR_IDS.forEach(id => {
        document.getElementById(id)?.classList.toggle('visible', hasQuery);
    });
}

function handleSearch(val) {
    state.search = val;
    updateSearchClearButtons();
    _renderPantryDebounced();
}

function clearSearch() {
    state.search = '';
    SEARCH_INPUT_IDS.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    updateSearchClearButtons();
    _renderPantryDebounced.cancel();
    renderPantry();
}

function setFilter(f) {
    state.filter = f;
    renderPantry();
}

function toggleSpecialFilter(key) {
    state[key] = !state[key];
    // Si on active un toggle, désactiver l'autre pour la cohérence panier/stock
    renderPantry();
}

function resetFilters() {
    state.filter = 'all';
    state.showInStockOnly = false;
    state.showInCartOnly = false;
    renderPantry();
}

async function generateSuggestions() {
  const apiKey = state.aiConfig.apiKey;
  if (!apiKey) { toast('Clé API Gemini requise', 'error'); openModal('modal-api-config'); return; }
  const stockItems = state.ingredients.filter(i => i.inStock);
  if (stockItems.length === 0) { toast('Inventaire vide', 'error'); return; }

  const btn = document.getElementById('generate-btn');
  btn.disabled = true;
  btn.classList.add('loading');

  try {
    const recipes = await generateRecipes(apiKey, stockItems, state.aiConfig, state.ingredients, state.extraIngredients);
    state.aiSuggestions = recipes;
    // renderAIResults(recipes); // No need, saveState() will trigger auto-render
    saveState();
  } catch (e) {
    toast('Erreur IA : ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.classList.remove('loading');
  }
}

function renderAI() {
    restoreAIConfig();
    if (state.aiSuggestions && state.aiSuggestions.length > 0) {
        renderAIResults(state.aiSuggestions);
    }
}

function renderAIResults(recipes) {
    const grid = document.getElementById('ai-results-list');
    if (!grid) return;
    grid.replaceChildren(...recipes.map((r, i) => renderRecipeCard(r, i, { openRecipeDetail })));
    document.getElementById('ai-placeholder')?.classList.add('hidden');
    document.getElementById('ai-results-list')?.classList.remove('hidden');
}

function restoreAIConfig() {
    const cfg = state.aiConfig;
    const apiKeyInput = document.getElementById('api-key-input');
    if (apiKeyInput) apiKeyInput.value = cfg.apiKey || '';
    
    document.getElementById('ai-exceptions') && (document.getElementById('ai-exceptions').value = cfg.exceptions || '');
    document.getElementById('ai-exclusions') && (document.getElementById('ai-exclusions').value = cfg.exclusions || '');

    // Slider de créativité (LOT 008, chantier 6) : ?? plutôt que || pour ne pas
    // écraser une créativité volontairement réglée à 0 (minimum légitime du slider).
    const creativitySlider = document.getElementById('creativity-slider');
    if (creativitySlider) creativitySlider.value = cfg.creativity ?? 50;

    // Restore chips active state
    document.querySelectorAll('.ai-settings .chip').forEach(chip => {
        const field = chip.closest('.chips-row').id?.replace('ai-', '').replace('-chips', '');
        if (field && cfg[field]) {
            if (Array.isArray(cfg[field])) {
                chip.classList.toggle('active', cfg[field].includes(chip.dataset.val));
            } else {
                chip.classList.toggle('active', cfg[field] === chip.dataset.val);
            }
        }
    });

    updateAiCtaSummary();
}

function updateAiCtaSummary() {
    const summaryEl = document.getElementById('ai-cta-summary');
    if (summaryEl) {
        summaryEl.textContent = `${state.aiConfig.meal || 'Plat'} · ${state.aiConfig.ppl || '2'} pers.`;
    }
}

function toggleAiSingle(field, el) {
    el.closest('.chips-row').querySelectorAll('.chip')
      .forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    state.aiConfig[field] = el.dataset.val;
    saveState(false);
    updateAiCtaSummary();
}

function toggleAiChip(field, el) {
    el.classList.toggle('active');
    const active = Array.from(el.closest('.chips-row').querySelectorAll('.chip.active'))
        .map(c => c.dataset.val);
    state.aiConfig[field] = active;
    saveState(false);
}

function saveAiConfigFromUI() {
    state.aiConfig.exceptions = document.getElementById('ai-exceptions')?.value || '';
    state.aiConfig.exclusions = document.getElementById('ai-exclusions')?.value || '';
    state.aiConfig.creativity = parseInt(document.getElementById('creativity-slider')?.value || '50');
    saveState(false);
}

let _currentPickerData = [];
let _currentPickerRecipeName = '';

function openRecipeDetail(idx, source = 'ai') {
    let r = null;
    let favId = null;
    if (source === 'ai') {
        r = state.aiSuggestions[idx];
    } else if (source === 'fav') {
        const fav = state.favorites.find(f => f.id === idx);
        if (fav) {
            r = fav.recipe || fav;
            favId = fav.id;
        }
    }
    
    if (!r) return;

    const modal = document.getElementById('modal-recipe-detail');
    modal.replaceChildren(renderRecipeDetail(r, source, {
        closeModal,
        toggleRecipeFullscreen,
        changePplScale,
        saveSuggestionToFav: () => saveSuggestionToFavDirect(r),
        addSuggestionToCart: () => openEnhancedCartPicker(r),
        saveRecipeOnly: () => saveRecipeOnly(r),
        saveRecipeAndList: () => saveRecipeAndList(r),
        deleteFav: () => deleteFav(favId),
        analyzeNutrition: () => analyzeNutrition(r, source, favId),
        printRecipe: () => printRecipe()
    }));
    openModal('modal-recipe-detail');
}

async function analyzeNutrition(r, source, favId) {
    if (!r || !r.ingredients) return;
    const apiKey = state.aiConfig.apiKey;
    if (!apiKey) { toast("Clé API requise pour l'analyse", 'error'); return; }

    const btn = document.getElementById('rd-nutri-btn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Analyse...';
    }

    try {
        const ingList = (r.ingredients || []).map(i => (i.q || i.amount || '') + ' ' + (i.n || i.name)).join(', ');
        const prompt = `Tu es un nutritionniste expert. Analyse cette recette:\nNom: ${r.name}\nIngrédients: ${ingList}\nInstructions: ${(r.steps || r.instructions || []).join(' ')}\n\nEstime le Nutri-Score (A à E) et le nombre de kilocalories (kcal) pour UNE portion (la recette est pour ${r.people || r.ppl || 1} pers.), et propose 2 tags courts. Réponds UNIQUEMENT en JSON: {"score": "A", "kcal": 450, "tags": ["Sain", "Léger"]}`;

        const model = state.aiConfig.models?.nutrition || AI_ROLES.REASONING;
        const raw = await callAI(prompt, apiKey, model, { isJSON: false, temperature: 0.1 });
        const match = raw.match(/\{[\s\S]*?\}/);
        if (!match) throw new Error("Réponse IA invalide");
        
        const nutrition = JSON.parse(match[0]);
        r.nutrition = nutrition;
        
        saveState();
        // Refresh modal
        const modal = document.getElementById('modal-recipe-detail');
        if (modal) {
            modal.replaceChildren(renderRecipeDetail(r, source, {
                closeModal,
                toggleRecipeFullscreen,
                changePplScale,
                saveSuggestionToFav: () => saveSuggestionToFavDirect(r),
                addSuggestionToCart: () => openEnhancedCartPicker(r),
                saveRecipeOnly: () => saveRecipeOnly(r),
                saveRecipeAndList: () => saveRecipeAndList(r),
                deleteFav: () => deleteFav(source === 'fav' ? favId : r.id),
                analyzeNutrition: () => analyzeNutrition(r, source, favId),
                printRecipe: () => printRecipe()
            }));
        }
        toast('Analyse nutritionnelle terminée !');
    } catch (e) {
        console.error(e);
        toast("Erreur analyse nutrition", 'error');
        if (btn) {
            btn.disabled = false;
            btn.textContent = '✨ Analyse Nutri';
        }
    }
}

/**
 * Vrai plein écran d'appareil (LOT 009, casse C6) : la classe CSS
 * `recipe-fullscreen` assure le repli visuel même si l'API navigateur refuse
 * (contexte non interactif, permission absente) — la classe est posée AVANT
 * l'appel API et ne dépend jamais de sa réussite.
 */
function isDocumentFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement ||
        document.mozFullScreenElement || document.msFullscreenElement);
}

function requestElementFullscreen(el) {
    const request = el.requestFullscreen || el.webkitRequestFullscreen ||
        el.mozRequestFullScreen || el.msRequestFullscreen;
    if (!request) return Promise.reject(new Error('Fullscreen API indisponible'));
    return request.call(el);
}

function exitDocumentFullscreen() {
    const exit = document.exitFullscreen || document.webkitExitFullscreen ||
        document.mozCancelFullScreen || document.msExitFullscreen;
    if (!exit) return Promise.resolve();
    return exit.call(document);
}

function toggleRecipeFullscreen(id) {
    const el = typeof id === 'string' ? document.getElementById(id) : id;
    if (!el) return;
    if (el.classList.contains('recipe-fullscreen')) {
        if (isDocumentFullscreen()) exitDocumentFullscreen().catch(() => {});
        else el.classList.remove('recipe-fullscreen');
    } else {
        el.classList.add('recipe-fullscreen');
        requestElementFullscreen(el).catch(() => { /* repli CSS pur, cf. commentaire ci-dessus */ });
    }
}

// Resynchronise la classe si l'utilisateur sort par Échap ou un geste système —
// les 4 variantes préfixées de l'évènement (oracle l.5457-5464).
function syncRecipeFullscreenClass() {
    const el = document.getElementById('modal-recipe-detail');
    if (el && !isDocumentFullscreen()) el.classList.remove('recipe-fullscreen');
}

function initRecipeFullscreenListeners() {
    ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange']
        .forEach(evt => document.addEventListener(evt, syncRecipeFullscreenClass));
}

function changePplScale(delta) {
    const pplEl = document.getElementById('rd-ppl-count');
    if (!pplEl) return;
    let val = parseInt(pplEl.textContent);
    val = Math.max(1, val + delta);
    pplEl.textContent = val;
    // Note: Quantitative scaling logic could be added here if needed
}

/**
 * Confronte un ingrédient de recette à l'inventaire.
 *
 * Deux sources d'information, par ordre de fiabilité :
 *  1. le statut `s` renvoyé par l'IA (`stock` | `pinned` | `missing`), qui n'est
 *     présent que pour les recettes générées, pas pour celles collées à la main ;
 *  2. à défaut, l'inventaire réel, via `areSimilar` — le comparateur déjà utilisé
 *     pour la détection de doublons et l'ajout d'ingrédients.
 *
 * @returns {{inStock: boolean, matchedName: string|null, isExact: boolean}}
 */
function matchIngredientToStock(ingredient) {
    const name = ingredient.n || ingredient.name || '';
    const aiStatus = ingredient.s;

    const inventoryMatch = state.ingredients.find(i => areSimilar(name, i.name));
    const isExact = !!inventoryMatch
        && normalizeString(inventoryMatch.name) === normalizeString(name);

    // L'IA annonce l'ingrédient comme déjà possédé : on la croit, mais on affiche
    // quand même à quoi il correspond dans l'inventaire si on le retrouve.
    if (aiStatus === 'stock' || aiStatus === 'pinned') {
        return { inStock: true, matchedName: inventoryMatch?.name || null, isExact };
    }
    if (aiStatus === 'missing') {
        return { inStock: false, matchedName: inventoryMatch?.name || null, isExact };
    }

    return {
        inStock: !!inventoryMatch?.inStock,
        matchedName: inventoryMatch?.name || null,
        isExact
    };
}

function openEnhancedCartPicker(recipe) {
    closeModal('modal-recipe-detail');
    _currentPickerRecipeName = recipe.name || 'Recette';
    _currentPickerData = (recipe.ingredients || []).map(i => {
        const name = i.n || i.name;
        const category = i.c || i.category || 'Autres';
        const status = matchIngredientToStock(i);
        return {
            name,
            category,
            // Emoji : celui de l'IA, sinon celui de la base d'ingredients,
            // sinon celui de la categorie.
            emoji: i.e || i.emoji || autoEmoji(name, DEFAULT_DB, getCategoryEmoji(category)),
            isMissing: !status.inStock,
            matchedName: status.matchedName,
            isExact: status.isExact
        };
    });

    const listEl = document.getElementById('modal-recipe-cart-list');
    if (listEl) {
        listEl.replaceChildren(..._currentPickerData.map((it, idx) => {
            // Coche par defaut ce qui manque uniquement : ce que Joel a deja en stock
            // n'a pas a retourner dans la liste de courses.
            const checked = it.isMissing;
            // Correspondance approximative (ex. « Tomates cerises » vs « Tomate ») :
            // signalee visuellement, car la deduction peut se tromper.
            const softMatch = !!it.matchedName && !it.isExact;

            const labelChildren = [h('div', {}, [it.emoji + ' ', it.name])];
            if (it.matchedName) {
                labelChildren.push(h('div', { class: 'picker-match-info' },
                    it.isMissing
                        ? `Correspond à « ${it.matchedName} », pas en stock`
                        : `Déjà en stock : « ${it.matchedName} »`));
            }

            return h('div', {
                class: `picker-item ${checked ? 'checked' : ''} ${softMatch ? 'soft-match' : ''}`,
                id: `pitem-${idx}`
            }, [
                h('input', {
                    type: 'checkbox',
                    checked,
                    id: `pick-${idx}`,
                    onchange: () => updatePickerRow(idx)
                }),
                h('label', { for: `pick-${idx}`, style: { cursor: 'pointer', flex: 1, marginLeft: '8px' } }, labelChildren),
                it.isMissing ? null : h('span', { class: 'picker-badge' }, 'En stock')
            ].filter(Boolean));
        }));
    }

    // La case maitresse reflete l'etat reel des lignes plutot que de rester cochee.
    const selectAll = document.getElementById('picker-select-all');
    if (selectAll) selectAll.checked = _currentPickerData.every(it => it.isMissing);

    openModal('modal-recipe-to-cart');
}

function confirmRecipeToCart() {
    const list = document.getElementById('modal-recipe-cart-list');
    if (!list) return;
    const checks = list.querySelectorAll('input[type="checkbox"]');
    checks.forEach((chk, i) => {
        if (chk.checked) {
            const it = _currentPickerData[i];
            const existing = state.ingredients.find(ing => areSimilar(ing.name, it.name));
            if (existing) {
                existing.inCart = true;
                existing.shoppingSource = _currentPickerRecipeName;
            } else {
                const id = generateId('ing');
                state.ingredients.push({ 
                    ...it, id, 
                    inStock: false, inCart: true, 
                    shoppingSource: _currentPickerRecipeName 
                });
            }
        }
    });
    saveState();
    closeModal('modal-recipe-to-cart');
    toast('Course ajoutée !');
}

function renderFavorites() {
    const el = document.getElementById('fav-list');
    if (!el) return;
    if (!state.favorites || state.favorites.length === 0) {
        el.replaceChildren(h('div', { class: 'fav-empty' }, 'Aucun favori'));
        return;
    }
    // We pass fav.recipe because renderRecipeCard expects a recipe object
    // and we use fav.id (the favorite entry ID) for identification
    el.replaceChildren(...state.favorites.map(fav => {
        const r = fav.recipe || fav; // Fallback if data is flat
        return renderRecipeCard(r, fav.id, { 
            openRecipeDetail: (id) => openRecipeDetail(id, 'fav') 
        });
    }));
}

function deleteFav(id) {
    state.favorites = state.favorites.filter(f => f.id !== id);
    // saveState() emet 'stateUpdated', qui relance deja renderCurrentView() : pas de rendu manuel.
    saveState();
    toast('Recette supprimée');
}

function saveSuggestionToFavDirect(r) {
    if (!r) return;
    state.favorites.push({ ...r, id: generateId('fav') });
    saveState();
    toast('Ajouté aux favoris !');
}

function saveRecipeOnly(r) {
    if (!r) return;
    state.favorites.push({ ...r, id: generateId('fav') });
    saveState();
    toast('Recette sauvegardée !');
    closeModal('modal-paste-recipe');
}

function saveRecipeAndList(r) {
    if (!r) return;
    saveRecipeOnly(r);
    openEnhancedCartPicker(r);
}

/**
 * Regroupe des ingredients par categorie en UNE passe, categories triees alphabetiquement.
 * Remplace le balayage complet de l'inventaire repete pour chaque categorie.
 * @returns {Array<[string, Array]>} paires [categorie, ingredients] triees.
 */
function groupByCategory(ingredients) {
    const grouped = new Map();
    for (const i of ingredients) {
        if (!grouped.has(i.category)) grouped.set(i.category, []);
        grouped.get(i.category).push(i);
    }
    // Tri par defaut volontaire (et non localeCompare) : conserve a l'identique
    // l'ordre des rubriques dans le texte exporte.
    return [...grouped.keys()].sort().map(cat => [cat, grouped.get(cat)]);
}

async function exportClipboard(type) {
    let text = '';
    const date = new Date().toLocaleDateString('fr-FR');

    if (type === 'simple') {
        text = `🛒 LISTE DE COURSES (${date})\n\n`;
        const items = state.ingredients.filter(i => i.inCart);
        if (items.length === 0) { text += "(Vide)"; }
        else {
            items.forEach(i => {
                text += `${i.emoji || '🔸'} ${i.name}\n`;
            });
        }
    } else if (type === 'full') {
        text = `🍱 INVENTAIRE COMPLET (${date})\n\n`;
        state.ingredients.forEach(i => {
            const status = i.inStock ? '✅' : (i.inCart ? '🛒' : '⚪');
            text += `${status} ${i.emoji || '🔸'} ${i.name} [${i.category}]\n`;
        });
    } else if (type === 'categorized') {
        text = `📦 INVENTAIRE PAR RAYON (${date})\n\n`;
        for (const [cat, items] of groupByCategory(state.ingredients)) {
            text += `\n--- ${cat.toUpperCase()} ---\n`;
            items.forEach(i => {
                const status = i.inStock ? '✅' : (i.inCart ? '🛒' : '⚪');
                text += `${status} ${i.emoji || '🔸'} ${i.name}\n`;
            });
        }
    } else if (type === 'cart') {
        text = `🛒 LISTE DE COURSES (${date})\n\n`;
        const items = state.ingredients.filter(i => i.inCart);
        if (items.length === 0) { text += "(Vide)"; }
        else {
            for (const [cat, catItems] of groupByCategory(items)) {
                text += `\n[ ${cat.toUpperCase()} ]\n`;
                catItems.forEach(i => {
                    text += `☐ ${i.emoji || '🔸'} ${i.name}\n`;
                });
            }
        }
    }

    try {
        await navigator.clipboard.writeText(text);
        toast('Copié dans le presse-papiers !');
    } catch (err) {
        console.error('Erreur copie:', err);
        toast('Erreur lors de la copie', 'error');
    }
}

function updateSystemInfo() {
    // LOT 007 a rebranché #info-last-sync/#info-network (oracle l.4466-4482).
    // LOT 009 complète avec les 3 derniers champs (oracle l.4443-4464) et retire
    // la branche morte #system-storage, un id qui n'existe nulle part (0 occurrence).
    const syncEl = document.getElementById('info-last-sync');
    if (syncEl) {
        let raw = null;
        try { raw = localStorage.getItem(SYNC_LAST_KEY); } catch { /* affichage seulement */ }
        if (!raw) {
            syncEl.textContent = 'Jamais synchronisé';
        } else {
            syncEl.textContent = new Date(raw).toLocaleString('fr-FR', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
        }
    }

    const keyEl = document.getElementById('info-api-key');
    if (keyEl) {
        const key = state.aiConfig?.apiKey || '';
        const isConfigured = key.length > 10;
        const last4 = key.length > 4 ? key.slice(-4) : '****';
        keyEl.replaceChildren(
            isConfigured
                ? h('span', {}, [`****${last4}`, h('span', { class: 'system-info-value tag green' }, 'Configurée (Locale)')])
                : h('span', {}, ['Non configurée', h('span', { class: 'system-info-value tag red' }, 'Manquante')])
        );
    }

    const fbUserEl = document.getElementById('info-fb-user');
    if (fbUserEl) fbUserEl.textContent = FB_USER;

    const storageEl = document.getElementById('info-storage');
    if (storageEl) {
        let raw = '';
        try { raw = localStorage.getItem(LOCAL_STORAGE_KEY) || ''; } catch { /* affichage seulement */ }
        const sizeKB = (raw.length / 1024).toFixed(2);
        storageEl.replaceChildren(
            h('code', {}, LOCAL_STORAGE_KEY),
            h('span', { style: { opacity: '0.6', fontSize: '11px', marginLeft: '4px' } }, `(${sizeKB} KB)`)
        );
    }

    updateNetworkInfo();
    updateApiStatus();
}

function updateApiStatus() {
    const dot = document.getElementById('api-status-dot');
    const label = document.getElementById('api-status-label');
    if (!dot || !label) return;
    const hasKey = !!state.aiConfig?.apiKey;
    dot.classList.toggle('off', !hasKey);
    dot.classList.toggle('on', hasKey);
    label.textContent = hasKey ? 'Gemini AI : On' : 'Gemini AI : Off';
}

function updateBadges() {
    const { stock: stockCount, cart: cartCount } = countStockAndCart();
    const favCount = state.favorites?.length || 0;

    // Sidebar
    const sbStock = document.getElementById('sb-badge-stock');
    const sbCart = document.getElementById('sb-badge-cart');
    const sbFav = document.getElementById('sb-badge-fav');
    
    if (sbStock) sbStock.textContent = stockCount || '0';
    if (sbCart) sbCart.textContent = cartCount || '0';
    if (sbFav) {
        sbFav.textContent = favCount || '0';
        sbFav.classList.toggle('hidden', favCount === 0);
    }

    // Bottom nav
    const bnStock = document.getElementById('bn-badge-stock');
    const bnCart = document.getElementById('bn-badge-cart');
    if (bnStock) {
        bnStock.textContent = stockCount || '';
        bnStock.classList.toggle('hidden', stockCount === 0);
    }
    if (bnCart) {
        bnCart.textContent = cartCount || '';
        bnCart.classList.toggle('hidden', cartCount === 0);
    }
}

/**
 * Active ou grise les boutons d'enregistrement de la fenêtre « Coller une recette ».
 * Ils n'ont de sens qu'une fois le texte transformé en recette structurée.
 */
function setPasteSaveButtonsEnabled(enabled) {
    ['paste-save-btn', 'paste-list-btn'].forEach(id => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.disabled = !enabled;
        // Le bouton « + Courses » etait masque en dur et jamais reaffiche.
        btn.style.display = '';
    });
}

function openModal(id) {
    document.getElementById(id)?.classList.add('open');

    if (id === 'modal-paste-recipe') {
        // Sans cette remise a zero, la recette transformee lors d'une ouverture
        // precedente survivait : « Sauvegarder tel quel » enregistrait alors la
        // recette d'avant, silencieusement.
        _lastTransformedRecipe = null;
        setPasteSaveButtonsEnabled(false);
    }

    if (id === 'modal-api-config') {
        const keyInput = document.getElementById('api-key-input');
        if (keyInput && state.aiConfig?.apiKey) keyInput.value = state.aiConfig.apiKey;
        const modelSelect = document.getElementById('api-model-complex');
        if (modelSelect && state.aiConfig?.models?.recipeGeneration) {
            modelSelect.value = state.aiConfig.models.recipeGeneration;
        }
    }
}
function closeModal(id) {
    const el = document.getElementById(id);
    el?.classList.remove('open');
    if (el?.classList.contains('recipe-fullscreen')) {
        el.classList.remove('recipe-fullscreen');
        if (isDocumentFullscreen()) exitDocumentFullscreen().catch(() => {});
    }
}

let _currentEditingIngId = null;
function openEditEmoji(id) {
    _currentEditingIngId = id;
    const ing = state.ingredients.find(i => i.id === id);
    if (!ing) return;
    document.getElementById('edit-emoji-name').textContent = ing.name;
    const searchInput = document.getElementById('emoji-search-input');
    if (searchInput) searchInput.value = '';
    renderEmojiEditGrid(ing.name);
    openModal('modal-edit-emoji');
}

// Socle générique de secours pour les suggestions d'emoji — SSOT unique, partagé
// par `updateEmojiSuggestions` (flux Ajouter) et `buildEmojiEditSuggestions` (flux
// Édition, LOT 009). Ne JAMAIS dupliquer cette liste ailleurs.
const GENERIC_EMOJI_FALLBACK = ['🧂', '🧅', '🧄', '🥦', '🥩', '🍎', '🥚', '🥛'];

/**
 * Suggestions locales pour la grille d'édition d'icône (oracle : monolithe
 * `getEmojiSuggestions`/`EMOJI_MAP`). Construites depuis `DEFAULT_DB` — jamais
 * de table d'emojis dupliquée (SSOT, `GENERIC_EMOJI_FALLBACK` partagé avec
 * `updateEmojiSuggestions`). Complète TOUJOURS avec l'emoji de catégorie puis le
 * socle générique tant qu'il manque des alternatives : un ingrédient dont le nom
 * ne correspond qu'à lui-même (ex. « Banane ») ne doit jamais se retrouver avec
 * une grille à une seule tuile qui ne fait que confirmer l'icône déjà en place
 * (audit Codex, LOT 009 — le « changer en 2 clics » exige un vrai choix).
 */
function buildEmojiEditSuggestions(seed) {
    const s = (seed || '').toLowerCase();
    const matches = s ? DEFAULT_DB.filter(i => i.name.toLowerCase().includes(s)) : [];
    const fromMatches = matches.map(i => i.emoji);
    const ing = state.ingredients.find(i => i.id === _currentEditingIngId);
    const categoryEmoji = ing ? getCategoryEmoji(ing.category) : null;
    const emojis = [...new Set([...fromMatches, categoryEmoji, ...GENERIC_EMOJI_FALLBACK].filter(Boolean))];
    return emojis.slice(0, 15);
}

function renderEmojiEditGrid(seed) {
    const grid = document.getElementById('edit-emoji-grid');
    if (!grid) return;
    grid.replaceChildren(...buildEmojiEditSuggestions(seed).map(e =>
        h('button', { class: 'emoji-edit-btn', onclick: () => applyEditedEmoji(e) }, e)
    ));
}

/** Applique l'emoji choisi, sauvegarde, ferme — contrat du `updateEmoji` du
 * monolithe : pas d'étape intermédiaire, aucun input libre à valider. */
function applyEditedEmoji(emoji) {
    const ing = state.ingredients.find(i => i.id === _currentEditingIngId);
    if (ing) {
        ing.emoji = emoji;
        saveState(); // 'stateUpdated' relance le rendu : pas d'appel manuel.
    }
    closeModal('modal-edit-emoji');
}

function renderAdd() {
    _isManualCategory = false;
    _localCategoryFill = false;
    clearTimeout(_addSuggestTimer);
    _aiSuggestGenId++; // invalide une requete IA deja en vol
    const list = document.getElementById('add-results-list');
    if (list) list.replaceChildren();
    const emojiSug = document.getElementById('emoji-suggestions');
    if (emojiSug) emojiSug.replaceChildren();
    showCategoryIndicator(null);
}

function guessCategoryLocally(name) {
    const n = normalizeString(name);
    if (!n || n.length < 3) return '';

    // 1. Exact match in DEFAULT_DB (fiable à 100%)
    const exact = DEFAULT_DB.find(i => normalizeString(i.name) === n);
    if (exact) return exact.category;

    // 2. Règles par premier mot (conservatives, pas de fuzzy)
    const first = n.split(/\s+/)[0];
    const proteines = ['poulet', 'boeuf', 'saumon', 'thon', 'porc', 'agneau', 'dinde', 'lapin', 'veau', 'crevette', 'cabillaud'];
    const legumes   = ['carotte', 'courgette', 'tomate', 'oignon', 'poireau', 'brocoli', 'epinard', 'poivron', 'aubergine', 'champignon'];
    const fruits    = ['pomme', 'poire', 'banane', 'mangue', 'fraise', 'framboise', 'citron', 'orange', 'kiwi'];
    const laitiers  = ['lait', 'creme', 'beurre', 'yaourt', 'fromage'];
    const feculents = ['riz', 'pate', 'lentille', 'pois', 'haricot', 'quinoa', 'boulgour'];

    if (proteines.includes(first)) return 'Protéines';
    if (legumes.includes(first))   return 'Légumes';
    if (fruits.includes(first))    return 'Fruits';
    if (laitiers.includes(first))  return 'Produits laitiers';
    if (feculents.includes(first)) return 'Pâtes, riz & légumes secs';

    const plats = ['frite', 'croquette', 'nugget', 'pizza', 'burger', 'lasagne', 'quiche'];
    if (plats.some(k => n.includes(k))) return 'Plats & Préparations';

    return '';
}

function sanitizeCategory(aiCat, name) {
    if (!aiCat) return guessCategoryLocally(name) || 'Conserves & bocaux';
    if (CATEGORIES.includes(aiCat)) return aiCat;
    const l = aiCat.toLowerCase();
    if (l.includes('boisson'))                               return 'Conserves & bocaux';
    if (l.includes('condiment') || l.includes('sauce'))      return 'Sauces & condiments';
    if (l.includes('epice') || l.includes('arômate'))        return 'Épices sèches';
    if (l.includes('laitag') || l.includes('laitier'))       return 'Produits laitiers';
    if (l.includes('vegetal') || l.includes('végétal'))      return 'Alternatives végétales';
    if (l.includes('viande') || l.includes('poisson') || l.includes('protein')) return 'Protéines';
    if (l.includes('cereale') || l.includes('riz') || l.includes('pate'))       return 'Pâtes, riz & légumes secs';
    if (l.includes('plat') || l.includes('prepa'))           return 'Plats & Préparations';
    return guessCategoryLocally(name) || 'Conserves & bocaux';
}

function showCategoryIndicator(type) {
    const el = document.getElementById('category-suggestion-indicator');
    if (!el) return;
    if (!type) {
        el.style.display = 'none';
    } else if (type === 'thinking') {
        el.style.display = 'block';
        el.style.color = 'var(--txt-soft)';
        el.textContent = "✨ Analyse par l'IA...";
    } else if (type === 'local') {
        el.style.display = 'block';
        el.style.color = 'var(--green)';
        el.textContent = '✨ Catégorie auto-détectée';
    } else if (type === 'ai') {
        el.style.display = 'block';
        el.style.color = 'var(--green)';
        el.textContent = '✨ Catégorie suggérée par l\'IA';
    }
}

function updateEmojiSuggestions(val) {
    const container = document.getElementById('emoji-suggestions');
    if (!container) return;
    if (!val) {
        container.replaceChildren(...GENERIC_EMOJI_FALLBACK.map(e => h('span', { class: 'emoji-item emoji-sug-btn', onclick: () => selectEmoji(e) }, e)));
        return;
    }
    const s = val.toLowerCase();
    const matches = DEFAULT_DB.filter(i => i.name.toLowerCase().includes(s)).slice(0, 15);
    const emojis = [...new Set(matches.map(i => i.emoji))];
    container.replaceChildren(...emojis.map(e => h('span', { class: 'emoji-item emoji-sug-btn', onclick: () => selectEmoji(e) }, e)));
}

// Balaye les 273 ingredients de la base : temporise sur la frappe, immediat sur un reset.
const _updateEmojiSuggestionsDebounced = debounce(updateEmojiSuggestions, 200);

function handleAddInput(val) {
    const list = document.getElementById('add-results-list');
    const emojiInput = document.getElementById('add-emoji');
    const catSelect = document.getElementById('add-category');

    // 1. Champ vide → tout réinitialiser
    if (!val || val.trim().length === 0) {
        _isManualCategory = false;
        _localCategoryFill = false;
        clearTimeout(_addSuggestTimer);
        _aiSuggestGenId++; // invalide une requete IA deja en vol
        if (list) list.replaceChildren();
        if (emojiInput) emojiInput.value = '';
        if (catSelect) catSelect.value = '';
        _updateEmojiSuggestionsDebounced.cancel();
        updateEmojiSuggestions('');
        showCategoryIndicator(null);
        return;
    }

    // 2. Autocomplétion DB (instantané)
    if (list) {
        const s = normalizeString(val);
        const results = DEFAULT_DB.filter(i => normalizeString(i.name).includes(s)).slice(0, 5);
        list.replaceChildren(...results.map(i => h('div', {
            class: 'add-res-item',
            onclick: () => addIngredientFromDb(i)
        }, [i.emoji + ' ', i.name])));
    }

    // 3. Grille d'emojis (temporisee, depuis DB)
    _updateEmojiSuggestionsDebounced(val);

    // Si l'utilisateur a choisi manuellement la catégorie, on s'arrête là
    if (_isManualCategory) return;

    // 4. Détection locale conservative (exact match ou règles par mot)
    const localCat = guessCategoryLocally(val);
    if (localCat) {
        catSelect.value = localCat;
        _localCategoryFill = true;
        showCategoryIndicator('local');
        // Exact match DB → on prend aussi l'emoji et on n'appelle pas l'IA
        const exactEntry = DEFAULT_DB.find(i => normalizeString(i.name) === normalizeString(val));
        if (exactEntry) {
            if (emojiInput && !emojiInput.value) selectEmoji(exactEntry.emoji);
            clearTimeout(_addSuggestTimer);
            _aiSuggestGenId++; // invalide une requete IA deja en vol
            return;
        }
    } else if (val.length >= 3 && state.aiConfig?.apiKey) {
        showCategoryIndicator('thinking');
    }

    // 5. Suggestion IA (différée, écrase toujours la détection locale)
    if (val.length < 3) return;
    clearTimeout(_addSuggestTimer);
    _addSuggestTimer = setTimeout(async () => {
        const apiKey = state.aiConfig?.apiKey;
        if (!apiKey || _isManualCategory) return;

        // Jeton de generation : `clearTimeout` annule une requete PAS ENCORE partie,
        // mais rien ne peut rappeler une requete deja en vol. Sans ce jeton, taper
        // « salsifi » puis effacer et taper « tomate » laisse la reponse la plus lente
        // ecraser la plus recente. On ignore donc toute reponse peremee.
        const myGenId = ++_aiSuggestGenId;

        try {
            const prompt = `Tu es un assistant culinaire. Pour l'ingrédient "${val}", réponds en JSON UNIQUEMENT: {"category":"Légumes","emojis":["🥕","🌿","🥦"]}. Catégories possibles: ${CATEGORIES.join(', ')}. Propose 3-5 emojis pertinents.`;
            const model = state.aiConfig.models?.categorySuggest || AI_ROLES.FAST;
            const raw = await callAI(prompt, apiKey, model, { isJSON: false, temperature: 0.1 });
            if (myGenId !== _aiSuggestGenId) return; // saisie modifiee entre-temps
            const match = raw.match(/\{[\s\S]*?\}/);
            if (!match) { showCategoryIndicator(null); return; }
            const data = JSON.parse(match[0]);

            // Catégorie : l'IA écrase toujours la détection locale (jamais le choix manuel)
            if (data.category && !_isManualCategory) {
                const finalCat = sanitizeCategory(data.category, val);
                if (finalCat) {
                    catSelect.value = finalCat;
                    _localCategoryFill = false;
                    showCategoryIndicator('ai');
                }
            }

            // Emojis : ajout dans la grille + auto-sélection si rien de choisi
            if (data.emojis && data.emojis.length > 0) {
                const container = document.getElementById('emoji-suggestions');
                if (container) {
                    data.emojis.forEach(e => {
                        if (!container.querySelector(`[data-emoji="${e}"]`)) {
                            container.appendChild(h('span', {
                                class: 'emoji-item emoji-sug-btn',
                                'data-emoji': e,
                                onclick: () => selectEmoji(e)
                            }, e));
                        }
                    });
                }
                if (emojiInput && !emojiInput.value && data.emojis[0]) {
                    selectEmoji(data.emojis[0]);
                }
            }
        } catch (e) {
            if (myGenId !== _aiSuggestGenId) return;
            showCategoryIndicator(null);
            console.warn('[AI Suggest]', e.message);
        }
    }, 800);
}

// Called from HTML when user manually changes the category dropdown
window._onManualCategoryChange = function() {
    _isManualCategory = true;
    _localCategoryFill = false;
    showCategoryIndicator(null);
};

function addIngredient() {
    const name = document.getElementById('add-name')?.value;
    if (!name) { toast('Nom requis', 'error'); return; }
    
    const emoji = document.getElementById('add-emoji')?.value || '🛒';
    const category = document.getElementById('add-category')?.value || 'Autres';
    const frozen = document.getElementById('add-frozen')?.checked || false;
    
    // Check duplicate/similarity
    const similar = state.ingredients.find(i => areSimilar(i.name, name));
    if (similar) {
        const type = normalizeString(similar.name) === normalizeString(name) ? 'existe déjà' : 'ressemble beaucoup';
        if (!confirm(`ℹ️ "${name}" ${type} à "${similar.name}" (${similar.category}).\nVoulez-vous quand même l'ajouter ?`)) return;
    }

    const id = generateId('ing');
    state.ingredients.push({
        id, name, emoji, category, frozen,
        inStock: true, inCart: false, pinned: false
    });

    saveState(); // 'stateUpdated' relance le rendu de la vue courante : pas d'appel manuel.

    // Reset form
    document.getElementById('add-name').value = '';
    document.getElementById('add-emoji').value = '';
    document.getElementById('add-category').value = '';
    document.getElementById('add-frozen').checked = false;
    _isManualCategory = false;
    renderAdd();
    toast(`"${name}" ajouté ✓`);
}

function addIngredientFromDb(dbItem) {
    // Check duplicate/similarity
    const similar = state.ingredients.find(i => areSimilar(i.name, dbItem.name));
    if (similar) {
        const type = normalizeString(similar.name) === normalizeString(dbItem.name) ? 'existe déjà' : 'ressemble beaucoup';
        if (!confirm(`ℹ️ "${dbItem.name}" ${type} à "${similar.name}" (${similar.category}).\nVoulez-vous quand même l'ajouter ?`)) return;
    }

    const id = generateId('ing');
    state.ingredients.push({ ...dbItem, id, inStock: true, inCart: false, pinned: false });
    
    saveState(); // 'stateUpdated' relance le rendu de la vue courante : pas d'appel manuel.

    // Reset form
    document.getElementById('add-name').value = '';
    document.getElementById('add-emoji').value = '';
    document.getElementById('add-category').value = '';
    document.getElementById('add-frozen').checked = false;
    _isManualCategory = false;
    renderAdd();
    
    toast(`${dbItem.name} ajouté !`);
}

function confirmBulkAdd() {
    const checked = document.querySelectorAll('#modal-shopping-bulk-list input:checked');
    checked.forEach(cb => {
        const id = cb.dataset.id;
        const ing = state.ingredients.find(i => i.id === id);
        if (ing) ing.inCart = true;
    });
    saveState();
    closeModal('modal-shopping-bulk');
    toast('Ajouté à la liste !');
}

function updatePickerRow(idx) {
    const row = document.getElementById(`pitem-${idx}`);
    const chk = document.getElementById(`pick-${idx}`);
    if (row && chk) {
        if (chk.checked) row.classList.add('checked');
        else row.classList.remove('checked');
    }
}

function toggleAllPickerItems(checked) {
    const list = document.getElementById('modal-recipe-cart-list');
    if (!list) return;
    const checks = list.querySelectorAll('input[type="checkbox"]');
    checks.forEach((chk, i) => {
        chk.checked = checked;
        updatePickerRow(i);
    });
}

async function searchEmojiAddAI() {
    const searchVal = document.getElementById('add-emoji-search')?.value?.trim();
    const nameVal = document.getElementById('add-name')?.value?.trim();
    const target = searchVal || nameVal;
    if (!target || !state.aiConfig.apiKey) return;

    const btn = document.getElementById('add-emoji-search-btn');
    if (btn) btn.textContent = '...';

    try {
        const prompt = `Trouve 12 emojis pertinents pour l'ingrédient "${target}". Réponds uniquement par les emojis séparés par des espaces.`;
        const model = state.aiConfig.models?.emojiSearch || AI_ROLES.FAST;
        const res = await callAI(prompt, state.aiConfig.apiKey, model, { isJSON: false });
        if (res) {
            // Robust emoji detection using modern regex
            const allEmojis = res.match(/\p{Emoji_Presentation}/gu) || res.match(/\p{Emoji}/gu) || [];
            const uniqueEmojis = [...new Set(allEmojis)];

            const grid = document.getElementById('emoji-suggestions');
            if (grid) {
                grid.replaceChildren(...uniqueEmojis.map(e => h('span', { 
                    class: 'emoji-item emoji-sug-btn', 
                    onclick: () => selectEmoji(e)
                }, e)));
                
                // Auto-select first emoji if currently empty
                const currentEmoji = document.getElementById('add-emoji');
                if (currentEmoji && (!currentEmoji.value || !currentEmoji.value.trim()) && uniqueEmojis.length > 0) {
                    selectEmoji(uniqueEmojis[0]);
                }
            }
        }
    } catch(e) {
        console.error('[searchEmojiAddAI]', e);
        toast(`Erreur emoji : ${e.message}`, 'error');
    } finally {
        if (btn) btn.textContent = '✨';
    }
}

function addExtraIngredient() {
    const input = document.getElementById('ez-input');
    const val = input?.value?.trim();
    if (!val) return;
    
    if (state.extraIngredients.length >= 6) {
        toast('Maximum 6 ingrédients hors stock', 'error'); return;
    }

    // Check similarity in Inventory
    const similarInStock = state.ingredients.find(ing => ing.inStock && areSimilar(ing.name, val));
    if (similarInStock) {
        if (!confirm(`⚠️ "${similarInStock.name}" est déjà en stock ! Voulez-vous vraiment ajouter "${val}" en hors-stock ?`)) return;
    }

    // Check similarity in existing hors-stock
    const similarInExtra = state.extraIngredients.find(ei => areSimilar(ei.name, val));
    if (similarInExtra) {
        if (!confirm(`ℹ️ "${val}" ressemble beaucoup à "${similarInExtra.name}" déjà présent dans la liste. Ajouter quand même ?`)) return;
    }

    state.extraIngredients.push({ name: val, emoji: '✨', id: generateId('extra') });
    input.value = '';
    saveState();
}

function renderExtraChips() {
    const container = document.getElementById('imposed-chips');
    if (!container) return;
    const chips = state.extraIngredients.map(it => h('div', { class: 'chip active' }, [
        it.name,
        h('span', { style: { marginLeft: '6px', cursor: 'pointer' }, onclick: () => removeExtraIngredient(it.id) }, '✕')
    ]));
    container.replaceChildren(...chips);
    if (chips.length === 0) container.replaceChildren(h('span', { class: 'pz-empty' }, 'Aucun ingrédient imposé'));
}

function removeExtraIngredient(id) {
    state.extraIngredients = state.extraIngredients.filter(it => it.id !== id);
    saveState();
}

function generateRandomWithStock() {
    const stock = state.ingredients.filter(i => i.inStock);
    if (stock.length === 0) { toast('Stock vide', 'error'); return; }
    generateSuggestions();
}

async function fetchRecipeFromUrl() {
    const url = document.getElementById('paste-url')?.value;
    if (!url) return;
    const btn = document.getElementById('paste-fetch-btn');
    btn.disabled = true;
    btn.textContent = 'Chargement...';
    try {
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
        const res = await fetch(proxyUrl);
        const data = await res.json();
        const content = data.contents;
        document.getElementById('paste-content').value = content;
        toast('Page lue ! Cliquez sur Transformer avec l\'IA.');
    } catch (e) {
        toast('Erreur lecture URL. Essayez le copier-coller.', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '🌍 Lire la page';
    }
}

async function transformRecipeAI() {
    const content = document.getElementById('paste-content')?.value;
    if (!content) return;
    if (!state.aiConfig.apiKey) { toast('Clé API requise', 'error'); openModal('modal-api-config'); return; }
    
    const btn = document.getElementById('paste-ai-btn');
    btn.disabled = true;
    btn.textContent = 'Transformation...';
    try {
        const recipe = await transformRecipeFromText(content, state.aiConfig.apiKey);
        document.getElementById('paste-title').value = recipe.name;
        // Re-render preview or just store it
        _lastTransformedRecipe = recipe;
        setPasteSaveButtonsEnabled(true);
        toast('Recette structurée !');
    } catch (e) {
        toast('Erreur transformation IA', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Transformer avec l\'IA ✨';
    }
}

let _lastTransformedRecipe = null;

function printRecipe() {
    window.print();
}

function restoreJSON(event) {
    const file = event.target.files[0];
    if (file) Actions.importJSON(file);
}

function importStockOnly(event) {
    const file = event.target.files[0];
    if (file) Actions.importStockOnly(file);
    event.target.value = '';
}

const toggleStock = Actions.toggleStock;
const togglePin = Actions.togglePin;
const toggleCart = Actions.toggleCart;
const deleteIngredient = Actions.deleteIngredient;
const toggleShoppingCheck = Actions.toggleShoppingCheck;
const removeFromCart = Actions.removeFromCart;
function saveApiKey() {
    const key = document.getElementById('api-key-input')?.value?.trim();
    if (!key) { toast('Clé API requise', 'error'); return; }
    state.aiConfig.apiKey = key;

    // Save model selection if present
    const modelSelect = document.getElementById('api-model-complex');
    if (modelSelect?.value) {
        if (!state.aiConfig.models) state.aiConfig.models = {};
        state.aiConfig.models.recipeGeneration = modelSelect.value;
        state.aiConfig.models.nutrition = modelSelect.value;
        state.aiConfig.models.smartPaste = modelSelect.value;
    }

    saveState();
    updateApiStatus();
    closeModal('modal-api-config');
    toast('Clé API sauvegardée ✓');
}
function selectEmoji(e) {
    const input = document.getElementById('add-emoji');
    if (input) {
        input.value = e;
        
        // Smart category pick if not manual
        if (!_isManualCategory) {
            const match = DEFAULT_DB.find(i => i.emoji === e);
            if (match) {
                const catSelect = document.getElementById('add-category');
                if (catSelect) catSelect.value = match.category;
            }
        }

        document.querySelectorAll('.emoji-sug-btn').forEach(b => {
            b.classList.toggle('selected', b.textContent === e);
        });
    }
}

async function searchEmojiAI() {
    const input = document.getElementById('emoji-search-input');
    const btn = document.getElementById('emoji-search-btn');
    if (!input || !btn) return;
    const query = input.value.trim();
    if (!query) return;

    btn.disabled = true;
    const oldHtml = btn.innerHTML;
    btn.innerHTML = '<div class="spinner-small" style="margin:0"></div>';

    try {
        const prompt = `Suggère 15 emojis pour: ${query}. Réponds uniquement par les emojis.`;
        const model = state.aiConfig.models?.emojiSearch || AI_ROLES.FAST;
        const res = await callAI(prompt, state.aiConfig.apiKey, model, { isJSON: false });
        if (res) {
            const emojis = res.match(/(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g) || [];
            const grid = document.getElementById('edit-emoji-grid');
            if (grid) {
                grid.replaceChildren(...emojis.map(e =>
                    h('button', { class: 'emoji-edit-btn', onclick: () => applyEditedEmoji(e) }, e)
                ));
            }
        }
    } catch (e) {
        console.error(e);
        toast('Erreur recherche emoji', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = oldHtml;
    }
}

function initSwipeToClose(modalId) {
    const overlay = document.getElementById(modalId);
    if (!overlay) return;

    let startY = 0;
    let currentY = 0;
    let isSwiping = false;
    let modal = null;

    // Écouteurs posés UNE FOIS sur l'overlay, qui survit à tout `replaceChildren`
    // de son contenu (ex. `openRecipeDetail`) — le noeud `.modal-content`/`.modal`
    // visé est recalculé à CHAQUE geste, jamais capturé une fois pour toutes
    // (LOT 009, casse C7 : le glissement mourait après le premier rendu dynamique).
    overlay.addEventListener('touchstart', (e) => {
        modal = overlay.querySelector('.modal-content') || overlay.querySelector('.modal');
        if (!modal) return;
        const touch = e.touches[0];
        const rect = modal.getBoundingClientRect();
        // Allow swipe from the top 100px (header/drag handle)
        if (touch.clientY - rect.top < 100) {
            startY = touch.clientY;
            // Repart de zéro à CHAQUE geste (audit Codex, LOT 009) : sans ce reset,
            // currentY gardait la valeur du geste PRÉCÉDENT — un simple toucher sans
            // glissement après une fermeture réussie pouvait re-fermer aussitôt.
            currentY = touch.clientY;
            isSwiping = true;
            modal.style.transition = 'none';
        }
    }, { passive: true });

    overlay.addEventListener('touchmove', (e) => {
        if (!isSwiping || !modal) return;
        currentY = e.touches[0].clientY;
        const diff = currentY - startY;
        if (diff > 0) {
            modal.style.transform = `translateY(${diff}px)`;
            const opacity = 1 - (diff / 500);
            overlay.style.backgroundColor = `rgba(0,0,0, ${Math.max(0, opacity * 0.5)})`;
        }
    }, { passive: true });

    overlay.addEventListener('touchend', () => {
        if (!isSwiping || !modal) return;
        isSwiping = false;
        const diff = currentY - startY;
        if (diff > 100) {
            closeModal(modalId);
        }
        modal.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        modal.style.transform = '';
        overlay.style.backgroundColor = '';
    });

    // Durcissement (contre-vérification Codex, LOT 009) : un geste interrompu par le
    // système (appel entrant, geste OS concurrent...) ne doit ni fermer le modal ni le
    // laisser visuellement décalé — même remise en place que touchend, sans décision
    // de fermeture.
    overlay.addEventListener('touchcancel', () => {
        if (!isSwiping || !modal) return;
        isSwiping = false;
        modal.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        modal.style.transform = '';
        overlay.style.backgroundColor = '';
    });
}

function initKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay.open').forEach(m => closeModal(m.id));
        }
        if (e.key === 'Enter') {
            const activeModal = document.querySelector('.modal-overlay.open');
            if (activeModal) {
                if (activeModal.id === 'modal-api-config') saveApiKey();
                else if (activeModal.id === 'modal-recipe-to-cart') confirmRecipeToCart();
                else if (activeModal.id === 'modal-shopping-bulk') confirmBulkAdd();
            } else if (state.currentView === 'add') {
                addIngredient();
            }
        }
    });
}

const resetCart = Actions.resetCart;
const resetAllData = Actions.resetAllData;
const exportJSON = Actions.exportJSON;

expose({
    switchView, handleSearch, clearSearch, setFilter,
    toggleStock, togglePin, toggleCart, deleteIngredient,
    generateSuggestions, openRecipeDetail, confirmRecipeToCart,
    saveApiKey, resetCart, resetAllData, exportJSON,
    openModal, closeModal, openEditEmoji,
    toggleAiSingle, toggleAiChip, saveAiConfigFromUI, 
    confirmBulkAdd, searchEmojiAddAI, handleAddInput, addIngredient,
    addExtraIngredient, generateRandomWithStock,
    fetchRecipeFromUrl, transformRecipeAI, printRecipe, restoreJSON, importStockOnly,
    saveRecipeOnly: () => saveRecipeOnly(_lastTransformedRecipe),
    saveRecipeAndList: () => saveRecipeAndList(_lastTransformedRecipe),
    toggleRecipeFullscreen, changePplScale,
    // Clic « Cloud Sync » : cycle complet immediat via le moteur (LOT 007, §4.4) —
    // envoi d'abord si des modifications attendent, recuperation, puis envoi
    // (court-circuite si rien n'a change). Toasts geres par le moteur (manual).
    pullFromFirebase: () => requestSyncOp('manual'),
    pushToFirebase: () => requestSyncOp('send'),
    exportClipboard, toggleAllPickerItems, deleteFav, searchEmojiAI, selectEmoji,
    // Appelee en inline depuis index.html (oninput du champ de recherche d'emoji) :
    // sans cette exposition, chaque frappe levait une ReferenceError.
    updateEmojiSuggestions: _updateEmojiSuggestionsDebounced
});
