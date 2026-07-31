import { normalizeString } from './helpers.js';
import { CATEGORIES, DEFAULT_DB } from '../data.js';

/**
 * DEDUCTION DE CATEGORIE — extrait de `js/app.js` au LOT 014, volet A.
 *
 * Deplacement PUR : pas une regle n'a change, y compris ses defauts connus (voir plus bas).
 * Le filet a ete pose AVANT le deplacement (`tests/categorize.test.js`, 17 tests de
 * caracterisation), conformement a la regle du lot sur les zones aveugles.
 *
 * DERIVATION DEPUIS `DEFAULT_DB` : volontairement NON tentee. L'etape 1 interroge deja le
 * catalogue (c'est la partie SSOT). Les mots-cles de l'etape 2 sont des RADICAUX au
 * singulier (`poulet`, `carotte`) alors que `DEFAULT_DB` porte des noms qualifies
 * (« Boeuf (hache) ») : les deriver changerait le comportement, ce qu'interdit le pare-feu
 * du lot. Les 8 regles de `sanitizeCategory` traduisent, elles, le vocabulaire de l'IA —
 * aucune donnee du projet ne peut les produire.
 *
 * DEUX DEFAUTS LATENTS, figes tels quels par les tests et traces au backlog :
 *  - le repli « vegetal » est au SINGULIER : « Produits vegetaux » n'est pas reconnu ;
 *  - `aiCat.toLowerCase()` n'a pas de garde de type : une categorie IA non-chaine leve.
 * Les corriger est un CHANGEMENT DE COMPORTEMENT, donc une decision a part.
 */

export function guessCategoryLocally(name) {
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

export function sanitizeCategory(aiCat, name) {
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
