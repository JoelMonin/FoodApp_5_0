import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { generateRecipes } from '../src/services/gemini.js';
import { defaultAiConfig } from '../src/state.js';
import { MAX_OUTPUT_TOKENS_IA } from '../src/constants.js';

// LOT 029, chantier D — PANNE RÉELLE REMONTÉE PAR JOEL le 2026-08-03 :
// « j'ai quand même ce message la plupart du temps avec les envies du moment »
// (capture : « Erreur IA : Réponse incomplète ou illisible. Réessayez… »).
//
// CE QUI SE PASSAIT. Une « envie du moment » demande 5 VARIANTES D'UN MÊME PLAT, chacune
// avec les étapes détaillées exigées depuis le LOT 026. Le texte produit dépasse alors le
// plafond de longueur — plafond PARTAGÉ avec les jetons de réflexion du modèle. Google
// coupe la réponse en plein vol et le signale par `finishReason: 'MAX_TOKENS'`.
// L'app ne lisait JAMAIS ce champ : toute réponse coupée était traitée comme du charabia,
// et Joel se voyait conseiller « réessayez » — alors qu'un essai identique reproduit
// exactement la même coupure, la cause étant structurelle et non aléatoire.
//
// C'est la DEUXIÈME sous-estimation du même plafond (LOT 026 : 8192 → 16384). Ces tests
// existent pour qu'il n'y en ait pas une troisième silencieuse.

const CORPS = () => JSON.parse(fetch.mock.calls[0][1].body);

/** Réponse Google coupée net au milieu de la PREMIÈRE recette — le cas de Joel. */
function reponseCoupee() {
    return {
        ok: true,
        json: () => Promise.resolve({
            candidates: [{
                finishReason: 'MAX_TOKENS',
                content: { parts: [{ text: '[{"name":"Chili con carne classique","ingredients":[{"n":"Boeuf haché","q":"500 g' }] }
            }]
        })
    };
}

describe('LOT 029 — réponse de l\'IA coupée au plafond', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
    });
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe('Le plafond envoyé à Google', () => {
        it('vaut la SSOT, et non un nombre réécrit dans le service', async () => {
            fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ candidates: [{ content: { parts: [{ text: '[]' }] } }] })
            });

            await generateRecipes('MOCK_KEY', [], { ...defaultAiConfig(), ppl: '2' }, [], []);

            expect(CORPS().generationConfig.maxOutputTokens).toBe(MAX_OUTPUT_TOKENS_IA);
        });

        it('laisse de la marge au-delà de la valeur qui a échoué chez Joel', () => {
            // Verrou de NON-RETOUR : 16384 est la valeur exacte qui produisait la panne.
            // Y revenir doit faire rougir, pas passer inaperçu.
            expect(MAX_OUTPUT_TOKENS_IA).toBeGreaterThan(16384);
        });
    });

    describe('Le message d\'erreur dit la vérité', () => {
        it('une réponse coupée ne conseille PLUS de réessayer', async () => {
            fetch.mockResolvedValue(reponseCoupee());

            // Le sauvetage ne peut rien récupérer : la coupure tombe dans la première
            // recette, exactement comme sur la capture de Joel.
            await expect(
                generateRecipes('MOCK_KEY', [], { ...defaultAiConfig(), envie: 'chili con carne', ppl: '2' }, [], [])
            ).rejects.toThrow(/coupée/i);
        });

        it('une réponse coupée oriente vers le bon geste : raccourcir la demande', async () => {
            fetch.mockResolvedValue(reponseCoupee());

            await expect(
                generateRecipes('MOCK_KEY', [], { ...defaultAiConfig(), envie: 'chili con carne', ppl: '2' }, [], [])
            ).rejects.toThrow(/plus courte|moins de contraintes/i);
        });

        it('une réponse VRAIMENT illisible garde son message d\'origine', async () => {
            // Non-régression : le message du LOT 026 reste le bon quand la réponse n'est
            // pas tronquée mais incompréhensible. Les deux pannes ne se confondent plus.
            fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({
                    candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'Bonjour, voici mes idées !' }] } }]
                })
            });

            await expect(
                generateRecipes('MOCK_KEY', [], { ...defaultAiConfig(), ppl: '2' }, [], [])
            ).rejects.toThrow(/Réessayez/);
        });
    });

    describe('Le sauvetage garde la priorité sur le message', () => {
        it('une réponse coupée APRÈS une recette complète rend cette recette, sans erreur', async () => {
            // Le comportement le plus utile pour Joel : mieux vaut 1 recette que 0. La
            // troncature ne doit pas transformer un sauvetage réussi en échec.
            fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({
                    candidates: [{
                        finishReason: 'MAX_TOKENS',
                        content: {
                            parts: [{
                                text: '[{"name":"Chili express","ingredients":[{"n":"Boeuf","q":"500 g","e":"🥩","c":"Viandes","s":"stock"}],"steps":["Cuire."]},{"name":"Chili coupé","ingredients":[{"n":"Hari'
                            }]
                        }
                    }]
                })
            });

            const recettes = await generateRecipes(
                'MOCK_KEY', [], { ...defaultAiConfig(), envie: 'chili con carne', ppl: '2' }, [], []
            );

            expect(recettes).toHaveLength(1);
            expect(recettes[0].name).toBe('Chili express');
        });
    });
});
