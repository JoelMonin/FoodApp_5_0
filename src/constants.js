// SSOT du numéro de version. Pour changer la version partout :
// modifier UNIQUEMENT cette ligne puis lancer `python scripts/sync_version.py`.
export const APP_VERSION = '5.7.0';

// SSOT des modeles IA par role metier. Ne JAMAIS ecrire un nom de modele ailleurs.
// REASONING : recettes, nutrition, transformation de texte (qualite avant tout).
// FAST : suggestion de categorie, recherche d'emoji (volume, latence, cout).
export const AI_ROLES = {
  REASONING: 'gemini-3.6-flash',
  FAST: 'gemini-3.5-flash-lite'
};

// SSOT des plafonds d'ingrédients imposés à l'IA (LOT 010, casse C9).
// L'oracle plafonnait SÉPARÉMENT les deux familles — 6 épinglés ET 6 hors stock
// (`foodapp-v5-Joel.html` l.4737 et l.4916) — et non « 6 au total » comme le
// prétendait le libellé de l'interface. Ces constantes alimentent à la fois la
// règle, les messages et le libellé affiché : ne jamais réécrire un 6 en dur.
export const MAX_PINNED_INGREDIENTS = 6;
export const MAX_EXTRA_INGREDIENTS = 6;

export const FB_USER = 'FoodApp_V5_Joel';
export const FB_URL = 'https://food-app-ef43d-default-rtdb.europe-west1.firebasedatabase.app';

export const LOCAL_STORAGE_KEY = 'pantry_v5';
export const LOCAL_STORAGE_CHECKED_KEY = 'pantry_v5_checked';

// Référence anti-boucle de la synchro : dernier document cloud connu, PERSISTÉ
// (audit Sol du LOT 007, C1) — partagé entre le moteur (js/app.js) et le chemin
// explicite de réinitialisation (src/actions.js). SSOT du nom de la clé.
export const LOCAL_STORAGE_SYNC_REF_KEY = 'pantry_v5_sync_ref';
