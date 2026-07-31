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
  formatDateFr,
  normalizeString,
  autoEmoji,
  areSimilar,
  debounce
} from '../src/utils/helpers.js';
import { CATEGORIES, DEFAULT_DB, getCategoryEmoji } from '../src/data.js';
import { guessCategoryLocally, sanitizeCategory } from '../src/utils/categorize.js';
// SSOT du calcul « en stock / manquant » — extrait d'ici au LOT 014, volet A.
import { matchIngredientToStock, buildIngredientTags } from '../src/utils/stockMatch.js';
// Selecteur de courses — extrait d'ici au LOT 014, volet A. Trois couplages lui sont
// INJECTES (openModal/closeModal, qui ne sont pas de simples helpers, et
// buildEmojiEditSuggestions, qui appartient a la modale d'edition d'icone) : voir
// l'en-tete du module pour le detail du noeud annonce par la phase decouverte.
// Modale « detail de recette » — extraite d'ici au LOT 014, volet A. `buildRecipeHandlers`
// reste ici : c'est du cablage vers la zone favoris, pas du rendu.
import {
  renderRecipeModal,
  openRecipeDetail,
  analyzeNutrition,
  isDocumentFullscreen,
  exitDocumentFullscreen,
  quitterPleinEcranSiBesoin,
  toggleRecipeFullscreen,
  syncRecipeFullscreenClass,
  initRecipeFullscreenListeners,
  changePplScale,
  registerRecipeModalHooks
} from '../src/ui/recipeModal.js';
// Modale « changer l'icone » — extraite d'ici au LOT 014, volet A.
import {
  openEditEmoji,
  buildEmojiEditSuggestions,
  renderEmojiEditGrid,
  applyEditedEmoji,
  searchEmojiAI,
  registerEmojiModalHooks
} from '../src/ui/emojiModal.js';
// Socle des modales — extrait d'ici au LOT 017. `openModal` etait le dernier « hub » reste
// dans ce fichier : c'est parce qu'il vivait ici que trois modules devaient se le faire
// injecter. Deux de ces trois injections disparaissent avec ce deplacement.
import {
  openModal,
  closeModal,
  initSwipeToClose,
  registerModalHooks
} from '../src/ui/modals.js';
// Ecran « Reglages » et sa fiche technique — extraits d'ici au LOT 017. `updateApiStatus` et
// `onApiConfigOpen` sont partis avec, bien qu'absents du plan : la premiere n'etait appelee
// que par cet ecran, la seconde etait un `if` loge dans `openModal`.
import {
  updateSystemInfo,
  updateApiStatus,
  onApiConfigOpen,
  renderAiModelsInfo,
  saveApiKey,
  saveAiConfigFromUI
} from '../src/ui/settings.js';
// Fenetre « coller une recette » — extraite d'ici au LOT 017. Elle recupere les 29 lignes de
// remise a zero que le volet A avait sorties de `openModal` : elles ecrivent son etat prive,
// c'est donc ici, et nulle part ailleurs, qu'elles pouvaient aller.
import {
  setPasteSaveButtonsEnabled,
  resetPasteModal,
  savePastedRecipe,
  savePastedRecipeAndList,
  fetchRecipeFromUrl,
  transformRecipeAI
} from '../src/ui/pasteRecipe.js';
// Barre superieure, puces de filtre et pastilles de comptage — extraites d'ici au LOT 017.
// Les trois fonctions de filtre sont parties avec : les laisser ici aurait porte le nombre de
// crochets du module a CINQ, contre TROIS en les emportant.
import {
  renderTopbar,
  renderPantryFilters,
  updateBadges,
  setFilter,
  toggleSpecialFilter,
  resetFilters,
  registerTopbarHooks
} from '../src/ui/topbar.js';
// Ecran FAVORIS — extrait d'ici au LOT 017, avec `buildRecipeHandlers` que le LOT 014 avait
// laissee exprès : elle trouve la-bas ses six dependances en simples imports.
import {
  renderFavorites,
  deleteFav,
  pousserFavori,
  saveSuggestionToFavDirect,
  saveRecipeOnly,
  saveRecipeAndList,
  printRecipe,
  buildRecipeHandlers
} from '../src/ui/favorites.js';
import {
  openEnhancedCartPicker,
  confirmRecipeToCart,
  cycleEmoji,
  updatePickerRow,
  toggleAllPickerItems,
  registerCartPickerHooks
} from '../src/ui/cartPicker.js';
// Formulaire d'ajout — extrait d'ici au LOT 014, volet A. Son état (catégorie choisie à la
// main, temporisations, jeton anti-course) est désormais PRIVÉ au module : la seule écriture
// possible depuis ici passe par `resetManualCategory`, appelée par `switchView`.
import {
  renderAdd,
  showCategoryIndicator,
  selectEmoji,
  updateEmojiSuggestions,
  updateEmojiSuggestionsDebounced,
  handleAddInput,
  onManualCategoryChange,
  addIngredient,
  addIngredientFromDb,
  searchEmojiAddAI,
  resetManualCategory,
  registerAddFormNav
} from '../src/ui/addForm.js';
// Gardes d'entrée des données externes — SSOT (LOT 014, volet C).
import { validateState, isValidRecipe, escapePromptValue } from '../src/utils/validate.js';
// Composition des textes de partage — extraite d'ici au LOT 014, volet A.
import { buildClipboardText, writeToClipboard } from '../src/services/exports.js';
import { AI_ROLES, LOCAL_STORAGE_SYNC_REF_KEY, FB_USER, LOCAL_STORAGE_KEY, MAX_PINNED_INGREDIENTS, MAX_EXTRA_INGREDIENTS, GENERIC_EMOJI_FALLBACK, AI_EMOJI_ONLY, PANNEAU_DE_VUE, estVueFavoris, estVueReglages, MESSAGE_CLE_API_MANQUANTE } from '../src/constants.js';
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
// LOT 011 (trouve par l'audit du sous-lot 11A) : deux generations de recettes concurrentes
// (bouton normal + 🎲, ou deux clics rapides sur 🎲) pouvaient se marcher dessus — chacune
// restaure "sa" creativite sauvegardee dans un finally, et la derniere a finir l'emporte
// meme si elle a lu une valeur deja corrompue par l'autre. Un seul point d'entree
// (generateSuggestions) refuse desormais tout lancement pendant qu'un autre est en cours.
let _generationInFlight = false;

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
  ['modal-paste-recipe', 'modal-recipe-to-cart', 'modal-recipe-detail', 'modal-api-config', 'modal-edit-emoji']
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
// Le formulaire d'ajout renvoie a l'inventaire apres un ajout reussi : `switchView` vit
// ici et lit l'etat du formulaire, d'ou l'injection plutot qu'un import croise.
registerAddFormNav({ switchView });
// LOT 017 — `registerCartPickerHooks` et `registerEmojiModalHooks` ONT DISPARU : ces deux
// modules importent desormais `openModal`/`closeModal` directement depuis `src/ui/modals.js`.
// C'est la regle du LOT 014 appliquee a la lettre — des qu'une cible sort dans son module, le
// crochet qui la remplacait devient de la dette.
// `registerRecipeModalHooks` RESTE : `modals.js` importe `quitterPleinEcranSiBesoin` de
// `recipeModal.js`, donc l'inverse serait un vrai cycle. Il ne porte plus qu'`openModal` et
// le cablage vers les favoris.
registerRecipeModalHooks({ openModal, buildRecipeHandlers });
// Ce que les modales delegent aux ecrans concernes : deux blocs qui vivaient a tort DANS
// `openModal`. Ils partiront avec leurs modules (`pasteRecipe`, `settings`), et ce branchement
// suivra sans changer de forme.
registerModalHooks({ resetPasteModal, onApiConfigOpen });
// Ce que la barre superieure delegue : trois fonctions qui appartiennent a l'ecran INVENTAIRE
// (`renderPantry`, `switchView`) ou au partage (`exportClipboard`), et qui n'ont pas encore de
// module a elles. Le jour ou `src/ui/pantryView.js` existera, il n'en restera qu'une.
registerTopbarHooks({ switchView, exportClipboard, renderPantry });

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
    // LOT 014, volet A — exporte pour les tests unitaires : `matchIngredientToStock` est le
    // coeur du calcul « en stock / manquant » et n'avait AUCUN test direct (zone aveugle
    // §B10). Exporter ne change aucun comportement.
    matchIngredientToStock,
    buildIngredientTags,
    transformRecipeAI,
    generateSuggestions,
    // LOT 012 — exportés uniquement pour les tests unitaires (mêmes raisons qu'au-dessus).
    cycleEmoji,
    confirmRecipeToCart,
    // LOT 014, volet A — exporte pour les tests unitaires (meme raison que les blocs
    // LOT 009/010 ci-dessus) : `initKeyboardShortcuts` n'est cablee qu'au demarrage, et
    // `DOMContentLoaded` ne se declenche jamais sous Vitest. Sans cet export, les 4
    // raccourcis clavier restaient une zone aveugle.
    initKeyboardShortcuts,
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
    // LOT 014, volet D — la table vit desormais dans `src/constants.js` (PANNEAU_DE_VUE).
    const activePanel = PANNEAU_DE_VUE[view] || view;
    document.querySelectorAll('.view-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === `view-${activePanel}`);
    });

    renderTopbar(view);
    updateBadges();
    updateApiStatus();

    if (view === 'pantry') renderPantry();
    else if (view === 'shopping') renderShopping();
    else if (view === 'ai') { renderAI(); refreshImposedZone(); renderImposedCapHint(); }
    else if (estVueFavoris(view)) renderFavorites();
    else if (view === 'add') renderAdd();
    else if (estVueReglages(view)) updateSystemInfo();

    document.getElementById('fab-add')?.classList.toggle('hidden', view !== 'pantry');
    document.querySelectorAll('.sb-item, .bn-item').forEach(el => {
        el.classList.toggle('active', el.dataset.view === view || (view === 'favorites' && el.dataset.view === 'favorites'));
    });
}

