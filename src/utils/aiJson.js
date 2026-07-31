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
 * Trouve la fin du bloc equilibre qui COMMENCE a `debut`, ou `-1` s'il ne s'equilibre
 * jamais. Chaines et echappements ignores dans le comptage — voir l'en-tete du module.
 */
function finDuBloc(texte, debut) {
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
        else if (c === fermant && --profondeur === 0) return i;
    }
    return -1;
}

/**
 * Rend TOUS les blocs `{...}` ou `[...]` equilibres du texte, dans l'ordre ou ils
 * apparaissent — pas seulement le premier.
 *
 * CORRECTIF (LOT 014, trouve par audit adversarial le 2026-07-31, verifie sur piece). La
 * version precedente ne regardait QUE depuis le tout premier `{`/`[` du texte, et abandonnait
 * si ce premier bloc ne s'equilibrait pas ou ne parsait pas. Un crochet de PROSE avant le
 * vrai JSON (« Voir [la documentation]... {"category":"Fruits"} ») capturait `[la
 * documentation]`, un bloc qui S'EQUILIBRE tres bien sans etre du JSON valide — et la
 * fonction s'arretait la, recreant exactement le symptome que ce module devait eliminer
 * (« la suggestion disparait sans message »). La liste ci-dessous laisse l'appelant essayer
 * CHAQUE bloc trouve, dans l'ordre, jusqu'a ce qu'un vrai JSON soit reconnu.
 */
function blocsEquilibres(texte) {
    const blocs = [];
    let depart = 0;
    while (depart < texte.length) {
        const relatif = texte.slice(depart).search(/[{[]/);
        if (relatif === -1) break;
        const debut = depart + relatif;
        const fin = finDuBloc(texte, debut);
        if (fin === -1) {
            depart = debut + 1; // ce delimiteur ne s'equilibre jamais : on tente le suivant
            continue;
        }
        blocs.push(texte.slice(debut, fin + 1));
        depart = fin + 1;
    }
    return blocs;
}

/** Contenu d'un bloc Markdown ```json ... ``` (la balise `json` reste facultative). */
function contenuDuBlocMarkdown(texte) {
    const bloc = texte.match(/```(?:json)?\s*([\s\S]*?)```/i);
    return bloc ? bloc[1].trim() : null;
}

/**
 * Toutes les pistes a essayer, dans l'ordre : d'abord CHAQUE bloc trouve A L'INTERIEUR du
 * bloc Markdown quand l'IA en a pose un, ensuite chaque bloc de la reponse entiere. Cet
 * ordre n'est pas cosmetique : une reponse qui bavarde AVANT le bloc Markdown (« format
 * attendu : {clé: valeur}, voici : ```json… ») ne doit pas faire gagner l'accolade du
 * bavardage sur le vrai JSON encadre.
 */
function candidatsJson(texte) {
    const dansMarkdown = contenuDuBlocMarkdown(texte);
    return [...(dansMarkdown ? blocsEquilibres(dansMarkdown) : []), ...blocsEquilibres(texte)];
}

/**
 * Decoupe la portion JSON d'une reponse IA et la rend TELLE QUELLE (chaine), ou `null`.
 * Utilise par `callAI`, dont le contrat public est de rendre une chaine. Rend le PREMIER
 * candidat qui parse reellement — un bloc qui s'equilibre sans etre du JSON valide (ex. un
 * crochet de prose) est ignore, pas retenu tel quel.
 */
export function decouperJsonIA(texte) {
    if (typeof texte !== 'string') return null;
    for (const piste of candidatsJson(texte)) {
        if (parserJson(piste) !== undefined) return piste;
    }
    return null;
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
