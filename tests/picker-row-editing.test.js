/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest';
import { state } from '../src/state.js';
import {
    openEnhancedCartPicker,
    confirmRecipeToCart,
    cycleEmoji,
    buildEmojiEditSuggestions
} from '../js/app.js';

// LOT 012, zone A — édition par ligne du sélecteur d'articles (complète le LOT 006).
// Oracle : rendu l.5677-5700, `cycleEmoji` l.5809-5824, `confirmRecipeToCart` l.5826-5862.

function setupModalDom() {
    document.body.innerHTML = `
        <div class="modal-overlay" id="modal-recipe-detail"></div>
        <div class="modal-overlay" id="modal-recipe-to-cart"></div>
        <div class="picker-list" id="modal-recipe-cart-list"></div>
        <input type="checkbox" id="picker-select-all">
    `;
}

function recette(ingredients) {
    return { id: 'r1', name: 'Test', people: 2, ingredients };
}

describe('LOT 012 / zone A — édition par ligne du sélecteur', () => {
    beforeEach(() => {
        setupModalDom();
        state.ingredients = [];
    });

    it('chaque ligne rend un nom éditable, un émoji en lecture seule et un bouton 🎲', () => {
        openEnhancedCartPicker(recette([{ n: 'Tomate', q: '3', e: '🍅', c: 'Légumes' }]));

        const nameInp = document.getElementById('pick-name-0');
        const emojiInp = document.getElementById('pick-emoji-0');
        expect(nameInp.value).toBe('Tomate');
        expect(nameInp.readOnly).toBe(false);
        expect(emojiInp.value).toBe('🍅');
        expect(emojiInp.readOnly).toBe(true);
        expect(document.querySelector('#pitem-0 .picker-magic-btn')).toBeTruthy();
        expect(document.getElementById('pick-cat-0').value).toBe('Légumes');
    });

    it("cliquer le champ nom ne coche/décoche pas la ligne (plus de <label> autour)", () => {
        openEnhancedCartPicker(recette([{ n: 'Tomate', q: '3', e: '🍅', c: 'Légumes' }]));
        const before = document.getElementById('pick-0').checked;

        document.getElementById('pick-name-0').dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(document.getElementById('pick-0').checked).toBe(before);
    });

    it('cycleEmoji fait défiler les suggestions de façon circulaire, en réutilisant buildEmojiEditSuggestions', () => {
        openEnhancedCartPicker(recette([{ n: 'Tomate', q: '3', e: '🍎', c: 'Légumes' }]));
        const expected = buildEmojiEditSuggestions('Tomate', 'Légumes');
        expect(expected.length).toBeGreaterThan(1);

        const emojiInp = document.getElementById('pick-emoji-0');
        cycleEmoji(0);
        const v1 = emojiInp.value;
        expect(expected).toContain(v1);

        for (let i = 0; i < expected.length; i++) cycleEmoji(0);
        expect(emojiInp.value).toBe(v1); // un tour complet ramène à la même valeur
    });

    it("cycleEmoji relit le NOM ÉDITÉ à chaque clic, pas le nom d'origine", () => {
        openEnhancedCartPicker(recette([{ n: 'Yaourt', q: '1', e: '🥛', c: 'Crèmerie' }]));
        const suggestionsOriginal = buildEmojiEditSuggestions('Yaourt', 'Crèmerie');

        document.getElementById('pick-name-0').value = 'Chocolat';
        const suggestionsEdited = buildEmojiEditSuggestions('Chocolat', 'Crèmerie');
        // Prérequis du test : sinon il ne prouverait rien.
        expect(suggestionsEdited).not.toEqual(suggestionsOriginal);

        cycleEmoji(0);
        expect(suggestionsEdited).toContain(document.getElementById('pick-emoji-0').value);
    });

    it("confirmRecipeToCart lit le nom et l'émoji ÉDITÉS, pas les valeurs d'origine", () => {
        openEnhancedCartPicker(recette([{ n: 'Yaourt', q: '1', e: '🥛', c: 'Crèmerie' }]));
        document.getElementById('pick-name-0').value = 'Yaourt nature';
        document.getElementById('pick-emoji-0').value = '🍦';
        document.getElementById('pick-0').checked = true;

        confirmRecipeToCart();

        const added = state.ingredients.find(i => i.name === 'Yaourt nature');
        expect(added).toBeTruthy();
        expect(added.emoji).toBe('🍦');
        expect(added.category).toBe('Crèmerie');
        expect(added.inCart).toBe(true);
        expect(state.ingredients.find(i => i.name === 'Yaourt')).toBeFalsy();
    });

    it("un nom vidé volontairement refuse proprement la ligne — pas de repli silencieux sur l'original", () => {
        openEnhancedCartPicker(recette([{ n: 'Yaourt', q: '1', e: '🥛', c: 'Crèmerie' }]));
        document.getElementById('pick-name-0').value = '   ';
        document.getElementById('pick-0').checked = true;

        confirmRecipeToCart();

        expect(state.ingredients.length).toBe(0);
    });

    it('une ligne non cochée est ignorée même si son nom a été édité', () => {
        openEnhancedCartPicker(recette([{ n: 'Yaourt', q: '1', e: '🥛', c: 'Crèmerie' }]));
        document.getElementById('pick-name-0').value = 'Yaourt nature';
        document.getElementById('pick-0').checked = false;

        confirmRecipeToCart();

        expect(state.ingredients.length).toBe(0);
    });

    it('acquis LOT 006 préservés avec la nouvelle structure : pré-cochage et badge « En stock »', () => {
        state.ingredients = [{ id: 'i1', name: 'Farine', category: 'Épicerie', emoji: '🌾', inStock: true, inCart: false }];
        openEnhancedCartPicker(recette([
            { n: 'Farine', q: '200 g', c: 'Épicerie' },
            { n: 'Sucre', q: '100 g', c: 'Épicerie' }
        ]));

        expect(document.getElementById('pick-0').checked).toBe(false);
        expect(document.getElementById('pitem-0').querySelector('.picker-badge')?.textContent).toBe('En stock');
        expect(document.getElementById('pitem-0').classList.contains('checked')).toBe(false);

        expect(document.getElementById('pick-1').checked).toBe(true);
        expect(document.getElementById('pitem-1').querySelector('.picker-badge')).toBeFalsy();
        expect(document.getElementById('pitem-1').classList.contains('checked')).toBe(true);
    });

    // ─── LOT 013 : la branche `areSimilar` de confirmRecipeToCart n'était couverte par ───
    // ─── AUCUN test avant ce lot (js/app.js:1413-1418).                                ───
    it('un ingrédient déjà présent (même approximativement) est RÉUTILISÉ, jamais dupliqué '
       + '(areSimilar, js/app.js:1413)', () => {
        state.ingredients = [
            { id: 'existant_1', name: 'Yaourt', category: 'Crèmerie', emoji: '🥛', inStock: true, inCart: false, shoppingSource: null }
        ];
        openEnhancedCartPicker(recette([{ n: 'Yaourt', q: '1', e: '🥛', c: 'Crèmerie' }]));
        document.getElementById('pick-0').checked = true;

        confirmRecipeToCart();

        expect(state.ingredients.length).toBe(1); // aucun doublon créé
        const existant = state.ingredients.find(i => i.id === 'existant_1');
        expect(existant.inCart).toBe(true);
        expect(existant.shoppingSource).toBe('Test'); // nom de la recette passée à recette()
        expect(existant.inStock).toBe(true); // le reste de la fiche n'est pas altéré
    });

    it('sans correspondance existante : un NOUVEL ingrédient est créé, avec un id neuf', () => {
        state.ingredients = [];
        openEnhancedCartPicker(recette([{ n: 'Fenouil', q: '1', e: '🌿', c: 'Légumes' }]));
        document.getElementById('pick-0').checked = true;

        confirmRecipeToCart();

        expect(state.ingredients.length).toBe(1);
        const nouveau = state.ingredients[0];
        expect(nouveau.name).toBe('Fenouil');
        expect(nouveau.inCart).toBe(true);
        expect(nouveau.inStock).toBe(false);
        expect(nouveau.id).toBeTruthy();
    });
});
