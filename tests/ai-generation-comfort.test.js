/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { state } from '../src/state.js';
import { generateSuggestions, openModal, transformRecipeAI } from '../js/app.js';

// LOT 011, chantier 5 — confort de génération perdu à la migration : textes d'attente
// animés, scroll auto sur mobile, verrouillage + aperçu pendant la transformation IA,
// remise à zéro des champs de « Coller une recette ». Oracle : l.5052-5058 (textes),
// l.5068-5072 (scroll), l.5932-5942 (ouverture), l.6019-6025 (transformation réussie).

describe('LOT 011 / chantier 5 — textes d\'attente animés (generateSuggestions)', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <button id="generate-btn"></button>
            <div id="ai-results-col"></div>
        `;
        document.getElementById('ai-results-col').scrollIntoView = vi.fn();
        vi.stubGlobal('fetch', vi.fn());
        fetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ candidates: [{ content: { parts: [{ text: '[]' }] } }] })
        });
        state.ingredients = [{ id: 'i1', name: 'Tomate', inStock: true }];
        state.extraIngredients = [];
        state.aiConfig = { apiKey: 'MOCK_KEY', models: {}, ppl: '2' };
    });

    it('démarre immédiatement avec le premier texte', () => {
        generateSuggestions();

        expect(document.getElementById('generate-btn').getAttribute('data-loading-text'))
            .toBe('Analyse du stock...');
    });

    it('fait tourner les 3 textes toutes les 2,5 secondes', async () => {
        // Le mock réseau par défaut résout quasi instantanément (rien à voir avec le
        // temps simulé) : la génération finirait avant même le premier tour du
        // minuteur. On retient volontairement la réponse pour laisser le minuteur
        // tourner, comme le ferait un vrai appel réseau de plusieurs secondes.
        vi.useFakeTimers();
        let resolveFetch;
        fetch.mockImplementation(() => new Promise(resolve => { resolveFetch = resolve; }));

        const promesse = generateSuggestions();
        const btn = document.getElementById('generate-btn');

        expect(btn.getAttribute('data-loading-text')).toBe('Analyse du stock...');
        await vi.advanceTimersByTimeAsync(2500);
        expect(btn.getAttribute('data-loading-text')).toBe("Recherche d'idées...");
        await vi.advanceTimersByTimeAsync(2500);
        expect(btn.getAttribute('data-loading-text')).toBe('Rédaction des recettes...');
        await vi.advanceTimersByTimeAsync(2500);
        expect(btn.getAttribute('data-loading-text')).toBe('Analyse du stock...'); // boucle

        resolveFetch({
            ok: true,
            json: () => Promise.resolve({ candidates: [{ content: { parts: [{ text: '[]' }] } }] })
        });
        await promesse;
        vi.useRealTimers();
    });

    it('le minuteur est bien arrêté à la fin — le texte ne change plus après coup', async () => {
        vi.useFakeTimers();
        const promesse = generateSuggestions();
        await promesse; // la génération se termine, le finally coupe le minuteur
        const texteFinal = document.getElementById('generate-btn').getAttribute('data-loading-text');

        await vi.advanceTimersByTimeAsync(10000); // largement de quoi tourner plusieurs fois de plus

        expect(document.getElementById('generate-btn').getAttribute('data-loading-text')).toBe(texteFinal);
        vi.useRealTimers();
    });

    it('le minuteur est arrêté même si la génération échoue', async () => {
        fetch.mockRejectedValue(new Error('Panne'));
        vi.useFakeTimers();
        const promesse = generateSuggestions();
        await promesse;
        const texteFinal = document.getElementById('generate-btn').getAttribute('data-loading-text');

        await vi.advanceTimersByTimeAsync(10000);

        expect(document.getElementById('generate-btn').getAttribute('data-loading-text')).toBe(texteFinal);
        vi.useRealTimers();
    });
});

describe('LOT 011 / chantier 5 — scroll auto vers les résultats sur mobile', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <button id="generate-btn"></button>
            <div id="ai-results-col"></div>
        `;
        document.getElementById('ai-results-col').scrollIntoView = vi.fn();
        vi.stubGlobal('fetch', vi.fn());
        fetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ candidates: [{ content: { parts: [{ text: '[]' }] } }] })
        });
        state.ingredients = [{ id: 'i1', name: 'Tomate', inStock: true }];
        state.extraIngredients = [];
        state.aiConfig = { apiKey: 'MOCK_KEY', models: {}, ppl: '2' };
    });

    it('défile vers les résultats en dessous de 768px', async () => {
        vi.stubGlobal('innerWidth', 600);
        vi.useFakeTimers();

        const promesse = generateSuggestions();
        await promesse;
        await vi.advanceTimersByTimeAsync(100);

        expect(document.getElementById('ai-results-col').scrollIntoView)
            .toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
        vi.useRealTimers();
    });

    it('ne défile PAS au-dessus de 768px (bureau)', async () => {
        vi.stubGlobal('innerWidth', 1200);
        vi.useFakeTimers();

        const promesse = generateSuggestions();
        await promesse;
        await vi.advanceTimersByTimeAsync(100);

        expect(document.getElementById('ai-results-col').scrollIntoView).not.toHaveBeenCalled();
        vi.useRealTimers();
    });
});

