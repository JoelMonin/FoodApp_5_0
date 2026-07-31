import { describe, it, expect } from 'vitest';
import {
  texteNonVide,
  estUnObjetSimple,
  aUnNomExploitable,
  estUnIngredientPlausible,
  estFusionnable,
  isValidRecipe,
  validateState,
  escapePromptValue
} from '../src/utils/validate.js';

// LOT 014, volet C — src/utils/validate.js est la SSOT des gardes d'entrée. Ces tests
// figent la FRONTIÈRE de chaque prédicat : ce qu'il rejette, mais aussi — et surtout — ce
// qu'il doit continuer d'accepter. Durcir un de ces prédicats au-delà du nécessaire serait
// une régression déguisée en sécurité (leçon de l'arbitrage §C du lot : exiger `category`
// aurait rejeté des fichiers de sauvegarde qui fonctionnent aujourd'hui).

describe('LOT 014 §C — texteNonVide / estUnObjetSimple', () => {
  it('texteNonVide rejette vide, espaces, non-chaînes', () => {
    expect(texteNonVide('Tomate')).toBe(true);
    expect(texteNonVide('')).toBe(false);
    expect(texteNonVide('   ')).toBe(false);
    expect(texteNonVide(undefined)).toBe(false);
    expect(texteNonVide(42)).toBe(false);
    expect(texteNonVide(null)).toBe(false);
  });

  it('estUnObjetSimple rejette null, tableaux et primitives', () => {
    expect(estUnObjetSimple({})).toBe(true);
    expect(estUnObjetSimple({ a: 1 })).toBe(true);
    expect(estUnObjetSimple(null)).toBe(false);
    expect(estUnObjetSimple([1, 2])).toBe(false);   // un tableau N'EST PAS un état
    expect(estUnObjetSimple('abc')).toBe(false);
    expect(estUnObjetSimple(42)).toBe(false);
    expect(estUnObjetSimple(undefined)).toBe(false);
  });
});

describe('LOT 014 §C — gardes d\'ingrédient : deux niveaux, un socle', () => {
  it('aUnNomExploitable accepte `name` ET l\'ancien `n` du monolithe', () => {
    expect(aUnNomExploitable({ name: 'Tomate' })).toBe(true);
    expect(aUnNomExploitable({ n: 'Tomate' })).toBe(true);
    expect(aUnNomExploitable({ name: '  ' })).toBe(false);
    expect(aUnNomExploitable({})).toBe(false);
    expect(aUnNomExploitable('Tomate')).toBe(false); // une chaîne n'est pas un ingrédient
  });

  it('estUnIngredientPlausible (remplacement total) exige nom ET identifiant', () => {
    expect(estUnIngredientPlausible({ id: 'i1', name: 'Tomate' })).toBe(true);
    expect(estUnIngredientPlausible({ id: 'i1', n: 'Tomate' })).toBe(true);
    expect(estUnIngredientPlausible({ name: 'Tomate' })).toBe(false); // pas d'id
    expect(estUnIngredientPlausible({ id: 'i1' })).toBe(false);       // pas de nom
  });

  // GARDE-FOU CONTRE LE SUR-DURCISSEMENT : la fiche du lot demandait d'exiger `category`.
  // Ce test fige le refus de cette exigence — `sanitizeGlobalState` pose « Autres », et
  // l'exiger ici rejetterait des sauvegardes aujourd'hui acceptées.
  it('estUnIngredientPlausible N\'EXIGE PAS `category` (arbitrage §C, anti-régression)', () => {
    expect(estUnIngredientPlausible({ id: 'i1', name: 'Tomate' })).toBe(true);
  });

  it('estFusionnable (fusion douce) accepte nom OU identifiant', () => {
    expect(estFusionnable({ id: 'i1' })).toBe(true);              // « cet ingrédient, en stock »
    expect(estFusionnable({ name: 'Tomate' })).toBe(true);        // sans id : la fusion en fabrique un
    expect(estFusionnable({ id: 'i1', name: 'Tomate' })).toBe(true);
    expect(estFusionnable({})).toBe(false);
    expect(estFusionnable('Tomate')).toBe(false);
    expect(estFusionnable(42)).toBe(false);
    expect(estFusionnable(null)).toBe(false);
  });

  it('estFusionnable est bien PLUS PERMISSIF que estUnIngredientPlausible', () => {
    const sansId = { name: 'Tomate' };
    const sansNom = { id: 'i1' };
    expect(estFusionnable(sansId) && !estUnIngredientPlausible(sansId)).toBe(true);
    expect(estFusionnable(sansNom) && !estUnIngredientPlausible(sansNom)).toBe(true);
  });
});

