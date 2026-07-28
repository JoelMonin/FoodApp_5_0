/**
 * Supprime les accents d'une chaîne de caractères et la met en minuscules.
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

  n = n.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
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
 */
export function areSimilar(recipeIng, inventoryIng) {
  const n1 = normalizeString(recipeIng);
  const n2 = normalizeString(inventoryIng);
  if (n1 === n2) return true;
  if (n1.includes(n2) || n2.includes(n1)) return true;
  const dist = levenshtein(n1, n2);
  const threshold = Math.min(n1.length, n2.length) > 5 ? 2 : 1;
  return dist <= threshold;
}

/**
 * Devine l'émoji d'un ingrédient en fonction de son nom.
 */
export function autoEmoji(name, categories = []) {
  return '🛒';
}
