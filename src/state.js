import { AI_ROLES, LOCAL_STORAGE_KEY, LOCAL_STORAGE_CHECKED_KEY } from './constants.js';
import { DEFAULT_DB } from './data.js';

/**
 * Affectation des modèles IA par rôle métier — représentation canonique unique.
 * Utilisée à la fois pour l'état initial et pour écraser les valeurs périmées
 * relues depuis localStorage (cf. sanitizeGlobalState).
 */
function defaultAiModels() {
  return {
    recipeGeneration: AI_ROLES.REASONING,
    nutrition: AI_ROLES.REASONING,
    smartPaste: AI_ROLES.REASONING,
    categorySuggest: AI_ROLES.FAST,
    emojiSearch: AI_ROLES.FAST
  };
}

/**
 * Configuration IA par défaut — représentation canonique unique. Utilisée à la fois
 * pour l'état initial et pour la réinitialisation complète (LOT 008, chantier 5),
 * afin de ne jamais dupliquer la forme de cet objet (SSOT).
 */
export function defaultAiConfig() {
  return {
    apiKey: '',
    models: defaultAiModels(),
    diet: [], exceptions: '', cuisines: [], equip: [],
    meal: 'indifferent', time: 'libre', diff: 'indifferent', ppl: '2',
    creativity: 50, exclusions: ''
  };
}

export let state = {
  ingredients: [],
  customCartItems: [],
  favorites: [],
  aiConfig: defaultAiConfig(),
  extraIngredients: [],
  currentView: 'pantry',
  filter: 'all',
  search: '',
  aiSuggestions: null,
  currentSuggestionIdx: null,
  lastSync: null,
  showInStockOnly: false,
  showInCartOnly: false
};

export let shoppingChecked = new Set();

/**
 * Inscription du moteur de synchro (LOT 007, spec §4.2/§4.5).
 *
 * Restaure le principe du `saveState(push = true)` du monolithe (l.4336-4340) :
 * toute sauvegarde LOCALE planifie un envoi vers le cloud. Ce fichier n'importe
 * JAMAIS `firebase.js` ni le moteur (pas de cycle d'import) : le moteur, hébergé
 * dans `js/app.js`, s'inscrit ici au démarrage. Tant que rien n'est inscrit
 * (tests unitaires, démarrage), la sauvegarde reste purement locale.
 */
let syncScheduler = null;
export function registerSyncScheduler(fn) {
  syncScheduler = fn;
}

/**
 * Barrière de synchro (contre-vérification d'audit Sol, C3) : permet à un chemin
 * EXPLICITE (la réinitialisation) de se sérialiser avec le moteur — annuler tout
 * envoi temporisé et attendre la fin d'une opération en vol — sans que
 * `src/actions.js` n'importe jamais le moteur (pas de cycle). Sans moteur inscrit
 * (tests, démarrage), la barrière est immédiate.
 */
let syncBarrier = null;
export function registerSyncBarrier(fn) {
  syncBarrier = fn;
}
export function awaitSyncQuiescence() {
  return syncBarrier ? syncBarrier() : Promise.resolve();
}

/**
 * Remplace le contenu du Set des coches de courses (réception d'un pull, §4.1).
 * `shoppingChecked` est un export ESM non réassignable depuis l'extérieur :
 * on mute le Set en place, jamais par affectation côté appelant (réserve Codex).
 */
export function replaceShoppingChecked(ids) {
  shoppingChecked.clear();
  (Array.isArray(ids) ? ids : []).forEach(id => shoppingChecked.add(id));
}

/**
 * Charge l'état depuis le localStorage.
 */
export function loadState() {
  try {
    const s = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (s) {
      const p = JSON.parse(s);
      state = { ...state, ...p };
    }
    
    const sc = localStorage.getItem(LOCAL_STORAGE_CHECKED_KEY);
    if (sc) shoppingChecked = new Set(JSON.parse(sc));
  } catch (e) {
    console.error('Load Error:', e);
  }

  sanitizeGlobalState();

  // Reset search and filters for safety
  state.search = "";
  state.filter = "all";
  state.showInStockOnly = false;
  state.showInCartOnly = false;
}

/**
 * Sauvegarde l'état dans le localStorage.
 *
 * @param {boolean} updateUI - Si true, déclenche un rendu (événement `stateUpdated`).
 * @param {boolean} scheduleSync - Si true, planifie un envoi cloud via le moteur
 *   inscrit (LOT 007). Le chemin « application d'un pull » sauvegarde avec `false`
 *   pour ne JAMAIS réémettre ce qu'il vient de recevoir — le contrat exact du
 *   `saveState(false)` du monolithe (§4.5 : la planification vit ICI, pas dans
 *   l'événement `stateUpdated`, que `saveState(false)` supprime déjà).
 */
