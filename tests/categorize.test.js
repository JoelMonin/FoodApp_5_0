import { describe, it, expect } from 'vitest';
import { guessCategoryLocally, sanitizeCategory } from '../js/app.js';
import { CATEGORIES, DEFAULT_DB } from '../src/data.js';

// LOT 014, volet A — TESTS DE CARACTÉRISATION, écrits AVANT le déplacement du code.
//
// Ces deux fonctions étaient l'une des zones aveugles relevées à la phase découverte :
// 41 lignes, 49 mots-clés et 8 règles écrits en dur, et ZÉRO test direct. Les déplacer sans
// filet aurait annulé localement tout le bénéfice du LOT 013 — précisément à l'endroit où
// le code bouge.
//
// Un test de caractérisation ne juge pas : il DÉCRIT le comportement actuel, quel qu'il
// soit, pour que le déplacement soit prouvé fidèle. Les bizarreries constatées (le seuil de
// 3 caractères, le repli « Conserves & bocaux », la casse sur « arômate ») sont donc figées
// telles quelles, pas corrigées — les corriger serait un changement de comportement, donc
// une autre décision, prise avec Joel.

describe('LOT 014 §A — guessCategoryLocally (caractérisation avant déplacement)', () => {
    it('rend une chaîne vide sous 3 caractères, et sur une entrée vide', () => {
        expect(guessCategoryLocally('')).toBe('');
        expect(guessCategoryLocally('ri')).toBe('');
        expect(guessCategoryLocally('  ')).toBe('');
        expect(guessCategoryLocally(undefined)).toBe('');
    });

    it('un nom EXACT du catalogue rend sa vraie catégorie (source la plus fiable)', () => {
        const reference = DEFAULT_DB[0];
        expect(guessCategoryLocally(reference.name)).toBe(reference.category);
    });

    it('la correspondance exacte ignore accents et casse', () => {
        const avecAccent = DEFAULT_DB.find(i => /[éèêàûôç]/i.test(i.name));
        expect(avecAccent).toBeTruthy();
        expect(guessCategoryLocally(avecAccent.name.toUpperCase())).toBe(avecAccent.category);
    });

    it('les 5 familles de mots-clés répondent sur le PREMIER mot', () => {
        expect(guessCategoryLocally('poulet fermier')).toBe('Protéines');
        expect(guessCategoryLocally('carotte des sables')).toBe('Légumes');
        expect(guessCategoryLocally('pomme golden')).toBe('Fruits');
        expect(guessCategoryLocally('beurre demi-sel')).toBe('Produits laitiers');
        expect(guessCategoryLocally('quinoa blond')).toBe('Pâtes, riz & légumes secs');
    });

    // Comportement RÉEL et volontaire (« conservatives, pas de fuzzy ») : le mot-clé doit
    // être en PREMIER. « filet de poulet » n'est donc pas reconnu. Figé tel quel.
    it('un mot-clé qui n\'est PAS en premier n\'est pas reconnu — règle volontairement stricte', () => {
        expect(guessCategoryLocally('filet de poulet')).toBe('');
        expect(guessCategoryLocally('jus de pomme')).toBe('');
    });

    // Les plats font exception : ils sont cherchés N'IMPORTE OÙ dans le nom.
    it('les plats préparés sont reconnus n\'importe où dans le nom (exception assumée)', () => {
        expect(guessCategoryLocally('pizza margherita')).toBe('Plats & Préparations');
        expect(guessCategoryLocally('petites croquettes')).toBe('Plats & Préparations');
        expect(guessCategoryLocally('grande lasagne')).toBe('Plats & Préparations');
    });

    it('un nom inconnu rend une chaîne vide — jamais une catégorie inventée', () => {
        expect(guessCategoryLocally('xyzabc')).toBe('');
    });

    it('toute catégorie rendue appartient à la liste officielle', () => {
        for (const essai of ['poulet', 'carotte', 'pomme', 'lait', 'riz', 'pizza']) {
            const cat = guessCategoryLocally(essai);
            if (cat) expect(CATEGORIES).toContain(cat);
        }
    });
});

