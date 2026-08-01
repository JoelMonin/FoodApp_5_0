/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest';
import { state } from '../src/state.js';
import { matchIngredientToStock } from '../js/app.js';

// LOT 019 — CRITÈRES D'ACCEPTATION, transcrits des captures d'écran réelles de Joel
// (2026-08-01) et de la règle contractuelle de la fiche du lot, §2.
//
// LA RÈGLE EN UNE PHRASE : l'inventaire a le dernier mot dès qu'il parle CLAIREMENT
// (correspondance exacte, ou article générique dont la recette demande une variante) ;
// l'IA n'arbitre QUE la zone du doute (stock plus spécifique que la demande, variantes
// cousines, synonymes hors inventaire).
//
// ATTENDU ÉCRIT AVANT EXÉCUTION (discipline de preuve, CLAUDE.md §5) — sur le code
// d'AVANT implémentation, ces tests doivent se répartir ainsi :
//   ROUGES attendus : 1 (fécule), 2 (levure), 4 (tajine sans avis IA), 8 (exact épuisé),
//                     9 (pluriel).
//   VERTS attendus  : 3, 5, 6, 7, 10 — ils passent DÉJÀ, mais pour une raison différente
//                     de celle que la nouvelle règle leur donnera. Ce sont les garde-fous
//                     qui prouvent que le lot ne casse pas ce qui marchait.
// Tout écart à cette répartition est un signal à comprendre AVANT de coder.

const ing = (nom, extra = {}) => ({
    id: 'i_' + nom, name: nom, emoji: '🥕', category: 'Divers',
    inStock: false, inCart: false, pinned: false, ...extra
});

describe('LOT 019 — l\'inventaire tranche les cas clairs, l\'IA arbitre le doute', () => {
    beforeEach(() => { state.ingredients = []; });

    describe('L\'INVENTAIRE A LE DERNIER MOT (l\'avis de l\'IA est ignoré)', () => {
        // Capture de Joel : « Fécule de tapioca — Correspond à "Fécule (maïs)", pas en stock »,
        // pré-cochée à l'achat, alors que « Fécule (tapioca) » est dans l'inventaire.
        // DEUX défauts en un : le premier voisin trouvé l'emportait sur le meilleur, et les
        // mots vides (« de ») empêchaient de voir que les deux noms désignent la même chose.
        it('CAS 1 — « Fécule de tapioca » est reconnue dans « Fécule (tapioca) », malgré l\'avis « manquant » de l\'IA', () => {
            state.ingredients = [
                ing('Fécule (maïs)', { inStock: false }),      // le PREMIER voisin, et le mauvais
                ing('Fécule (pdt)', { inStock: true }),
                ing('Fécule (tapioca)', { inStock: true })     // le BON, en dernière position
            ];
            const r = matchIngredientToStock({ n: 'Fécule de tapioca', s: 'missing' });
            expect(r.inStock).toBe(true);
            expect(r.matchedName).toBe('Fécule (tapioca)');
            expect(r.isExact).toBe(true);
        });

        it('CAS 2 — « Levure boulangère sèche » n\'est plus rachetée quand « levure » est en stock', () => {
            state.ingredients = [ing('levure', { inStock: true })];
            const r = matchIngredientToStock({ n: 'Levure boulangère sèche', s: 'missing' });
            expect(r.inStock).toBe(true);
            expect(r.matchedName).toBe('levure');
        });

        it('CAS 8 — un ingrédient EXACT mais ÉPUISÉ reste manquant, même si l\'IA le dit en stock', () => {
            state.ingredients = [ing('Carotte', { inStock: false })];
            const r = matchIngredientToStock({ n: 'Carotte', s: 'stock' });
            expect(r.inStock).toBe(false);
            expect(r.matchedName).toBe('Carotte');
        });

        it('CAS 9 — le pluriel ne casse plus la reconnaissance : « Tomates » ↔ « Tomate »', () => {
            state.ingredients = [ing('Tomate', { inStock: true })];
            const r = matchIngredientToStock({ n: 'Tomates' });
            expect(r.inStock).toBe(true);
            expect(r.isExact).toBe(true);   // tag VERT, pas orange
        });
    });

    describe('L\'IA ARBITRE LA ZONE DU DOUTE', () => {
        // Capture de Joel : « Épices tajine — Déjà en stock : "Épices couscous" ». Deux
        // variantes cousines : aucune ne contient l'autre. L'IA seule sait qu'un tajine
        // n'est pas un couscous — c'est le seul endroit où elle apporte quelque chose que
        // le calcul local ne peut pas savoir.
        it('CAS 3 — « Épices tajine » reste à acheter malgré « Épices couscous » en stock (l\'IA dit manquant)', () => {
            state.ingredients = [ing('Épices couscous', { inStock: true })];
            const r = matchIngredientToStock({ n: 'Épices tajine', s: 'missing' });
            expect(r.inStock).toBe(false);
            expect(r.matchedName).toBe('Épices couscous'); // on montre quand même le cousin
        });

        it('CAS 4 — sans avis de l\'IA, deux variantes cousines penchent vers l\'achat (l\'erreur la moins chère)', () => {
            state.ingredients = [ing('Épices couscous', { inStock: true })];
            const r = matchIngredientToStock({ n: 'Épices tajine' });
            expect(r.inStock).toBe(false);
        });

        it('CAS 5 — « Lait » demandé, « Lait de coco » en stock : l\'IA départage, et elle dit manquant', () => {
            state.ingredients = [ing('Lait de coco', { inStock: true })];
            const r = matchIngredientToStock({ n: 'Lait', s: 'missing' });
            expect(r.inStock).toBe(false);
        });

        it('CAS 6 — même situation, mais l\'IA dit « en stock » : on la suit', () => {
            state.ingredients = [ing('Lait de coco', { inStock: true })];
            const r = matchIngredientToStock({ n: 'Lait', s: 'stock' });
            expect(r.inStock).toBe(true);
            expect(r.matchedName).toBe('Lait de coco');
        });

        it('CAS 7 — « Maïzena » introuvable localement : l\'IA seule connaît le synonyme', () => {
            state.ingredients = [ing('Fécule (maïs)', { inStock: true })];
            const r = matchIngredientToStock({ n: 'Maïzena', s: 'stock' });
            expect(r.inStock).toBe(true);
        });

        // GARDE-FOU DE L'ARBITRAGE (écart trouvé À L'IMPLÉMENTATION, cf. fiche §2.3) :
        // quand l'inventaire contient une version PLUS PRÉCISE de ce qui est demandé et
        // que l'IA se tait, on retombe sur le comportement de l'oracle — « j'en ai » —
        // et non sur le repli « dans le doute, achète ». Sans cette nuance, un ingrédient
        // ÉPINGLÉ et en stock serait annoncé manquant (LOT 011, tag orange + 📌).
        it('CAS 10 — « Tomate » demandée, « Tomate cerise » en stock, IA muette : on considère qu\'on en a', () => {
            state.ingredients = [ing('Tomate cerise', { inStock: true, pinned: true })];
            const r = matchIngredientToStock({ n: 'Tomate' });
            expect(r.inStock).toBe(true);
            expect(r.isExact).toBe(false);   // tag ORANGE : approchant, pas exact
            expect(r.isPinned).toBe(true);
        });
    });
});
