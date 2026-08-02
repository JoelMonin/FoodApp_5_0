/**
 * APERÇU TEXTE D'UNE RECETTE STRUCTURÉE (LOT 025, volet A).
 *
 * POURQUOI CE MODULE EXISTE. Après « Transformer avec l'IA », la fenêtre « Coller une recette »
 * remplaçait le texte source par un accusé de réception et la SEULE phrase d'accroche. La
 * recette complète existait bien — ingrédients, quantités, étapes — mais elle vivait en mémoire
 * (`_lastTransformedRecipe`) sans jamais être montrée. Joel a lu ça comme une perte de sa
 * recette, et à raison : **on lui demandait de sauvegarder ce qu'il ne pouvait pas voir.**
 *
 * POURQUOI DU TEXTE ET PAS UN RENDU VISUEL. Trois rendus DOM existent déjà
 * (`src/ui/recipe.js`), mais `renderRecipeDetail` produit une modale entière (en-tête et pied
 * compris) partagée par trois écrans : la découper pour l'encastrer dans une autre fenêtre
 * serait un risque sans rapport avec le besoin. Le texte, lui, se relit ligne à ligne face au
 * site d'origine et se copie — exactement l'usage de Joel, qui veut comparer avant de garder.
 *
 * MODULE PUR, SANS DÉPENDANCE : ni DOM, ni état, ni réseau.
 *
 * TOLÉRANT AUX DEUX FORMES DE RECETTE du projet (`name`/`title`, `people`/`ppl`, `n`/`name`,
 * `q`/`qty`) : `renderRecipeCard` et `renderFavoriteCard` le sont déjà, un aperçu qui ne
 * l'était pas afficherait du vide sur une recette parfaitement valide.
 */

/** « 1 personne » / « 4 personnes » — le pluriel se voit, et « mon 1 achat » a déjà servi de leçon (LOT 020). */
function mentionPersonnes(nombre) {
    const n = parseInt(nombre, 10);
    if (!Number.isFinite(n) || n <= 0) return '';
    return `👤 ${n} personne${n > 1 ? 's' : ''}`;
}

function ligneIngredient(ing) {
    if (!ing || typeof ing !== 'object') return '';
    const nom = String(ing.n || ing.name || '').trim();
    if (!nom) return '';
    const quantite = String(ing.q || ing.qty || '').trim();
    const emoji = String(ing.e || '').trim();
    const tete = [emoji, nom].filter(Boolean).join(' ');
    return quantite ? `• ${tete} — ${quantite}` : `• ${tete}`;
}

/**
 * Compose l'aperçu lisible d'une recette structurée.
 *
 * Chaque section est OPTIONNELLE : une recette sans étapes (réponse tronquée récupérée par le
 * sauvetage de `generateRecipes`) affiche ses ingrédients au lieu d'un titre de section vide.
 *
 * @param {Object} r - Recette structurée renvoyée par l'IA.
 * @returns {string} Texte prêt à afficher, ou chaîne vide si l'objet n'est pas exploitable.
 */
export function recetteEnTexte(r) {
    if (!r || typeof r !== 'object') return '';

    const blocs = [];

    const titre = String(r.name || r.title || '').trim();
    if (titre) blocs.push(titre.toUpperCase());

    const accroche = String(r.description || '').trim();
    if (accroche) blocs.push(accroche);

    const meta = [
        r.time && `⏱️ ${String(r.time).trim()}`,
        mentionPersonnes(r.people ?? r.ppl),
        r.difficulty && `📊 ${String(r.difficulty).trim()}`,
        r.cuisine && `🌍 ${String(r.cuisine).trim()}`
    ].filter(Boolean);
    if (meta.length) blocs.push(meta.join('  ·  '));

    const ingredients = (Array.isArray(r.ingredients) ? r.ingredients : [])
        .map(ligneIngredient)
        .filter(Boolean);
    if (ingredients.length) {
        blocs.push(`🧺 INGRÉDIENTS (${ingredients.length})\n${ingredients.join('\n')}`);
    }

    const etapes = (Array.isArray(r.steps) ? r.steps : [])
        .map(etape => String(etape ?? '').trim())
        .filter(Boolean)
        // La numérotation se calcule APRÈS le filtrage : une étape vide au milieu ne doit pas
        // faire sauter un numéro à l'écran.
        .map((etape, index) => `${index + 1}. ${etape}`);
    if (etapes.length) {
        blocs.push(`👨‍🍳 PRÉPARATION (${etapes.length} étape${etapes.length > 1 ? 's' : ''})\n${etapes.join('\n\n')}`);
    }

    return blocs.join('\n\n');
}
