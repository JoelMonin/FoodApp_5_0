/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { state } from '../src/state.js';
import { renderFavoriteCard } from '../src/ui/recipe.js';
import {
    renderFavorites,
    saveSuggestionToFavDirect,
    saveRecipeOnly,
    savePastedRecipe,
    savePastedRecipeAndList,
    transformRecipeAI,
    buildIngredientTags,
    openModal
} from '../js/app.js';

// LOT 011, chantier 7 — favoris riches : composant dédié (`renderFavoriteCard`, trouvé
// nécessaire par l'audit du sous-lot 11A), date de sauvegarde stockée ET affichée
// (arbitrage Joel §9 Q3 — l'oracle la stockait sans jamais l'afficher), état vide avec
// CTA. Arbitrage A1 (§12) : « Sauvegarder tel quel » restauré — un texte collé SANS
// transformation IA doit pouvoir être sauvegardé, ce que le LOT 006 avait rendu
// impossible en grisant le bouton tant qu'aucune transformation n'avait eu lieu.

function pasteModalDom() {
    document.body.innerHTML = `
        <div class="modal-overlay" id="modal-paste-recipe">
            <input id="paste-url">
            <button id="paste-fetch-btn"></button>
            <input id="paste-title">
            <textarea id="paste-content"></textarea>
            <button id="paste-ai-btn"></button>
            <button id="paste-save-btn"></button>
            <button id="paste-list-btn" style="display:none"></button>
        </div>
        <div id="fav-list"></div>
    `;
}

describe('LOT 011 / chantier 7 — carte de favori dédiée', () => {
    it('titre depuis r.name (recette structurée), extrait depuis la description', () => {
        const fav = { id: 'fav_1', date: '30/07/2026', recipe: { name: 'Tarte', description: 'Un dessert' } };
        const card = renderFavoriteCard(fav, { openFav: () => {}, deleteFavorite: () => {} });

        expect(card.querySelector('.fav-title').textContent).toBe('Tarte');
        expect(card.querySelector('.fav-excerpt').textContent).toBe('Un dessert');
        expect(card.querySelector('.fav-date').textContent).toBe('30/07/2026');
    });

    it('titre depuis fav.title et extrait depuis le contenu (favori texte brut, arbitrage A1)', () => {
        const contenuLong = 'x'.repeat(150);
        const fav = { id: 'fav_2', date: '29/07/2026', title: 'Recette de mamie', content: contenuLong };
        const card = renderFavoriteCard(fav, { openFav: () => {}, deleteFavorite: () => {} });

        expect(card.querySelector('.fav-title').textContent).toBe('Recette de mamie');
        expect(card.querySelector('.fav-excerpt').textContent).toBe('x'.repeat(100) + '...');
    });

    it('omet la date si absente (favoris déjà enregistrés avant le LOT 011)', () => {
        const fav = { id: 'fav_3', recipe: { name: 'Ancien favori' } };
        const card = renderFavoriteCard(fav, { openFav: () => {}, deleteFavorite: () => {} });

        expect(card.querySelector('.fav-date')).toBeNull();
    });

    it('Voir et Supprimer appellent leurs handlers sans se déclencher l\'un l\'autre', () => {
        const openFav = vi.fn();
        const deleteFavorite = vi.fn();
        const fav = { id: 'fav_4', date: '30/07/2026', recipe: { name: 'Test' } };
        const card = renderFavoriteCard(fav, { openFav, deleteFavorite });

        card.querySelector('.fav-btn.del').click();
        expect(deleteFavorite).toHaveBeenCalledTimes(1);
        expect(openFav).not.toHaveBeenCalled();
    });

    it('le clic sur la carte ouvre le favori', () => {
        const openFav = vi.fn();
        const fav = { id: 'fav_5', recipe: { name: 'Test' } };
        renderFavoriteCard(fav, { openFav, deleteFavorite: () => {} }).click();

        expect(openFav).toHaveBeenCalledTimes(1);
    });

    it('affiche les tags d\'état (plafond 8, distinct des 6 des cartes IA)', () => {
        const tags = buildIngredientTags(Array.from({ length: 10 }, (_, i) => ({ n: `Ing ${i}` })), 'card');
        const fav = { id: 'fav_6', recipe: { name: 'Test' } };
        const card = renderFavoriteCard(fav, { openFav: () => {}, deleteFavorite: () => {} }, tags);

        expect(card.querySelectorAll('.r-tag').length).toBe(8);
    });
});

