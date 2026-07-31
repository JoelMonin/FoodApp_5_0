/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest';
import { state } from '../src/state.js';
import { matchIngredientToStock } from '../js/app.js';

// LOT 014, volet A — TESTS DE CARACTÉRISATION de `matchIngredientToStock`, écrits AVANT son
// déplacement vers `src/utils/stockMatch.js`.
//
// C'est le CŒUR du calcul « en stock / manquant » : il décide la couleur de chaque tag
// d'ingrédient (vert/orange/rouge) et quelles lignes le sélecteur de courses pré-coche. Il
// était pourtant l'une des zones aveugles du lot — 41 lignes, aucun test direct. Ce que les
// tests existants couvraient, c'était ses APPELANTS (`buildIngredientTags`,
// `openEnhancedCartPicker`), jamais ses règles propres.
//
// Un test de caractérisation ne juge pas : il décrit le comportement actuel pour que le
// déplacement soit prouvé fidèle.

const ing = (nom, extra = {}) => ({
    id: 'i_' + nom, name: nom, emoji: '🥕', category: 'Légumes',
    inStock: false, inCart: false, pinned: false, ...extra
});

describe('LOT 014 §A — matchIngredientToStock (caractérisation avant déplacement)', () => {
    beforeEach(() => { state.ingredients = []; });

    it('lit le nom sous ses DEUX formes : `n` (format IA compact) et `name`', () => {
        state.ingredients = [ing('Carotte', { inStock: true })];
        expect(matchIngredientToStock({ n: 'Carotte' }).inStock).toBe(true);
        expect(matchIngredientToStock({ name: 'Carotte' }).inStock).toBe(true);
    });

    it('un ingrédient inconnu de l\'inventaire est manquant, sans correspondance', () => {
        state.ingredients = [ing('Carotte', { inStock: true })];
        const r = matchIngredientToStock({ n: 'Salsifis' });
        expect(r.inStock).toBe(false);
        expect(r.matchedName).toBe(null);
        expect(r.isExact).toBe(false);
    });

    it('un ingrédient connu mais ÉPUISÉ est manquant — tout en gardant sa correspondance', () => {
        state.ingredients = [ing('Carotte', { inStock: false })];
        const r = matchIngredientToStock({ n: 'Carotte' });
        expect(r.inStock).toBe(false);
        expect(r.matchedName).toBe('Carotte'); // on sait à quoi il correspond
        expect(r.isExact).toBe(true);          // et que le nom est exact
    });

    // `isExact` se calcule INDÉPENDAMMENT du stock : c'est ce qui permet aux appelants de
    // distinguer « j'ai exactement ça » de « j'ai quelque chose qui y ressemble ».
    it('`isExact` ignore les accents et la casse', () => {
        state.ingredients = [ing('Épinards', { inStock: true })];
        const r = matchIngredientToStock({ n: 'epinards' });
        expect(r.isExact).toBe(true);
        expect(r.matchedName).toBe('Épinards');
    });

    it('une correspondance APPROCHANTE remplit matchedName mais laisse `isExact` faux', () => {
        state.ingredients = [ing('Tomate cerise', { inStock: true })];
        const r = matchIngredientToStock({ n: 'Tomate' });
        expect(r.matchedName).toBe('Tomate cerise');
        expect(r.isExact).toBe(false);
        expect(r.inStock).toBe(true); // le stock suit la correspondance approchante
    });

    describe('le statut annoncé par l\'IA (`s`) fait autorité sur l\'inventaire', () => {
        it('`s: "stock"` force « en stock », même si l\'inventaire dit épuisé', () => {
            state.ingredients = [ing('Carotte', { inStock: false })];
            const r = matchIngredientToStock({ n: 'Carotte', s: 'stock' });
            expect(r.inStock).toBe(true);
            expect(r.matchedName).toBe('Carotte'); // on affiche quand même la correspondance
        });

        it('`s: "pinned"` force lui aussi « en stock »', () => {
            state.ingredients = [ing('Carotte', { inStock: false })];
            expect(matchIngredientToStock({ n: 'Carotte', s: 'pinned' }).inStock).toBe(true);
        });

        it('`s: "missing"` force « manquant », même si l\'inventaire dit en stock', () => {
            state.ingredients = [ing('Carotte', { inStock: true })];
            const r = matchIngredientToStock({ n: 'Carotte', s: 'missing' });
            expect(r.inStock).toBe(false);
            expect(r.matchedName).toBe('Carotte');
        });

        it('un statut IA inconnu est IGNORÉ : l\'inventaire reprend la main', () => {
            state.ingredients = [ing('Carotte', { inStock: true })];
            expect(matchIngredientToStock({ n: 'Carotte', s: 'nimportequoi' }).inStock).toBe(true);
            state.ingredients = [ing('Carotte', { inStock: false })];
            expect(matchIngredientToStock({ n: 'Carotte', s: 'nimportequoi' }).inStock).toBe(false);
        });
    });

    it('`isPinned` est vrai dès qu\'UN ingrédient ressemblant est épinglé', () => {
        state.ingredients = [ing('Carotte', { pinned: true, inStock: false })];
        expect(matchIngredientToStock({ n: 'Carotte' }).isPinned).toBe(true);
    });

    it('`isPinned` reste faux si le ressemblant n\'est pas épinglé', () => {
        state.ingredients = [ing('Carotte', { pinned: false })];
        expect(matchIngredientToStock({ n: 'Carotte' }).isPinned).toBe(false);
    });

    it('`allMatchesInStock` liste TOUS les ressemblants en stock, pas seulement le premier', () => {
        state.ingredients = [
            ing('Tomate cerise', { inStock: true }),
            ing('Tomate pelée', { inStock: true }),
            ing('Tomate séchée', { inStock: false })   // épuisée : exclue
        ];
        const noms = matchIngredientToStock({ n: 'Tomate' }).allMatchesInStock.map(i => i.name);
        expect(noms).toEqual(['Tomate cerise', 'Tomate pelée']);
    });

    it('sur un inventaire vide, rend un résultat complet et neutre — jamais undefined', () => {
        const r = matchIngredientToStock({ n: 'Carotte' });
        expect(r).toEqual({
            inStock: false, matchedName: null, isExact: false,
            isPinned: false, allMatchesInStock: []
        });
    });

    it('un ingrédient SANS nom ne fait pas lever et ne correspond à rien', () => {
        state.ingredients = [ing('Carotte', { inStock: true })];
        const r = matchIngredientToStock({});
        expect(r.inStock).toBe(false);
        expect(r.matchedName).toBe(null);
    });

    // `areSimilar` compare des MOTS ENTIERS depuis le LOT 011 (correctif hors-plan porté
    // depuis l'oracle) : un fragment de texte ne doit plus créer de fausse correspondance.
    // Verrouillé ici parce que le déplacement passe par cette dépendance.
    it('ne rapproche PAS deux ingrédients sur un simple fragment de texte', () => {
        state.ingredients = [ing('Chocolat', { inStock: true })];
        const r = matchIngredientToStock({ n: 'Chou' });
        expect(r.matchedName).toBe(null);
        expect(r.inStock).toBe(false);
    });
});
