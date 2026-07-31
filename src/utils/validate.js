/**
 * GARDES D'ENTRÉE DES DONNÉES EXTERNES — SSOT (LOT 014, volet C).
 *
 * Toute donnée qui n'a pas été produite par l'app elle-même entre par une de ces portes :
 * le localStorage relu au démarrage, le document cloud, un fichier de sauvegarde, une
 * réponse d'IA. Avant ce module, chaque porte définissait ses propres règles — et c'est
 * exactement ce qui a laissé « Importer uniquement le stock » sans protection pendant que
 * son bouton jumeau se blindait (LOT 014, §C1) : la garde du voisin était enfermée dans sa
 * fonction, donc inutilisable ailleurs.
 *
 * RÈGLE DE CONCEPTION — ces prédicats REJETTENT, ils ne réparent pas. La réparation
 * (valeurs par défaut, coercitions) vit dans `sanitizeGlobalState` et `extractSyncedState`,
 * et reste volontairement TOLÉRANTE : rejeter un document entier parce qu'un champ
 * secondaire est mal formé perdrait des données saines. On ne rejette donc que ce qui rend
 * la donnée inexploitable.
 *
 * Zéro dépendance : ce module ne doit jamais importer d'état ni de DOM.
 */

/** Une chaîne réellement renseignée (ni vide, ni des espaces). */
export const texteNonVide = (v) => typeof v === 'string' && v.trim() !== '';

/** Un objet simple — ni `null`, ni un tableau, ni une primitive. */
export const estUnObjetSimple = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * Le minimum absolu pour qu'un ingrédient veuille dire quelque chose : un nom.
 * `n` est l'ancien nom court des sauvegardes de l'ère monolithe, que `sanitizeGlobalState`
 * recopie vers `name` — on l'accepte donc au même titre.
 */
export function aUnNomExploitable(i) {
  if (!estUnObjetSimple(i)) return false;
  return texteNonVide(i.name) || texteNonVide(i.n);
}

/**
 * Ingrédient acceptable pour un REMPLACEMENT TOTAL (`importJSON`) : nom **ET** identifiant,
 * parce que ce chemin indexe tout par `id`.
 *
 * ⚠️ N'exige VOLONTAIREMENT PAS `category`, contrairement à la lettre de la fiche du lot :
 * `sanitizeGlobalState` la pose à « Autres » (`src/state.js`), et l'exiger ici rejetterait
 * des fichiers de sauvegarde aujourd'hui acceptés — dont ceux de l'ère monolithe. Durcir
 * au-delà du nécessaire serait une régression déguisée en sécurité (arbitrage tracé dans la
 * fiche du LOT 014, §C des arbitrages).
 */
export function estUnIngredientPlausible(i) {
  return aUnNomExploitable(i) && texteNonVide(i.id);
}

/**
 * Ingrédient acceptable pour une FUSION (`importStockOnly`) : nom **OU** identifiant.
 * Une entrée `{ id: 'ing_1', inStock: true }` sans nom est parfaitement valide (« cet
 * ingrédient-là, maintenant en stock ») et une entrée sans `id` l'est aussi (la fusion
 * fabrique un `custom_restore_…`). Exiger les deux refuserait des fichiers qui fonctionnent.
 */
export function estFusionnable(i) {
  if (!estUnObjetSimple(i)) return false;
  return texteNonVide(i.id) || aUnNomExploitable(i);
}

/**
 * Réglages IA acceptables : un objet, dont la clé API — si elle est présente — est bien une
 * chaîne. Le reste des champs est reposé en forme complète par les appelants
 * (`{ ...defaultAiConfig(), ...reçu }`), il n'y a donc rien d'autre à exiger ici.
 */
export function isValidAiConfig(c) {
  if (!estUnObjetSimple(c)) return false;
  return c.apiKey === undefined || typeof c.apiKey === 'string';
}

/**
 * Recette acceptable venue de l'IA : un nom renseigné et raisonnable, et — s'ils sont
 * présents — des ingrédients et des étapes sous forme de tableaux.
 *
 * La limite de 200 caractères sur le nom vient de la fiche : une « recette » dont le titre
 * fait un paragraphe est une réponse d'IA qui a déraillé, pas une recette.
 */
export function isValidRecipe(r) {
  if (!estUnObjetSimple(r)) return false;
  if (!texteNonVide(r.name) || r.name.length > 200) return false;
  if (r.ingredients !== undefined && !Array.isArray(r.ingredients)) return false;
  if (r.steps !== undefined && !Array.isArray(r.steps)) return false;
  return true;
}

/**
 * État acceptable venu de l'extérieur (document cloud, localStorage).
 *
 * ⚠️ ÉCART ASSUMÉ À LA LETTRE DE LA FICHE, et c'est délibéré. La fiche demandait d'exiger
 * aussi que `favorites`, `extraIngredients` et `aiConfig` soient valides. Or ces champs sont
 * déjà **coercés sans perte** en aval (`extractSyncedState` remplace un non-tableau par `[]`,
 * `sanitizeGlobalState` repose les invariants). Les exiger ici ferait rejeter un document
 * ENTIER — donc perdre un inventaire sain — à cause d'un champ secondaire mal formé. Le
 * rejet est réservé à ce qui rend le document inexploitable.
 *
 * L'invariant retenu est donc exactement celui du garde §4.9 du LOT 007, dont ce prédicat
 * devient la définition unique : **un inventaire présent et sous forme de tableau**.
 */
export function validateState(s) {
  if (!estUnObjetSimple(s)) return false;
  return Array.isArray(s.ingredients);
}

/**
 * Échappe une valeur saisie par l'utilisateur avant de l'interpoler dans une consigne
 * envoyée à l'IA.
 *
 * Le champ d'ajout d'ingrédient est inséré entre guillemets dans un prompt qui décrit
 * lui-même du JSON à guillemets doubles (`js/app.js`) : un `"` saisi casse la consigne, et
 * un texte construit exprès peut la réécrire.
 *
 * ⚠️ RÉSERVÉ AUX VALEURS COURTES. La troncature à 100 caractères est faite pour un nom
 * d'ingrédient. NE JAMAIS l'appliquer à un contenu long — tronquer une recette collée à 100
 * caractères détruirait la fonctionnalité.
 */
export function escapePromptValue(str) {
  return String(str ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/[\r\n]+/g, ' ')
    .slice(0, 100);
}
