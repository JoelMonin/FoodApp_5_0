import { AI_ROLES, LOCAL_STORAGE_KEY, LOCAL_STORAGE_CHECKED_KEY } from './constants.js';

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

export let state = {
  ingredients: [],
  customCartItems: [],
  favorites: [],
  aiConfig: {
    apiKey: '',
    models: defaultAiModels(),
    diet: [], exceptions: '', cuisines: [], equip: [],
    meal: 'indifferent', time: 'libre', diff: 'indifferent', ppl: '2',
    creativity: 50, exclusions: ''
  },
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
 * @param {boolean} updateUI - Si true, déclenche un rendu (à implémenter via event ou callback)
 */
export function saveState(updateUI = true) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
    localStorage.setItem(LOCAL_STORAGE_CHECKED_KEY, JSON.stringify(Array.from(shoppingChecked)));
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
 */
export function setState(partialState) {
  state = { ...state, ...partialState };
  sanitizeGlobalState();
  saveState();
}