describe('LOT 014 §C — isValidRecipe (réponses de l\'IA)', () => {
  it('accepte une recette minimale, et une recette complète', () => {
    expect(isValidRecipe({ name: 'Soupe' })).toBe(true);
    expect(isValidRecipe({ name: 'Soupe', ingredients: [], steps: ['couper'] })).toBe(true);
  });

  it('rejette une recette sans nom exploitable', () => {
    expect(isValidRecipe({})).toBe(false);
    expect(isValidRecipe({ name: '' })).toBe(false);
    expect(isValidRecipe({ name: '   ' })).toBe(false);
    expect(isValidRecipe({ name: 42 })).toBe(false);
  });

  it('rejette un titre d\'un paragraphe entier (> 200 caractères) — réponse IA déraillée', () => {
    expect(isValidRecipe({ name: 'a'.repeat(200) })).toBe(true);
    expect(isValidRecipe({ name: 'a'.repeat(201) })).toBe(false);
  });

  it('rejette `ingredients` ou `steps` qui ne sont pas des listes', () => {
    expect(isValidRecipe({ name: 'Soupe', ingredients: 'carotte' })).toBe(false);
    expect(isValidRecipe({ name: 'Soupe', steps: 'couper' })).toBe(false);
    // Absents, en revanche, c'est valide : toutes les recettes n'ont pas d'étapes.
    expect(isValidRecipe({ name: 'Soupe', ingredients: undefined })).toBe(true);
  });

  it('rejette les non-objets', () => {
    expect(isValidRecipe(null)).toBe(false);
    expect(isValidRecipe('Soupe')).toBe(false);
    expect(isValidRecipe([{ name: 'Soupe' }])).toBe(false);
  });
});

describe('LOT 014 §C — validateState (document cloud / stockage local)', () => {
  it('exige un inventaire présent et sous forme de tableau', () => {
    expect(validateState({ ingredients: [] })).toBe(true);
    expect(validateState({ ingredients: [{ id: 'i1', name: 'Tomate' }] })).toBe(true);
    expect(validateState({})).toBe(false);
    expect(validateState({ ingredients: 'abc' })).toBe(false);
    expect(validateState({ ingredients: null })).toBe(false);
    expect(validateState(null)).toBe(false);
    expect(validateState([])).toBe(false);
  });

  // ÉCART ASSUMÉ à la lettre de la fiche, figé ici pour qu'on ne le « corrige » pas par
  // erreur : un champ SECONDAIRE mal formé ne doit PAS faire rejeter tout le document.
  // `extractSyncedState` et `sanitizeGlobalState` les coercent sans perte ; rejeter ferait
  // perdre un inventaire sain à cause d'un détail.
  it('n\'exige RIEN des champs secondaires — ils sont réparés en aval, pas rejetés', () => {
    expect(validateState({ ingredients: [], favorites: 'pas un tableau' })).toBe(true);
    expect(validateState({ ingredients: [], extraIngredients: 42 })).toBe(true);
    expect(validateState({ ingredients: [], aiConfig: 'cassé' })).toBe(true);
  });
});

// Trouvé par l'auto-audit du LOT 014, en vérifiant les réponses des auditeurs : les DEUX
// portes qui reçoivent des réglages IA externes les étalaient sans garde de forme suffisante.
// `typeof [] === 'object'` : l'ancienne garde du cloud laissait passer un tableau, et celle
// du fichier n'existait pas du tout. Le spread colle alors des clés `0/1/2` dans les réglages,
// persistées puis poussées au cloud — même famille que le trou d'`importStockOnly` (§C1).
describe('LOT 014 §C — la forme des réglages IA reçus (anti-clés parasites)', () => {
  it('estUnObjetSimple écarte précisément ce que `typeof x === "object"` laissait passer', () => {
    expect(estUnObjetSimple({ creativity: 90 })).toBe(true);
    expect(estUnObjetSimple(['a', 'b'])).toBe(false); // le cas que l'ancienne garde ratait
    expect(estUnObjetSimple('abc')).toBe(false);
    expect(estUnObjetSimple(null)).toBe(false);
  });

  it('démontre le dégât évité : étaler une chaîne fabrique des clés 0/1/2', () => {
    const defauts = { apiKey: '', creativity: 50 };
    const pollue = { ...defauts, ...'abc' };
    expect(pollue['0']).toBe('a'); // ce qui entrait dans les réglages de Joel
    const protege = { ...defauts, ...(estUnObjetSimple('abc') ? 'abc' : {}) };
    expect(protege['0']).toBeUndefined();
    expect(protege.creativity).toBe(50); // et les réglages valides survivent
  });
});

describe('LOT 014 §C — escapePromptValue', () => {
  it('échappe les guillemets, qui sinon casseraient la consigne envoyée à l\'IA', () => {
    expect(escapePromptValue('tomate "cerise"')).toBe('tomate \\"cerise\\"');
  });

  it('échappe les antislashs AVANT les guillemets (ordre non commutatif)', () => {
    expect(escapePromptValue('a\\b')).toBe('a\\\\b');
    // Un antislash suivi d'un guillemet : les deux doivent être échappés, sans se manger.
    expect(escapePromptValue('a\\"b')).toBe('a\\\\\\"b');
  });

  it('remplace les sauts de ligne par des espaces', () => {
    expect(escapePromptValue('ligne1\nligne2')).toBe('ligne1 ligne2');
    expect(escapePromptValue('ligne1\r\nligne2')).toBe('ligne1 ligne2');
  });

  it('tronque à 100 caractères — réservé aux valeurs COURTES', () => {
    expect(escapePromptValue('a'.repeat(500))).toHaveLength(100);
  });

  it('ne plante ni sur undefined ni sur null', () => {
    expect(escapePromptValue(undefined)).toBe('');
    expect(escapePromptValue(null)).toBe('');
  });

  it('laisse un nom d\'ingrédient normal parfaitement intact', () => {
    expect(escapePromptValue('Courgette')).toBe('Courgette');
    expect(escapePromptValue('Pâtes complètes')).toBe('Pâtes complètes');
  });
});
