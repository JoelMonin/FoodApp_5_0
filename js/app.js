import {
  state as moduleState,
  loadState as loadStateFromModule,
  saveState as saveStateToModule,
  shoppingChecked,
  applyExternalState,
  registerSyncScheduler,
  registerSyncBarrier,
  replaceShoppingChecked,
  defaultAiConfig
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
import { guessCategoryLocally, sanitizeCategory } from '../src/utils/categorize.js';
// Gardes d'entrée des données externes — SSOT (LOT 014, volet C).
import { validateState, isValidRecipe, escapePromptValue } from '../src/utils/validate.js';
// Composition des textes de partage — extraite d'ici au LOT 014, volet A.
import { buildClipboardText, writeToClipboard } from '../src/services/exports.js';
import { AI_ROLES, LOCAL_STORAGE_SYNC_REF_KEY, FB_USER, LOCAL_STORAGE_KEY, MAX_PINNED_INGREDIENTS, MAX_EXTRA_INGREDIENTS } from '../src/constants.js';
import { syncPush, syncPull, buildSyncDocument, extractSyncedState } from '../src/services/firebase.js';
import { generateRecipes, callAI, transformRecipeFromText } from '../src/services/gemini.js';
import { renderPantryGrid } from '../src/ui/pantry.js';
import { renderShoppingList } from '../src/ui/shopping.js';
import { renderRecipeCard, renderRecipeDetail, renderFavoriteCard } from '../src/ui/recipe.js';
import * as Actions from '../src/actions.js';

// LOT 014, volet B — `const` : depuis que `src/state.js` MUTE son état au lieu de le
// remplacer (`Object.assign` dans `setState`/`loadState`), cet alias reste valide pour
// toujours. Les trois rattrapages `state = moduleState` qui suivaient chaque réassignation
// (ex-l.62, :96, :422) ont disparu ; `const` interdit qu'un quatrième réapparaisse.
const state = moduleState;
let _isManualCategory = false;
let _localCategoryFill = false; // true = catégorie posée par détection locale faible (IA peut écraser)
let _addSuggestTimer = null;
// Incremente a chaque requete de suggestion IA : seule la derniere lancee a le droit
// d'appliquer sa reponse (cf. handleAddInput).
let _aiSuggestGenId = 0;
// LOT 011 (trouve par l'audit du sous-lot 11A) : deux generations de recettes concurrentes
// (bouton normal + 🎲, ou deux clics rapides sur 🎲) pouvaient se marcher dessus — chacune
// restaure "sa" creativite sauvegardee dans un finally, et la derniere a finir l'emporte
// meme si elle a lu une valeur deja corrompue par l'autre. Un seul point d'entree
// (generateSuggestions) refuse desormais tout lancement pendant qu'un autre est en cours.
let _generationInFlight = false;

// Filet de sécurité emoji ingrédient (LOT 010, casse C12, durci après audit Codex Terra) :
// un prompt IA sans indication de format a pu, par le passé, faire dériver du texte (une
// unité comme "g") dans le champ emoji. Ancré sur la chaîne ENTIÈRE (`.test()` cherche
// n'importe où par défaut — une valeur mixte comme "g🐟" passait sinon). `\p{Emoji}️`
// (sélecteur de variante 16) couvre en plus les emojis à présentation texte par défaut,
// explicitement forcés en emoji. SSOT (LOT 011) : partagé par le sélecteur de courses et
// le détail de recette — un correctif de sécurité ne doit vivre qu'à un seul endroit.
const AI_EMOJI_ONLY = /^(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F)+$/u;

function saveState(updateUI = true) { saveStateToModule(updateUI); }

const expose = (fns) => {
  for (const [name, fn] of Object.entries(fns)) {
    window[name] = fn;
  }
};

window.addEventListener('DOMContentLoaded', async () => {
  loadStateFromModule();

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

  initFieldEnterShortcuts();
  initChipsRowTouchScroll();

  // Synchro cloud : moteur bidirectionnel (LOT 007). Le pull de demarrage part en
  // arriere-plan — l'ecran ne depend jamais du reseau (acquis LOT 005). Les
  // garde-fous d'empreinte (donnees locales + formulaire IA) qui vivaient ici sont
  // GENERALISES a tous les pulls, dans performSyncPull.
  initSyncEngine();

  initSearchAutofillGuard();
});

window.addEventListener('stateUpdated', () => {
    renderCurrentView();
});
// LOT 014, volet A — LE MOTEUR DE SYNCHRO A DEMENAGE dans `src/services/sync.js`
// (deplacement pur, 438 lignes). Les noms restent republies a l'identique par le bloc
// `export {}` plus bas : les tests du LOT 007 n'ont pas eu a etre touches, ce qui est
// exactement la garantie recherchee pendant un deplacement de code.
import {
  initSyncEngine, scheduleSyncPush, requestSyncOp, performSyncSend, performSyncPull,
  setSyncStatus, isSyncPending, syncEngineBarrier, __resetSyncEngineForTests,
  updateNetworkInfo, SYNC_LAST_KEY, registerSyncUi
} from '../src/services/sync.js';

// Les DEUX dependances d'interface du moteur, injectees ici pour eviter un import
// circulaire (cf. en-tete de sync.js) : re-lecture du formulaire IA apres un pull applique,
// et rafraichissement du panneau systeme apres un succes.
registerSyncUi({ restoreAiForm: restoreAIConfig, refreshSystemInfo: updateSystemInfo });

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
    initSwipeToClose,
    // LOT 010 — exportés uniquement pour les tests unitaires (mêmes raisons qu'au-dessus).
    toggleAiChip,
    restoreAIConfig,
    renderImposedCapHint,
    addExtraIngredient,
    renderExtraChips,
    updateAIContextSub,
    refreshImposedZone,
    removeExtraIngredient,
    getFilteredIngredients,
    guessCategoryLocally,
    sanitizeCategory,
    openRecipeDetail,
    analyzeNutrition,
    changePplScale,
    renderRecipeModal,
    openEnhancedCartPicker,
    renderAiModelsInfo,
    saveApiKey,
    openModal,
    // LOT 011 — exportés uniquement pour les tests unitaires (mêmes raisons qu'au-dessus).
    generateRandomWithStock,
    fetchRecipeFromUrl,
    renderAIResults,
    renderFavorites,
    saveSuggestionToFavDirect,
    saveRecipeOnly,
    saveRecipeAndList,
    deleteFav,
    savePastedRecipe,
    savePastedRecipeAndList,
    buildIngredientTags,
    transformRecipeAI,
    generateSuggestions,
    // LOT 012 — exportés uniquement pour les tests unitaires (mêmes raisons qu'au-dessus).
    cycleEmoji,
    confirmRecipeToCart,
    initFieldEnterShortcuts,
    initChipsRowTouchScroll,
    initSearchAutofillGuard,
    clearSearch,
    renderTopbar,
    updateBadges,
    addIngredient,
    addIngredientFromDb
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
    else if (view === 'ai') { renderAI(); refreshImposedZone(); renderImposedCapHint(); }
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

// Sous-titre "N recette(s)" — partagé par les deux clés 'fav'/'favorites' (alias de la
// meme vue, cf. `viewMap` de `renderCurrentView`), pour ne pas dupliquer le calcul.
const _favCountSub = () => {
    const n = state.favorites.length;
    return n + ' recette' + (n > 1 ? 's' : '');
};

/**
 * LOT 012, zone C (oracle `updateTopbar`, l.4520-4579) — barre superieure contextuelle,
 * icones mobiles et sous-titres, restaures au mot pres (table verifiee par l'audit de
 * spec Codex). `.mh-icons` n'est JAMAIS remplace en bloc (contrairement a l'oracle) :
 * `#sync-indicator-mobile` (LOT 007) porte son etat thinking/success/error dans sa
 * classe et son texte, un `innerHTML=` le reinitialiserait silencieusement a chaque
 * changement de vue — l'oracle pouvait se le permettre, son propre voyant est statique.
 */
function renderTopbar(view) {
    const titles = {
        pantry: 'Inventaire',
        shopping: 'Liste de courses',
        ai: 'Recettes IA',
        favorites: 'Recettes favorites',
        fav: 'Recettes favorites',
        export: 'Réglages',
        settings: 'Réglages',
        add: 'Ajouter un ingrédient'
    };
    // Note de portage : l'oracle a un bug d'espace pour n=1 côté "ai" ('ingrédient' +
    // 'en stock' → « ingrédienten stock », collé) — typo, pas une intention, corrigée
    // silencieusement (espace ajouté) comme le code mort de la zone A ne l'a pas été.
    const subs = {
        pantry: () => countStockAndCart().stock + ' en stock',
        shopping: () => {
            const n = countStockAndCart().cart;
            return n + ' article' + (n > 1 ? 's' : '');
        },
        ai: () => {
            const n = countStockAndCart().stock;
            return 'basé sur ' + n + ' ingrédient' + (n > 1 ? 's en stock' : ' en stock');
        },
        favorites: _favCountSub,
        fav: _favCountSub
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

    // Sous-titre mobile — meme table que le desktop.
    const mhSub = document.getElementById('mh-subtitle');
    if (mhSub) mhSub.textContent = (subs[view] ? subs[view]() : null) || titles[view] || view;

    // Barre de recherche desktop masquee hors inventaire (oracle l.4542-4547).
    const tbSearch = document.getElementById('tb-search-wrap');
    if (tbSearch) {
        tbSearch.style.display = (view === 'pantry') ? 'flex' : 'none';
        const searchInput = document.getElementById('search-input');
        if (searchInput) searchInput.value = state.search;
    }

    // Bouton d'action contextuel desktop (oracle l.4549-4563) — classes CSS deja posees
    // (`.tb-btn-add`, `.tb-btn`, `.tb-btn.terra`, `.tb-icon-btn`, `.tb-btn.primary`),
    // aucune a creer. Remplacement complet a chaque rendu : sans etat a proteger ici,
    // contrairement a l'icone mobile ci-dessous.
    const actionEl = document.getElementById('top-action-btn');
    if (actionEl) {
        if (view === 'pantry') {
            actionEl.replaceChildren(h('button', {
                class: 'tb-btn-add', title: 'Ajouter un ingrédient', onclick: () => switchView('add')
            }, '＋'));
        } else if (view === 'shopping') {
            actionEl.replaceChildren(
                h('button', { class: 'tb-btn', onclick: () => exportClipboard('cart') }, '📋 Copier'),
                h('button', { class: 'tb-btn terra', onclick: () => resetCart() }, '🗑️ Vider')
            );
        } else if (view === 'ai') {
            actionEl.replaceChildren(h('button', {
                class: 'tb-icon-btn', title: 'Config API', onclick: () => openModal('modal-api-config')
            }, '⚙️'));
        } else if (view === 'favorites' || view === 'fav') {
            actionEl.replaceChildren(h('button', {
                class: 'tb-btn primary', onclick: () => openModal('modal-paste-recipe')
            }, '📋 Coller une recette'));
        } else {
            actionEl.replaceChildren();
        }
    }

    // Icone mobile contextuelle (oracle l.4565-4578) — mise a jour CHIRURGICALE d'un
    // noeud STABLE (jamais recree), `.onclick =` et non `addEventListener` : sans ca,
    // chaque changement de vue empilerait un nouveau gestionnaire sur le meme noeud.
    const mhIcon = document.getElementById('mh-context-icon');
    if (mhIcon) {
        if (view === 'pantry') {
            mhIcon.textContent = '+';
            mhIcon.style.cssText = 'background:var(--green);color:white;font-weight:bold';
            mhIcon.onclick = () => switchView('add');
        } else if (view === 'ai') {
            mhIcon.textContent = '⚙️';
            mhIcon.style.cssText = '';
            mhIcon.onclick = () => openModal('modal-api-config');
        } else if (view === 'favorites' || view === 'fav') {
            mhIcon.textContent = '📋';
            mhIcon.style.cssText = '';
            mhIcon.onclick = () => openModal('modal-paste-recipe');
        } else {
            mhIcon.style.cssText = 'display:none';
            mhIcon.onclick = null;
        }
    }
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

    // LOT 013 (écart d'ancrage autorisé) : `data-filter` est un attribut de TEST pur, posé
    // ici pour la première fois — contrairement à `data-val` des puces IA (js/app.js §aiConfig),
    // aucun code applicatif ne le lit. Ne pas le confondre avec un attribut fonctionnel.
    const chips = [
        // "Tous" — remet tout à zéro
        h('div', {
            class: `chip ${state.filter === 'all' && !state.showInStockOnly && !state.showInCartOnly ? 'active' : ''}`,
            'data-testid': 'filter-chip',
            'data-filter': 'all',
            onclick: () => resetFilters()
        }, 'Tous'),

        // Toggles combinables
        ...toggles.map(t => h('div', {
            class: `chip ${t.cls} ${state[t.key] ? 'active' : ''}`,
            'data-testid': 'filter-chip',
            'data-filter': t.key,
            onclick: t.onclick
        }, `${t.emoji}${t.label}`)),

        // Filtres exclusifs
        ...exclusifs.map(s => h('div', {
            class: `chip ${s.cls} ${state.filter === s.val ? 'active' : ''}`,
            'data-testid': 'filter-chip',
            'data-filter': s.val,
            onclick: () => setFilter(s.val)
        }, `${s.emoji}${s.label}`)),

        // Catégories
        ...CATEGORIES.map(cat => h('div', {
            class: `chip ${state.filter === cat ? 'active' : ''}`,
            'data-testid': 'filter-chip',
            'data-filter': cat,
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

    // 4. Tri alphabétique (LOT 010, casse C11) — porté depuis l'oracle
    // (`foodapp-v5-Joel.html` l.4646). N'affecte QUE la grille d'inventaire : l'export
    // presse-papier lit `state.ingredients` directement via `groupByCategory`, dont le
    // tri « par défaut volontaire » (LOT 005) reste intact — chemins disjoints, vérifié
    // en phase découverte du lot.
    return list.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr'));
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

// Textes d'attente animés pendant la génération (LOT 011, chantier 5 ; oracle
// l.5052-5058, littéraux exacts).
const AI_LOADING_TEXTS = ["Analyse du stock...", "Recherche d'idées...", "Rédaction des recettes..."];

async function generateSuggestions() {
  if (_generationInFlight) { toast('Une génération est déjà en cours…', 'error'); return; }
  const apiKey = state.aiConfig.apiKey;
  if (!apiKey) { toast('Clé API Gemini requise', 'error'); openModal('modal-api-config'); return; }
  const stockItems = state.ingredients.filter(i => i.inStock);
  if (stockItems.length === 0) { toast('Inventaire vide', 'error'); return; }

  _generationInFlight = true;
  const btn = document.getElementById('generate-btn');
  btn.disabled = true;
  btn.classList.add('loading');

  // Rotation toutes les 2,5 s dans l'attribut lu par le CSS (`content: attr(data-loading-text)`,
  // déjà câblé). `clearInterval` garanti dans le `finally`, quel que soit le chemin de sortie.
  let loadingTextIdx = 0;
  btn.setAttribute('data-loading-text', AI_LOADING_TEXTS[0]);
  const loadingInterval = setInterval(() => {
    loadingTextIdx = (loadingTextIdx + 1) % AI_LOADING_TEXTS.length;
    btn.setAttribute('data-loading-text', AI_LOADING_TEXTS[loadingTextIdx]);
  }, 2500);

  try {
    const recipes = await generateRecipes(apiKey, stockItems, state.aiConfig, state.ingredients, state.extraIngredients, {
      // LOT 011 : si l'API rejette le niveau d'effort demande et que le repli reussit quand
      // meme, Joel doit le savoir au moment meme (demande explicite) — jamais silencieux.
      onThinkingFallback: () => toast('Recettes générées sans le mode réflexion approfondie (temporairement indisponible).')
    });
    state.aiSuggestions = recipes;
    // renderAIResults(recipes); // No need, saveState() will trigger auto-render
    saveState();

    // Scroll auto vers les résultats sur mobile (LOT 011, chantier 5 ; oracle l.5068-5072).
    setTimeout(() => {
      if (window.innerWidth < 768) {
        document.getElementById('ai-results-col')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  } catch (e) {
    toast('Erreur IA : ' + e.message, 'error');
  } finally {
    clearInterval(loadingInterval);
    _generationInFlight = false;
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
    grid.replaceChildren(...recipes.map((r, i) => {
        const tags = buildIngredientTags(r.ingredients, 'card');
        const handlers = {
            openRecipeDetail,
            saveToFavorites: () => saveSuggestionToFavDirect(r),
            addMissingToCart: () => openEnhancedCartPicker(r)
        };
        return renderRecipeCard(r, i, handlers, tags);
    }));
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

// LOT 010 (casse C12) — état du modal recette ouvert, module-level comme dans l'oracle
// (`_originalPpl`/`_currentScale`, `foodapp-v5-Joel.html` l.5357-5359). `_originalPpl`
// est LA référence : `_currentScale` en est toujours dérivé, jamais accumulé, ce qui
// évite toute dérive d'arrondi d'un changement à l'autre.
let _currentRecipeDetail = null;
let _currentRecipeSource = 'ai';
let _currentRecipeFavId = null;
let _originalPpl = 2;
let _currentScale = 1;

function buildRecipeHandlers(r, source, favId) {
    return {
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
    };
}

/**
 * Re-rend le modal recette avec l'échelle courante (LOT 010, casse C12).
 * Point d'entrée UNIQUE du rendu du modal : `openRecipeDetail` (nouvelle ouverture,
 * échelle réinitialisée), `changePplScale` (échelle changée) et `analyzeNutrition`
 * (échelle PRÉSERVÉE — l'analyse ne doit jamais remettre à 1 un choix déjà fait) s'y
 * appellent tous, jamais un `replaceChildren` direct.
 */
function renderRecipeModal() {
    const modal = document.getElementById('modal-recipe-detail');
    if (!modal || !_currentRecipeDetail) return;
    const tags = buildIngredientTags(_currentRecipeDetail.ingredients, 'detail');
    modal.replaceChildren(renderRecipeDetail(
        _currentRecipeDetail,
        _currentRecipeSource,
        buildRecipeHandlers(_currentRecipeDetail, _currentRecipeSource, _currentRecipeFavId),
        _currentScale,
        tags
    ));
}

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

    _currentRecipeDetail = r;
    _currentRecipeSource = source;
    _currentRecipeFavId = favId;
    _originalPpl = parseInt(r.people || r.ppl) || 2;
    _currentScale = 1;

    renderRecipeModal();
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
        // LOT 010 (casse C12) : re-rend via le point d'entrée unique, qui PRÉSERVE
        // l'échelle courante — une analyse ne doit jamais remettre le nombre de
        // personnes à sa valeur d'origine si l'utilisateur l'avait déjà changé.
        renderRecipeModal();
        toast('Analyse nutritionnelle terminée !');
    } catch (e) {
        console.error(e);
        toast("Erreur analyse nutrition", 'error');
        if (btn) {
            btn.disabled = false;
            // LOT 011 (chantier 2) : même libellé qu'à l'affichage initial du bouton
            // (`src/ui/recipe.js`, NUTRI_BTN_LABEL) — sans ce rappel, un échec laissait
            // un texte plus court que celui rendu la première fois.
            btn.textContent = '🔍 Estimer la valeur nutritionnelle (IA)';
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

/**
 * Recalcule les quantités affichées selon le nombre de personnes (LOT 010, casse
 * C12). Porté depuis l'oracle (`foodapp-v5-Joel.html` l.5467-5472) : la nouvelle
 * échelle se calcule TOUJOURS depuis `_originalPpl`, jamais en cumulant sur la
 * précédente — c'est ce qui garantit l'absence de dérive d'arrondi. Bornes 1-20 :
 * au-delà, le clic est sans effet.
 */
function changePplScale(delta) {
    const newPpl = (_originalPpl * _currentScale) + delta;
    if (newPpl < 1 || newPpl > 20) return;
    _currentScale = newPpl / _originalPpl;
    renderRecipeModal();
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
    // LOT 011 (décision D3) : ajouts PURS pour les tags colorés des cartes/détail —
    // `isPinned` (préfixe 📌) et `allMatchesInStock` (info-bulle « Correspond à… »).
    // La sémantique de inStock/matchedName/isExact n'est pas touchée : figée par le
    // sélecteur de liste de courses et ses tests (pare-feu A/B).
    const isPinned = state.ingredients.some(i => i.pinned && areSimilar(name, i.name));
    const allMatchesInStock = state.ingredients.filter(i => i.inStock && areSimilar(name, i.name));

    // L'IA annonce l'ingrédient comme déjà possédé : on la croit, mais on affiche
    // quand même à quoi il correspond dans l'inventaire si on le retrouve.
    if (aiStatus === 'stock' || aiStatus === 'pinned') {
        return { inStock: true, matchedName: inventoryMatch?.name || null, isExact, isPinned, allMatchesInStock };
    }
    if (aiStatus === 'missing') {
        return { inStock: false, matchedName: inventoryMatch?.name || null, isExact, isPinned, allMatchesInStock };
    }

    return {
        inStock: !!inventoryMatch?.inStock,
        matchedName: inventoryMatch?.name || null,
        isExact,
        isPinned,
        allMatchesInStock
    };
}

/**
 * Construit les tags colorés d'ingrédients (LOT 011, chantiers 1/2/7). Réutilise
 * `matchIngredientToStock` (SSOT, LOT 006 étendue au LOT 011) plutôt que de dupliquer
 * une logique de correspondance. Deux styles d'info-bulle, vérifiés distincts dans
 * l'oracle (fiche LOT 011 §10-G) : les cartes précisent le statut, le détail non plus
 * concis.
 * @param {Array} ingredients
 * @param {'card'|'detail'} tooltipStyle
 */
function buildIngredientTags(ingredients, tooltipStyle) {
    return (ingredients || []).map(ing => {
        const name = ing.n || ing.name || '';
        const category = ing.c || ing.category || 'Autres';
        const status = matchIngredientToStock(ing);
        // Ordre significatif, trouvé en testant : `isExact` (LOT 006) se calcule
        // INDÉPENDAMMENT du stock (le nom le plus proche, même sur un ingrédient épuisé) —
        // sans `inStock` en premier filtre, un nom exact mais épuisé ressortait vert.
        const cls = !status.inStock ? 'red' : (status.isExact ? 'green' : 'orange');
        const matches = (status.allMatchesInStock || []).map(m => m.name).join(', ');
        // Même filet de sécurité que le sélecteur de courses (SSOT, `AI_EMOJI_ONLY`) :
        // un ingrédient de recette peut porter le même défaut de format.
        const aiEmoji = ing.e && AI_EMOJI_ONLY.test(ing.e.trim()) ? ing.e : null;

        let tooltip = name;
        if (tooltipStyle === 'card') {
            if (status.isExact) tooltip += ` (En stock : ${status.matchedName})`;
            else if (status.inStock) tooltip += ` (Estimation basée sur : ${matches})`;
            else tooltip += ' (Manquant)';
        } else if (status.inStock) {
            tooltip += ` (Stock : ${matches})`;
        }

        return {
            name,
            cls,
            tooltip,
            isPinned: status.isPinned,
            emoji: aiEmoji || autoEmoji(name, DEFAULT_DB, getCategoryEmoji(category))
        };
    });
}

function openEnhancedCartPicker(recipe) {
    closeModal('modal-recipe-detail');
    _currentPickerRecipeName = recipe.name || 'Recette';
    _currentPickerData = (recipe.ingredients || []).map(i => {
        const name = i.n || i.name;
        const category = i.c || i.category || 'Autres';
        const status = matchIngredientToStock(i);
        // Filet de sécurité emoji : cf. la constante module-level `AI_EMOJI_ONLY`
        // (LOT 010, casse C12 ; remontée au niveau module par le LOT 011, chantier 2,
        // pour rester SSOT avec le détail de recette).
        const aiEmoji = i.e && AI_EMOJI_ONLY.test(i.e.trim()) ? i.e : null;
        return {
            name,
            category,
            // Emoji : celui de l'IA (validé), sinon celui de la base d'ingredients,
            // sinon celui de la categorie.
            emoji: aiEmoji || i.emoji || autoEmoji(name, DEFAULT_DB, getCategoryEmoji(category)),
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

            // Edition par ligne (LOT 012, zone A) : pas de <label> autour du contenu
            // (contrairement à l'ancien rendu) — fidèle à la structure de l'oracle, et
            // ça évite tout risque de double-déclenchement de la case au clic sur les
            // champs édités désormais imbriqués. Seule la case à cocher coche/décoche.
            const contentChildren = [
                h('input', { class: 'picker-name-inp', id: `pick-name-${idx}` , value: it.name }),
                h('div', { class: 'picker-cat-label' }, it.category)
            ];
            if (it.matchedName) {
                contentChildren.push(h('div', { class: 'picker-match-info' },
                    it.isMissing
                        ? `Correspond à « ${it.matchedName} », pas en stock`
                        : `Déjà en stock : « ${it.matchedName} »`));
            }
            contentChildren.push(h('input', { type: 'hidden', id: `pick-cat-${idx}`, value: it.category }));

            // `h()` pose les props via setAttribute : pour un booleen HTML comme "checked",
            // la seule PRESENCE de l'attribut coche la case, meme passe `false` (defaut
            // preexistant du LOT 006, trouve par les tests de non-regression de ce chantier
            // — un seul point d'appel dans toute la base, corrige ici). Affectation directe
            // de la propriete IDL pour un rendu initial fidele a `it.isMissing`.
            const checkboxEl = h('input', {
                id: `pick-${idx}`,
                type: 'checkbox',
                onchange: () => updatePickerRow(idx)
            });
            checkboxEl.checked = checked;

            return h('div', {
                class: `picker-item ${checked ? 'checked' : ''} ${softMatch ? 'soft-match' : ''}`,
                id: `pitem-${idx}`
            }, [
                checkboxEl,
                h('div', { class: 'picker-emoji-wrap' }, [
                    h('input', { class: 'picker-emoji-inp', id: `pick-emoji-${idx}`, value: it.emoji, readonly: true }),
                    h('button', { class: 'picker-magic-btn', title: "Changer l'émoji", onclick: () => cycleEmoji(idx) }, '🎲')
                ]),
                h('div', { class: 'picker-content' }, contentChildren),
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
        if (!chk.checked) return;
        const original = _currentPickerData[i];
        const nameInp = document.getElementById(`pick-name-${i}`);
        const emojiInp = document.getElementById(`pick-emoji-${i}`);
        const catInp = document.getElementById(`pick-cat-${i}`);
        // Lit les valeurs EDITEES (LOT 012, zone A) plutot que l'original. Distinction
        // (audit Codex) entre "input absent" (repli defensif sur l'original, ne devrait
        // pas arriver) et "nom vide par un input present" (Joel a efface le champ :
        // refus propre de cette ligne, jamais de repli silencieux sur l'ancien nom).
        if (nameInp && !nameInp.value.trim()) return;
        const name = nameInp ? nameInp.value.trim() : original.name;
        const emoji = (emojiInp ? emojiInp.value.trim() : '') || original.emoji;
        const category = catInp ? catInp.value : original.category;

        const existing = state.ingredients.find(ing => areSimilar(ing.name, name));
        if (existing) {
            existing.inCart = true;
            existing.shoppingSource = _currentPickerRecipeName;
        } else {
            const id = generateId('ing');
            state.ingredients.push({
                name, category, emoji, id,
                inStock: false, inCart: true,
                shoppingSource: _currentPickerRecipeName
            });
        }
    });
    saveState();
    closeModal('modal-recipe-to-cart');
    toast('Course ajoutée !');
}

/**
 * Favoris riches (LOT 011, chantier 7). Composant DÉDIÉ (`renderFavoriteCard`), distinct
 * de `renderRecipeCard` (trouvé par l'audit du sous-lot 11A : les deux écrans réutilisaient
 * la même carte sans lui passer les mêmes handlers — un bouton ajouté à l'un aurait planté
 * au clic dans l'autre). État vide enrichi avec CTA vers le collage, oracle l.5871.
 */
function renderFavorites() {
    const el = document.getElementById('fav-list');
    if (!el) return;
    if (!state.favorites || state.favorites.length === 0) {
        el.replaceChildren(h('div', { class: 'fav-empty' }, [
            h('div', { class: 'fav-empty-icon' }, '📖'),
            h('div', { class: 'fav-empty-title' }, 'Aucune recette favorite'),
            h('div', { style: { fontSize: '13px', color: 'var(--txt-soft)' } },
                'Sauvegardez une recette via les Recettes IA ou en collant un texte.'),
            h('button', {
                class: 'tb-btn primary',
                style: { margin: '16px auto 0', display: 'flex' },
                onclick: () => openModal('modal-paste-recipe')
            }, '📋 Coller une recette')
        ]));
        return;
    }
    el.replaceChildren(...state.favorites.map(fav => {
        const r = fav.recipe || fav; // Repli si les données sont plates (forme canonique).
        const tags = buildIngredientTags(r.ingredients, 'card');
        const handlers = {
            openFav: () => openRecipeDetail(fav.id, 'fav'),
            deleteFavorite: () => deleteFav(fav.id)
        };
        return renderFavoriteCard(fav, handlers, tags);
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
    state.favorites.push({ ...r, id: generateId('fav'), date: new Date().toLocaleDateString('fr-FR') });
    saveState();
    toast('Ajouté aux favoris !');
}

function saveRecipeOnly(r) {
    if (!r) return;
    state.favorites.push({ ...r, id: generateId('fav'), date: new Date().toLocaleDateString('fr-FR') });
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
 * Construit le favori à partir de la fenêtre « Coller une recette » — recette structurée
 * si transformée par l'IA, texte brut sinon. Restaure un chemin cassé par le LOT 006
 * (arbitrage Joel A1, fiche LOT 011 §12) : `_lastTransformedRecipe` n'existant qu'après
 * passage par l'IA, le bouton grisé jusque-là rendait le texte brut seul INATTEIGNABLE —
 * une recette collée sans transformation ne pouvait plus jamais être sauvegardée. Porte
 * le double chemin de l'oracle (`saveRecipeOnly`/`saveRecipeAndList` l.6036-6058).
 * @returns {Object|null} null si titre/contenu manquants (toast déjà émis).
 */
function buildPastedFavorite() {
    const title = document.getElementById('paste-title')?.value.trim() || '';
    const content = document.getElementById('paste-content')?.value.trim() || '';
    if (!title || (!content && !_lastTransformedRecipe)) {
        toast('Titre et contenu requis', 'error');
        return null;
    }
    const date = new Date().toLocaleDateString('fr-FR');
    return _lastTransformedRecipe
        ? { ..._lastTransformedRecipe, id: generateId('fav'), date }
        : { id: generateId('fav'), title, content, date };
}

function savePastedRecipe() {
    const fav = buildPastedFavorite();
    if (!fav) return;
    state.favorites.push(fav);
    saveState();
    updateBadges();
    closeModal('modal-paste-recipe');
    toast(`⭐ ${fav.name || fav.title} sauvegardé en favori`);
}

function savePastedRecipeAndList() {
    const fav = buildPastedFavorite();
    if (!fav) return;
    state.favorites.push(fav);
    saveState();
    updateBadges();
    closeModal('modal-paste-recipe');
    if (fav.ingredients) {
        openEnhancedCartPicker(fav);
    } else {
        // Pas d'ingrédients structurés (texte brut) : rien à proposer pour la liste de
        // courses. Cas déjà inatteignable dans l'oracle lui-même (le bouton « + Liste »
        // n'est révélé qu'après une transformation IA réussie, chantier 5).
        toast(`⭐ ${fav.title} sauvegardé en favori`);
    }
}

// LOT 014, volet A — la composition des textes de partage a demenage dans
// `src/services/exports.js` (deplacement PUR : aucune regle n'a change). Seul le point
// d'entree `exportClipboard` reste ici, parce qu'il est publie sur `window` par `expose()`
// et que ce contrat public ne bouge pas.

/**
 * LOT 015, chantiers 1-4 et 9 — copie d'un format de partage.
 *
 * GARDE-FOU « rien a copier » : il porte sur la SOURCE, jamais sur le texte final.
 * L'oracle testait `if (!text)` (l.6483) parce que chez lui le texte restait vide sans
 * donnees. Ici, chaque format ecrivait son en-tete AVANT de regarder les donnees : le meme
 * test ne se serait JAMAIS declenche (audit Gemini du 2026-07-30, Q1). D'ou la separation
 * en-tete / corps / compte de buildClipboardText.
 */
async function exportClipboard(type) {
    const built = buildClipboardText(type, state);
    if (!built) {
        toast('Rien à copier', 'error');
        return;
    }
    if (built.count === 0) {
        toast(built.emptyMessage, 'error');
        return;
    }

    const copied = await writeToClipboard(built.header + built.body);
    if (copied) toast(built.successMessage);
    else toast('Erreur lors de la copie', 'error');
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

    // LOT 012, zone C (oracle l.6638-6639) : compteur de la barre laterale, fige depuis
    // la migration.
    const sbPrincipal = document.getElementById('sb-label-principal');
    if (sbPrincipal) sbPrincipal.textContent = `Principal (${state.ingredients.length} ingrédients)`;

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
 * Active/désactive les boutons d'enregistrement de la fenêtre « Coller une recette ».
 *
 * BUG RÉEL trouvé par l'audit du sous-lot 11B (Codex Terra + Gemini, convergents) :
 * cette fonction désactivait AUSSI « Sauvegarder tel quel » tant qu'aucune transformation
 * IA n'avait eu lieu — rendant l'arbitrage A1 (restaurer la sauvegarde d'un texte brut
 * SANS IA) inatteignable depuis l'interface réelle, alors même que `buildPastedFavorite`
 * fonctionnait parfaitement une fois appelée directement (ce que les tests faisaient,
 * masquant le bug). Corrigé : « Sauvegarder tel quel » reste TOUJOURS actif — c'est
 * `buildPastedFavorite` qui valide titre/contenu au moment du clic, pas l'état du bouton.
 * Seul « + Liste » (qui suppose des ingrédients structurés) reste conditionné par
 * `enabled` ; sa VISIBILITÉ, elle, est gérée séparément (révélée par `transformRecipeAI`,
 * remise à `none` par `openModal`) — plus par cette fonction (durcissement de l'audit).
 */
function setPasteSaveButtonsEnabled(enabled) {
    const saveBtn = document.getElementById('paste-save-btn');
    if (saveBtn) saveBtn.disabled = false;

    const listBtn = document.getElementById('paste-list-btn');
    if (listBtn) listBtn.disabled = !enabled;
}

function openModal(id) {
    document.getElementById(id)?.classList.add('open');

    if (id === 'modal-paste-recipe') {
        // Sans cette remise a zero, la recette transformee lors d'une ouverture
        // precedente survivait : « Sauvegarder tel quel » enregistrait alors la
        // recette d'avant, silencieusement.
        _lastTransformedRecipe = null;
        setPasteSaveButtonsEnabled(false);
        // LOT 011, chantier 5 (oracle openPasteModal, l.5932-5942) : le LOT 006 ne
        // purgeait que _lastTransformedRecipe — titre/contenu/URL survivaient d'une
        // ouverture à l'autre, et le textarea restait verrouillé si la dernière session
        // avait transformé une recette.
        const titleInput = document.getElementById('paste-title');
        const contentInput = document.getElementById('paste-content');
        const urlInput = document.getElementById('paste-url');
        if (titleInput) titleInput.value = '';
        if (contentInput) {
            contentInput.value = '';
            contentInput.disabled = false;
        }
        if (urlInput) urlInput.value = '';
        const aiBtn = document.getElementById('paste-ai-btn');
        if (aiBtn) aiBtn.style.display = '';
        const saveBtn = document.getElementById('paste-save-btn');
        if (saveBtn) saveBtn.textContent = 'Sauvegarder tel quel';
        // « + Liste » repart masqué (état par défaut du HTML) : sans cette ligne, une
        // transformation IA de la session précédente le laissait visible — durcissement
        // signalé par l'audit du sous-lot 11B.
        const listBtn = document.getElementById('paste-list-btn');
        if (listBtn) listBtn.style.display = 'none';
    }

    if (id === 'modal-api-config') {
        const keyInput = document.getElementById('api-key-input');
        if (keyInput && state.aiConfig?.apiKey) keyInput.value = state.aiConfig.apiKey;
        renderAiModelsInfo();
    }
}

/**
 * Bloc d'information en lecture seule sur les modèles IA (LOT 010, arbitrage §6).
 * Dérivé de la SSOT (`state.aiConfig.models`, toujours réalignée sur `AI_ROLES` par
 * `sanitizeGlobalState`) — aucun nom de modèle n'est jamais écrit en dur ici.
 */
function renderAiModelsInfo() {
    const el = document.getElementById('api-models-info');
    if (!el) return;
    const models = state.aiConfig?.models || {};
    el.textContent = `Recettes, nutrition et transformation de texte : ${models.recipeGeneration} · ` +
        `Catégories et emojis : ${models.categorySuggest}`;
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
 *
 * `category` (LOT 012, zone A) : override optionnel de la source d'emoji de
 * catégorie, pour les appelants qui n'éditent pas l'ingrédient en cours
 * (`_currentEditingIngId`) — ex. `cycleEmoji` sur une ligne du sélecteur de
 * recette. Omis, le comportement est strictement identique à avant (SSOT).
 */
function buildEmojiEditSuggestions(seed, category) {
    const s = (seed || '').toLowerCase();
    const matches = s ? DEFAULT_DB.filter(i => i.name.toLowerCase().includes(s)) : [];
    const fromMatches = matches.map(i => i.emoji);
    let categoryEmoji;
    if (category) {
        categoryEmoji = getCategoryEmoji(category);
    } else {
        const ing = state.ingredients.find(i => i.id === _currentEditingIngId);
        categoryEmoji = ing ? getCategoryEmoji(ing.category) : null;
    }
    const emojis = [...new Set([...fromMatches, categoryEmoji, ...GENERIC_EMOJI_FALLBACK].filter(Boolean))];
    return emojis.slice(0, 15);
}

/**
 * Fait défiler l'émoji d'une ligne du sélecteur d'articles (LOT 012, zone A ;
 * oracle `cycleEmoji`, cycle circulaire). Relit le NOM ÉDITÉ à chaque appel
 * (pas `_currentPickerData[idx].name`) : une correction de nom faite avant de
 * cliquer 🎲 influence les suggestions. Réutilise `buildEmojiEditSuggestions` —
 * jamais de table d'emojis dupliquée (SSOT).
 */
function cycleEmoji(idx) {
    const emojiInp = document.getElementById(`pick-emoji-${idx}`);
    const nameInp = document.getElementById(`pick-name-${idx}`);
    if (!emojiInp || !nameInp) return;
    const category = _currentPickerData[idx]?.category;
    const suggestions = buildEmojiEditSuggestions(nameInp.value, category);
    const at = suggestions.indexOf(emojiInp.value);
    emojiInp.value = suggestions[(at + 1) % suggestions.length];
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

// LOT 014, volet A — la deduction de categorie a demenage dans `src/utils/categorize.js`
// (deplacement pur ; filet pose AVANT, tests/categorize.test.js).

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
            // LOT 014, volet C — la saisie de Joel est interpolee ENTRE GUILLEMETS dans une
            // consigne qui decrit elle-meme du JSON a guillemets doubles. Un `"` tape casse
            // la consigne ; un texte construit expres peut la reecrire. `escapePromptValue`
            // n'est applique QU'ICI, a la valeur du prompt — jamais a la donnee elle-meme.
            const prompt = `Tu es un assistant culinaire. Pour l'ingrédient "${escapePromptValue(val)}", réponds en JSON UNIQUEMENT: {"category":"Légumes","emojis":["🥕","🌿","🥦"]}. Catégories possibles: ${CATEGORIES.join(', ')}. Propose 3-5 emojis pertinents.`;
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
    // LOT 012, zone C (oracle l.6458) : retour a l'inventaire apres un ajout reussi,
    // pour ne pas laisser Joel sur un formulaire vide sans lien evident avec ce qu'il
    // vient de faire. Le formulaire s'est deja reinitialise juste au-dessus (LOT 006) :
    // un enchainement de plusieurs ajouts reste possible avant l'echeance des 500 ms.
    setTimeout(() => switchView('pantry'), 500);
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
    // LOT 012, zone C — trouvé par l'audit du diff final (Codex Terra) : ce chemin
    // d'ajout (clic sur une suggestion d'autocomplétion, absent de l'oracle) ajoute
    // vraiment un ingrédient au même titre que `addIngredient` — même retour auto pour
    // que les deux parcours se comportent pareil du point de vue de Joel.
    setTimeout(() => switchView('pantry'), 500);
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
        // LOT 014, volet C — meme formulaire d'ajout que `handleAddInput`, meme traitement :
        // la valeur vient de `#add-emoji-search` ou, a defaut, de `#add-name`.
        const prompt = `Trouve 12 emojis pertinents pour l'ingrédient "${escapePromptValue(target)}". Réponds uniquement par les emojis séparés par des espaces.`;
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
    
    // Plafond des « hors stock », séparé de celui des épinglés (LOT 010 : le 6 en dur
    // est remonté dans la SSOT des plafonds, le message reste celui de l'oracle l.4917).
    if (state.extraIngredients.length >= MAX_EXTRA_INGREDIENTS) {
        toast(`Maximum ${MAX_EXTRA_INGREDIENTS} ingrédients hors stock`, 'error'); return;
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

    // LOT 012, zone C (oracle l.4933) : emoji devine depuis la base plutot qu'une
    // etoile fixe qui ne renseignait jamais Joel sur ce qu'il venait de taper.
    const emoji = autoEmoji(val, DEFAULT_DB);
    state.extraIngredients.push({ name: val, emoji, id: generateId('extra') });
    input.value = '';
    saveState();
    refreshImposedZone();
}

/**
 * Remplit le libellé des plafonds depuis la SSOT (LOT 010, casse C9).
 * L'interface annonçait « Max 6 ingrédients imposés au total » alors que les deux
 * familles sont plafonnées SÉPARÉMENT — un mensonge visible par l'utilisateur.
 */
function renderImposedCapHint() {
    const el = document.getElementById('imposed-cap-hint');
    if (el) el.textContent = `Max ${MAX_PINNED_INGREDIENTS} épinglés + ${MAX_EXTRA_INGREDIENTS} hors stock`;
}

/**
 * Zone « Ingrédients imposés » de l'écran IA (LOT 010, casse C10).
 *
 * Remplace l'ancien `renderExtraChips` qui n'affichait QUE les extras, sans emoji,
 * et ne se rafraîchissait qu'au rendu de la vue IA — un épinglé était envoyé à l'IA
 * (`gemini.js`) mais invisible et non retirable ici.
 *
 * Porté depuis l'oracle (`renderImposedZone`, `foodapp-v5-Joel.html` l.4875-4910),
 * en DOM-safe via `h()` plutôt que le `innerHTML` littéral de l'original — même
 * choix de sécurité que pour le panneau système du LOT 009.
 */
function renderExtraChips() {
    const container = document.getElementById('imposed-chips');
    if (!container) return;

    const pinned = state.ingredients.filter(i => i.pinned);
    const extras = state.extraIngredients || [];

    if (pinned.length === 0 && extras.length === 0) {
        container.replaceChildren(h('span', { class: 'pz-empty' }, 'Aucun ingrédient imposé'));
        return;
    }

    const blocs = [];

    if (pinned.length > 0) {
        blocs.push(h('div', { class: 'pz-label' }, "📍 Dans l'inventaire"));
        blocs.push(h('div', { class: 'pz-chips' }, pinned.map(ing => h('div', { class: 'pz-chip' }, [
            h('span', {}, ing.emoji),
            ` ${ing.name} `,
            h('span', { class: 'pz-chip-del', onclick: () => togglePin(ing.id) }, '✕')
        ]))));
    }

    if (extras.length > 0) {
        blocs.push(h('div', { class: 'ez-label', style: { marginTop: '12px' } }, '🛒 Hors inventaire'));
        blocs.push(h('div', { class: 'pz-chips' }, extras.map(ei => h('div', { class: 'ez-chip' }, [
            h('span', {}, ei.emoji),
            ` ${ei.name} `,
            h('span', { class: 'ez-chip-del', onclick: () => removeExtraIngredient(ei.id) }, '✕')
        ]))));
    }

    container.replaceChildren(...blocs);
}

/**
 * Sous-titre vivant de l'écran IA (LOT 010, casse C10).
 * Porté depuis l'oracle (`updateAIContextSub`, `foodapp-v5-Joel.html` l.4943-4953) :
 * segments « épinglé(s) » et « hors stock » masqués quand leur compteur vaut 0.
 */
function updateAIContextSub() {
    const el = document.getElementById('ai-context-sub');
    if (!el) return;
    const stock = state.ingredients.filter(i => i.inStock).length;
    const pinned = state.ingredients.filter(i => i.pinned).length;
    const extra = (state.extraIngredients || []).length;
    let s = stock + ' ingrédient' + (stock > 1 ? 's' : '') + ' en stock';
    if (pinned > 0) s += ` · ${pinned} épinglé${pinned > 1 ? 's' : ''}`;
    if (extra > 0) s += ` · ${extra} hors stock`;
    el.textContent = s;
}

/**
 * Rafraîchit la zone imposée ET le sous-titre en un seul appel (LOT 010, casse C10) :
 * dépassement volontaire de l'oracle, assumé et tracé dans la fiche du lot — l'oracle
 * ne rafraîchissait le sous-titre qu'à certains endroits, oubliant l'épinglage.
 */
function refreshImposedZone() {
    renderExtraChips();
    updateAIContextSub();
}

function removeExtraIngredient(id) {
    state.extraIngredients = state.extraIngredients.filter(it => it.id !== id);
    saveState();
    refreshImposedZone();
}

function generateRandomWithStock() {
    // Meme garde que generateSuggestions (LOT 011, audit sous-lot 11A) : evite de muter
    // state.aiConfig pour rien si une generation tourne deja, et rend le refus immediat.
    if (_generationInFlight) { toast('Une génération est déjà en cours…', 'error'); return; }
    const stock = state.ingredients.filter(i => i.inStock);
    if (stock.length === 0) { toast('Stock vide', 'error'); return; }

    // Desactivation visuelle du bouton 🎲 le temps de la generation, symetrique a ce que
    // generateSuggestions fait deja pour #generate-btn (trouve par l'audit : seul le
    // bouton normal etait desactive, pas celui-ci — un double-clic sur 🎲 restait possible).
    const magicBtn = document.getElementById('magic-btn');
    if (magicBtn) magicBtn.disabled = true;

    // Reinitialisation des filtres comme dans l'oracle (l.5092-5097) pour CETTE
    // generation, MAIS apiKey et models sont preserves : l'oracle les stockait ailleurs,
    // les reinitialiser ici viderait la cle API de Joel a chaque tirage. `cuisines`
    // (pluriel, SSOT du LOT 010) est bien cible — l'oracle videait un champ fantome
    // `cuisine` qui ne servait a rien.
    // Arbitrage Joel (2026-07-30, post-audit sous-lot 11A) : contrairement a l'oracle
    // (qui laissait les filtres reinitialises en permanence), TOUT est emprunte pour
    // une seule generation puis restaure integralement ensuite — pas seulement la
    // creativite. D'ou la sauvegarde de l'objet entier, pas juste d'un champ.
    const savedAiConfig = state.aiConfig;
    state.aiConfig = {
        ...defaultAiConfig(),
        apiKey: savedAiConfig.apiKey,
        models: savedAiConfig.models,
        ppl: savedAiConfig.ppl || '2',
        creativity: Math.floor(Math.random() * 21) + 80 // 80-100
    };
    restoreAIConfig();

    return generateSuggestions().finally(() => {
        state.aiConfig = savedAiConfig;
        restoreAIConfig();
        saveState(false);
        if (magicBtn) magicBtn.disabled = false;
    });
}

async function fetchRecipeFromUrl() {
    const urlInput = document.getElementById('paste-url');
    const url = (urlInput?.value || '').trim();
    if (!url) { toast('Veuillez entrer une adresse URL', 'error'); return; }
    if (!url.startsWith('http')) { toast('L\'adresse doit commencer par http:// ou https://', 'error'); return; }

    const btn = document.getElementById('paste-fetch-btn');
    btn.disabled = true;
    btn.textContent = 'Lecture...';

    // Delai d'expiration : sans lui, un service tiers bloque laisserait le bouton
    // en "Lecture..." indefiniment (durcissement post-audit, LOT 011 §10-D).
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
        // Jina Reader (l.5944-5974 de l'oracle) : contourne le CORS et extrait le texte
        // principal. Arbitrage Joel (LOT 011 §9 Q2) : AUCUN repli sur un autre service —
        // remplace l'ancien allorigins, ne le garde pas en secours.
        const res = await fetch(`https://r.jina.ai/${url}`, { signal: controller.signal });
        if (!res.ok) throw new Error('Impossible de lire la page');
        const text = await res.text();
        if (!text || !text.trim()) throw new Error('Page vide');

        document.getElementById('paste-content').value = text;
        const mainTitle = text.split('\n')[0].replace(/^#+\s*/, '').trim();
        if (mainTitle) document.getElementById('paste-title').value = mainTitle;

        toast('Page lue ! Cliquez sur Transformer avec l\'IA.');
    } catch (e) {
        toast('Erreur de lecture. Vérifiez l\'URL ou copiez le texte manuellement.', 'error');
    } finally {
        clearTimeout(timeoutId);
        btn.disabled = false;
        btn.textContent = '🌍 Lire la page';
    }
}

async function transformRecipeAI() {
    const title = document.getElementById('paste-title')?.value || '';
    const content = document.getElementById('paste-content')?.value;
    if (!content) return;
    if (!state.aiConfig.apiKey) { toast('Clé API requise', 'error'); openModal('modal-api-config'); return; }

    const btn = document.getElementById('paste-ai-btn');
    btn.disabled = true;
    btn.textContent = 'Transformation...';
    try {
        const stockItems = state.ingredients.filter(i => i.inStock);
        const model = state.aiConfig.models?.smartPaste || AI_ROLES.REASONING;
        const recipe = await transformRecipeFromText(title, content, stockItems, state.aiConfig.apiKey, model, {
            onThinkingFallback: () => toast('Recette transformée sans le mode réflexion approfondie (temporairement indisponible).')
        });
        // LOT 014, volet C — la réponse de l'IA était lue À L'AVEUGLE : `recipe.name` était
        // écrit dans le champ sans qu'on sache si `recipe` était bien une recette. Une
        // réponse déraillée (objet sans nom, `steps` qui n'est pas une liste, titre d'un
        // paragraphe entier) était acceptée, verrouillait le texte source de Joel et
        // devenait sauvegardable en favori.
        if (!isValidRecipe(recipe)) {
            toast('Réponse de l\'IA inexploitable — votre texte est intact', 'error');
            return; // le `finally` réarme le bouton : Joel peut relancer
        }
        _lastTransformedRecipe = recipe;
        document.getElementById('paste-title').value = recipe.name;
        // LOT 011, chantier 5 (oracle l.6019-6025) : verrouille le texte source et affiche
        // un aperçu — après transformation, c'est la recette structurée qui sera
        // sauvegardée, plus le texte brut, qui n'a donc plus de raison d'être modifiable.
        document.getElementById('paste-content').value = "✅ Recette analysée et formatée par l'IA.\n\n" + (recipe.description || '');
        document.getElementById('paste-content').disabled = true;
        document.getElementById('paste-ai-btn').style.display = 'none';
        document.getElementById('paste-save-btn').textContent = 'Sauvegarder en favoris';
        document.getElementById('paste-list-btn').style.display = '';
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

// LOT 015, chantier 5 : le champ fichier doit etre REARME apres chaque tentative, sinon
// resselectionner LE MEME fichier ne declenche plus rien (l'evenement `change` n'est pas
// emis si la valeur ne change pas). `restoreJSON` ne le faisait pas, contrairement a son
// voisin. Le rearmement est pose HORS du `if (file)` pour couvrir aussi l'annulation, et
// il est sur immediatement : la lecture est deja lancee sur l'objet `File`. C'est ce que
// faisait l'oracle (`foodapp-v5-Joel.html` l.6514 et l.6561).
function restoreJSON(event) {
    const file = event.target.files[0];
    if (file) Actions.importJSON(file);
    event.target.value = '';
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

/**
 * LOT 012, zone B (oracle l.6744/l.6746) : Entree sur un champ PRECIS, pas un raccourci
 * global par modale — la modale "Coller une recette" a plusieurs actions possibles
 * (recuperer l'URL, transformer par IA, sauvegarder), donc contrairement aux modales
 * gerees par `initKeyboardShortcuts` il n'y a pas UNE seule action a associer a la
 * touche. Ecouteurs dedies sur des champs statiques du HTML, fonction separee (et non
 * repliee dans `initKeyboardShortcuts`) pour rester ré-appelable isolement en test sans
 * ré-empiler un listener global sur `window` a chaque appel.
 */
function initFieldEnterShortcuts() {
    document.getElementById('ez-input')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') addExtraIngredient();
    });
    document.getElementById('paste-title')?.addEventListener('keydown', e => {
        if (e.key === 'Enter') document.getElementById('paste-content')?.focus();
    });
}

/** LOT 012, zone B (oracle l.6790-6793) : sans ce stopPropagation, un balayage horizontal
 * pour faire defiler les puces de filtre remonte au conteneur parent et fait defiler
 * toute la page verticalement (mobile). `.chips-row` est statique dans le HTML — un seul
 * passage suffit, comme dans l'oracle. */
function initChipsRowTouchScroll() {
    document.querySelectorAll('.chips-row').forEach(el => {
        el.addEventListener('touchmove', e => e.stopPropagation(), { passive: true });
    });
}

/** LOT 012, zone B (oracle l.6773-6781, "FINAL OVERRIDE") : le remplissage automatique du
 * navigateur peut pre-remplir les barres de recherche avant que ce delai ne s'ecoule ;
 * `clearSearch()` (deja utilisee par la croix d'effacement) vide les deux champs et
 * resynchronise `state.search` avec ce que Joel voit vraiment. */
function initSearchAutofillGuard() {
    setTimeout(() => clearSearch(), 100);
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
    saveRecipeOnly: savePastedRecipe,
    saveRecipeAndList: savePastedRecipeAndList,
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
