/**
 * LECTURE DE LA FICHE RECETTE STRUCTURÉE D'UNE PAGE WEB (LOT 025, volet D).
 *
 * POURQUOI CE MODULE EXISTE. Le volet B nettoyait le TEXTE d'une page pour en tirer une
 * recette — une heuristique, et la mesure l'a confirmée sur-ajustée : −90 % sur Marmiton,
 * qui avait servi de modèle, mais −15 % sur un blog et un mur de cookies envoyé à l'IA sur
 * 750g. La bibliothèque de référence du domaine (`hhursev/recipe-scrapers`, 649 sites) ne
 * procède JAMAIS ainsi : elle lit la fiche que le site publie déjà pour les machines
 * (schema.org `Recipe`, celle que Google affiche dans ses résultats). Mesuré sur 13 pages
 * réelles : **10 en publient une exploitable**, 3 partent au repli. (Chiffre remesuré à la
 * clôture du lot, finding d'audit Codex : il annonçait 9 sur 12, mesure d'avant l'ajout du
 * 13ᵉ site. Un nombre se remesure à chaque étape — leçon LOT 017.)
 *
 * CE QUE ÇA CHANGE. Sur la blanquette de Marmiton, cette fiche donne 13 ingrédients avec
 * leurs quantités et 7 étapes au mot près, en ~1 000 caractères au lieu de 25 000. L'IA
 * n'a plus à reconstituer une recette au milieu du bruit : elle pose les emojis et les
 * catégories sur une donnée déjà juste.
 *
 * MODULE PUR : ni état, ni réseau. Il ne touche au DOM que par `DOMParser`, qui produit un
 * document INERTE (aucun script n'y est exécuté, aucune image n'y est chargée) — jamais par
 * `innerHTML` sur la page vivante.
 *
 * ⚠️ TROIS RÈGLES ISSUES DE L'AUDIT DE SPEC (Codex, 2026-08-02), chacune contre-vérifiée :
 *  - **La fiche retenue est la PLUS COMPLÈTE, jamais « la première trouvée »** : une page
 *    peut porter plusieurs nœuds `Recipe` (échantillon DISTINCT de celui du bilan ci-dessus :
 *    sur les 10 pages examinées pour ce point, 1 en portait trois, toutes identiques).
 *    Prendre la première, c'est dépendre de l'ordre de parcours du document.
 *  - **Les intitulés de section sont retirés AVANT de juger la fiche exploitable** : sans ça
 *    une fiche ne contenant que « Ingrédients » et « Préparation » passerait pour bonne et
 *    remplacerait en silence un repli propre.
 *  - **`ficheEnTexteSource` est SÉPARÉE de `recetteEnTexte`** (`src/utils/recipeText.js`).
 *    Les confondre était tentant — les deux rendent du texte depuis une recette — mais l'une
 *    habille un aperçu pour Joel (majuscules, emojis, compteurs) et l'autre alimente un
 *    message envoyé à l'IA. Fondues, un futur ravalement de l'aperçu changerait le prompt
 *    sans que personne ne le voie.
 */

/** Ce qui n'est qu'un titre de rubrique, jamais un ingrédient ni une étape. */
const INTITULE_DE_SECTION = /^(ingr[ée]dients?|pr[ée]parations?|instructions?|[ée]tapes?|mat[ée]riels?|ustensiles?|recette)\s*:?\s*$/i;

/** Préfixes que certains sites collent en tête d'étape (« Préparation:Laver les… », 750g). */
const PREFIXE_PARASITE = /^\s*(pr[ée]paration|instructions?|[ée]tape\s*\d*)\s*:\s*/i;

/** Puces de liste laissées dans les valeurs par certains sites. */
const PUCE_DE_TETE = /^\s*[-*•–—]\s*/;

/** Profondeur maximale d'exploration d'un document de données structurées. */
const PROFONDEUR_MAX = 12;

/**
 * Décode les entités HTML (`&#039;`, `&frac12;`, `&amp;`) et retire les balises résiduelles.
 * Passe par un document INERTE : `parseFromString` n'exécute rien et ne charge rien.
 */
function decoderTexte(valeur) {
    const brut = String(valeur ?? '');
    if (!brut) return '';
    if (typeof DOMParser === 'undefined') return brut;
    const doc = new DOMParser().parseFromString(brut, 'text/html');
    return (doc.body?.textContent ?? brut).replace(/\s+/g, ' ').trim();
}

