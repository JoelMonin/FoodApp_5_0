import { state } from '../state.js';
import { h } from '../utils/dom.js';
import { CATEGORIES, getCategoryEmoji } from '../data.js';
import { estVueFavoris } from '../constants.js';
import { openModal } from './modals.js';
import { resetCart } from '../actions.js';

/**
 * BARRE SUPERIEURE ET FILTRES — extraits de `js/app.js` au LOT 017.
 *
 * Deplacement PUR : pas une regle n'a change. Zone couverte par
 * `tests/topbar-context.test.js` (20 tests) et `tests/pantry-filters-search.test.js` (21).
 *
 * CE QUE CE MODULE COUVRE : le titre et le sous-titre contextuels, le bouton d'action et
 * l'icone mobile qui changent selon l'ecran, et les pastilles de comptage de la navigation.
 *
 * LOT 018 — LES PUCES DE FILTRE N'Y SONT PLUS. Le LOT 017 les avait mises ici pour eviter des
 * crochets ; elles sont parties dans `src/ui/pantryView.js`, ou elles sont reellement chez
 * elles (ce sont les filtres de l'INVENTAIRE, pas de la barre du haut). Leur depart a supprime
 * le crochet `renderPantry` : il n'existait que pour elles.
 *
 * `countStockAndCart` et `_favCountSub` restent : leurs seuls appelants sont `renderTopbar` et
 * `updateBadges`.
 *
 * `resetCart` s'importe DIRECTEMENT depuis `src/actions.js` : ce n'etait qu'un alias dans
 * `js/app.js`, donc un crochet inutile.
 *
 * LES DEUX CROCHETS RESTANTS visent du code qui n'appartient a aucun ecran en particulier :
 * `switchView` (la navigation elle-meme, qui vit dans le point d'entree et n'est PAS
 * l'homonyme de `src/actions.js`, dont le comportement differe) et `exportClipboard` (le
 * partage, commun aux Reglages et a la liste de courses). Contrairement a ce qu'annoncait la
 * version precedente de ce commentaire, ils ne tombent donc PAS a un : les sortir demanderait
 * deux autres chantiers, sans rapport avec l'inventaire.
 */

const _hooks = {
    switchView: () => {},
    exportClipboard: () => {}
};

export function registerTopbarHooks(hooks = {}) {
    for (const cle of Object.keys(_hooks)) {
        if (typeof hooks[cle] === 'function') _hooks[cle] = hooks[cle];
    }
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
// meme vue, cf. `PANNEAU_DE_VUE`, `src/constants.js`), pour ne pas dupliquer le calcul.
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
export function renderTopbar(view) {
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
                class: 'tb-btn-add', title: 'Ajouter un ingrédient', onclick: () => _hooks.switchView('add')
            }, '＋'));
        } else if (view === 'shopping') {
            actionEl.replaceChildren(
                h('button', { class: 'tb-btn', onclick: () => _hooks.exportClipboard('cart') }, '📋 Copier'),
                h('button', { class: 'tb-btn terra', onclick: () => resetCart() }, '🗑️ Vider')
            );
        } else if (view === 'ai') {
            actionEl.replaceChildren(h('button', {
                class: 'tb-icon-btn', title: 'Config API', onclick: () => openModal('modal-api-config')
            }, '⚙️'));
        } else if (estVueFavoris(view)) {
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
            mhIcon.onclick = () => _hooks.switchView('add');
        } else if (view === 'ai') {
            mhIcon.textContent = '⚙️';
            mhIcon.style.cssText = '';
            mhIcon.onclick = () => openModal('modal-api-config');
        } else if (estVueFavoris(view)) {
            mhIcon.textContent = '📋';
            mhIcon.style.cssText = '';
            mhIcon.onclick = () => openModal('modal-paste-recipe');
        } else {
            mhIcon.style.cssText = 'display:none';
            mhIcon.onclick = null;
        }
    }
}

// LOT 018 — les puces de filtre et leurs trois actions sont parties dans
// `src/ui/pantryView.js`. Elles filtrent l'inventaire : elles sont chez elles la-bas, et
// leur depart supprime le va-et-vient qui obligeait ce module a se faire injecter`renderPantry`.

export function updateBadges() {
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
