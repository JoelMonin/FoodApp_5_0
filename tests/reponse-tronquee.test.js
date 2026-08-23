import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateRecipes, callAI } from '../src/services/gemini.js';
import { defaultAiConfig } from '../src/state.js';
import { MAX_OUTPUT_TOKENS_IA } from '../src/constants.js';

// LOT 029, chantier D — LA TRONCATURE, ET SEULEMENT ELLE.
//
// ⚠️ CE FICHIER A FAILLI RACONTER UNE HISTOIRE FAUSSE (finding F-05 de l'audit Codex du
// 2026-08-03, justifié). Il annonçait couvrir « la panne réelle remontée par Joel ». Ce
// n'était pas vrai : la panne de Joel n'avait RIEN d'une troncature — sa cause est une
// consigne ambiguë qui faisait écrire au modèle des guillemets simples comme délimiteurs
// (verrouillée, elle, par `tests/json-reponse-ia.test.js`). Les réponses mesurées dans son
// navigateur consommaient ~10 500 jetons sur 65 536 et s'arrêtaient normalement.
//
// Laisser l'affirmation aurait un coût précis et prévisible : au prochain JSON illisible, un
// mainteneur relèverait le plafond — le geste inutile — au lieu de regarder la réponse brute.
//
// CE QUE CES TESTS COUVRENT DONC VRAIMENT : la troncature comme panne POSSIBLE (elle s'est
// produite pour de bon au LOT 026, 8192 → 16384), le fait que le plafond vienne de la SSOT,
// et surtout que l'app sache DIRE qu'une réponse a été coupée au lieu de conseiller
// « réessayez » — conseil faux face à une coupure, qui se reproduit à l'identique.

const CORPS = () => JSON.parse(fetch.mock.calls[0][1].body);

/** Réponse Google coupée net au milieu de la PREMIÈRE recette : le sauvetage ne peut rien. */
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

        it('laisse de la marge au-delà de l\'ancienne valeur', () => {
            expect(MAX_OUTPUT_TOKENS_IA).toBeGreaterThan(16384);
        });

        // ⚠️ FAUX VERROU CORRIGÉ (finding F-03 de l'audit Codex, justifié). Les trois tests
        // ci-dessus comparent la valeur ENVOYÉE à la constante — ce qui reste vrai si le
        // service écrit `65536` en dur ! Ils annonçaient « vient de la SSOT » en prouvant
        // seulement « vaut le même nombre ». Cette vérification-ci est la seule qui morde :
        // elle lit le service et exige qu'aucun plafond n'y soit écrit en chiffres.
        it('AUCUN plafond n\'est écrit en chiffres dans le service (la SSOT, vraiment)', () => {
            const service = readFileSync(resolve(__dirname, '../src/services/gemini.js'), 'utf8');

            const enDur = [...service.matchAll(/maxTokens:\s*(\d+)/g)].map(m => m[1]);
            expect(enDur).toEqual([]);
            expect(service).toContain('maxTokens: MAX_OUTPUT_TOKENS_IA');
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

        // Finding F-07 de l'audit Codex : quand le plafond est atteint PENDANT la réflexion,
        // il ne reste aucune partie visible. Le drapeau de troncature était bien levé, mais
        // « Réponse vide » était lancé avant que quiconque puisse s'en servir — donc le
        // message le moins utile, dans le cas le plus caractéristique de la panne.
        it('une coupure TOTALE (aucun texte restant) dit aussi qu\'elle a été coupée', async () => {
            fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [] } }] })
            });

            await expect(
                generateRecipes('MOCK_KEY', [], { ...defaultAiConfig(), envie: 'chili', ppl: '2' }, [], [])
            ).rejects.toThrow(/coupée/i);
        });

        // Contre-audit Codex — DÉFAUT QUE J'AVAIS INTRODUIT en corrigeant F-07 : j'avais mis
        // le conseil « essayez une envie du moment plus courte » dans `callAI`, le lecteur
        // GÉNÉRIQUE. Or il sert aussi à la recherche d'emoji, à la suggestion de catégorie et
        // à l'analyse nutritionnelle, qui affichent son erreur telle quelle : Joel se serait
        // vu conseiller de raccourcir une envie sur un écran où il n'en existe aucune.
        it('un appel NON lié aux recettes ne conseille pas de raccourcir une « envie »', async () => {
            fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [] } }] })
            });

            const echec = callAI('trouve un emoji', 'MOCK_KEY', 'modele-test').catch(e => e.message);

            await expect(echec).resolves.toMatch(/coupée/i);
            await expect(echec).resolves.not.toMatch(/envie du moment/i);
        });

        it('une réponse vide SANS coupure garde le message « réponse vide »', async () => {
            // Contre-épreuve : le correctif ci-dessus ne doit pas avaler l'autre panne.
            fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ candidates: [{ finishReason: 'STOP', content: { parts: [] } }] })
            });

            await expect(
                generateRecipes('MOCK_KEY', [], defaultAiConfig(), [], [])
            ).rejects.toThrow(/vide/i);
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
