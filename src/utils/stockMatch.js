import { state } from '../state.js';
import { areSimilar, normalizeString, autoEmoji } from './helpers.js';
import { CATEGORIE_PAR_DEFAUT, DEFAULT_DB, getCategoryEmoji } from '../data.js';
import { AI_EMOJI_ONLY } from '../constants.js';

/**
 * CORRESPONDANCE INGRÉDIENT ↔ INVENTAIRE — extrait de `js/app.js` au LOT 014, volet A ;
 * REGLE D'ARBITRAGE REECRITE AU LOT 019 (changement de comportement assume, valide par Joel).
 *
 * POURQUOI C'EST LE MODULE LE PLUS SENSIBLE DU PROJET : `matchIngredientToStock` est le SSOT
 * du calcul « en stock / manquant ». Il decide la couleur de chaque tag d'ingredient (vert =
 * j'ai exactement ca, orange = j'ai quelque chose d'approchant, rouge = manquant) ET quelles
 * lignes le selecteur de courses pre-coche — donc ce que Joel achete reellement.
 *
 * LA REGLE (fiche LOT 019 §2) : l'inventaire a le dernier mot DES QU'IL PARLE CLAIREMENT ;
 * l'IA n'arbitre QUE la zone du doute. Ni l'ancienne regle de la version modulaire (l'avis
 * de l'IA ecrasait tout, dans les deux sens), ni celle de l'oracle (l'IA ignoree partout) :
 * chacun tranche la ou il voit clair.
 *
 *  · EXACTE ou GENERIQUE trouve dans l'inventaire  -> l'inventaire seul decide, `s` IGNORE.
 *      « Levure boulangere seche » demandee, « levure » en stock : on en a. Un article exact
 *      mais epuise reste manquant, meme si l'IA le croit disponible.
 *  · SPECIFIQUE ou FRATRIE seulement               -> l'IA arbitre (elle seule sait qu'un
 *      tajine n'est pas un couscous, et que le lait de coco ne remplace pas le lait).
 *  · Rien du tout                                  -> l'IA arbitre l'absence (synonymes :
 *      « Maizena » pour « Fecule (mais) »).
 *
 * TROIS DEFAUTS CORRIGES ICI, tous constates en usage reel (captures du 2026-08-01) :
 *  1. On prenait le PREMIER voisin trouve, pas le MEILLEUR : « Fecule de tapioca » etait
 *     rattachee a « Fecule (mais) » alors que « Fecule (tapioca) » etait en stock. Le
 *     classement de `_rang` restaure la priorite de l'oracle (`foodapp-v5-Joel.html`
 *     l.5339-5355), etendue aux classes de correspondance.
 *  2. « L'IA fait autorite » etait une INVENTION de la version modulaire : l'oracle ne lit
 *     `ing.s` NULLE PART dans ce calcul (une seule occurrence dans tout le monolithe,
 *     l.5308, pour afficher un bouton).
 *  3. Les mots vides et les pluriels de l'oracle (l.6354-6381) avaient ete perdus au
 *     portage — c'est la cause directe du cas « Fecule DE tapioca » (cf. `_motsComparables`).
 *
 * DEUX REGLES ANCIENNES CONSERVEES, chacune verrouillee par un test :
 *  · `isExact` se calcule INDEPENDAMMENT du stock (`tests/stock-match.test.js`) : c'est ce
 *    qui distingue « j'ai exactement ca » de « j'ai quelque chose qui y ressemble », meme
 *    sur un article epuise.
 *  · `areSimilar` compare des MOTS ENTIERS depuis le LOT 011 : « Chou » ne correspond pas a
 *    « Chocolat ». Elle reste le FILTRE des candidats, inchangee — elle a 9 appelants de
 *    production hors de ce module, dont trois qui ECRIVENT des donnees.
 */

// Mots vides et depluralisation : repris tels quels du `normalizeString` de l'oracle
// (`foodapp-v5-Joel.html` l.6366-6380), perdus lors du portage vers la version modulaire.
// Ils vivent ICI et pas dans `helpers.js` a dessein : le `normalizeString` partage sert
// aussi a DECIDER D'ECRIRE (doublon a l'ajout, fusion du panier, import de stock) — le
// resserrer aurait un rayon d'impact bien plus large que cette seule lecture.
const MOTS_VIDES = new Set(['de', 'du', 'des', 'le', 'la', 'les', 'au', 'aux', 'un', 'une', 'd', 'l']);

