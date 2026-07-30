import { describe, it, expect } from 'vitest';
import { stripAccents, normalizeString, generateId, autoEmoji, debounce, areSimilar } from '../src/utils/helpers';
import { getCategoryEmoji, CATEGORIES, CATEGORIES_WITH_EMOJI } from '../src/data';

describe('Helpers Utility', () => {
  describe('stripAccents', () => {
    it('should remove accents and lowercase', () => {
      expect(stripAccents('Éléphant')).toBe('elephant');
      expect(stripAccents('À la fête')).toBe('a la fete');
    });

    it('should return empty string for null/undefined', () => {
      expect(stripAccents(null)).toBe('');
      expect(stripAccents(undefined)).toBe('');
    });
  });

  describe('normalizeString', () => {
    it('should normalize complex food names', () => {
      expect(normalizeString('Pommes de terre')).toBe('pommedeterre');
      expect(normalizeString('PDT au four')).toBe('pommedeterre au four');
    });

    it('should remove punctuation', () => {
      expect(normalizeString('Lait (entier), 1L.')).toBe('lait entier 1l');
    });

    it('should handle œ character', () => {
      expect(normalizeString('Bœuf')).toBe('boeuf');
    });
  });

  describe('generateId', () => {
    it('should generate a string starting with prefix', () => {
      const id = generateId('test');
      expect(id).toMatch(/^test_/);
    });

    it('should be reasonably unique', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('autoEmoji', () => {
    const db = [
      { name: 'Poulet (blanc)', emoji: '🍗', category: 'Protéines' },
      { name: 'Pommes de terre', emoji: '🥔', category: 'Légumes' }
    ];

    it('retrouve l\'emoji par correspondance exacte du nom', () => {
      expect(autoEmoji('Poulet (blanc)', db)).toBe('🍗');
    });

    it('ignore accents, casse et ponctuation comme le formulaire d\'ajout', () => {
      // `normalizeString` replie « PDT » sur « pommedeterre »
      expect(autoEmoji('PDT', db)).toBe('🥔');
      expect(autoEmoji('poulet blanc', db)).toBe('🍗');
    });

    it('rend le repli demandé si rien ne correspond', () => {
      expect(autoEmoji('Salsifis', db)).toBe('🛒');
      expect(autoEmoji('Salsifis', db, '🥦')).toBe('🥦');
    });

    it('rend le repli sur un nom vide ou une base vide', () => {
      expect(autoEmoji('', db)).toBe('🛒');
      expect(autoEmoji(null, db, '📦')).toBe('📦');
      expect(autoEmoji('Poulet (blanc)', [])).toBe('🛒');
    });
  });

  // areSimilar n'avait JAMAIS eu de test, malgré un usage massif (détection de doublons,
  // correspondance stock IA, import). Régression trouvée par Joël en testant le LOT 011
  // (2026-07-30) : la comparaison en chaîne brute faisait matcher « Eau » avec « Agneau »
  // et « Oeuf » avec « Bœuf » — de simples fragments de texte, pas des mots. Porté depuis
  // l'oracle (foodapp-v5-Joel.html l.6383-6414), qui compare des MOTS ENTIERS.
  describe('areSimilar', () => {
    it('identiques après normalisation', () => {
      expect(areSimilar('Tomate', 'tomate')).toBe(true);
      expect(areSimilar('Lait (entier)', 'lait entier')).toBe(true);
    });

    it('LE BUG DE JOËL : un mot court n\'est plus confondu avec un fragment d\'un mot ' +
       'plus long qui le contient par coïncidence', () => {
      expect(areSimilar('Eau', 'Agneau (brochettes)')).toBe(false);
      expect(areSimilar('Oeuf', 'Bœuf (steak)')).toBe(false);
      expect(areSimilar('Ail', 'Détail')).toBe(false);
    });

    it('un ingrédient plus précis compte pour le même (volontaire, déjà le cas dans ' +
       'l\'oracle) : « Ail » ⊂ « Ail en poudre »', () => {
      expect(areSimilar('Ail (en poudre)', 'Ail')).toBe(true);
      expect(areSimilar('Ail', 'Ail (en poudre)')).toBe(true);
    });

    it('même mot principal + la plupart des mots en commun : match', () => {
      expect(areSimilar('Tomates cerises', 'Tomates')).toBe(true);
    });

    it('un seul mot en commun qui n\'est PAS le mot principal : pas de match ' +
       '(exemple documenté par l\'oracle : « frais » ne suffit pas)', () => {
      expect(areSimilar('Persil frais', 'Thon frais')).toBe(false);
    });

    it('repli flou sur fautes de frappe/pluriels, réservé aux chaînes de plus de 3 ' +
       'caractères', () => {
      expect(areSimilar('Carotte', 'Carottes')).toBe(true);
      expect(areSimilar('Courgette', 'Courgettes')).toBe(true);
    });

    it('chaîne vide ou absente : jamais de correspondance, jamais de plantage', () => {
      expect(areSimilar('', 'Tomate')).toBe(false);
      expect(areSimilar('Tomate', '')).toBe(false);
      expect(areSimilar(null, 'Tomate')).toBe(false);
      expect(areSimilar(undefined, undefined)).toBe(false);
    });
  });

  describe('debounce', () => {
    it('n\'exécute qu\'une fois après une rafale d\'appels', async () => {
      let calls = 0;
      const fn = debounce(() => { calls++; }, 10);
      fn(); fn(); fn();
      expect(calls).toBe(0);
      await new Promise(r => setTimeout(r, 30));
      expect(calls).toBe(1);
    });

    it('annule un appel en attente via cancel()', async () => {
      let calls = 0;
      const fn = debounce(() => { calls++; }, 10);
      fn();
      fn.cancel();
      await new Promise(r => setTimeout(r, 30));
      expect(calls).toBe(0);
    });
  });
});

describe('Catégories (source unique)', () => {
  it('dérive CATEGORIES de la table nom+emoji', () => {
    expect(CATEGORIES).toEqual(CATEGORIES_WITH_EMOJI.map(c => c.name));
  });

  it('donne un emoji à chaque catégorie, sans exception', () => {
    for (const cat of CATEGORIES) {
      expect(getCategoryEmoji(cat)).toBeTruthy();
    }
  });

  it('inclut « Autres », la catégorie de repli réellement produite par le code', () => {
    expect(CATEGORIES).toContain('Autres');
  });

  it('rend le carton pour une catégorie inconnue', () => {
    expect(getCategoryEmoji('Catégorie inexistante')).toBe('📦');
  });
});
