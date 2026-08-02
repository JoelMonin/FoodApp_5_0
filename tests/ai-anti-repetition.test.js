/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { state, defaultAiConfig } from '../src/state.js';
import {
    generateSuggestions,
    nomsSuggestionsRecentes,
    noterSuggestionsProposees,
    viderSuggestionsRecentes
} from '../src/ui/aiPanel.js';

// LOT 026, chantier C — anti-répétition EN SÉRIE seulement (décision de Joel du
// 2026-08-02 : « ok, mais seulement pour des générations en séries, par exemple dans un
// intervalle donné de 60 minutes »). Mémoire de SESSION : ni synchronisée, ni sauvegardée,
// un rechargement l'efface — la « série » se joue dans la même session.

const HEURE = 60 * 60 * 1000;

describe('LOT 026 / chantier C — mémoire des suggestions récentes (fonctions pures)', () => {
    beforeEach(() => {
        viderSuggestionsRecentes();
    });

    it('vide au départ : la première génération d\'une session n\'a rien à éviter', () => {
        expect(nomsSuggestionsRecentes()).toEqual([]);
    });

    it('mémorise les noms des recettes proposées', () => {
        noterSuggestionsProposees([{ name: 'Risotto crémeux' }, { name: 'Quiche lorraine' }]);

        expect(nomsSuggestionsRecentes()).toEqual(['Risotto crémeux', 'Quiche lorraine']);
    });

    it('oublie une proposition au bout de 60 minutes — la fenêtre GLISSE, elle ne s\'étend pas', () => {
        const t0 = 1_000_000;
        noterSuggestionsProposees([{ name: 'Risotto crémeux' }], t0);
        noterSuggestionsProposees([{ name: 'Tarte fine' }], t0 + 30 * 60 * 1000);

        // Juste avant l'heure : les deux fournées sont encore là.
        expect(nomsSuggestionsRecentes(t0 + HEURE - 1)).toEqual(['Risotto crémeux', 'Tarte fine']);
        // Pile une heure après la 1ʳᵉ : elle seule disparaît, la 2ᵉ reste.
        expect(nomsSuggestionsRecentes(t0 + HEURE)).toEqual(['Tarte fine']);
        // Une heure après la 2ᵉ : plus rien.
        expect(nomsSuggestionsRecentes(t0 + 30 * 60 * 1000 + HEURE)).toEqual([]);
    });

    it('ignore les recettes sans nom (réponse IA dégradée) plutôt que de mémoriser du vide', () => {
        noterSuggestionsProposees([{ name: 'Bonne recette' }, {}, null, { name: '' }]);

        expect(nomsSuggestionsRecentes()).toEqual(['Bonne recette']);
    });
});

describe('LOT 026 / chantier C — le circuit complet, de la 1ʳᵉ à la 2ᵉ génération', () => {
    function reponseIA(recipes) {
        fetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                candidates: [{ content: { parts: [{ text: JSON.stringify(recipes) }] } }]
            })
        });
    }

    const RECETTE = {
        name: 'Risotto crémeux aux champignons', description: 'd', time: '30 min',
        difficulty: 'Facile', people: 2, cuisine: 'italienne',
        ingredients: [{ n: 'Riz', q: '200 g', e: '🍚', c: 'Épicerie', s: 'stock' }],
        steps: ['Cuire le riz.']
    };

    beforeEach(() => {
        document.body.innerHTML = '<button id="generate-btn"></button>';
        vi.stubGlobal('fetch', vi.fn());
        viderSuggestionsRecentes();
        state.aiConfig = { ...defaultAiConfig(), apiKey: 'MOCK_KEY' };
        state.ingredients = [{ id: 'i1', name: 'Riz', emoji: '🍚', cat: 'Épicerie', inStock: true }];
        state.extraIngredients = [];
        state.aiSuggestions = [];
    });

    it('1ʳᵉ génération : AUCUNE ligne anti-répétition dans le message envoyé', async () => {
        reponseIA([RECETTE]);

        await generateSuggestions();

        expect(fetch.mock.calls[0][1].body).not.toContain('DÉJÀ PROPOSÉES');
    });

    it('2ᵉ génération dans l\'heure : les noms de la 1ʳᵉ partent avec l\'interdiction de les reproposer', async () => {
        reponseIA([RECETTE]);
        await generateSuggestions();

        await generateSuggestions();

        const corps2 = fetch.mock.calls[1][1].body;
        expect(corps2).toContain('DÉJÀ PROPOSÉES RÉCEMMENT');
        expect(corps2).toContain('Risotto crémeux aux champignons');
    });

    it('une génération en ÉCHEC ne mémorise rien : rien n\'a été proposé à l\'utilisateur', async () => {
        fetch.mockRejectedValue(new Error('panne réseau'));

        await generateSuggestions();

        expect(nomsSuggestionsRecentes()).toEqual([]);
    });
});
