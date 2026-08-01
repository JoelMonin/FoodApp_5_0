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

    // ⚠️ BLOC REMPLACÉ AU LOT 019, en connaissance de cause — pas « réparé ».
    //
    // Il s'intitulait « le statut annoncé par l'IA (`s`) fait autorité sur l'inventaire » et
    // gravait, en trois tests, qu'un `s` reçu de l'IA écrasait l'inventaire dans les DEUX
    // sens. Ces tests ne se trompaient pas sur le code : ils décrivaient fidèlement ce que
    // `matchIngredientToStock` faisait au LOT 014. Ils n'ont simplement jamais été confrontés
    // à l'oracle — qui, lui, ne consulte `ing.s` NULLE PART dans ce calcul
    // (`foodapp-v5-Joel.html`, une seule occurrence l.5308, pour afficher un bouton).
    // « L'IA fait autorité » était donc une invention de la version modulaire, jamais une
    // règle du produit. Elle faisait racheter à Joel de la levure qu'il avait.
    //
    // La règle qui la remplace vit dans `tests/stock-match-arbitrage.test.js` (10 critères
    // issus de captures réelles). Ce bloc-ci n'en garde que la charnière : où passe
    // exactement la frontière entre « l'inventaire tranche » et « l'IA arbitre ».
    describe('l\'inventaire a le dernier mot quand il parle clairement (LOT 019)', () => {
        it('`s: "stock"` ne ressuscite PAS un article exact mais épuisé', () => {
            state.ingredients = [ing('Carotte', { inStock: false })];
            const r = matchIngredientToStock({ n: 'Carotte', s: 'stock' });
            expect(r.inStock).toBe(false);
            expect(r.matchedName).toBe('Carotte'); // on affiche quand même la correspondance
        });

        it('`s: "pinned"` ne le ressuscite pas davantage', () => {
            state.ingredients = [ing('Carotte', { inStock: false })];
            expect(matchIngredientToStock({ n: 'Carotte', s: 'pinned' }).inStock).toBe(false);
        });

        it('`s: "missing"` ne fait PAS racheter un article exact qui est en stock', () => {
            state.ingredients = [ing('Carotte', { inStock: true })];
            const r = matchIngredientToStock({ n: 'Carotte', s: 'missing' });
            expect(r.inStock).toBe(true);
            expect(r.matchedName).toBe('Carotte');
        });

        it('un statut IA inconnu est IGNORÉ : l\'inventaire reprend la main', () => {
            state.ingredients = [ing('Carotte', { inStock: true })];
            expect(matchIngredientToStock({ n: 'Carotte', s: 'nimportequoi' }).inStock).toBe(true);
            state.ingredients = [ing('Carotte', { inStock: false })];
            expect(matchIngredientToStock({ n: 'Carotte', s: 'nimportequoi' }).inStock).toBe(false);
        });

        // La frontière elle-même : même inventaire, même avis de l'IA — seule la CLASSE de
        // correspondance change, et elle seule décide qui a le dernier mot.
        it('la frontière : sur un GÉNÉRIQUE l\'IA est ignorée, sur une FRATRIE elle décide', () => {
            state.ingredients = [ing('Poivre', { inStock: true })];
            // « Poivre » (rayon) ⊂ « Poivre noir moulu » (demande) → l'inventaire tranche.
            expect(matchIngredientToStock({ n: 'Poivre noir moulu', s: 'missing' }).inStock).toBe(true);

            state.ingredients = [ing('Poivre blanc', { inStock: true })];
            // « Poivre blanc » et « Poivre noir » : deux cousins → l'IA tranche.
            expect(matchIngredientToStock({ n: 'Poivre noir', s: 'missing' }).inStock).toBe(false);
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
