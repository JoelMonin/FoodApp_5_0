import { 
  state as moduleState, 
  loadState as loadStateFromModule, 
  saveState as saveStateToModule, 
  shoppingChecked, 
  setState 
} from '../src/state.js';
import { h, toast } from '../src/utils/dom.js';
import {
  generateId,
  normalizeString,
  autoEmoji,
  areSimilar,
  debounce
} from '../src/utils/helpers.js';
import { CATEGORIES, DEFAULT_DB } from '../src/data.js';
import { syncPush, syncPull } from '../src/services/firebase.js';
import { generateRecipes, callAI, transformRecipeFromText } from '../src/services/gemini.js';
import { renderPantryGrid } from '../src/ui/pantry.js';
import { renderShoppingList } from '../src/ui/shopping.js';
import { renderRecipeCard, renderRecipeDetail } from '../src/ui/recipe.js';
import * as Actions from '../src/actions.js';

let state = moduleState;
let _isManualCategory = false;
let _localCategoryFill = false; // true = catégorie posée par détection locale faible (IA peut écraser)
let _addSuggestTimer = null;

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

  // Synchro cloud en arriere-plan : setState declenche 'stateUpdated', donc le re-rendu
  // est automatique quand les donnees arrivent.
  //
  // GARDE-FOU : la reponse du cloud est une photo prise AVANT les gestes de
  // l'utilisateur. Comme l'ecran est desormais interactif pendant l'attente reseau,
  // appliquer cette photo telle quelle effacerait tout ce qu'il a fait entre-temps
  // (setState remplace les tableaux en bloc). On compare donc les donnees locales
  // avant/apres : au moindre changement, la reponse cloud est ecartee pour ce
  // demarrage — les donnees locales sont plus recentes, par construction.
  const localDataFingerprint = () => JSON.stringify([
      state.ingredients, state.customCartItems, state.favorites, state.extraIngredients
  ]);
  const fingerprintBeforeSync = localDataFingerprint();

  // Meme principe pour les champs libres de la config IA : ils ne sont enregistres
  // qu'au clic sur « Sauvegarder ». Une saisie en cours ne doit pas etre reecrite par
  // le retour de la synchro — y compris si l'utilisateur a deja clique ailleurs.
  const AI_FORM_FIELD_IDS = ['api-key-input', 'ai-exceptions', 'ai-exclusions'];
  const aiFormFingerprint = () => JSON.stringify(
      AI_FORM_FIELD_IDS.map(id => document.getElementById(id)?.value ?? null)
  );
  const aiFormBeforeSync = aiFormFingerprint();

  syncPull()
    .then(cloudData => {
        if (!cloudData) return;

        if (localDataFingerprint() !== fingerprintBeforeSync) {
            console.warn('[Sync] Modifications locales pendant la synchro initiale : '
                + 'donnees cloud ecartees pour ce demarrage (aucune perte locale).');
            return;
        }

        const localApiKey = state.aiConfig?.apiKey;
        // La cle API n'est jamais poussee dans le cloud : on preserve celle du poste.
        if (localApiKey && (!cloudData.aiConfig || !cloudData.aiConfig.apiKey)) {
            if (!cloudData.aiConfig) cloudData.aiConfig = {};
            cloudData.aiConfig.apiKey = localApiKey;
        }
        setState(cloudData);
        state = moduleState;

        // Ne pas reecrire une saisie en cours dans le formulaire de config IA.
        if (aiFormFingerprint() === aiFormBeforeSync) {
            restoreAIConfig();
        } else {
            console.warn('[Sync] Saisie en cours dans la configuration IA : champs non reecrits.');
        }
    })
    .catch(e => console.error('Initial Sync failed', e));
});

