import { describe, it, expect, beforeEach, vi } from 'vitest';
import { state, sanitizeGlobalState, defaultAiConfig } from '../src/state.js';
import { generateRecipes } from '../src/services/gemini.js';
import { MAX_EXCLUSIONS_CHARS } from '../src/constants.js';

// LOT 029 — GARDES DE TYPE ET BORNES SUR `aiConfig` (findings F-011 et F-012 du registre
// technique).
//
// CE QUE CES TESTS PROTÈGENT, EN CLAIR : une valeur abîmée dans les réglages IA — document
// cloud corrompu, sauvegarde bricolée à la main, ancien état d'une version disparue — ne doit
// jamais faire ÉCHOUER LA GÉNÉRATION D'IDÉES. Sans ces gardes, Joel voit « Erreur IA » sans
// comprendre, et aucune manipulation dans l'app ne le répare : la valeur fautive est
// persistée, resynchronisée, et revient à chaque tentative.
//
// Les deux étages sont testés SÉPARÉMENT, et c'est volontaire :
//  · l'étage 1 (`sanitizeGlobalState`) répare la donnée à l'entrée — c'est le vrai correctif ;
//  · l'étage 2 (`generateRecipes`) prouve qu'un état déjà corrompu EN MÉMOIRE, qui n'est
//    jamais repassé par l'assainissement, ne plante pas non plus. Un seul des deux ne suffit
//    pas : le premier peut être contourné, le second ne répare rien.

