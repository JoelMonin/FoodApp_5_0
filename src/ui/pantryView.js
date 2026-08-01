import { state } from '../state.js';
import { h } from '../utils/dom.js';
import { debounce, normalizeString } from '../utils/helpers.js';
import { CATEGORIES, getCategoryEmoji } from '../data.js';
import { toggleStock, togglePin, toggleCart, deleteIngredient } from '../actions.js';
import { renderPantryGrid } from './pantry.js';
import { openEditEmoji } from './emojiModal.js';

/**
 * ECRAN INVENTAIRE — extrait de `js/app.js` et de `src/ui/topbar.js` au LOT 018.
 *
 * Deplacement PUR : pas une regle n'a change. Zone deja couverte — 21 tests dans
 * `tests/pantry-filters-search.test.js`, 6 dans `tests/pantry-sort.test.js`, 3 dans
 * `tests/keyboard-gestures.test.js`. Aucun test neuf n'a ete necessaire, aucun import de test
 * n'a bouge.
 *
 * NE PAS CONFONDRE AVEC `src/ui/pantry.js`, son voisin au nom presque identique. La frontiere
 * est nette et vaut d'etre lue avant d'ajouter quoi que ce soit ici :
 *  · `pantry.js` = RENDU PUR de la grille. Il recoit une liste toute faite et des gestionnaires
 *    en parametres, ne lit jamais l'etat, ne decide de rien.
 *  · `pantryView.js` (ce fichier) = L'ECRAN. Il decide QUOI afficher (filtres, recherche, tri),
 *    puis confie le dessin a `pantry.js`.
 * Une regle d'affichage va dans `pantry.js` ; une regle de selection va ici.
 *
 * LE PREMIER MODULE DE LA SERIE QUI SORT « SEC » : zero cycle, zero crochet. Les six modules
 * du LOT 017 ont tous du composer avec des dependances croisees ; celui-ci n'appelle rien qui
 * soit reste dans `js/app.js`. C'est ce qui rend ce lot court et sur.
 *
 * IL RAPATRIE LES PUCES DE FILTRE, QUE LE LOT 017 AVAIT MISES DANS `topbar.js`. C'etait la
 * seule facon d'obtenir ce resultat : `renderPantry` appelle `renderPantryFilters`, donc les
 * separer aurait fait dialoguer les deux modules en aller-retour. Les puces de filtre sont
 * celles de l'inventaire, pas de la barre du haut — elles sont ici chez elles, et les trois
 * fonctions qui les actionnent (`setFilter`, `toggleSpecialFilter`, `resetFilters`) appellent
 * desormais `renderPantry()` DIRECTEMENT, la ou elles passaient par un crochet.
 *
 * CE QUI N'EST PAS VENU, ET POURQUOI (verifie sur piece, pas suppose) :
 *  · `initChipsRowTouchScroll` (`js/app.js`) — son commentaire parle des « puces de filtre »,
 *    ce qui en fait un faux ami parfait. Son selecteur `.chips-row` couvre en realite 8
 *    elements d'`index.html`, dont UN SEUL est l'inventaire : les sept autres sont le panneau
 *    IA. C'est de l'initialisation globale, elle reste au demarrage.
 *  · `toggleStock`/`togglePin`/`toggleCart`/`deleteIngredient` — ils sont importes ICI depuis
 *    `src/actions.js`, mais `js/app.js` garde ses propres alias : il en a besoin pour les
 *    publier sur `window`. Les emporter aurait casse quatre gestes de l'application sans
 *    qu'aucun test de la grille ne bronche (ils injectent des doublures).
 *  · `initSearchAutofillGuard` — trois lignes qui n'appellent que `clearSearch`. Laissee au
 *    demarrage par COHERENCE : toutes les fonctions d'initialisation (`initKeyboardShortcuts`,
 *    `initFieldEnterShortcuts`, `initChipsRowTouchScroll`) vivent groupees dans le point
 *    d'entree. Choix tranche explicitement, pas par omission.
 */

export function renderPantry() {
    renderPantryFilters();
    renderPantryGrid(
        document.getElementById('ing-grid'),
        document.getElementById('ing-empty'),
        getFilteredIngredients(),
        { toggleStock, togglePin, toggleCart, deleteIngredient, openEditEmoji }
    );
}

export function renderPantryFilters() {
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
    // ici pour la première fois — contrairement à `data-val` des puces IA, aucun code
    // applicatif ne le lit. Ne pas le confondre avec un attribut fonctionnel.
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

export function setFilter(f) {
    state.filter = f;
    renderPantry();
}

export function toggleSpecialFilter(key) {
    // CORRIGÉ (audit adversarial, LOT 014, 2026-07-31) : ce commentaire affirmait le
    // contraire du code — les deux toggles « En-Stock » et « Liste courses » sont
    // INDÉPENDANTS et CUMULABLES, comme le disent déjà `renderPantryFilters` et
    // `getFilteredIngredients`, qui les appliquent l'un après l'autre sans
    // jamais désactiver l'autre.
    state[key] = !state[key];
    renderPantry();
}

export function resetFilters() {
    state.filter = 'all';
    state.showInStockOnly = false;
    state.showInCartOnly = false;
    renderPantry();
}

export function getFilteredIngredients() {
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

export function handleSearch(val) {
    state.search = val;
    updateSearchClearButtons();
    _renderPantryDebounced();
}

export function clearSearch() {
    state.search = '';
    SEARCH_INPUT_IDS.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    updateSearchClearButtons();
    _renderPantryDebounced.cancel();
    renderPantry();
}