window.addEventListener('stateUpdated', () => {
    state = moduleState;
    renderCurrentView();
});

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

    const CAT_EMOJI = {
        'Protéines': '🥩', 'Légumes': '🥦', 'Fruits': '🍎',
        'Herbes & aromates': '🌿', 'Épices sèches': '🫙',
        'Produits laitiers': '🧀', 'Alternatives végétales': '🥛',
        'Pâtes, riz & légumes secs': '🍝', 'Conserves & bocaux': '🥫',
        'Sauces & condiments': '🧴', 'Huiles & vinaigres': '🫒',
        'Farines & liants': '🌾', 'Graines & noix': '🌰',
        'Sucres & sirops': '🍬', 'Bouillons & bases': '🍲',
        'Plats & Préparations': '🍱', 'Autres': '📦'
    };

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
        }, `${CAT_EMOJI[cat] || '📦'} ${cat}`))
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
        analyzeNutrition: () => analyzeNutrition(r, source, favId)
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

        const model = state.aiConfig.models?.nutrition || 'gemini-3.6-flash';
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
                analyzeNutrition: () => analyzeNutrition(r, source, favId)
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

function toggleRecipeFullscreen(id) {
    const el = typeof id === 'string' ? document.getElementById(id) : id;
    if (el) el.classList.toggle('fullscreen');
}

function changePplScale(delta) {
    const pplEl = document.getElementById('rd-ppl-count');
    if (!pplEl) return;
    let val = parseInt(pplEl.textContent);
    val = Math.max(1, val + delta);
    pplEl.textContent = val;
    // Note: Quantitative scaling logic could be added here if needed
}

