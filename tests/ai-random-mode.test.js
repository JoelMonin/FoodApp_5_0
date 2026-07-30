/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { state, defaultAiConfig } from '../src/state.js';
import { generateRandomWithStock } from '../js/app.js';

// LOT 011, chantier 4 — le mode 🎲 n'était qu'un simple alias de la génération normale :
// aucun filtre remis à zéro, créativité inchangée. Oracle : foodapp-v5-Joel.html l.5083-5103.
// Déviations assumées et tranchées (fiche LOT 011, décision D1 et §12-A2, précisées §14
// après l'audit du sous-lot 11A) :
//  - `cuisines` (pluriel, SSOT LOT 010) est ciblé, pas le `cuisine` fantôme que vidait
//    l'oracle sans effet réel ;
//  - apiKey et models ne sont JAMAIS touchés (l'oracle les stockait ailleurs — les
//    réinitialiser ici viderait la clé API de Joel à chaque tirage) ;
//  - contrairement à l'oracle (qui laisse les filtres réinitialisés en permanence),
//    TOUT l'état IA est emprunté pour une seule génération puis restauré intégralement
//    après coup — pas seulement la créativité (arbitrage Joel du 2026-07-30, post-audit :
//    « tout doit revenir après », pas une réinitialisation durable).

function dernierToast() {
    return document.querySelector('#toast-container .toast')?.textContent;
}

describe('LOT 011 / chantier 4 — mode 🎲 aléatoire complet', () => {
    beforeEach(() => {
        document.body.innerHTML = '<button id="generate-btn"></button><button id="magic-btn"></button>';
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

    it('pendant la génération, les filtres sont bien réinitialisés (cuisines incluse, créativité ' +
       '80-100 traduite en consigne texte) — c\'est CETTE recette-là qui en profite', async () => {
        await generateRandomWithStock();

        const body = fetch.mock.calls[0][1].body;
        expect(body).toContain('CUISINE : Libre');
        expect(body).toContain('TRÈS CRÉATIF');
    });

    it('après la génération, TOUS les filtres reviennent exactement comme avant — pas ' +
       'seulement la créativité (arbitrage Joel du 2026-07-30, post-audit sous-lot 11A)', async () => {
        await generateRandomWithStock();

        expect(state.aiConfig.cuisines).toEqual(['italienne']);
        expect(state.aiConfig.diet).toEqual(['vegan']);
        expect(state.aiConfig.creativity).toBe(42);
    });

    it('conserve le nombre de personnes tout du long', async () => {
        await generateRandomWithStock();

        expect(state.aiConfig.ppl).toBe('4');
    });

    it('ne touche JAMAIS à la clé API ni aux modèles configurés', async () => {
        await generateRandomWithStock();

        expect(state.aiConfig.apiKey).toBe('MA_CLE');
        expect(state.aiConfig.models).toEqual(defaultAiConfig().models);
    });

    it('la restauration complète a lieu même si la génération échoue', async () => {
        fetch.mockRejectedValue(new Error('Panne réseau'));

        await generateRandomWithStock();

        expect(state.aiConfig.creativity).toBe(42);
        expect(state.aiConfig.cuisines).toEqual(['italienne']);
    });

    // Trouvé par l'audit du sous-lot 11A : deux tirages rapprochés — chacun mémorise
    // "son" état avant de générer, puis le restaure dans un finally. Sans garde, le
    // second tirage mémorise l'état ALÉATOIRE posé par le premier (pas le vrai réglage
    // de Joel), et l'écrase à la fin — le vrai réglage sauvegardé est perdu.
    it('deux tirages rapprochés ne corrompent plus l\'état sauvegardé (course corrigée)', async () => {
        const premierTirage = generateRandomWithStock();
        // Le second arrive AVANT que le premier n'ait fini — doit être refusé net,
        // sans muter state.aiConfig ni appeler le réseau une deuxième fois.
        generateRandomWithStock();

        await premierTirage;

        expect(fetch).toHaveBeenCalledTimes(1);
        expect(state.aiConfig.creativity).toBe(42);
        expect(state.aiConfig.cuisines).toEqual(['italienne']);
        expect(dernierToast()).toContain('déjà en cours');
    });

    it('le bouton 🎲 est désactivé pendant la génération puis réactivé', async () => {
        const promesse = generateRandomWithStock();
        expect(document.getElementById('magic-btn').disabled).toBe(true);

        await promesse;

        expect(document.getElementById('magic-btn').disabled).toBe(false);
    });
});
