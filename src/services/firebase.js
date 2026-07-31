import { FB_URL, FB_USER } from '../constants.js';
import { defaultAiConfig } from '../state.js';
import { estUnObjetSimple } from '../utils/validate.js';

/**
 * PÉRIMÈTRE du document synchronisé (LOT 007, spec §4.1) — SSOT : rien ne part au
 * cloud et rien n'en revient sans passer par `buildSyncDocument` / `extractSyncedState`.
 *
 * Hors périmètre, et pourquoi :
 * - `aiConfig.apiKey`   : JAMAIS envoyée, JAMAIS écrasée (invariant §4.6).
 * - `aiConfig.models`   : dérivé d'`AI_ROLES`, réécrasé à chaque chargement (SSOT) —
 *                         le synchroniser créerait un faux conflit entre versions.
 * - `currentView`, `filter`, `search`, `showInStockOnly`, `showInCartOnly`,
 *   `currentSuggestionIdx` : champs d'affichage — l'écran d'un appareil ne doit
 *                         jamais changer tout seul (F6).
 * - `aiSuggestions`     : volatile, sans identifiant, adressé par index.
 * - `lastSync`          : métadonnée LOCALE (localStorage), hors document — dans le
 *                         document, chaque succès réamorçait la boucle (audit Codex v2).
 */
// LOT 014, volet G : `customCartItems` retiré du périmètre. Conséquence à connaître —
// `buildSyncDocument` reconstruit le document DE ZÉRO et `syncPush` fait un PUT (remplacement
// entier) : le champ est donc EFFACÉ du cloud dès le premier envoi suivant, pas seulement
// ignoré. Annoncé à Joel le 2026-07-31, décision maintenue.
const SYNC_ARRAY_KEYS = ['ingredients', 'favorites', 'extraIngredients'];

// Une requête pendante bloquait indéfiniment (F9) : délai d'expiration unique (§4.7).
const SYNC_TIMEOUT_MS = 15000;

function fbDocUrl() {
  return `${FB_URL}/users/${encodeURIComponent(FB_USER)}.json`;
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Erreur HTTP porteuse du code de statut : le moteur (js/app.js) distingue un refus
 * serveur 4xx (drapeau maintenu, pas de retry) d'un échec récupérable 5xx/réseau
 * (une seule nouvelle tentative) — règle anti-verrouillage à trois cas (§4.9).
 */
function httpError(prefix, res) {
  const err = new Error(`${prefix}: ${res.statusText || res.status}`);
  err.status = res.status;
  return err;
}

/**
 * Construit le document à envoyer au cloud — copie profonde, périmètre §4.1 strict.
 * @param {Object} state - L'état applicatif complet.
 * @param {Array} shoppingCheckedIds - Coches de courses sérialisées (Set → tableau).
 */
export function buildSyncDocument(state, shoppingCheckedIds = []) {
  const doc = {};
  for (const key of SYNC_ARRAY_KEYS) {
    doc[key] = JSON.parse(JSON.stringify(Array.isArray(state[key]) ? state[key] : []));
  }
  const { apiKey, models, ...aiRest } = state.aiConfig || {};
  doc.aiConfig = JSON.parse(JSON.stringify(aiRest));
  doc.shoppingChecked = [...shoppingCheckedIds];
  return doc;
}

/**
 * Lit un document cloud et le convertit en état applicable CLÉ PAR CLÉ (§4.3) :
 * valeur du cloud si présente, sinon valeur PAR DÉFAUT — JAMAIS la valeur locale
 * (`setState` fusionne : une clé absente y survivrait, contredisant le remplacement
 * entier — constat Codex). Un champ absent est une donnée (« vide »), pas une erreur.
 * Une clé inconnue du périmètre est ignorée, jamais appliquée aveuglément (§4.6).
 * @returns {{patch: Object, checkedIds: Array}}
 */
export function extractSyncedState(cloudDoc) {
  const patch = {};
  for (const key of SYNC_ARRAY_KEYS) {
    patch[key] = Array.isArray(cloudDoc[key]) ? cloudDoc[key] : [];
  }
  // LOT 014, volet C — `typeof [] === 'object'` : l'ancienne garde laissait passer un
  // TABLEAU, dont le spread colle des clés `0/1/2` dans les réglages IA (même famille que
  // le trou d'`importStockOnly`). `estUnObjetSimple` exclut aussi les tableaux.
  const cloudAi = estUnObjetSimple(cloudDoc.aiConfig) ? cloudDoc.aiConfig : {};
  const { apiKey, models, ...aiRest } = cloudAi;
  // Forme toujours complète : sous-champ absent → défaut. La clé API de ce patch est
  // vide et sera de toute façon remplacée par la clé LOCALE (applyExternalState) ;
  // les modèles seront réécrasés par sanitizeGlobalState (SSOT AI_ROLES).
  patch.aiConfig = { ...defaultAiConfig(), ...aiRest };

  const checkedIds = Array.isArray(cloudDoc.shoppingChecked) ? cloudDoc.shoppingChecked : [];
  return { patch, checkedIds };
}

/**
 * Envoie l'état local vers Firebase Cloud (PUT : remplacement entier, §3).
 * @param {Object} state - L'état complet ; seul le périmètre §4.1 part au cloud.
 * @param {Array} shoppingCheckedIds - Coches de courses à inclure.
 * @returns {Promise<Object>} - Le document effectivement envoyé.
 */
export async function syncPush(state, shoppingCheckedIds = []) {
  const doc = buildSyncDocument(state, shoppingCheckedIds);

  const res = await fetchWithTimeout(fbDocUrl(), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(doc)
  });

  if (!res.ok) {
    throw httpError('Erreur Firebase Push', res);
  }

  return doc;
}

/**
 * Récupère les données depuis Firebase Cloud.
 * @returns {Promise<Object|null>} - Les données récupérées ou null si vide.
 */
export async function syncPull() {
  const res = await fetchWithTimeout(fbDocUrl());
  if (!res.ok) {
    throw httpError('Erreur Firebase Pull', res);
  }

  const data = await res.json();
  return data;
}
