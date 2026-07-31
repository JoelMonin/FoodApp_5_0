/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { analyzeNutrition } from '../js/app.js';
import { state, defaultAiConfig } from '../src/state.js';
import { setupTestDOM, mockFetchResponse, mockFetchNetworkError, readToasts } from './_helpers/dom-helpers.js';

// LOT 013 — analyzeNutrition (js/app.js:1111) n'avait que 2 tests avant ce lot
// (tests/recipe-scaling.test.js:272/294), tous deux focalisés sur la PRÉSERVATION de
// l'échelle, jamais sur l'analyse elle-même ni ses 3 branches d'échec. Le libellé exact du
// bouton réarmé après un échec (LOT 011, chantier 2) n'était figé nulle part.

const NUTRI_BTN_LABEL = '🔍 Estimer la valeur nutritionnelle (IA)';

function recette(over = {}) {
    return {
        name: 'Poulet rôti', people: 2,
        ingredients: [{ name: 'Poulet', amount: '1' }],
        steps: ['Enfourner'],
        ...over
    };
}

describe('LOT 013 — analyzeNutrition', () => {
    beforeEach(() => {
        setupTestDOM('recipeDetail');
        state.aiConfig = { ...defaultAiConfig(), apiKey: 'CLE_TEST' };
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('recette absente : ne fait rien, ne lève pas', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        await analyzeNutrition(null, 'ai', null);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('recette sans ingrédients : ne fait rien (garde `!r.ingredients`)', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        await analyzeNutrition({ name: 'Sans ingrédients' }, 'ai', null);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('sans clé API : toast explicite, aucun appel réseau', async () => {
        state.aiConfig.apiKey = '';
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        await analyzeNutrition(recette(), 'ai', null);

        expect(fetchMock).not.toHaveBeenCalled();
        expect(readToasts()).toContain("Clé API requise pour l'analyse");
    });

    it('happy path : attache r.nutrition et confirme par toast', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ candidates: [{ content: { parts: [{ text: '{"score":"A","kcal":420,"tags":["Sain","Léger"]}' }] } }] })
        }));
        const r = recette();

        await analyzeNutrition(r, 'ai', null);

        expect(r.nutrition).toEqual({ score: 'A', kcal: 420, tags: ['Sain', 'Léger'] });
        expect(readToasts()).toContain('Analyse nutritionnelle terminée !');
    });

    it('réponse IA sans JSON exploitable : toast d\'erreur, bouton réarmé au libellé EXACT '
       + 'd\'origine (LOT 011, chantier 2)', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ candidates: [{ content: { parts: [{ text: 'Désolé, aucune estimation possible.' }] } }] })
        }));
        const r = recette();

        await analyzeNutrition(r, 'ai', null);

        expect(r.nutrition).toBeUndefined();
        expect(readToasts()).toContain('Erreur analyse nutrition');
        const btn = document.getElementById('rd-nutri-btn');
        expect(btn.disabled).toBe(false);
        expect(btn.textContent).toBe(NUTRI_BTN_LABEL);
    });

    it('panne réseau : toast d\'erreur, bouton réarmé, ne relève pas d\'exception', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
        const r = recette();

        await expect(analyzeNutrition(r, 'ai', null)).resolves.not.toThrow();

        expect(r.nutrition).toBeUndefined();
        expect(readToasts()).toContain('Erreur analyse nutrition');
        expect(document.getElementById('rd-nutri-btn').textContent).toBe(NUTRI_BTN_LABEL);
    });

    it('le bouton se désactive avec "Analyse..." pendant l\'appel', async () => {
        let capteDisabledPendantAppel = null;
        vi.stubGlobal('fetch', vi.fn(() => {
            capteDisabledPendantAppel = document.getElementById('rd-nutri-btn').disabled;
            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ candidates: [{ content: { parts: [{ text: '{"score":"B","kcal":300,"tags":[]}' }] } }] })
            });
        }));

        await analyzeNutrition(recette(), 'ai', null);

        expect(capteDisabledPendantAppel).toBe(true);
    });
});