describe('LOT 011 / chantier 7 — renderFavorites', () => {
    beforeEach(() => {
        pasteModalDom();
        state.favorites = [];
    });

    it('état vide : icône, titre, CTA vers le collage', () => {
        renderFavorites();

        const el = document.getElementById('fav-list');
        expect(el.querySelector('.fav-empty-title').textContent).toBe('Aucune recette favorite');
        const cta = [...el.querySelectorAll('button')].find(b => b.textContent.includes('Coller une recette'));
        expect(cta).toBeTruthy();

        cta.click();
        expect(document.getElementById('modal-paste-recipe').classList.contains('open')).toBe(true);
    });

    it('affiche une carte par favori', () => {
        state.favorites = [
            { id: 'f1', date: '30/07/2026', recipe: { name: 'Tarte' } },
            { id: 'f2', date: '29/07/2026', title: 'Texte brut', content: 'Un texte' }
        ];

        renderFavorites();

        expect(document.querySelectorAll('#fav-list .fav-card').length).toBe(2);
    });
});

describe('LOT 011 / chantier 7 — date de sauvegarde (arbitrage Joel §9 Q3)', () => {
    beforeEach(() => {
        state.favorites = [];
    });

    it('saveSuggestionToFavDirect stocke une date', () => {
        saveSuggestionToFavDirect({ id: 'r1', name: 'Test' });

        expect(state.favorites[0].date).toBeTruthy();
        expect(typeof state.favorites[0].date).toBe('string');
    });

    it('saveRecipeOnly stocke une date', () => {
        saveRecipeOnly({ id: 'r2', name: 'Test' });

        expect(state.favorites[0].date).toBeTruthy();
    });
});

describe('LOT 011 / chantier 7 — « Sauvegarder tel quel » restauré (arbitrage Joel A1)', () => {
    beforeEach(() => {
        pasteModalDom();
        state.favorites = [];
    });

    it('titre vide : refuse, rien n\'est sauvegardé', () => {
        document.getElementById('paste-title').value = '';
        document.getElementById('paste-content').value = 'Un texte quelconque';

        savePastedRecipe();

        expect(state.favorites.length).toBe(0);
    });

    it('contenu vide sans transformation IA : refuse, rien n\'est sauvegardé', () => {
        document.getElementById('paste-title').value = 'Mon titre';
        document.getElementById('paste-content').value = '';

        savePastedRecipe();

        expect(state.favorites.length).toBe(0);
    });

    it('texte brut SANS transformation IA : sauvegarde quand même — c\'est le chemin que ' +
       'le LOT 006 avait rendu impossible en grisant le bouton', () => {
        document.getElementById('paste-title').value = 'Recette de mamie';
        document.getElementById('paste-content').value = 'Mélanger, cuire, déguster.';

        savePastedRecipe();

        expect(state.favorites.length).toBe(1);
        expect(state.favorites[0].title).toBe('Recette de mamie');
        expect(state.favorites[0].content).toBe('Mélanger, cuire, déguster.');
        expect(state.favorites[0].date).toBeTruthy();
        expect(state.favorites[0].ingredients).toBeUndefined();
    });

    it('ferme le modal et vide le champ après sauvegarde du texte brut', () => {
        document.getElementById('modal-paste-recipe').classList.add('open');
        document.getElementById('paste-title').value = 'Recette de mamie';
        document.getElementById('paste-content').value = 'Un texte.';

        savePastedRecipe();

        expect(document.getElementById('modal-paste-recipe').classList.contains('open')).toBe(false);
    });

    it('savePastedRecipeAndList sur un texte brut sauvegarde SANS planter (pas d\'ingrédients ' +
       'à proposer pour la liste de courses)', () => {
        document.getElementById('paste-title').value = 'Recette de mamie';
        document.getElementById('paste-content').value = 'Un texte.';

        expect(() => savePastedRecipeAndList()).not.toThrow();
        expect(state.favorites.length).toBe(1);
    });

    describe('avec une recette transformée par l\'IA', () => {
        beforeEach(() => {
            vi.stubGlobal('fetch', vi.fn());
            fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({
                    candidates: [{
                        content: {
                            parts: [{
                                text: JSON.stringify({
                                    name: 'Tarte structurée',
                                    ingredients: [{ n: 'Pomme', q: '4', e: '🍎', c: 'Fruits', s: 'stock' }],
                                    steps: ['Cuire.']
                                })
                            }]
                        }
                    }]
                })
            });
            state.aiConfig.apiKey = 'MOCK_KEY';
            document.getElementById('paste-title').value = 'Titre initial';
            document.getElementById('paste-content').value = 'Texte à transformer';
        });

        it('sauvegarde la recette structurée (pas le texte brut) une fois transformée', async () => {
            await transformRecipeAI();

            savePastedRecipe();

            expect(state.favorites.length).toBe(1);
            expect(state.favorites[0].name).toBe('Tarte structurée');
            expect(state.favorites[0].ingredients).toBeDefined();
            expect(state.favorites[0].date).toBeTruthy();
        });

        it('savePastedRecipeAndList sauvegarde puis tente d\'ouvrir le sélecteur de courses ' +
           'pour une recette transformée, sans planter même sans ce modal dans la page', async () => {
            await transformRecipeAI();

            expect(() => savePastedRecipeAndList()).not.toThrow();

            expect(state.favorites.length).toBe(1);
            expect(state.favorites[0].ingredients).toBeDefined();
        });
    });
});
