/**
 * NETTOYEUR DE PAGE WEB IMPORTÉE (LOT 025, volet B).
 *
 * POURQUOI CE MODULE EXISTE. « Lire la page » rapatrie le texte d'une page de recette via
 * Jina Reader, puis l'envoie TEL QUEL à l'IA. Sur une page Marmiton réelle (constat de Joel,
 * 2026-08-02), cela signifie : bandeau cookies, « 1117 partenaires », six menus de navigation,
 * fil d'Ariane, encarts publicitaires, formulaire de newsletter, 176 commentaires, neuf autres
 * recettes en liens et le pied de page complet — pour quatre étapes de cuisine. ~90 % de bruit,
 * payé au jeton, et un risque réel que l'IA suive une des autres recettes citées.
 *
 * CE MODULE EST PUR ET SANS DÉPENDANCE, comme `validate.js` : il se teste sans DOM, sans
 * réseau et sans état.
 *
 * ⚠️ CES RÈGLES SONT DES HEURISTIQUES, ET ELLES SONT TRAITÉES COMME TELLES. Aucune ne connaît
 * un site en particulier ; elles reposent sur des conventions Markdown (un titre de niveau 1
 * ouvre le contenu principal, certains intertitres ouvrent le pied de page). Un site qui ne
 * les respecte pas ne doit pas casser l'import : d'où le garde-fou de `nettoyerPageWeb`, qui
 * **rend le texte d'origine plutôt que du vide** si ses règles ont tout mangé. Une heuristique
 * qui se trompe doit dégrader vers l'inaction, jamais vers la perte.
 *
 * OÙ IL EST BRANCHÉ, ET POURQUOI LÀ. Dans `fetchRecipeFromUrl` (`src/ui/pasteRecipe.js`),
 * AVANT l'écriture dans le champ — donc Joel voit exactement ce qui partira à l'IA et peut le
 * corriger à la main. Le poser côté service (`gemini.js`) aurait rendu le nettoyage invisible,
 * donc invérifiable à l'œil.
 */

/**
 * Intertitres et lignes qui ouvrent le pied de page d'un article : tout ce qui suit le
 * premier marqueur rencontré est jeté. Liste volontairement courte — un marqueur trop
 * générique couperait une recette en deux.
 */
const MARQUEURS_DE_FIN = [
    /^#{1,4}\s*(vous aimerez aussi|commentaires?|avis des internautes|notes? et avis|sur le m[êe]me th[èe]me|[àa] lire aussi|newsletter|articles? similaires?)/i,
    /^(plus de recettes|ces contenus devraient vous int[ée]resser|d[ée]couvrez aussi)\b/i,
    /^(images|links|buttons)\s*:\s*$/i,
    /^©\s*\d{4}/,
];

/** Lignes de service ajoutées par le lecteur de page, sans aucune valeur pour l'IA. */
const LIGNES_TECHNIQUES = /^(URL Source|Published Time|Markdown Content|Warning)\s*:/i;

/** Ce qui ne porte plus aucune information une fois les liens et images retirés. */
const LIGNES_SANS_INFO = [
    /^[\s\-*_+#>|.·•]*$/,          // puces, séparateurs, intertitres devenus vides
    /^[-*+]?\s*\[[ xX]?\]\s*$/,    // cases à cocher orphelines (`- [x]`)
    /^\d+[.)]\s*$/,                // numéro de liste orphelin
    /^https?:\/\/\S+$/i,           // URL nue
];

/**
 * Plafond de sécurité, appliqué en dernier recours. Une page de recette nettoyée pèse
 * quelques milliers de caractères ; ce plafond ne se déclenche que sur une page pathologique,
 * pour qu'un import ne parte jamais en message démesuré.
 */
const PLAFOND_CARACTERES = 12000;

/** En dessous, on considère que le nettoyage a échoué plutôt que réussi (cf. garde-fou). */
const MINIMUM_UTILE = 40;

