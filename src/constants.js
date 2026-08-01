// SSOT du numéro de version. Pour changer la version partout :
// modifier UNIQUEMENT cette ligne puis lancer `python scripts/sync_version.py`.
export const APP_VERSION = '5.13.0';

// SSOT des modeles IA par role metier. Ne JAMAIS ecrire un nom de modele ailleurs.
// REASONING : recettes, nutrition, transformation de texte (qualite avant tout).
// FAST : suggestion de categorie, recherche d'emoji (volume, latence, cout).
export const AI_ROLES = {
  REASONING: 'gemini-3.6-flash',
  FAST: 'gemini-3.5-flash-lite'
};

// SSOT du message affiché quand la clé Gemini manque (LOT 014, décidé par Joel le
// 2026-07-31). Le même besoin s'annonçait de QUATRE façons différentes selon l'écran
// (« Clé API manquante. », « Clé API requise pour l'analyse », « Clé API requise »,
// « Clé API Gemini requise ») : quatre formulations pour une seule et même action à faire,
// et une seule qui disait quelle clé. C'est celle-là qui est retenue partout.
// Chaque écran garde en revanche SA réaction : ouvrir les Réglages, ou seulement prévenir.
export const MESSAGE_CLE_API_MANQUANTE = 'Clé API Gemini requise';

// SSOT des plafonds d'ingrédients imposés à l'IA (LOT 010, casse C9).
// L'oracle plafonnait SÉPARÉMENT les deux familles — 6 épinglés ET 6 hors stock
// (`foodapp-v5-Joel.html` l.4737 et l.4916) — et non « 6 au total » comme le
// prétendait le libellé de l'interface. Ces constantes alimentent à la fois la
// règle, les messages et le libellé affiché : ne jamais réécrire un 6 en dur.
export const MAX_PINNED_INGREDIENTS = 6;
export const MAX_EXTRA_INGREDIENTS = 6;

// SSOT du PÉRIMÈTRE DU FICHIER DE SAUVEGARDE (LOT 015, chantier 10a).
// L'export sérialisait `state` en ENTIER : partaient donc dans le fichier la vue courante,
// la recherche, les filtres et les suggestions IA. Restaurer une sauvegarde faite pendant
// qu'un filtre était actif rouvrait l'app filtrée ou vide, et changeait d'écran tout seul.
// L'oracle avait une liste blanche (`foodapp-v5-Joel.html` l.6490) ; la migration l'a perdue.
//
// Les coches de courses ne figurent PAS ici : elles vivent hors de `state` (Set séparé,
// `shoppingChecked`) et entrent par `replaceShoppingChecked`, jamais par le `spread` de
// `setState` — sans quoi elles créeraient un doublon dans l'état (violation SSOT §6).
// LOT 014, volet G : `customCartItems` retiré du périmètre. Un ancien fichier qui en
// contient reste lisible — `importJSON` ne boucle que sur cette liste, une clé hors
// périmètre est simplement ignorée.
export const BACKUP_STATE_KEYS = [
  'ingredients',
  'favorites',
  'extraIngredients',
  'aiConfig'
];

// Socle générique de secours pour les suggestions d'emoji — SSOT unique, partagé par
// `updateEmojiSuggestions` (flux Ajouter, `src/ui/addForm.js`) et `buildEmojiEditSuggestions`
// (flux Édition, `js/app.js`, LOT 009). Ne JAMAIS dupliquer cette liste ailleurs.
// LOT 014, volet A : remonté ici quand le formulaire d'ajout est parti dans son module —
// laissé dans `js/app.js`, il serait devenu la copie d'un des deux flux.
export const GENERIC_EMOJI_FALLBACK = ['🧂', '🧅', '🧄', '🥦', '🥩', '🍎', '🥚', '🥛'];

// Filet de sécurité emoji ingrédient (LOT 010, casse C12, durci après audit Codex Terra) :
// un prompt IA sans indication de format a pu, par le passé, faire dériver du texte (une
// unité comme "g") dans le champ emoji. Ancré sur la chaîne ENTIÈRE (`.test()` cherche
// n'importe où par défaut — une valeur mixte comme "g🐟" passait sinon). `\p{Emoji}️`
// (sélecteur de variante 16) couvre en plus les emojis à présentation texte par défaut,
// explicitement forcés en emoji. SSOT (LOT 011) : partagé par le sélecteur de courses et
// le détail de recette — un correctif de sécurité ne doit vivre qu'à un seul endroit.
// LOT 014, volet A : remonté ici quand `buildIngredientTags` est parti dans
// `src/utils/stockMatch.js` — laissé dans `js/app.js`, il aurait fallu le dupliquer.
export const AI_EMOJI_ONLY = /^(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F)+$/u;

// LOT 014, volet D — SSOT des VUES et de leurs alias. La table etait ecrite en dur dans
// `renderCurrentView`, et la double appellation `fav`/`favorites` (comme `export`/
// `settings`) etait retestee a la main a 4 endroits. Rien ne garantissait que les 5 restent
// d'accord : ajouter une vue obligeait a penser aux 5 sites, sans qu'aucun ne le rappelle.
export const PANNEAU_DE_VUE = {
  pantry: 'pantry',
  shopping: 'shopping',
  ai: 'ai',
  fav: 'favorites',
  favorites: 'favorites',
  add: 'add',
  export: 'export',
  settings: 'export'
};

// Les favoris et les reglages repondent chacun a DEUX noms, heritage de la migration.
export const estVueFavoris = (vue) => vue === 'fav' || vue === 'favorites';
export const estVueReglages = (vue) => vue === 'export' || vue === 'settings';

export const FB_USER = 'FoodApp_V5_Joel';
export const FB_URL = 'https://food-app-ef43d-default-rtdb.europe-west1.firebasedatabase.app';

export const LOCAL_STORAGE_KEY = 'pantry_v5';
export const LOCAL_STORAGE_CHECKED_KEY = 'pantry_v5_checked';

// Drapeau « des modifications attendent d'etre envoyees », PERSISTE (LOT 007 §4.3) :
// couvre aussi le rechargement de page. LOT 014, volet D : remonte ici, les 3 autres cles
// du projet y etaient deja — une cle de stockage oubliee dans un module est invisible le
// jour ou l'on cherche « tout ce que l'app ecrit sur cet appareil ».
export const LOCAL_STORAGE_SYNC_PENDING_KEY = 'pantry_v5_sync_pending';

// Horodatage de la derniere synchro reussie — metadonnee LOCALE, hors du document cloud
// (LOT 007 §4.1, audit Codex v2). Sert uniquement a l'affichage.
export const LOCAL_STORAGE_SYNC_LAST_KEY = 'pantry_v5_last_sync';

// Référence anti-boucle de la synchro : dernier document cloud connu, PERSISTÉ
// (audit Sol du LOT 007, C1) — partagé entre le moteur (js/app.js) et le chemin
// explicite de réinitialisation (src/actions.js). SSOT du nom de la clé.
export const LOCAL_STORAGE_SYNC_REF_KEY = 'pantry_v5_sync_ref';