/** Rend TOUS les nœuds `Recipe` d'un document de données structurées, dans l'ordre. */
function collecterNoeudsRecette(valeur, sortie = [], profondeur = 0) {
    if (!valeur || typeof valeur !== 'object' || profondeur > PROFONDEUR_MAX) return sortie;
    if (Array.isArray(valeur)) {
        valeur.forEach(v => collecterNoeudsRecette(v, sortie, profondeur + 1));
        return sortie;
    }
    const type = valeur['@type'];
    if (type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'))) sortie.push(valeur);
    for (const clef of Object.keys(valeur)) {
        if (clef === '@type') continue;
        collecterNoeudsRecette(valeur[clef], sortie, profondeur + 1);
    }
    return sortie;
}

/** Nettoie une ligne (ingrédient ou étape) ; rend '' si elle ne porte aucune information. */
function ligneUtile(valeur) {
    const texte = decoderTexte(valeur).replace(PUCE_DE_TETE, '').replace(PREFIXE_PARASITE, '').trim();
    if (!texte || INTITULE_DE_SECTION.test(texte)) return '';
    return texte;
}

/**
 * `recipeIngredient` : tableau de chaînes, tableau d'objets, ou UNE SEULE chaîne à retours
 * ligne (cas réel Marie Claire). Les trois formes donnent une liste propre.
 */
function listerIngredients(valeur) {
    const brutes = Array.isArray(valeur)
        ? valeur.map(v => (v && typeof v === 'object') ? (v.name ?? v.text ?? '') : v)
        : String(valeur ?? '').split(/\r?\n/);
    return brutes.map(ligneUtile).filter(Boolean);
}

/**
 * `recipeInstructions` : APLATISSEMENT RÉCURSIF. Une étape peut être une chaîne, un
 * `HowToStep` (`.text`), ou une `HowToSection` dont les étapes vivent dans `.itemListElement`
 * — piège documenté par les projets du domaine, et qui ferait perdre TOUTES les étapes d'une
 * recette sectionnée si on ne descendait pas dedans.
 */
function listerEtapes(valeur, profondeur = 0) {
    if (!valeur || profondeur > PROFONDEUR_MAX) return [];
    if (typeof valeur === 'string') return [ligneUtile(valeur)].filter(Boolean);
    if (Array.isArray(valeur)) return valeur.flatMap(v => listerEtapes(v, profondeur + 1));
    if (typeof valeur !== 'object') return [];
    if (valeur.itemListElement) return listerEtapes(valeur.itemListElement, profondeur + 1);
    const texte = ligneUtile(valeur.text ?? valeur.name ?? '');
    return texte ? [texte] : [];
}

/**
 * `recipeYield` n'est quasiment jamais un entier propre. Formes rencontrées sur 5 sites :
 * `"4 personnes"`, `"4"`, `["2","2 personnes"]`, `3`. On prend le premier entier trouvé.
 * @returns {number|undefined}
 */
function lireNombreDePersonnes(valeur) {
    const candidats = Array.isArray(valeur) ? valeur : [valeur];
    for (const candidat of candidats) {
        if (typeof candidat === 'number' && Number.isFinite(candidat) && candidat > 0) {
            return Math.trunc(candidat);
        }
        const trouve = String(candidat ?? '').match(/\d+/);
        if (trouve) {
            const n = parseInt(trouve[0], 10);
            if (n > 0) return n;
        }
    }
    return undefined;
}

/**
 * Durée ISO 8601 (`PT2H15M`) en texte lisible. Le schéma l'exige, mais les sites y mettent
 * aussi des minutes brutes ou du texte libre : tout ce qui n'est pas reconnu rend
 * `undefined`, et le champ disparaît simplement de la fiche — jamais d'erreur.
 * @returns {string|undefined}
 */
function lireDuree(valeur) {
    const correspondance = String(valeur ?? '').match(/^P(?:\d+D)?T(?:(\d+)H)?(?:(\d+)M)?/i);
    if (!correspondance) return undefined;
    const heures = parseInt(correspondance[1] || '0', 10);
    const minutes = parseInt(correspondance[2] || '0', 10);
    if (!heures && !minutes) return undefined;
    if (!heures) return `${minutes} min`;
    return minutes ? `${heures} h ${String(minutes).padStart(2, '0')}` : `${heures} h`;
}

/**
 * Traduit un nœud brut en fiche exploitable par l'application.
 * @returns {{name: string, description?: string, people?: number, time?: string,
 *            ingredients: string[], steps: string[]}|null}
 */
export function normaliserFiche(noeud) {
    if (!noeud || typeof noeud !== 'object' || Array.isArray(noeud)) return null;
    const name = decoderTexte(noeud.name);
    if (!name) return null;

    const fiche = {
        name,
        ingredients: listerIngredients(noeud.recipeIngredient),
        steps: listerEtapes(noeud.recipeInstructions)
    };
    const description = decoderTexte(noeud.description);
    if (description) fiche.description = description;
    const people = lireNombreDePersonnes(noeud.recipeYield);
    if (people !== undefined) fiche.people = people;
    const time = lireDuree(noeud.totalTime) || lireDuree(noeud.cookTime) || lireDuree(noeud.prepTime);
    if (time) fiche.time = time;
    return fiche;
}

/**
 * Une fiche n'est retenue que si elle porte de quoi cuisiner. **Cas réel Chef Simon** : la
 * page publie une fiche avec 4 ingrédients et ZÉRO étape — l'accepter donnerait à Joel une
 * recette sans préparation, en croyant avoir fait mieux que le repli.
 */
export function ficheExploitable(fiche) {
    return !!(fiche && fiche.name && fiche.ingredients?.length && fiche.steps?.length);
}

/**
 * Lit le HTML d'une page et rend SA MEILLEURE fiche recette, ou `null`.
 *
 * « Meilleure » et non « première » : voir l'en-tête du module. Le score est simplement le
 * total ingrédients + étapes — sur des copies identiques il départage sans effet de bord,
 * sur une page qui mêlerait recette principale et recette liée il favorise la plus détaillée.
 *
 * @param {string} html
 * @returns {Object|null}
 */
export function lireFicheRecette(html) {
    if (typeof html !== 'string' || !html.trim() || typeof DOMParser === 'undefined') return null;

    const doc = new DOMParser().parseFromString(html, 'text/html');
    const blocs = [...doc.querySelectorAll('script[type="application/ld+json"]')];

    const candidates = [];
    for (const bloc of blocs) {
        let donnees;
        try {
            donnees = JSON.parse(bloc.textContent || '');
        } catch {
            continue; // un bloc illisible n'invalide pas les autres
        }
        for (const noeud of collecterNoeudsRecette(donnees)) {
            const fiche = normaliserFiche(noeud);
            if (ficheExploitable(fiche)) candidates.push(fiche);
        }
    }
    if (!candidates.length) return null;

    return candidates.reduce((meilleure, fiche) =>
        (fiche.ingredients.length + fiche.steps.length) > (meilleure.ingredients.length + meilleure.steps.length)
            ? fiche
            : meilleure);
}

/**
 * Sérialise une fiche pour le message envoyé à l'IA.
 *
 * ⚠️ NE PAS FUSIONNER AVEC `recetteEnTexte` (`src/utils/recipeText.js`), malgré la
 * ressemblance — c'est le finding n°6 de l'audit de spec. Celle-ci produit du texte NU
 * (aucun emoji, aucune majuscule décorative, aucun compteur) parce qu'elle nourrit un
 * prompt ; l'autre habille un aperçu destiné à l'œil de Joel. Fondues, un changement
 * cosmétique de l'aperçu modifierait le message envoyé à l'IA sans que rien ne le signale.
 *
 * @param {Object} fiche - Fiche normalisée.
 * @returns {string}
 */
export function ficheEnTexteSource(fiche) {
    if (!fiche || typeof fiche !== 'object') return '';
    const blocs = [];
    if (fiche.name) blocs.push(`Titre : ${fiche.name}`);
    if (fiche.description) blocs.push(`Description : ${fiche.description}`);
    if (fiche.people !== undefined) blocs.push(`Nombre de personnes : ${fiche.people}`);
    if (fiche.time) blocs.push(`Temps total : ${fiche.time}`);
    if (fiche.ingredients?.length) {
        blocs.push(`Ingrédients :\n${fiche.ingredients.map(i => `- ${i}`).join('\n')}`);
    }
    if (fiche.steps?.length) {
        blocs.push(`Préparation :\n${fiche.steps.map((e, n) => `${n + 1}. ${e}`).join('\n')}`);
    }
    return blocs.join('\n\n');
}