describe('LOT 029 — un réglage IA abîmé ne casse plus la génération', () => {
    beforeEach(() => {
        state.aiConfig = defaultAiConfig();
    });

    describe('F-011 — les trois champs tableau sont assainis à l\'entrée', () => {
        // `cuisines` avait sa garde depuis le LOT 010 ; `diet` et `equip` n'en ont jamais eu.
        it.each([
            ['diet', 'vegan'],
            ['equip', 'Poêles'],
            ['cuisines', 'italienne'],
        ])('%s : une chaîne reçue à la place d\'une liste est remise en liste vide', (champ, valeurCorrompue) => {
            state.aiConfig[champ] = valeurCorrompue;

            sanitizeGlobalState();

            expect(state.aiConfig[champ]).toEqual([]);
        });

        it.each(['diet', 'equip', 'cuisines'])(
            '%s : un objet est traité comme une chaîne — même remède', (champ) => {
            state.aiConfig[champ] = { 0: 'vegan' };

            sanitizeGlobalState();

            expect(state.aiConfig[champ]).toEqual([]);
        });

        it('une liste LÉGITIME n\'est jamais touchée — la garde ne doit rien effacer', () => {
            state.aiConfig.diet = ['keto', 'sans-gluten'];
            state.aiConfig.equip = ['Four'];
            state.aiConfig.cuisines = ['italienne'];

            sanitizeGlobalState();

            expect(state.aiConfig.diet).toEqual(['keto', 'sans-gluten']);
            expect(state.aiConfig.equip).toEqual(['Four']);
            expect(state.aiConfig.cuisines).toEqual(['italienne']);
        });
    });

    describe('F-011 — et la génération survit à un état corrompu non assaini', () => {
        beforeEach(() => {
            vi.stubGlobal('fetch', vi.fn());
            fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({
                    candidates: [{ content: { parts: [{ text: '[]' }] } }]
                })
            });
        });

        it('un régime corrompu en chaîne ne fait pas échouer la génération', async () => {
            // Avant la garde : `.join(', ')` levait « join is not a function ».
            const aiConfig = { ...defaultAiConfig(), diet: 'vegan', ppl: '2' };

            await expect(generateRecipes('MOCK_KEY', [], aiConfig, [], [])).resolves.toEqual([]);
        });

        it('un équipement corrompu en chaîne ne fait pas échouer la génération', async () => {
            // LE CAS SOURNOIS : le lecteur teste `cfgEquip.includes('Poêles')` — et UNE CHAÎNE
            // POSSÈDE `.includes`. Le test réussit donc au lieu d'échouer, et le plantage
            // tombe une ligne plus loin, au `.map()`. La valeur choisie ici contient
            // volontairement « Poêles » pour emprunter cette branche précise.
            const aiConfig = { ...defaultAiConfig(), equip: 'Poêles', ppl: '2' };

            await expect(generateRecipes('MOCK_KEY', [], aiConfig, [], [])).resolves.toEqual([]);
        });

        // Finding F-04 de l'audit Codex, justifié : les DEUX champs voisins avaient leur
        // preuve au niveau du lecteur, `cuisines` non — il n'était éprouvé qu'APRÈS
        // assainissement. Remettre son seul lecteur à `(aiConfig.cuisines || []).join(', ')`
        // laissait donc toute la suite verte. Un service exporté ne doit rien supposer de son
        // appelant : c'est la raison d'être du second étage de garde.
        it('une cuisine corrompue en chaîne ne fait pas échouer la génération', async () => {
            const aiConfig = { ...defaultAiConfig(), cuisines: 'italienne', ppl: '2' };

            await expect(generateRecipes('MOCK_KEY', [], aiConfig, [], [])).resolves.toEqual([]);
        });

        it('un équipement corrompu SANS le mot piège plante aussi sans garde', async () => {
            // Le jumeau du précédent, par l'autre branche (`.length`/`.join`) : les deux
            // chemins doivent tenir, pas seulement celui qui contient « Poêles ».
            const aiConfig = { ...defaultAiConfig(), equip: 'Four', ppl: '2' };

            await expect(generateRecipes('MOCK_KEY', [], aiConfig, [], [])).resolves.toEqual([]);
        });
    });

    describe('F-012 — les exclusions rejoignent les deux autres champs libres', () => {
        beforeEach(() => {
            vi.stubGlobal('fetch', vi.fn());
            fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({
                    candidates: [{ content: { parts: [{ text: '[]' }] } }]
                })
            });
        });

        const corps = () => fetch.mock.calls[0][1].body;

        it('une exclusion normale part toujours dans le message, inchangée', async () => {
            const aiConfig = { ...defaultAiConfig(), exclusions: 'arachides, crustacés', ppl: '2' };

            await generateRecipes('MOCK_KEY', [], aiConfig, [], []);

            expect(corps()).toContain('Exclure formellement : arachides, crustacés.');
        });

        it('une exclusion non textuelle est ignorée, et le repli « rien » reprend la main', async () => {
            // Avant : `${aiConfig.exclusions || 'rien'}` envoyait « [object Object] » à l'IA
            // comme si c'était une consigne d'exclusion. Pas de plantage, mais du bruit
            // présenté au modèle avec l'autorité d'une règle.
            const aiConfig = { ...defaultAiConfig(), exclusions: { liste: 'arachides' }, ppl: '2' };

            await generateRecipes('MOCK_KEY', [], aiConfig, [], []);

            expect(corps()).toContain('Exclure formellement : rien.');
            expect(corps()).not.toContain('object Object');
        });

        it('une exclusion démesurée venue du cloud est bornée', async () => {
            const aiConfig = { ...defaultAiConfig(), exclusions: 'z'.repeat(400), ppl: '2' };

            await generateRecipes('MOCK_KEY', [], aiConfig, [], []);

            expect(corps()).toContain(
                `Exclure formellement : ${'z'.repeat(MAX_EXCLUSIONS_CHARS)}.`
            );
        });

        it('une exclusion faite d\'espaces compte comme vide', async () => {
            const aiConfig = { ...defaultAiConfig(), exclusions: '   ', ppl: '2' };

            await generateRecipes('MOCK_KEY', [], aiConfig, [], []);

            expect(corps()).toContain('Exclure formellement : rien.');
        });
    });
});
