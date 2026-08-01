import { state, saveState } from '../state.js';
import { h, toast } from '../utils/dom.js';
import { generateId, formatDateFr } from '../utils/helpers.js';
import { buildIngredientTags } from '../utils/stockMatch.js';
import { renderFavoriteCard } from './recipe.js';
import {
    openRecipeDetail,
    toggleRecipeFullscreen,
    changePplScale,
    analyzeNutrition
} from './recipeModal.js';
import { openEnhancedCartPicker } from './cartPicker.js';
import { openModal, closeModal } from './modals.js';

/**
 * FAVORIS — extraits de `js/app.js` au LOT 017.
 *
 * Deplacement PUR : pas une regle n'a change. La zone est couverte par
 * `tests/favorites-rich.test.js` (24 tests, LOT 011) — aucun test neuf n'a ete necessaire, et
 * aucun import de test n'a bouge : `js/app.js` republie les noms a l'identique.
 *
 * `buildRecipeHandlers` ARRIVE ENFIN A SA PLACE. Le LOT 014 l'avait volontairement LAISSEE
 * dans `js/app.js` en notant : « c'est du cablage vers la zone favoris, et le deplacer vers
 * `recipeModal` aurait demande SIX injections au lieu de deux — signe que la frontiere aurait
 * ete au mauvais endroit. Il partira naturellement avec `favorites.js` ». C'est exactement ce
 * qui se produit : ici, les six dependances sont de simples imports.
 *
 * POURQUOI LE CROCHET `registerRecipeModalHooks` SURVIT MALGRE CA. Ce module importe la modale
 * de recette (`openRecipeDetail`, le plein ecran, l'echelle, la nutrition) ; si la modale
 * importait `buildRecipeHandlers` en retour, le cycle serait reel. Elle continue donc de la
 * recevoir par injection. Le crochet ne disparait pas parce que sa cible a trouve un module —
 * il disparait quand le sens de dependance devient a sens unique, ce qui n'est pas le cas ici.
 *
 * `printRecipe` a suivi (3 lignes) : `buildRecipeHandlers` etait son seul appelant, la laisser
 * derriere aurait maintenu une dependance de ce module vers `js/app.js` pour un `window.print()`.
 */

/**
 * Favoris riches (LOT 011, chantier 7). Composant DÉDIÉ (`renderFavoriteCard`), distinct
 * de `renderRecipeCard` (trouvé par l'audit du sous-lot 11A : les deux écrans réutilisaient
 * la même carte sans lui passer les mêmes handlers — un bouton ajouté à l'un aurait planté
 * au clic dans l'autre). État vide enrichi avec CTA vers le collage, oracle l.5871.
 */
export function renderFavorites() {
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

export function deleteFav(id) {
    state.favorites = state.favorites.filter(f => f.id !== id);
    // saveState() emet 'stateUpdated', qui relance deja renderCurrentView() : pas de rendu manuel.
    saveState();
    toast('Recette supprimée');
}

/**
 * SSOT de l'ajout aux favoris (LOT 014, volet D) : la meme ligne etait ecrite a
 * l'identique dans deux fonctions. Le jour ou un champ s'ajoute a un favori, il ne doit
 * y avoir qu'un seul endroit a modifier.
 */
export function pousserFavori(recette) {
    state.favorites.push({ ...recette, id: generateId('fav'), date: formatDateFr() });
}

export function saveSuggestionToFavDirect(r) {
    if (!r) return;
    pousserFavori(r);
    saveState();
    toast('Ajouté aux favoris !');
}

export function saveRecipeOnly(r) {
    if (!r) return;
    pousserFavori(r);
    saveState();
    toast('Recette sauvegardée !');
    closeModal('modal-paste-recipe');
}

export function saveRecipeAndList(r) {
    if (!r) return;
    saveRecipeOnly(r);
    openEnhancedCartPicker(r);
}

export function printRecipe() {
    window.print();
}

/**
 * Cablage des boutons du detail de recette. Injectee dans `recipeModal.js` par
 * `registerRecipeModalHooks` (voir l'en-tete : le sens de dependance interdit l'import direct).
 *
 * PIEGE DE NOMMAGE, verifie au LOT 017 : les cles `saveRecipeOnly`/`saveRecipeAndList` de cet
 * objet pointent bien sur les fonctions locales ci-dessus — MAIS `js/app.js` publie sur
 * `window` deux homonymes qui sont, eux, `savePastedRecipe`/`savePastedRecipeAndList`, d'un
 * autre module. Meme nom, quatre fonctions, deux modules. Ne jamais unifier a l'aveugle.
 */
export function buildRecipeHandlers(r, source, favId) {
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