// toast function moved to dom.js

function switchView(view) {
    // Voir le defaut connu n°1 de `src/ui/addForm.js` : ce reset est redondant avec
    // `renderAdd` dans le parcours normal, et conserve tel quel (pare-feu A/B).
    if (view === 'add') resetManualCategory();
    state.currentView = view;
    saveState();
}

// LOT 017 — barre superieure, puces de filtre et pastilles de comptage vivent dans
// `src/ui/topbar.js`.

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



// Textes d'attente animés pendant la génération (LOT 011, chantier 5 ; oracle
// l.5052-5058, littéraux exacts).
const AI_LOADING_TEXTS = ["Analyse du stock...", "Recherche d'idées...", "Rédaction des recettes..."];

/**
 * Garde partagee (LOT 014, volet D) : deux points d'entree refusent une generation quand
 * une autre tourne deja — `generateSuggestions` et `generateRandomWithStock`. Ce dernier
 * verifie AVANT de toucher a `state.aiConfig` (LOT 011, audit du sous-lot 11A) : c'est
 * volontaire, et c'est pourquoi la garde existe a deux endroits plutot qu'un. Seul le
 * message etait duplique.
 */
function generationDejaEnCours() {
    if (!_generationInFlight) return false;
    toast('Une génération est déjà en cours…', 'error');
    return true;
}

