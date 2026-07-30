/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { state } from '../src/state.js';
import { renderRecipeCard } from '../src/ui/recipe.js';
import { renderAIResults, buildIngredientTags } from '../js/app.js';

// LOT 011, chantier 1 — les cartes de résultats IA étaient réduites à emoji + nom +
// « temps · difficulté ». Structure et règle des 3 couleurs restaurées à l'identique de
// l'oracle (`renderAIResults`, foodapp-v5-Joel.html l.5283-5331). Les boutons directs
// (⭐/🛍) ne se rendent QUE si leur handler est fourni (trouvé par l'audit du sous-lot
// 11A : le composant est aussi visé par les favoris, qui ne fournissent pas ces deux-là).

function recette(overrides = {}) {
    return {
        name: 'Tarte aux pommes',
        time: '45 min',
        difficulty: 'Moyen',
        people: 4,
        cuisine: 'Française',
        description: 'Une tarte simple et gourmande',
        ingredients: [
            { n: 'Pomme', s: 'stock' },
            { n: 'Farine', s: 'missing' }
        ],
        ...overrides
    };
}

describe('LOT 011 / chantier 1 — cartes de résultats IA complètes', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div id="ai-results-list" class="hidden"></div>
            <div id="ai-placeholder"></div>
        `;
        state.ingredients = [
            { id: 'i1', name: 'Pomme', inStock: true, pinned: false },
            { id: 'i2', name: 'Farine', inStock: false, pinned: false }
        ];
        state.aiSuggestions = [];
    });

    it('affiche le numéro, la méta complète et le pitch', () => {
        const r = recette();
        const tags = buildIngredientTags(r.ingredients, 'card');
        const card = renderRecipeCard(r, 0, { openRecipeDetail: () => {} }, tags);

        expect(card.querySelector('.rc-num').textContent).toBe('1');
        expect(card.querySelector('.rc-name').textContent).toBe('Tarte aux pommes');
        expect(card.querySelector('.rc-meta').textContent).toContain('45 min');
        expect(card.querySelector('.rc-meta').textContent).toContain('4 pers.');
        expect(card.querySelector('.rc-meta').textContent).toContain('Française');
        expect(card.querySelector('.rc-pitch').textContent).toBe('Une tarte simple et gourmande');
    });

    it('affiche le bon numéro selon la position dans la liste', () => {
        const card = renderRecipeCard(recette(), 3, { openRecipeDetail: () => {} }, []);

        expect(card.querySelector('.rc-num').textContent).toBe('4');
    });

    it('omet le pitch quand la description est absente', () => {
        const r = recette({ description: undefined });
        const card = renderRecipeCard(r, 0, { openRecipeDetail: () => {} }, []);

        expect(card.querySelector('.rc-pitch')).toBeNull();
    });

    it('colore les tags selon le stock réel : vert exact, rouge manquant', () => {
        const r = recette();
        const tags = buildIngredientTags(r.ingredients, 'card');
        const card = renderRecipeCard(r, 0, { openRecipeDetail: () => {} }, tags);

        const rendus = [...card.querySelectorAll('.r-tag')];
        expect(rendus.find(t => t.textContent.includes('Pomme')).className).toContain('green');
        expect(rendus.find(t => t.textContent.includes('Farine')).className).toContain('red');
    });

    it('correspondance approximative : orange, avec préfixe 📌 si épinglé', () => {
        state.ingredients = [{ id: 'i1', name: 'Pommes golden', inStock: true, pinned: true }];
        const r = recette({ ingredients: [{ n: 'Pomme' }] }); // pas de statut IA : l'inventaire tranche
        const tags = buildIngredientTags(r.ingredients, 'card');

        expect(tags[0].cls).toBe('orange');
        expect(tags[0].isPinned).toBe(true);

        const card = renderRecipeCard(r, 0, { openRecipeDetail: () => {} }, tags);
        expect(card.querySelector('.r-tag').textContent).toContain('📌');
    });

    it('limite les tags à 6 même si la recette a plus d\'ingrédients', () => {
        const beaucoup = Array.from({ length: 9 }, (_, i) => ({ n: `Ingrédient ${i}` }));
        const tags = buildIngredientTags(beaucoup, 'card');
        const card = renderRecipeCard(recette({ ingredients: beaucoup }), 0, { openRecipeDetail: () => {} }, tags);

        expect(card.querySelectorAll('.r-tag').length).toBe(6);
    });

    it('le clic sur la carte ouvre le détail avec le bon index et la bonne source', () => {
        const openRecipeDetail = vi.fn();
        const card = renderRecipeCard(recette(), 2, { openRecipeDetail }, []);

        card.click();

        expect(openRecipeDetail).toHaveBeenCalledWith(2, 'ai');
    });

    it('le bouton « Voir la recette → » est toujours présent et ouvre le détail sans doublon', () => {
        const openRecipeDetail = vi.fn();
        const card = renderRecipeCard(recette(), 0, { openRecipeDetail }, []);
        const voirBtn = [...card.querySelectorAll('.rc-btn')].find(b => b.textContent.includes('Voir la recette'));

        voirBtn.click();

        expect(openRecipeDetail).toHaveBeenCalledTimes(1);
    });

    it('« ⭐ Favoris » n\'apparaît que si le handler est fourni, et l\'appelle sans ouvrir le détail', () => {
        const openRecipeDetail = vi.fn();
        const sansHandler = renderRecipeCard(recette(), 0, { openRecipeDetail }, []);
        expect([...sansHandler.querySelectorAll('.rc-btn')].some(b => b.textContent.includes('Favoris'))).toBe(false);

        const saveToFavorites = vi.fn();
        const avecHandler = renderRecipeCard(recette(), 0, { openRecipeDetail, saveToFavorites }, []);
        const favBtn = [...avecHandler.querySelectorAll('.rc-btn')].find(b => b.textContent.includes('Favoris'));
        favBtn.click();

        expect(saveToFavorites).toHaveBeenCalledTimes(1);
        expect(openRecipeDetail).not.toHaveBeenCalled();
    });

    it('« 🛍 hors stock => courses » apparaît UNIQUEMENT si un ingrédient manque ET que le ' +
       'handler est fourni (sécurité ajoutée pour le composant partagé avec les favoris)', () => {
        const openRecipeDetail = vi.fn();
        const r = recette(); // contient un ingrédient manquant (Farine, s:'missing')
        const tags = buildIngredientTags(r.ingredients, 'card');

        const sansHandler = renderRecipeCard(r, 0, { openRecipeDetail }, tags);
        expect([...sansHandler.querySelectorAll('.rc-btn')].some(b => b.textContent.includes('hors stock'))).toBe(false);

        const addMissingToCart = vi.fn();
        const avecHandler = renderRecipeCard(r, 0, { openRecipeDetail, addMissingToCart }, tags);
        const cartBtn = [...avecHandler.querySelectorAll('.rc-btn')].find(b => b.textContent.includes('hors stock'));
        cartBtn.click();

        expect(addMissingToCart).toHaveBeenCalledTimes(1);
    });

    it('pas de bouton "hors stock" si tous les ingrédients sont en stock', () => {
        const openRecipeDetail = vi.fn();
        const addMissingToCart = vi.fn();
        const r = recette({ ingredients: [{ n: 'Pomme', s: 'stock' }] });
        const tags = buildIngredientTags(r.ingredients, 'card');

        const card = renderRecipeCard(r, 0, { openRecipeDetail, addMissingToCart }, tags);

        expect([...card.querySelectorAll('.rc-btn')].some(b => b.textContent.includes('hors stock'))).toBe(false);
    });

    it('renderAIResults affiche toutes les recettes et bascule les conteneurs visible/caché', () => {
        state.aiSuggestions = [recette(), recette({ name: 'Soupe' })];

        renderAIResults(state.aiSuggestions);

        const grid = document.getElementById('ai-results-list');
        expect(grid.classList.contains('hidden')).toBe(false);
        expect(document.getElementById('ai-placeholder').classList.contains('hidden')).toBe(true);
        expect(grid.querySelectorAll('.recipe-card').length).toBe(2);
    });
});
