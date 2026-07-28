// SSOT du numéro de version. Pour changer la version partout :
// modifier UNIQUEMENT cette ligne puis lancer `python scripts/sync_version.py`.
export const APP_VERSION = '5.3.0';

// SSOT des modeles IA par role metier. Ne JAMAIS ecrire un nom de modele ailleurs.
// REASONING : recettes, nutrition, transformation de texte (qualite avant tout).
// FAST : suggestion de categorie, recherche d'emoji (volume, latence, cout).
export const AI_ROLES = {
  REASONING: 'gemini-3.6-flash',
  FAST: 'gemini-3.5-flash-lite'
};

export const FB_USER = 'FoodApp_V5_Joel';
export const FB_URL = 'https://food-app-ef43d-default-rtdb.europe-west1.firebasedatabase.app';

export const LOCAL_STORAGE_KEY = 'pantry_v5';
export const LOCAL_STORAGE_CHECKED_KEY = 'pantry_v5_checked';
