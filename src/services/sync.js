import {
  state as moduleState, shoppingChecked, applyExternalState, replaceShoppingChecked,
  registerSyncScheduler, registerSyncBarrier
} from '../state.js';
import { toast } from '../utils/dom.js';
import { validateState } from '../utils/validate.js';
import { LOCAL_STORAGE_SYNC_REF_KEY } from '../constants.js';
import { syncPush, syncPull, buildSyncDocument, extractSyncedState } from './firebase.js';

/**
 * MOTEUR DE SYNCHRO — extrait de `js/app.js` au LOT 014, volet A.
 *
 * Deplacement PUR : pas une regle n'a change. Ce module etait deja concu pour sortir — le
 * transport et le perimetre du document vivent dans `./firebase.js`, et les deux points
 * d'injection (`registerSyncScheduler`, `registerSyncBarrier`) existaient deja dans
 * `src/state.js`. C'est ce qui permet ce deplacement SANS import circulaire.
 *
 * DEUX dependances d'interface restantes, et deux seulement : la re-lecture du formulaire
 * IA apres un pull applique, et le rafraichissement du panneau « informations systeme »
 * apres un succes. Toutes deux sont du RENDU, donc elles vivent dans `js/app.js` et sont
 * INJECTEES ici, sur le meme modele que les deux inscriptions ci-dessus.
 *
 * Elles ne font rien par defaut : un moteur sans interface (test unitaire) reste utilisable.
 * Un point d'injection UNIQUE plutot que deux fonctions separees — si une troisieme
 * dependance d'interface apparait un jour, c'est le signal que le decoupage a derape.
 */
const _ui = { restoreAiForm: () => {}, refreshSystemInfo: () => {} };
export function registerSyncUi(hooks = {}) {
    for (const cle of Object.keys(_ui)) {
        if (typeof hooks[cle] === 'function') _ui[cle] = hooks[cle];
    }
}


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
export const SYNC_LAST_KEY = 'pantry_v5_last_sync';       // metadonnee locale, HORS document (§4.1, audit Codex v2)
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

export function isSyncPending() {
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
export function setSyncStatus(status, message = null) {
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
    _ui.refreshSystemInfo();
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
export function scheduleSyncPush() {
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
export async function requestSyncOp(op) {
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
        const attendaitLaQuiescence = _syncIdleWaiters.length > 0;
        while (_syncIdleWaiters.length) _syncIdleWaiters.shift()();
        // LOT 015 (audit adversarial du 2026-07-30) — TROU DE LA BARRIERE DE QUIESCENCE.
        // `resolve()` ci-dessus ne fait que PROGRAMMER la reprise du chemin explicite
        // (reset, restauration de fichier) en microtache, alors que `requestSyncOp` demarre
        // SYNCHRONIQUEMENT et construit son document des ses premieres lignes
        // (`performSyncSend`, l.293-294). Une operation mise en attente PENDANT la barriere
        // partait donc AVANT que le chemin explicite ait ecrit, avec l'etat d'AVANT — puis
        // le pull qui la suit reappliquait ce vieux document par-dessus la restauration,
        // sans declencher le garde-fou d'empreinte (celle-ci etant prise apres coup).
        // Une operation demandee avant que le chemin explicite ecrive est PERIMEE par
        // construction : on ne la relance pas. Le chemin explicite planifie son propre
        // envoi via `saveState`, rien n'est perdu.
        if (queued && !attendaitLaQuiescence) requestSyncOp(queued);
    }
}

/**
 * Barriere de quiescence (contre-verification d'audit Sol, C3), inscrite via
 * registerSyncBarrier : annule tout envoi temporise, vide la file, et attend la
 * fin de l'operation en vol. Garantit qu'aucun PUT du moteur ANTERIEUR a un
 * chemin explicite (reset) ne peut ecrire APRES le PUT de ce chemin.
 */
export function syncEngineBarrier() {
    clearTimeout(_syncSendTimer);
    _syncSendTimer = null;
    _syncQueuedOp = null;
    if (!_syncInFlight) return Promise.resolve();
    return new Promise(resolve => _syncIdleWaiters.push(resolve));
}

/**
 * ENVOI (§4.3). Retourne true si le cloud est a jour (envoi reussi ou rien a envoyer).
 */
export async function performSyncSend({ manual = false, quiet = false } = {}) {
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
export async function performSyncPull({ manual = false } = {}) {
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
        if (!validateState(cloudDoc)) {
            // GARDE-FOU ENTRANT (§4.9.2) : document malforme ignore, erreur discrete.
            // LOT 014, volet C : l'invariant (« inventaire present et sous forme de
            // tableau ») est desormais DEFINI dans src/utils/validate.js, plus ecrit en
            // dur ici — meme regle, un seul endroit. Comportement inchange.
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

        // Reference anti-boucle = le document tel qu'il existe LOCALEMENT apres
        // application (sanitisation comprise) : ainsi une simple sauvegarde d'un
        // champ NON synchronise redonne exactement ce document → aucun envoi (§4.5).
        setSyncReference(currentSyncDocJson());
        _lastCloudHadIngredients = (moduleState.ingredients || []).length > 0;

        recordSyncSuccess();
        setSyncStatus('success');

        // Ne pas reecrire une saisie en cours dans le formulaire de config IA.
        if (aiFormFingerprint() === aiFormBefore) {
            _ui.restoreAiForm();
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

export function updateNetworkInfo() {
    const netEl = document.getElementById('info-network');
    if (netEl) netEl.textContent = navigator.onLine ? '🌐 Connecté' : '🚫 Hors-ligne';
}

/**
 * Demarrage du moteur (§4.4) : inscription dans saveState, ecouteurs reseau et
 * visibilite, pull periodique, puis recuperation initiale — qui ENVOIE D'ABORD
 * si le drapeau persiste est leve (modifications faites juste avant une fermeture).
 */
export function initSyncEngine() {
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
export function __resetSyncEngineForTests() {
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
