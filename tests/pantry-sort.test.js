/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest';
import { state } from '../src/state.js';
import { getFilteredIngredients } from '../js/app.js';

// LOT 010 — casse C11 : l'inventaire rendait l'ordre d'insertion, un ajout apparaissait
// en fin de grille. Porté depuis l'oracle (`foodapp-v5-Joel.html` l.4646) :
// `localeCompare('fr')` sur le nom, appliqué au résultat déjà filtré.

function ingredient(id, name) {
    return { id, name, category: 'Autres', emoji: '🥕', inStock: false, inCart: false, pinned: false };
}

describe('LOT 010 / C11 — tri alphabétique de l\'inventaire', () => {
    beforeEach(() => {
        state.ingredients = [];
        state.filter = 'all';
        state.search = '';
        state.showInStockOnly = false;
        state.showInCartOnly = false;
    });

    it('trie par ordre alphabétique français, pas par ordre d\'insertion', () => {
        state.ingredients = [ingredient('i1', 'Tomate'), ingredient('i2', 'Ananas'), ingredient('i3', 'Poire')];

        const result = getFilteredIngredients();

        expect(result.map(i => i.name)).toEqual(['Ananas', 'Poire', 'Tomate']);
    });

    it('respecte l\'ordre alphabétique français avec accents — « Épinard » avant « Fraise »', () => {
        state.ingredients = [ingredient('i1', 'Fraise'), ingredient('i2', 'Épinard')];

        const result = getFilteredIngredients();

        expect(result.map(i => i.name)).toEqual(['Épinard', 'Fraise']);
    });

    it('un ingrédient tout juste ajouté apparaît à sa place alphabétique, pas en fin de liste', () => {
        state.ingredients = [ingredient('i1', 'Zeste de citron'), ingredient('i2', 'Abricot')];

        const result = getFilteredIngredients();

        expect(result[0].name).toBe('Abricot');
    });

    it('le tri s\'applique APRÈS le filtrage (recherche, catégorie, toggles)', () => {
        state.ingredients = [
            ingredient('i1', 'Tomate'),
            { ...ingredient('i2', 'Poire'), category: 'Fruits' },
            { ...ingredient('i3', 'Ananas'), category: 'Fruits' }
        ];
        state.filter = 'Fruits';

        const result = getFilteredIngredients();

        expect(result.map(i => i.name)).toEqual(['Ananas', 'Poire']);
    });

    it('après tri, chaque carte reste identifiée par SON id — pas par sa position ' +
       '(verrou anti-régression demandé par l\'audit de spec : risque écarté mais à figer)', () => {
        state.ingredients = [ingredient('zzz_last', 'Zeste'), ingredient('aaa_first', 'Abricot')];

        const result = getFilteredIngredients();

        // Trié : Abricot (aaa_first) en premier — mais son id reste le sien, jamais
        // recalculé depuis sa nouvelle position dans le tableau.
        expect(result[0].id).toBe('aaa_first');
        expect(result[0].name).toBe('Abricot');
        expect(result[1].id).toBe('zzz_last');
    });

    it('ne modifie pas `state.ingredients` lui-même — seul le résultat renvoyé est trié ' +
       '(l\'export presse-papier lit `state.ingredients` directement, son ordre doit ' +
       'rester intact, cf. LOT 005)', () => {
        state.ingredients = [ingredient('i1', 'Zeste'), ingredient('i2', 'Abricot')];
        const ordreOriginal = state.ingredients.map(i => i.id);

        getFilteredIngredients();

        expect(state.ingredients.map(i => i.id)).toEqual(ordreOriginal);
    });
});