async function generateSuggestions() {
  if (generationDejaEnCours()) return;
  const apiKey = state.aiConfig.apiKey;
  if (!apiKey) { toast(MESSAGE_CLE_API_MANQUANTE, 'error'); openModal('modal-api-config'); return; }
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



// LOT 017 — `buildRecipeHandlers` est partie avec les favoris, comme le LOT 014 l'avait
// annonce : « elle partira naturellement avec `favorites.js` ». Elle y trouve ses six
// dependances en simples imports, la ou les porter dans la modale aurait exige six injections.








// LOT 014, volet A — `matchIngredientToStock` et `buildIngredientTags` ont demenage dans
// `src/utils/stockMatch.js` (deplacement pur ; filet pose AVANT, tests/stock-match.test.js).
// C'est le SSOT du calcul « en stock / manquant ». Le plein ecran de la modale de recette
// est parti avec elle, dans `src/ui/recipeModal.js`.
//
// LOT 017 — la DOCUMENTATION de ces fonctions etait restee ici, orpheline : un bloc JSDoc
// decrivant en detail `matchIngredientToStock` juste au-dessus d'une fonction qui n'est plus
// la, et un commentaire sur le plein ecran sans son code. Exactement le « commentaire
// menteur » que le LOT 014 traquait ailleurs, laisse par ses propres deplacements. Retires :
// la doc vit desormais avec le code qu'elle decrit.



// LOT 017 — l'ecran FAVORIS vit dans `src/ui/favorites.js` (rendu, suppression, les trois
// chemins de sauvegarde et leur SSOT `pousserFavori`).

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

// LOT 017 — l'ecran des REGLAGES et sa fiche technique vivent dans `src/ui/settings.js`.



// LOT 017 — la fenetre « coller une recette » vit dans `src/ui/pasteRecipe.js`, avec les
// 29 lignes de remise a zero que le volet A avait sorties de `openModal` sans pouvoir encore
// les loger ailleurs.

// LOT 017 — `onApiConfigOpen` et `renderAiModelsInfo` sont partis avec l'ecran des reglages.
// Le crochet branche plus bas pointe desormais directement sur `src/ui/settings.js`.





// LOT 014, volet A — le FORMULAIRE D'AJOUT a demenage dans `src/ui/addForm.js`
// (deplacement pur ; filet pose AVANT, tests/add-form.test.js). Y ont suivi :
// renderAdd, showCategoryIndicator, updateEmojiSuggestions (+ sa version temporisee),
// handleAddInput, _onManualCategoryChange, addIngredient, addIngredientFromDb,
// searchEmojiAddAI et selectEmoji, ainsi que leurs 4 variables d'etat.



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
    // Verifiee AVANT de muter state.aiConfig (LOT 011, audit sous-lot 11A) : le refus doit
    // etre immediat, sans effet de bord.
    if (generationDejaEnCours()) return;
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
    searchEmojiAddAI, handleAddInput, addIngredient,
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
    updateEmojiSuggestions: updateEmojiSuggestionsDebounced,
    // `onchange` du menu deroulant de categorie (index.html:648). Le nom public garde son
    // tiret bas historique — c'est le contrat de la page, pas un detail de style.
    _onManualCategoryChange: onManualCategoryChange
});
