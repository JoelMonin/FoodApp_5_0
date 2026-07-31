import { state } from '../state.js';
import { areSimilar, normalizeString, autoEmoji } from './helpers.js';
import { CATEGORIE_PAR_DEFAUT, DEFAULT_DB, getCategoryEmoji } from '../data.js';
import { AI_EMOJI_ONLY } from '../constants.js';

/**
 * CORRESPONDANCE INGRÉDIENT ↔ INVENTAIRE — extrait de `js/app.js` au LOT 014, volet A.
 *
 * Deplacement PUR : pas une regle n'a change. Le filet a ete pose AVANT
 * (`tests/stock-match.test.js`, 15 tests de caracterisation prouves par retrait 7/7).
 *
 * POURQUOI C'EST LE MODULE LE PLUS SENSIBLE DU DECOUPAGE : `matchIngredientToStock` est le
 * SSOT du calcul « en stock / manquant ». Il decide la couleur de chaque tag d'ingredient
 * (vert = j'ai exactement ca, orange = j'ai quelque chose d'approchant, rouge = manquant) ET
 * quelles lignes le selecteur de courses pre-coche. Il vivait au milieu de `js/app.js` sans
 * un seul test direct — les tests existants ne couvraient que ses APPELANTS.
 *
 * TROIS REGLES A NE PAS PERDRE, chacune verrouillee par un test :
 *  1. `isExact` se calcule INDEPENDAMMENT du stock. C'est ce qui permet de distinguer « j'ai
 *     exactement ca » de « j'ai quelque chose qui y ressemble », meme sur un article epuise.
 *  2. Le statut annonce par l'IA (`s`) fait AUTORITE sur l'inventaire — mais on affiche quand
 *     meme a quoi l'ingredient correspond si on le retrouve.
 *  3. `areSimilar` compare des MOTS ENTIERS depuis le LOT 011 (correctif porte depuis
 *     l'oracle) : « Chou » ne doit plus correspondre a « Chocolat ».
 */
export function matchIngredientToStock(ingredient) {
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
export function buildIngredientTags(ingredients, tooltipStyle) {
    return (ingredients || []).map(ing => {
        const name = ing.n || ing.name || '';
        const category = ing.c || ing.category || CATEGORIE_PAR_DEFAUT;
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
