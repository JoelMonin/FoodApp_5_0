/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { state, defaultAiConfig } from '../src/state.js';
import { generateRandomWithStock } from '../js/app.js';

// LOT 011, chantier 4 — le mode 🎲 n'était qu'un simple alias de la génération normale :
// aucun filtre remis à zéro, créativité inchangée. Oracle : foodapp-v5-Joel.html l.5083-5103.
// Déviations assumées et tranchées (fiche LOT 011, décision D1 et §12-A2) :
//  - `cuisines` (pluriel, SSOT LOT 010) est ciblé, pas le `cuisine` fantôme que vidait
//    l'oracle sans effet réel ;
//  - apiKey et models ne sont JAMAIS touchés (l'oracle les stockait ailleurs — les
//    réinitialiser ici viderait la clé API de Joel à chaque tirage) ;
//  - le boost de créativité est ponctuel : la valeur sauvegardée du curseur revient après
//    la génération (acquis LOT 008, jamais écrasé).

describe('LOT 011 / chantier 4 — mode 🎲 aléatoire complet', () => {
    beforeEach(() => {
        document.body.innerHTML = '<button id="generate-btn"></button>';
        vi.stubGlobal('fetch', vi.fn());
        fetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ candidates: [{ content: { parts: [{ text: '[]' }] } }] })
        });
        state.ingredients = [{ id: 'i1', name: 'Tomate', inStock: true, pinned: false }];
        state.extraIngredients = [];
        state.aiConfig = {
            ...defaultAiConfig(),
            apiKey: 'MA_CLE',
            ppl: '4',
            cuisines: ['italienne'],
            diet: ['vegan'],
            creativity: 42
        };
    });

    it('stock vide : refuse sans toucher à rien', () => {
        state.ingredients = [];

        generateRandomWithStock();

        expect(state.aiConfig.creativity).toBe(42);
        expect(fetch).not.toHaveBeenCalled();
    });

    it('vide le filtre de cuisine — `cuisines` (pluriel), jamais le champ fantôme `cuisine`', async () => {
        await generateRandomWithStock();

        expect(state.aiConfig.cuisines).toEqual([]);
        expect('cuisine' in state.aiConfig).toBe(false);
    });

    it('vide les autres filtres (régime compris)', async () => {
        await generateRandomWithStock();

        expect(state.aiConfig.diet).toEqual([]);
    });

    it('conserve le nombre de personnes', async () => {
        await generateRandomWithStock();

        expect(state.aiConfig.ppl).toBe('4');
    });

    it('ne touche JAMAIS à la clé API ni aux modèles configurés', async () => {
        await generateRandomWithStock();

        expect(state.aiConfig.apiKey).toBe('MA_CLE');
        expect(state.aiConfig.models).toEqual(defaultAiConfig().models);
    });

    it('tire une créativité 80-100 pour CETTE génération, traduite en consigne texte (§12-A2)', async () => {
        await generateRandomWithStock();

        expect(fetch.mock.calls[0][1].body).toContain('TRÈS CRÉATIF');
    });

    it('la créativité sauvegardée revient après la génération — le boost est ponctuel (LOT 008)', async () => {
        await generateRandomWithStock();

        expect(state.aiConfig.creativity).toBe(42);
    });

    it('reste ponctuelle même si la génération échoue', async () => {
        fetch.mockRejectedValue(new Error('Panne réseau'));

        await generateRandomWithStock();

        expect(state.aiConfig.creativity).toBe(42);
    });
});