describe('LOT 014 §A — sanitizeCategory (caractérisation avant déplacement)', () => {
    it('une catégorie officielle est rendue telle quelle', () => {
        expect(sanitizeCategory('Légumes', 'peu importe')).toBe('Légumes');
        expect(sanitizeCategory('Protéines', 'peu importe')).toBe('Protéines');
    });

    it('sans catégorie de l\'IA : retombe sur la déduction locale, puis sur « Conserves & bocaux »', () => {
        expect(sanitizeCategory('', 'poulet fermier')).toBe('Protéines');
        expect(sanitizeCategory(null, 'xyzabc')).toBe('Conserves & bocaux');
        expect(sanitizeCategory(undefined, 'xyzabc')).toBe('Conserves & bocaux');
    });

    it('les 8 correspondances de repli traduisent le vocabulaire de l\'IA', () => {
        expect(sanitizeCategory('Boissons', 'x')).toBe('Conserves & bocaux');
        expect(sanitizeCategory('Condiments', 'x')).toBe('Sauces & condiments');
        expect(sanitizeCategory('Sauces diverses', 'x')).toBe('Sauces & condiments');
        expect(sanitizeCategory('Epices', 'x')).toBe('Épices sèches');
        expect(sanitizeCategory('Laitages', 'x')).toBe('Produits laitiers');
        expect(sanitizeCategory('Alternatives vegetales', 'x')).toBe('Alternatives végétales');
        expect(sanitizeCategory('Viandes', 'x')).toBe('Protéines');
        expect(sanitizeCategory('Poissons', 'x')).toBe('Protéines');
        expect(sanitizeCategory('Cereales', 'x')).toBe('Pâtes, riz & légumes secs');
        expect(sanitizeCategory('Plats cuisines', 'x')).toBe('Plats & Préparations');
    });

    it('la traduction est insensible à la casse de la réponse IA', () => {
        expect(sanitizeCategory('BOISSONS', 'x')).toBe('Conserves & bocaux');
        expect(sanitizeCategory('viande rouge', 'x')).toBe('Protéines');
    });

    // BIZARRERIE RÉELLE, figée telle quelle : la règle des épices teste « arômate » avec un
    // accent circonflexe, alors que la comparaison se fait sur une chaîne seulement passée en
    // minuscules — les accents ne sont PAS retirés. « aromate » sans accent ne correspond donc
    // pas. Ce test documente le comportement d'aujourd'hui ; le corriger serait un changement
    // de comportement, pas un déplacement.
    it('« arômate » correspond, « aromate » (sans accent) ne correspond PAS — comportement actuel', () => {
        expect(sanitizeCategory('Arômates', 'x')).toBe('Épices sèches');
        expect(sanitizeCategory('Aromates', 'x')).toBe('Conserves & bocaux');
    });

    it('une catégorie IA inconnue retombe sur la déduction locale du NOM, pas sur du hasard', () => {
        expect(sanitizeCategory('Catégorie Martienne', 'carotte des sables')).toBe('Légumes');
        expect(sanitizeCategory('Catégorie Martienne', 'xyzabc')).toBe('Conserves & bocaux');
    });

    it('rend TOUJOURS une catégorie officielle, pour toute entrée de type CHAÎNE', () => {
        for (const e of ['', null, undefined, 'Boissons', 'nimportequoi', 'Légumes']) {
            expect(CATEGORIES).toContain(sanitizeCategory(e, 'xyzabc'));
        }
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // DEUX DÉFAUTS LATENTS TROUVÉS PAR CES TESTS DE CARACTÉRISATION (2026-07-31).
    // Ils sont FIGÉS TELS QUELS, pas corrigés : le volet A est un déplacement pur, et
    // corriger serait un changement de comportement — donc une autre décision. Ces deux
    // tests documentent la réalité et feront échouer toute correction silencieuse, ce qui
    // obligera à la traiter explicitement.
    // ─────────────────────────────────────────────────────────────────────────────

    // Le mot-clé de repli est « vegetal » au SINGULIER. Une réponse d'IA au pluriel
    // (« Produits végétaux », le plus naturel en français) n'est donc PAS reconnue et
    // atterrit dans le repli générique.
    it('DÉFAUT CONNU : « végétaux » au pluriel n\'est pas reconnu, seul le singulier l\'est', () => {
        expect(sanitizeCategory('vegetal', 'x')).toBe('Alternatives végétales');
        expect(sanitizeCategory('Produits vegetaux', 'x')).toBe('Conserves & bocaux');
        expect(sanitizeCategory('Végétaux', 'x')).toBe('Conserves & bocaux');
    });

    // `aiCat.toLowerCase()` est appelé sans garde de type. Une réponse d'IA renvoyant un
    // NOMBRE fait lever la fonction. L'exception est avalée par le `try/catch` de
    // `handleAddInput` : Joel ne voit pas d'erreur, la suggestion disparaît simplement.
    it('DÉFAUT CONNU : une catégorie IA NON-CHAÎNE fait lever la fonction', () => {
        expect(() => sanitizeCategory(42, 'xyzabc')).toThrow(TypeError);
        expect(() => sanitizeCategory({}, 'xyzabc')).toThrow(TypeError);
    });
});
