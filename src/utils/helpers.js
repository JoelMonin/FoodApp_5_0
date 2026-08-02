/**
 * Date au format français — SSOT (LOT 014, volet D). `toLocaleDateString('fr-FR')` était
 * écrit à 4 endroits : 3 chemins d'enregistrement de favori et l'en-tête des textes copiés.
 * Le paramètre rend la date INJECTABLE, seule façon de tester un rendu daté sans dépendre
 * du jour où tourne la suite.
 */
export function formatDateFr(date = new Date()) {
  return date.toLocaleDateString('fr-FR');
}

/**
 * Supprime les accents d'une chaîne de caractères et la met en minuscules.
 *
 * SSOT du retrait d'accents (LOT 014, volet D) : `normalizeString` recopiait la même
 * opération en ligne, ce qui laissait cette fonction sans aucun appelant en production.
 * @param {string} str
 * @returns {string}
 */
export function stripAccents(str) {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/**
 * Normalise une chaîne pour la comparaison (suppression accents, ponctuation, cas particuliers).
 * @param {string} str 
 * @returns {string}
 */
export function normalizeString(str) {
  if (!str) return '';
  let n = str.toLowerCase().trim();
  
  // Cas particuliers pour la FoodApp
  n = n.replace(/pommes? de terre/g, 'pommedeterre');
  n = n.replace(/pdt/g, 'pommedeterre');

  // LOT 014, volet D \u2014 SSOT : le retrait d'accents \u00e9tait recopi\u00e9 ici \u00e0 l'identique de
  // `stripAccents`, qui n'avait alors plus aucun appelant en production. Le brancher
  // supprime la duplication ET rend \u00e0 cette fonction son unique raison d'exister.
  // \u00c9quivalence v\u00e9rifi\u00e9e sur les 297 noms du catalogue + 11 cas limites : 0 diff\u00e9rence.
  n = stripAccents(n);
  n = n.replace(/œ/g, 'oe');
  // Remplacement de la ponctuation par des espaces
  n = n.replace(/[.,\#!$%\^&\*;:{}=\-_`~()'"\/]/g, " ");
  // Suppression des espaces doubles
  n = n.replace(/\s+/g, ' ').trim();
  
  return n;
}

export function generateId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Calcule la distance de Levenshtein entre deux chaînes.
 */
export function levenshtein(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) matrix[i][j] = matrix[i - 1][j - 1];
      else matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Vérifie si deux noms d'ingrédients sont similaires.
 *
 * Régression trouvée par Joël en testant le LOT 011 (2026-07-30) : la comparaison de
 * CHAÎNES BRUTES (`n1.includes(n2)`) faisait matcher « Eau » avec « Agneau » (« eau » est
 * un fragment caché dans « agn-EAU ») et « Oeuf » avec « Bœuf » (« oeuf » caché dans
 * « b-OEUF ») — deux ingrédients sans aucun rapport. Porté depuis l'oracle
 * (`foodapp-v5-Joel.html` l.6383-6414), qui compare des MOTS ENTIERS, jamais des
 * fragments de texte : « eau » et « agneau » sont deux mots différents, jamais confondus.
 * `normalizeString` n'est PAS touchée par ce correctif — seule cette fonction change.
 *
 * Ordre des règles, fidèle à l'oracle :
 * 1. Identique après normalisation.
 * 2. Tous les mots de l'un se retrouvent dans l'autre (ex. « Ail » ⊂ « Ail en poudre » —
 *    volontaire, l'oracle le fait déjà : un ingrédient plus précis compte pour le même).
 * 3. Même mot principal (premier mot) ET au moins tous les mots sauf un en commun (ex.
 *    « Tomates cerises » / « Tomates » mais PAS « Persil frais » / « Thon frais »).
 * 4. Repli flou (fautes de frappe/pluriels), UNIQUEMENT si les deux chaînes dépassent
 *    3 caractères — c'est cette borne, combinée à la comparaison mot-à-mot ci-dessus,
 *    qui empêche « eau » (3 caractères) de déclencher la moindre comparaison floue.
 */
export function areSimilar(recipeIng, inventoryIng) {
  const r = normalizeString(recipeIng);
  const i = normalizeString(inventoryIng);
  if (!r || !i) return false;
  if (r === i) return true;

  const rWords = r.split(' ');
  const iWords = i.split(' ');

  const isRecipeInInventory = rWords.every(word => iWords.includes(word));
  const isInventoryInRecipe = iWords.every(word => rWords.includes(word));
  if (isRecipeInInventory || isInventoryInRecipe) return true;

  const commonWords = rWords.filter(w => iWords.includes(w));
  if (commonWords.length > 0 && commonWords[0] === rWords[0] && rWords[0] === iWords[0]) {
    if (commonWords.length >= Math.min(rWords.length, iWords.length) - 1) return true;
  }

  if (r.length > 3 && i.length > 3) {
    const dist = levenshtein(r, i);
    if (dist <= 1) return true;
    if (dist <= 2 && (r.includes(i) || i.includes(r))) return true;
  }

  return false;
}

/**
 * Devine l'émoji d'un ingrédient à partir de son nom.
 *
 * Reprend la recherche déjà utilisée par le formulaire d'ajout : correspondance
 * exacte du nom normalisé dans la base d'ingrédients. Auparavant cette logique
 * n'existait qu'en ligne dans le formulaire, si bien que les autres écrans
 * (recette IA vers liste de courses) retombaient sur un caddie générique.
 *
 * @param {string} name - Nom de l'ingrédient recherché.
 * @param {Array} db - Base d'ingrédients (`DEFAULT_DB`), injectée pour garder ce
 *   module sans dépendance vers les données.
 * @param {string} [fallback='🛒'] - Émoji rendu si rien n'est trouvé (typiquement
 *   l'émoji de la catégorie de l'ingrédient).
 * @returns {string}
 */
export function autoEmoji(name, db = [], fallback = '🛒') {
  if (!name) return fallback;
  const target = normalizeString(name);
  const match = db.find(i => normalizeString(i.name) === target);
  return match?.emoji || fallback;
}

// Fractions Unicode reconnues par `scaleQty` (LOT 010, casse C12, arbitrage Joel).
const UNICODE_FRACTIONS = {
  '½': 1 / 2, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 1 / 4, '¾': 3 / 4,
  '⅕': 1 / 5, '⅖': 2 / 5, '⅗': 3 / 5, '⅘': 4 / 5,
  '⅙': 1 / 6, '⅚': 5 / 6, '⅐': 1 / 7, '⅛': 1 / 8, '⅜': 3 / 8, '⅝': 5 / 8, '⅞': 7 / 8,
  '⅑': 1 / 9, '⅒': 1 / 10
};
const UNICODE_FRACTION_CHARS = Object.keys(UNICODE_FRACTIONS).join('');

// Ordre de l'alternation SIGNIFICATIF : la fraction ASCII doit être tentée avant le
// nombre simple, sans quoi « 1/2 » matcherait d'abord « 1 » puis, séparément, « 2 »
// (le bug de l'oracle : « 1/2 citron » x2 devenait « 2/4 citron », le 1 et le 2 étant
// mis à l'échelle indépendamment). Unités collées gérées comme l'oracle : le motif
// est cherché n'importe où dans la chaîne, espace ou non avant l'unité.
const QTY_PATTERN = new RegExp(
  `(\\d+\\s*\\/\\s*\\d+)|(\\d+(?:[.,]\\d+)?)|([${UNICODE_FRACTION_CHARS}])`,
  'g'
);

/**
 * Met à l'échelle chaque nombre d'une quantité de recette (LOT 010, casse C12).
 *
 * Porte le principe de l'oracle (`foodapp-v5-Joel.html` l.5474-5484 : nombres
 * entiers/décimaux, unités collées, arrondi à 1 décimale) et corrige un bug de
 * l'oracle plutôt que de le reproduire : celui-ci traitait une fraction ASCII comme
 * deux nombres distincts, corrompant `1/2` en `2/4` dès le premier changement
 * d'échelle. Arbitrage explicite de Joel (2026-07-30) — dépassement volontaire
 * assumé : les fractions ASCII (`1/2`) ET Unicode (`½`) sont reconnues comme UNE
 * seule valeur.
 *
 * Toujours appelée depuis la chaîne D'ORIGINE (jamais depuis un résultat déjà mis à
 * l'échelle) par l'appelant : c'est ce qui garantit l'absence de dérive cumulée d'un
 * changement à l'autre, pas cette fonction elle-même.
 *
 * @param {string} qtyStr - Quantité telle qu'écrite dans la recette (ex. "300 g", "1/2 citron").
 * @param {number} scale - Facteur multiplicatif (1 = inchangé, retourné TEL QUEL sans reformatage).
 * @returns {string}
 */
export function scaleQty(qtyStr, scale) {
  if (!qtyStr || scale === 1) return qtyStr || '';

  return qtyStr.replace(QTY_PATTERN, (match, asciiFraction, decimal, unicodeFraction) => {
    let val;
    if (asciiFraction) {
      const [num, den] = asciiFraction.split('/').map(s => parseFloat(s.trim()));
      if (!den) return match;
      val = num / den;
    } else if (unicodeFraction) {
      val = UNICODE_FRACTIONS[unicodeFraction];
    } else {
      val = parseFloat(decimal.replace(',', '.'));
    }
    if (isNaN(val)) return match;

    const scaled = val * scale;
    return (Math.round(scaled * 10) / 10).toString().replace('.', ',');
  });
}

/**
 * Retarde l'exécution de `fn` tant que de nouveaux appels arrivent.
 * Utilisé pour ne pas re-filtrer tout l'inventaire à chaque touche frappée.
 * @param {Function} fn - La fonction à temporiser.
 * @param {number} delay - Délai d'inactivité en millisecondes avant exécution.
 * @returns {((...args: any[]) => void) & { cancel: () => void }} La version temporisée,
 *   dotée d'une méthode `.cancel()`. LOT 021 — cette ligne annonçait un simple `Function`,
 *   alors que la phrase juste à côté mentionnait déjà le `.cancel()`. La PROSE savait, pas
 *   l'ANNOTATION — et le vérificateur ne lit que l'annotation.
 */
/**
 * Classe une créativité (0-100) dans l'un des trois paliers du curseur IA (LOT 023).
 *
 * SSOT du seuillage : jusqu'ici DUPLIQUÉ implicitement entre la consigne envoyée à l'IA
 * (`creativityInstruction`, `src/services/gemini.js`) et les libellés affichés sous le
 * curseur (`index.html`, jamais mis en évidence). Extrait ici pour que les deux se
 * réfèrent à UNE seule frontière — sans changer où elle passe : `<=33` / `<=66` / le reste,
 * exactement les seuils d'origine du LOT 011.
 *
 * @param {number} creativity
 * @returns {'classique'|'equilibre'|'creatif'}
 */
export function creativityLevel(creativity) {
  if (creativity <= 33) return 'classique';
  if (creativity <= 66) return 'equilibre';
  return 'creatif';
}

/**
 * SSOT de la CONSIGNE LIBRE « Envie du moment » (LOT 028).
 *
 * Deux lecteurs très éloignés décident sur cette valeur : le message envoyé à l'IA
 * (`src/services/gemini.js`) et le rappel affiché sous le bouton Générer
 * (`src/ui/aiPanel.js`). Ils doivent répondre la MÊME chose à « y a-t-il une consigne ? »,
 * sans quoi l'écran annoncerait une exigence que l'IA ne reçoit pas — exactement le
 * mensonge d'interface que ce lot est venu réparer sur « Exceptions autorisées ».
 *
 * Une saisie faite d'espaces ne compte pas : elle n'exprime aucune envie, et elle
 * déclencherait pourtant le bloc prioritaire du prompt.
 *
 * @param {{envie?: string}} [aiConfig]
 * @returns {string} La consigne nettoyée, ou '' s'il n'y en a pas.
 */
export function envieActive(aiConfig) {
  const brut = aiConfig?.envie;
  return typeof brut === 'string' ? brut.trim() : '';
}

export function debounce(fn, delay = 200) {
  let timer = null;
  // LOT 021 — l'annotation dit ce que le code fait depuis toujours : la fonction rendue
  // porte AUSSI une methode `cancel`. Sans elle, le verificateur signalait `.cancel()` comme
  // inexistante chez ses deux appelants (`addForm.js`, `pantryView.js`). Pure declaration :
  // aucun effet a l'execution.
  const debounced = /** @type {((...args: any[]) => void) & { cancel: () => void }} */ (
    (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    }
  );
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}