/** Ensemble de mots signifiants d'un nom : sans mots vides, sans pluriels, sans nombres. */
function _motsComparables(nom) {
    return normalizeString(nom)
        .split(' ')
        .filter(m => m && !MOTS_VIDES.has(m) && !/^\d+$/.test(m))
        // Depluralisation de l'oracle : seulement au-dela de 3 lettres, pour ne pas amputer
        // un nom court legitime (« ris », « jus »). C'est ELLE qui fait tenir « Tomates » face
        // a « Tomate » (mutation M3 : la debrancher fait rougir le CAS 9, nommement).
        //
        // Une premiere version de `_classer` doublait cette regle d'une tolerance « une faute
        // de frappe » sur les noms entiers. La mutation M3 ne prouvait alors RIEN : les deux
        // mecanismes se couvraient l'un l'autre. La tolerance a ete retiree — 810 tests verts
        // sans elle — parce qu'elle etait a la fois redondante ET plus risquee : elle aurait
        // classe « Farine » et « Marine » comme le MEME ingredient, donc donne le dernier mot
        // a l'inventaire sur une paire que seule l'IA peut departager. Deux mecanismes qui se
        // couvrent mutuellement ne sont pas une securite : c'est un angle mort.
        .map(m => (m.length > 3 ? m.replace(/[sx]$/, '') : m));
}

const EXACTE = 0, GENERIQUE = 1, SPECIFIQUE = 2, FRATRIE = 3;

/**
 * Classe un article d'inventaire face a la demande, sur leurs mots signifiants.
 *  · EXACTE     : memes mots (« Fecule de tapioca » / « Fecule (tapioca) »).
 *  · GENERIQUE  : l'article est le terme LARGE dont la recette demande une variante
 *                 (« levure » en rayon, « levure boulangere seche » demandee) -> on en a.
 *  · SPECIFIQUE : l'article est PLUS PRECIS que la demande (« Lait de coco » en rayon,
 *                 « Lait » demande) -> ca depend de la recette, donc du doute.
 *  · FRATRIE    : cousins sans inclusion (« Epices tajine » / « Epices couscous »).
 */
function _classer(motsDemande, motsArticle) {
    if (!motsDemande.length || !motsArticle.length) return FRATRIE;
    const demande = new Set(motsDemande), article = new Set(motsArticle);
    const articleDansDemande = [...article].every(m => demande.has(m));
    const demandeDansArticle = [...demande].every(m => article.has(m));
    if (articleDansDemande && demandeDansArticle) return EXACTE;
    if (articleDansDemande) return GENERIQUE;
    if (demandeDansArticle) return SPECIFIQUE;
    return FRATRIE;
}

/**
 * Priorite d'affichage du « meilleur » candidat (0 = le meilleur). Etend l'ordre de l'oracle
 * (exact en stock > en stock > n'importe lequel) aux quatre classes. A rang egal, l'ordre de
 * l'inventaire departage — d'ou un `reduce` strictement inferieur.
 */
function _rang(classe, enStock) {
    if (classe === EXACTE) return enStock ? 0 : 1;
    if (classe === GENERIQUE) return enStock ? 2 : 3;
    // Dans la zone du doute, un article DISPONIBLE est plus utile a montrer qu'un cousin
    // epuise, quelle que soit sa classe : « Correspond a X » doit designer ce qu'on a.
    if (classe === SPECIFIQUE) return enStock ? 4 : 6;
    return enStock ? 5 : 7;
}

export function matchIngredientToStock(ingredient) {
    const name = ingredient.n || ingredient.name || '';
    const aiStatus = ingredient.s;

    // `areSimilar` reste le filtre d'entree : ce qu'elle refuse n'est jamais un candidat.
    const voisins = state.ingredients.filter(i => areSimilar(name, i.name));
    const motsDemande = _motsComparables(name);
    const candidats = voisins.map(item => {
        const classe = _classer(motsDemande, _motsComparables(item.name));
        return { item, classe, rang: _rang(classe, !!item.inStock) };
    });

    const meilleur = candidats.reduce((a, c) => (a && a.rang <= c.rang ? a : c), null);
    const isExact = candidats.some(c => c.classe === EXACTE);

    // L'inventaire parle CLAIREMENT : il a le dernier mot, l'avis de l'IA n'est pas consulte.
    const clairs = candidats.filter(c => c.classe === EXACTE || c.classe === GENERIQUE);
    let inStock;
    if (clairs.length) {
        inStock = clairs.some(c => c.item.inStock);
    } else if (aiStatus === 'stock' || aiStatus === 'pinned') {
        inStock = true;
    } else if (aiStatus === 'missing') {
        inStock = false;
    } else {
        // L'IA se tait dans la zone du doute. Un article PLUS PRECIS que la demande compte
        // comme disponible — c'est le comportement de l'oracle, et celui que le LOT 011 a
        // restaure (tag orange + 📌 sur un ingredient epingle et en stock). Une simple
        // FRATRIE, elle, penche vers l'achat : racheter coute moins cher que manquer.
        inStock = candidats.some(c => c.classe === SPECIFIQUE && c.item.inStock);
    }

    // LOT 011 (décision D3) : `isPinned` (préfixe 📌) et `allMatchesInStock` (info-bulle
    // « Correspond à… ») restent calculés sur le voisinage complet, sans notion de classe.
    return {
        inStock,
        matchedName: meilleur?.item.name || null,
        isExact,
        isPinned: state.ingredients.some(i => i.pinned && areSimilar(name, i.name)),
        allMatchesInStock: voisins.filter(i => i.inStock)
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