export function saveState(updateUI = true, scheduleSync = true) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
    localStorage.setItem(LOCAL_STORAGE_CHECKED_KEY, JSON.stringify(Array.from(shoppingChecked)));
    if (scheduleSync && syncScheduler) syncScheduler();
    if (updateUI) {
        // Dispatch custom event for decoupling
        window.dispatchEvent(new CustomEvent('stateUpdated'));
    }
  } catch (e) {
    console.error('Save Error:', e);
  }
}

/**
 * Nettoie et valide la structure de l'état.
 */
export function sanitizeGlobalState() {
  if (!state) return;

  ['ingredients', 'extraIngredients', 'favorites'].forEach(key => {
    if (state[key] && !Array.isArray(state[key])) {
      state[key] = Object.values(state[key]);
    }
  });

  if (!state.customCartItems) state.customCartItems = [];

  state.ingredients = (state.ingredients || []).filter(i => i && typeof i === 'object');

  // Repli sur la base par défaut (~273 ingrédients) si l'inventaire est vide ou
  // absent — comportement hérité du monolithe (`buildIngredients`, LOT 008 chantier 4).
  // Se déclenche aussi bien au premier lancement qu'après suppression du dernier
  // ingrédient : c'est assumé, pas un bug (cf. fiche du lot).
  if (state.ingredients.length === 0) {
    state.ingredients = DEFAULT_DB.map(d => ({
      ...d,
      inStock: false,
      inCart: false,
      pinned: false,
      shoppingSource: null
    }));
  }

  state.ingredients.forEach(i => {
    if (i.n && !i.name) i.name = i.n;
    if (!i.category) i.category = 'Autres';
    if (!i.emoji) i.emoji = '❓';
    i.inStock = !!i.inStock;
    i.inCart = !!i.inCart;
    i.pinned = !!i.pinned;
    if (i.shoppingSource === undefined) i.shoppingSource = null;
  });

  if (!state.aiConfig) state.aiConfig = { apiKey: '' };

  // Force la mise à jour des modèles à chaque chargement
  // pour écraser les valeurs périmées stockées en localStorage
  state.aiConfig.models = defaultAiModels();
}

/**
 * Met à jour l'état partiellement.
 *
 * Tous les appelants injectent des données EXTERNES (synchro cloud, restauration
 * d'un fichier JSON). Elles passent donc par le même assainissement que le
 * localStorage : sans cela, un ancien `aiConfig.models` stocké dans le cloud
 * réinjectait des modèles IA hors service (incident « gemini-2.0-flash », 28/07/2026).
 *
 * @param {Object} partialState
 * @param {{scheduleSync?: boolean}} [options] - `scheduleSync: false` pour une
 *   application issue de la synchro (ne replanifie jamais d'envoi, §4.5).
 */
export function setState(partialState, { scheduleSync = true } = {}) {
  state = { ...state, ...partialState };
  sanitizeGlobalState();
  saveState(true, scheduleSync);
}

/**
 * Point d'entrée UNIQUE pour toute donnée EXTERNE : synchro cloud au démarrage,
 * bouton Cloud Sync, restauration totale de fichier (LOT 008, casse C3b + F8).
 *
 * La clé API locale est préservée de façon INCONDITIONNELLE — même si la donnée
 * externe contient une clé différente ou vide, la clé du poste l'emporte toujours.
 * C'est plus strict que l'ancien `applyCloudState` (`js/app.js`), qui ne préservait
 * la clé locale que si le cloud n'en avait aucune : un fichier restauré ou un cloud
 * contenant une AUTRE clé écrasait silencieusement la bonne.
 *
 * @param {Object|null} data
 * @param {{scheduleSync?: boolean}} [options] - `scheduleSync: false` quand la donnée
 *   vient de la synchro elle-même (anti-boucle, §4.5). La restauration d'un fichier
 *   garde le défaut `true` : restaurer = restaurer partout (§4.9.3).
 * @returns {boolean} vrai si des données ont été appliquées.
 */
export function applyExternalState(data, { scheduleSync = true } = {}) {
  if (!data) return false;

  const localApiKey = state.aiConfig?.apiKey || '';
  setState({
    ...data,
    aiConfig: { ...(data.aiConfig || {}), apiKey: localApiKey }
  }, { scheduleSync });
  return true;
}