describe('LOT 011 / chantier 5 — remise à zéro de « Coller une recette »', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div class="modal-overlay" id="modal-paste-recipe">
                <input id="paste-url">
                <input id="paste-title">
                <textarea id="paste-content"></textarea>
                <button id="paste-ai-btn"></button>
                <button id="paste-save-btn"></button>
                <button id="paste-list-btn" style="display:none"></button>
            </div>
        `;
    });

    it('vide titre, contenu ET url à l\'ouverture (pas seulement _lastTransformedRecipe, LOT 006)', () => {
        document.getElementById('paste-title').value = 'Ancien titre';
        document.getElementById('paste-content').value = 'Ancien contenu';
        document.getElementById('paste-url').value = 'https://exemple.com';

        openModal('modal-paste-recipe');

        expect(document.getElementById('paste-title').value).toBe('');
        expect(document.getElementById('paste-content').value).toBe('');
        expect(document.getElementById('paste-url').value).toBe('');
    });

    it('réactive le textarea si une session précédente l\'avait verrouillé', () => {
        document.getElementById('paste-content').disabled = true;

        openModal('modal-paste-recipe');

        expect(document.getElementById('paste-content').disabled).toBe(false);
    });

    it('remet le bouton IA visible et le libellé de sauvegarde par défaut', () => {
        document.getElementById('paste-ai-btn').style.display = 'none';
        document.getElementById('paste-save-btn').textContent = 'Sauvegarder en favoris';

        openModal('modal-paste-recipe');

        expect(document.getElementById('paste-ai-btn').style.display).toBe('');
        expect(document.getElementById('paste-save-btn').textContent).toBe('Sauvegarder tel quel');
    });
});

describe('LOT 011 / chantier 5 — verrouillage + aperçu après transformation IA réussie', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <input id="paste-title">
            <textarea id="paste-content">Un texte de recette à transformer</textarea>
            <button id="paste-ai-btn"></button>
            <button id="paste-save-btn"></button>
            <button id="paste-list-btn" style="display:none"></button>
        `;
        vi.stubGlobal('fetch', vi.fn());
        fetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                candidates: [{
                    content: {
                        parts: [{
                            text: JSON.stringify({
                                name: 'Tarte structurée',
                                description: 'Une belle tarte',
                                ingredients: [{ n: 'Pomme', q: '4', e: '🍎', c: 'Fruits', s: 'stock' }],
                                steps: ['Cuire.']
                            })
                        }]
                    }
                }]
            })
        });
        state.aiConfig = { apiKey: 'MOCK_KEY', models: {} };
        state.ingredients = [];
    });

    it('verrouille le textarea et affiche un aperçu au lieu du texte source', async () => {
        await transformRecipeAI();

        const contentEl = document.getElementById('paste-content');
        expect(contentEl.disabled).toBe(true);
        expect(contentEl.value).toContain('analysée et formatée par l\'IA');
        expect(contentEl.value).toContain('Une belle tarte');
    });

    it('masque le bouton « Transformer » et fait apparaître « + Liste »', async () => {
        await transformRecipeAI();

        expect(document.getElementById('paste-ai-btn').style.display).toBe('none');
        expect(document.getElementById('paste-list-btn').style.display).toBe('');
    });

    it('renomme le bouton de sauvegarde en « Sauvegarder en favoris »', async () => {
        await transformRecipeAI();

        expect(document.getElementById('paste-save-btn').textContent).toBe('Sauvegarder en favoris');
    });
});