/** Retire images, liens et balises résiduelles d'une ligne, en gardant les libellés. */
function nettoyerLigne(ligne) {
    return ligne
        // Les images d'abord : sans ça, `[![alt](img) 4 aubergines](lien)` n'est pas
        // reconnaissable comme un lien, et l'ingrédient serait perdu avec le reste.
        .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function estSansInfo(ligne) {
    return LIGNES_SANS_INFO.some(motif => motif.test(ligne));
}

/**
 * Réduit le texte d'une page web à son contenu utile.
 *
 * @param {string} texte - Texte brut rapatrié par le lecteur de page.
 * @returns {string} Texte nettoyé, ou le texte d'origine si le nettoyage n'a rien laissé.
 */
export function nettoyerPageWeb(texte) {
    if (typeof texte !== 'string' || !texte.trim()) return '';

    let lignes = texte.split('\n');

    // 1. Tête : le titre de niveau 1 ouvre le contenu principal. Tout ce qui le précède
    //    (bandeau de consentement, menus, fil d'Ariane) tombe. Pas de titre de niveau 1 →
    //    on ne coupe RIEN : mieux vaut du bruit qu'une recette amputée de son début.
    const debut = lignes.findIndex(l => /^#\s+\S/.test(l));
    if (debut > 0) lignes = lignes.slice(debut);

    // 2. Pied : premier marqueur de fin rencontré.
    const fin = lignes.findIndex(l => MARQUEURS_DE_FIN.some(motif => motif.test(l.trim())));
    if (fin > 0) lignes = lignes.slice(0, fin);

    // 3. Ligne à ligne : liens et images retirés, lignes de service et lignes vides de sens
    //    ramenées à une ligne blanche (pas supprimées, pour ne pas coller les paragraphes).
    const traitees = lignes.map(ligne => {
        if (LIGNES_TECHNIQUES.test(ligne.trim())) return '';
        const propre = nettoyerLigne(ligne);
        return estSansInfo(propre) ? '' : propre;
    });

    // 4. Blancs consécutifs ramenés à un seul.
    const gardees = [];
    for (const ligne of traitees) {
        if (ligne === '' && gardees[gardees.length - 1] === '') continue;
        gardees.push(ligne);
    }

    let resultat = gardees.join('\n').trim();

    // 5. GARDE-FOU. Le nettoyage a mangé un texte substantiel : on rend l'original. Une
    //    heuristique qui se trompe dégrade vers l'inaction, jamais vers la perte.
    if (resultat.length < MINIMUM_UTILE && texte.trim().length >= MINIMUM_UTILE) return texte;
    if (!resultat) return texte;

    if (resultat.length > PLAFOND_CARACTERES) {
        resultat = resultat.slice(0, PLAFOND_CARACTERES).trim() + '\n\n[…suite de la page ignorée]';
    }
    return resultat;
}

/**
 * Titre de la page, sans le préfixe technique du lecteur.
 *
 * DÉFAUT CORRIGÉ ICI (constat de Joel, 2026-08-02) : `fetchRecipeFromUrl` prenait la PREMIÈRE
 * LIGNE du texte rapatrié et n'en retirait que les `#`. Or le lecteur de page ouvre par
 * `Title: …`, d'où un titre proposé « Title: Aubergines au four : la meilleure recette ».
 * L'IA le rattrapait ; « Sauvegarder tel quel » ne le rattrapait pas.
 *
 * @param {string} texte - Texte brut rapatrié par le lecteur de page.
 * @returns {string} Titre trouvé, ou chaîne vide.
 */
export function extraireTitrePage(texte) {
    if (typeof texte !== 'string') return '';

    // Le titre de niveau 1 de l'article prime : c'est le titre de la RECETTE, alors que le
    // `Title:` du lecteur reprend la balise de la page, souvent enrichie pour les moteurs
    // de recherche (« … : la meilleure recette »).
    const niveau1 = texte.match(/^#\s+(.+)$/m);
    if (niveau1) return nettoyerLigne(niveau1[1]);

    const metadonnee = texte.match(/^Title:\s*(.+)$/m);
    if (metadonnee) return nettoyerLigne(metadonnee[1]);

    const premiere = texte.split('\n')
        .map(ligne => nettoyerLigne(ligne.replace(/^#+\s*/, '')))
        .find(ligne => ligne && !LIGNES_TECHNIQUES.test(ligne));
    return premiere || '';
}