function openEnhancedCartPicker(recipe) {
    closeModal('modal-recipe-detail');
    _currentPickerRecipeName = recipe.name || 'Recette';
    _currentPickerData = (recipe.ingredients || []).map(i => ({
        name: i.n || i.name,
        emoji: i.e || i.emoji || autoEmoji(i.n || i.name, CATEGORIES),
        category: i.c || i.category || 'Autres',
        isMissing: true
    }));
    const listEl = document.getElementById('modal-recipe-cart-list');
    if (listEl) {
        listEl.replaceChildren(..._currentPickerData.map((it, idx) => 
            h('div', { class: 'picker-row', id: `pitem-${idx}` }, [
                h('input', { 
                    type: 'checkbox', 
                    checked: true, 
                    id: `pick-${idx}`,
                    onchange: () => updatePickerRow(idx)
                }),
                h('label', { for: `pick-${idx}`, style: { cursor: 'pointer', flex: 1, marginLeft: '8px' } }, [it.emoji + ' ', it.name])
            ])
        ));
    }
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
    const storageEl = document.getElementById('system-storage');
    if (storageEl) storageEl.textContent = JSON.stringify(state).length + ' bytes';
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

function openModal(id) {
    document.getElementById(id)?.classList.add('open');
    if (id === 'modal-api-config') {
        const keyInput = document.getElementById('api-key-input');
        if (keyInput && state.aiConfig?.apiKey) keyInput.value = state.aiConfig.apiKey;
        const modelSelect = document.getElementById('api-model-complex');
        if (modelSelect && state.aiConfig?.models?.recipeGeneration) {
            modelSelect.value = state.aiConfig.models.recipeGeneration;
        }
    }
}
function closeModal(id) { document.getElementById(id)?.classList.remove('open'); }

let _currentEditingIngId = null;
function openEditEmoji(id) {
    _currentEditingIngId = id;
    const ing = state.ingredients.find(i => i.id === id);
    if (!ing) return;
    document.getElementById('edit-emoji-name').textContent = ing.name;
    document.getElementById('edit-emoji-input').value = ing.emoji;
    openModal('modal-edit-emoji');
}

function saveEmoji() {
    const ing = state.ingredients.find(i => i.id === _currentEditingIngId);
    if (ing) {
        ing.emoji = document.getElementById('edit-emoji-input').value;
        saveState(); // 'stateUpdated' relance le rendu : pas d'appel manuel.
    }
    closeModal('modal-edit-emoji');
}

function renderAdd() {
    _isManualCategory = false;
    _localCategoryFill = false;
    clearTimeout(_addSuggestTimer);
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
        const defaults = ['🧂','🧅','🧄','🥦','🥩','🍎','🥚','🥛'];
        container.replaceChildren(...defaults.map(e => h('span', { class: 'emoji-item emoji-sug-btn', onclick: () => selectEmoji(e) }, e)));
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

        try {
            const prompt = `Tu es un assistant culinaire. Pour l'ingrédient "${val}", réponds en JSON UNIQUEMENT: {"category":"Légumes","emojis":["🥕","🌿","🥦"]}. Catégories possibles: ${CATEGORIES.join(', ')}. Propose 3-5 emojis pertinents.`;
            const model = state.aiConfig.models?.categorySuggest || 'gemini-3.6-flash';
            const raw = await callAI(prompt, apiKey, model, { isJSON: false, temperature: 0.1 });
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
        const model = state.aiConfig.models?.emojiSearch || 'gemini-3.6-flash';
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
        const model = state.aiConfig.models?.emojiSearch || 'gemini-3.6-flash';
        const res = await callAI(prompt, state.aiConfig.apiKey, model, { isJSON: false });
        if (res) {
            const emojis = res.match(/(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g) || [];
            const grid = document.getElementById('edit-emoji-grid');
            if (grid) {
                grid.replaceChildren();
                emojis.forEach(e => {
                    const b = h('button', { 
                        class: 'emoji-btn', 
                        onclick: () => {
                            const editInput = document.getElementById('edit-emoji-input');
                            if (editInput) editInput.value = e;
                        } 
                    }, e);
                    grid.appendChild(b);
                });
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
    const modal = overlay.querySelector('.modal-content') || overlay.querySelector('.modal');
    if (!modal) return;

    let startY = 0;
    let currentY = 0;
    let isSwiping = false;

    modal.addEventListener('touchstart', (e) => {
        const touch = e.touches[0];
        const rect = modal.getBoundingClientRect();
        // Allow swipe from the top 100px (header/drag handle)
        if (touch.clientY - rect.top < 100) {
            startY = touch.clientY;
            isSwiping = true;
            modal.style.transition = 'none';
        }
    }, { passive: true });

    modal.addEventListener('touchmove', (e) => {
        if (!isSwiping) return;
        currentY = e.touches[0].clientY;
        const diff = currentY - startY;
        if (diff > 0) {
            modal.style.transform = `translateY(${diff}px)`;
            const opacity = 1 - (diff / 500);
            overlay.style.backgroundColor = `rgba(0,0,0, ${Math.max(0, opacity * 0.5)})`;
        }
    }, { passive: true });

    modal.addEventListener('touchend', () => {
        if (!isSwiping) return;
        isSwiping = false;
        const diff = currentY - startY;
        if (diff > 100) {
            closeModal(modalId);
        }
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
                else if (activeModal.id === 'modal-edit-emoji') saveEmoji();
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
    openModal, closeModal, saveEmoji, openEditEmoji,
    toggleAiSingle, toggleAiChip, saveAiConfigFromUI, 
    confirmBulkAdd, searchEmojiAddAI, handleAddInput, addIngredient,
    addExtraIngredient, generateRandomWithStock,
    fetchRecipeFromUrl, transformRecipeAI, printRecipe, restoreJSON,
    saveRecipeOnly: () => saveRecipeOnly(_lastTransformedRecipe),
    saveRecipeAndList: () => saveRecipeAndList(_lastTransformedRecipe),
    toggleRecipeFullscreen, changePplScale,
    pullFromFirebase: async () => { const d = await syncPull(); if(d) setState(d); },
    pushToFirebase: async () => { await syncPush(state); toast('Synchronisé !'); },
    exportClipboard, toggleAllPickerItems, deleteFav, searchEmojiAI, selectEmoji,
    // Appelee en inline depuis index.html (oninput du champ de recherche d'emoji) :
    // sans cette exposition, chaque frappe levait une ReferenceError.
    updateEmojiSuggestions: _updateEmojiSuggestionsDebounced
});
