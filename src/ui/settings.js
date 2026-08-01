import { state, saveState } from '../state.js';
import { h, toast } from '../utils/dom.js';
import { FB_USER, LOCAL_STORAGE_KEY } from '../constants.js';
import { SYNC_LAST_KEY, updateNetworkInfo } from '../services/sync.js';
import { closeModal } from './modals.js';
import { creativityLevel } from '../utils/helpers.js';
import { updateCreativityLabels } from './aiPanel.js';

/**
 * REGLAGES — extrait de `js/app.js` au LOT 017.
 *
 * Deplacement PUR : pas une regle n'a change. La zone etait deja couverte depuis le LOT 015,
 * a UNE exception pres — `saveAiConfigFromUI` n'avait AUCUN test, et son filet a ete pose
 * AVANT ce deplacement (`tests/save-ai-config.test.js`, 8 tests, 5 mutations prouvees).
 *
 * CE QUE CE MODULE COUVRE : l'ecran « Reglages » et la fiche technique qu'il affiche —
 * derniere synchro, cle API (masquee), utilisateur Firebase, taille du stockage, etat du
 * reseau, modeles IA en lecture seule.
 *
 * DEUX FONCTIONS SONT ARRIVEES ICI PAR LE LOT 017, ET NON PAR LE PLAN.
 *  · `updateApiStatus` : appelee par `updateSystemInfo` ET par `saveApiKey`. La laisser dans
 *    `js/app.js` aurait fait dependre ce module d'une fonction restee derriere, pour rien.
 *  · `onApiConfigOpen` : ces 5 lignes vivaient DANS `openModal`. C'est de la logique de
 *    reglages (pre-remplir le champ de cle, afficher les modeles), pas de la logique de
 *    fenetre. Le socle des modales les appelle desormais par crochet — il sait qu'il faut
 *    prevenir cet ecran, il ne sait plus ce que cet ecran en fait.
 *
 * ATTENTION, HOMONYME : `src/actions.js` exporte AUSSI une fonction `saveApiKey`, qui n'est
 * PAS celle-ci et prend une cle en parametre. Celle d'ici lit le champ de l'ecran, sauvegarde,
 * rafraichit le voyant et ferme la fenetre. Ne jamais importer l'une en croyant prendre l'autre.
 *
 * PAS DE CROCHET SORTANT : ce module importe `closeModal` directement. `modals.js` ne connait
 * pas les reglages autrement que par le crochet qu'on lui branche, donc aucun cycle.
 */

export function updateSystemInfo() {
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

export function updateApiStatus() {
    const dot = document.getElementById('api-status-dot');
    const label = document.getElementById('api-status-label');
    if (!dot || !label) return;
    const hasKey = !!state.aiConfig?.apiKey;
    dot.classList.toggle('off', !hasKey);
    dot.classList.toggle('on', hasKey);
    label.textContent = hasKey ? 'Gemini AI : On' : 'Gemini AI : Off';
}

/**
 * Ce que la fenetre des reglages doit faire A SON OUVERTURE. Branche sur `modals.js` par
 * `registerModalHooks` (LOT 017) — c'etait auparavant un `if (id === 'modal-api-config')`
 * loge dans `openModal`.
 */
export function onApiConfigOpen() {
    const keyInput = document.getElementById('api-key-input');
    if (keyInput && state.aiConfig?.apiKey) keyInput.value = state.aiConfig.apiKey;
    renderAiModelsInfo();
}

/**
 * Bloc d'information en lecture seule sur les modèles IA (LOT 010, arbitrage §6).
 * Dérivé de la SSOT (`state.aiConfig.models`, toujours réalignée sur `AI_ROLES` par
 * `sanitizeGlobalState`) — aucun nom de modèle n'est jamais écrit en dur ici.
 */
export function renderAiModelsInfo() {
    const el = document.getElementById('api-models-info');
    if (!el) return;
    /** @type {Record<string, string>} */
    const models = state.aiConfig?.models || {};
    el.textContent = `Recettes, nutrition et transformation de texte : ${models.recipeGeneration} · ` +
        `Catégories et emojis : ${models.categorySuggest}`;
}

export function saveApiKey() {
    // LOT 012, zone C (oracle l.6589-6594) : aucune garde sur la cle vide — vider le
    // champ puis Sauver doit pouvoir effacer une cle existante (l'ancien blocage
    // rendait ce cas impossible, contrairement a l'oracle).
    const key = document.getElementById('api-key-input')?.value?.trim() || '';
    state.aiConfig.apiKey = key;

    saveState();
    updateApiStatus();
    closeModal('modal-api-config');
    toast(key ? 'Clé API sauvegardée ✓' : 'Clé API supprimée');
}

/**
 * Enregistre les trois reglages libres de l'ecran IA. Cablee en `oninput` sur les trois
 * champs (`index.html:386`, `:430`, `:443`), donc appelee A CHAQUE FRAPPE — d'ou le
 * `saveState(false)` : redeclencher un rendu complet a chaque lettre ferait perdre le focus
 * du champ en cours de saisie.
 *
 * PIEGE FIGE PAR `tests/save-ai-config.test.js` : le repli `|| '50'` porte sur la CHAINE lue
 * dans le champ. `'0'` etant une chaine non vide, une creativite volontairement reglee a zero
 * survit. Deplacer ce repli sur le nombre (`parseInt(...) || 50`) la remonterait a 50 en
 * silence — exactement le defaut corrige au LOT 008, dans l'autre sens.
 */
export function saveAiConfigFromUI() {
    state.aiConfig.exceptions = document.getElementById('ai-exceptions')?.value || '';
    state.aiConfig.exclusions = document.getElementById('ai-exclusions')?.value || '';
    state.aiConfig.creativity = parseInt(document.getElementById('creativity-slider')?.value || '50');
    // LOT 023 — appelée à CHAQUE geste sur le curseur (oninput) : le libellé actif se met
    // en évidence en direct pendant le glisser, pas seulement à la réouverture du panneau.
    updateCreativityLabels(creativityLevel(state.aiConfig.creativity));
    saveState(false);
}
