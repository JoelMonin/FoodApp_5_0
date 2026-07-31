/**
 * SSOT DE LA LECTURE DES REPONSES JSON DE L'IA (LOT 014, correctif valide par Joel le
 * 2026-07-31).
 *
 * POURQUOI CE MODULE EXISTE. Quatre endroits allaient chercher le JSON dans la reponse de
 * l'IA, chacun a sa facon : `callAI` (rend une CHAINE), `transformRecipeFromText` (essayait
 * `JSON.parse` d'abord), le formulaire d'ajout et l'analyse nutritionnelle (motif brut).
 * Les quatre partageaient le MEME defaut : un motif NON GOURMAND `/\{[\s\S]*?\}/` qui
 * s'arrete a la premiere accolade fermante venue. Des que l'IA imbrique un objet — par ex.
 * `{"category":"Fruits","meta":{"src":"db"}}` — le motif ne rend que `{"category":"Fruits",
 * "meta":{"src":"db"}` : du JSON invalide. La suggestion disparaissait alors SANS message.
 *
 * LA REGLE, UNE SEULE POUR TOUS : on decoupe le JSON en COMPTANT les accolades au lieu de
 * s'arreter a la premiere fermante — comme on compte les parentheses d'un calcul. Les
 * chaines de caracteres sont ignorees dans ce comptage : une accolade ecrite DANS un texte
 * (« Sauce {maison ») ne fausse plus le decoupage.
 *
 * UNE ETAPE ANNONCEE A JOEL A DISPARU EN COURS DE ROUTE, ET C'EST NORMAL. Le plan prevoyait
 * « lire la reponse telle quelle d'abord, aller la chercher dans le texte seulement sinon ».
 * La preuve par retrait a montre que cette premiere etape ne sert a RIEN une fois le
 * comptage en place : decouper une reponse deja purement JSON rend cette meme reponse, en
 * entier. La supprimer n'enleve aucun cas — la garder aurait ete du code que rien ne
 * distingue, donc un futur piege.
 *
 * DEUX SORTIES, PARCE QU'IL Y A DEUX BESOINS :
 *  - `extraireJsonIA` rend l'objet (ou le tableau) PARSE, sinon `null` — c'est ce que veulent
 *    les trois appelants qui exploitent la reponse.
 *  - `decouperJsonIA` rend la CHAINE trouvee, sinon `null` — `callAI` promet une chaine a ses
 *    appelants, ce contrat ne bouge pas.
 *
 * CE QUI N'EST PAS ICI, ET POURQUOI. `generateRecipes` garde son propre sauvetage : il ne
 * cherche pas UN bloc valide, il RECOLTE toutes les recettes completes d'une reponse
 * TRONQUEE (le dernier objet est coupe en plein milieu). C'est un autre besoin ; le fondre
 * ici ferait perdre les recettes deja recuperables.
 */

/**
 * Rend la valeur parsee, ou `undefined` si le candidat est absent ou illisible.
 *
 * Pas de garde « est-ce bien un objet ? » ici, et ce n'est pas un oubli : un candidat sort
 * TOUJOURS de `blocEquilibre`, qui commence sa recherche a une accolade ou un crochet. Une
 * reponse reduite a `null`, `42` ou `"du texte"` ne produit donc aucun candidat du tout et
 * ressort deja comme inexploitable. Une telle garde aurait ete du code que rien ne peut
 * faire echouer — verifie par retrait (LOT 014).
 */
function parserJson(candidat) {
    if (!candidat) return undefined;
    try {
        return JSON.parse(candidat);
    } catch {
        return undefined;
    }
}

/**
 * Rend le PREMIER bloc `{...}` ou `[...]` equilibre du texte, ou `null`.
 * Le type retenu est celui du premier delimiteur rencontre : c'est ce que le motif non
 * gourmand cherchait deja a faire (« le premier bloc »), sans savoir le faire.
 * Une reponse tronquee ne s'equilibre jamais : elle rend `null` plutot qu'un fragment.
 */
function blocEquilibre(texte) {
    const debut = texte.search(/[{[]/);
    if (debut === -1) return null;

    const ouvrant = texte[debut];
    const fermant = ouvrant === '{' ? '}' : ']';
    let profondeur = 0;
    let dansUneChaine = false;
    let echappe = false;

    for (let i = debut; i < texte.length; i++) {
        const c = texte[i];
        if (dansUneChaine) {
            if (echappe) echappe = false;
            else if (c === '\\') echappe = true;
            else if (c === '"') dansUneChaine = false;
            continue;
        }
        if (c === '"') dansUneChaine = true;
        else if (c === ouvrant) profondeur++;
        else if (c === fermant && --profondeur === 0) return texte.slice(debut, i + 1);
    }
    return null;
}

/** Contenu d'un bloc Markdown ```json ... ``` (la balise `json` reste facultative). */
function contenuDuBlocMarkdown(texte) {
    const bloc = texte.match(/```(?:json)?\s*([\s\S]*?)```/i);
    return bloc ? bloc[1].trim() : null;
}

/**
 * Les deux endroits ou chercher, dans l'ordre : d'abord A L'INTERIEUR du bloc Markdown quand
 * l'IA en a pose un, ensuite dans la reponse entiere. Cet ordre n'est pas cosmetique : une
 * reponse qui bavarde AVANT le bloc (« format attendu : {clé: valeur}, voici : ```json… »)
 * ferait mordre le decoupage sur les accolades du bavardage.
 */
function candidatsJson(texte) {
    const dansMarkdown = contenuDuBlocMarkdown(texte);
    return [dansMarkdown && blocEquilibre(dansMarkdown), blocEquilibre(texte)];
}

/**
 * Decoupe la portion JSON d'une reponse IA et la rend TELLE QUELLE (chaine), ou `null`.
 * Utilise par `callAI`, dont le contrat public est de rendre une chaine.
 */
export function decouperJsonIA(texte) {
    if (typeof texte !== 'string') return null;
    return candidatsJson(texte).find(Boolean) || null;
}

/** Lit une reponse IA et rend l'objet ou le tableau qu'elle contient, sinon `null`. */
export function extraireJsonIA(texte) {
    if (typeof texte !== 'string') return null;
    const brut = texte.trim();
    if (!brut) return null;

    for (const piste of candidatsJson(brut)) {
        const valeur = parserJson(piste);
        if (valeur !== undefined) return valeur;
    }
    return null;
}
