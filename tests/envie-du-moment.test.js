/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { state, defaultAiConfig } from '../src/state.js';
import { generateRecipes } from '../src/services/gemini.js';
import { setupTestDOM } from './_helpers/dom-helpers.js';
// `saveAiConfigFromUI` n'existe que dans `expose()` (js/app.js) : on l'atteint par `window`,
// comme le fait le navigateur. `restoreAIConfig`, elle, est exportée nommément.
import { restoreAIConfig } from '../js/app.js';

// LOT 028 — « Envie du moment » : une consigne libre qui doit ARRIVER JUSQU'À L'IA comme une
// exigence stricte (demande de Joel : « je veux dire "chili con carne" et n'avoir QUE des
// chili con carne »), survivre au rechargement, résister à une synchro qui tombe pendant la
// frappe, et rester visible sous le bouton Générer.
//
// CE FICHIER COUVRE AUSSI DEUX TROUS PRÉEXISTANTS, trouvés par la découverte de ce lot :
//  · `aiConfig.exceptions` n'était lu par AUCUN prompt depuis l'origine du projet (ni même
//    dans le monolithe) — le champ était décoratif, alors que Joel s'en était déjà servi ;
//  · `aiConfig.exclusions` n'avait AUCUN test sur sa présence dans le message envoyé à l'IA
//    (recherche « Exclure formellement » dans tests/ : 0 résultat avant ce fichier).

const INDEX_HTML = readFileSync(resolve(__dirname, '../index.html'), 'utf8');

const champ = (id, valeur) => { document.getElementById(id).value = valeur; };

/** Le message réellement envoyé à Gemini au dernier appel. */
const corpsEnvoye = () => fetch.mock.calls[0][1].body;

describe('LOT 028 — Envie du moment', () => {
    beforeEach(() => {
        state.aiConfig = { ...defaultAiConfig() };
    });

    describe('Le champ dans la vraie page', () => {
        it('existe, borné à 100 caractères et câblé sur l\'enregistrement à la frappe', () => {
            // Soudé en une seule assertion : un `maxlength` sans `oninput` donnerait un champ
            // qui ne s'enregistre jamais, un `oninput` sans `maxlength` laisserait une consigne
            // sans limite partir dans le prompt. Les trois vont ensemble ou ne servent à rien.
            expect(INDEX_HTML).toContain(
                `<input class="ai-input" id="ai-envie" maxlength="100"`
            );
            expect(INDEX_HTML).toMatch(
                /id="ai-envie"[\s\S]{0,200}?oninput="saveAiConfigFromUI\(\)"/
            );
        });

        it('est placé AVANT le type de plat — la consigne qui gagne se lit en premier', () => {
            // Décision de Joel : « en tête des réglages », donc hors de l'accordéon replié.
            expect(INDEX_HTML.indexOf('id="ai-envie"'))
                .toBeLessThan(INDEX_HTML.indexOf('id="ai-meal-chips"'));
            expect(INDEX_HTML.indexOf('id="ai-envie"'))
                .toBeLessThan(INDEX_HTML.indexOf('id="advanced-settings-accordion"'));
        });

        it('« Exceptions autorisées » est borné lui aussi, maintenant qu\'il part dans le prompt', () => {
            expect(INDEX_HTML).toContain(`<input class="ai-input" id="ai-exceptions" maxlength="80"`);
        });
    });

    describe('Bout en bout : frappe → état → rechargement', () => {
        beforeEach(() => {
            setupTestDOM(['aiSettings', 'systemInfo']);
            state.aiConfig = { ...defaultAiConfig() };
        });

        it('la consigne tapée est enregistrée, puis re-remplie au rechargement', () => {
            champ('ai-envie', 'chili con carne');
            window.saveAiConfigFromUI();
            expect(state.aiConfig.envie).toBe('chili con carne');

            // Rechargement : le DOM repart vide, seul l'état persiste.
            champ('ai-envie', '');
            restoreAIConfig();

            expect(document.getElementById('ai-envie').value).toBe('chili con carne');
        });

        it('le rappel sous le bouton affiche la consigne, et redevient nu quand on l\'efface', () => {
            champ('ai-envie', 'chili con carne');
            window.saveAiConfigFromUI();
            expect(document.getElementById('ai-cta-summary').textContent)
                .toBe('indifferent · 2 pers. · « chili con carne »');

            champ('ai-envie', '');
            window.saveAiConfigFromUI();
            // Texte STRICTEMENT d'origine : aucune trace résiduelle, pas même un séparateur.
            expect(document.getElementById('ai-cta-summary').textContent)
                .toBe('indifferent · 2 pers.');
        });
    });

    // PROTECTION DE LA SAISIE EN COURS : le verrou vit dans `tests/sync-engine.test.js`
    // (« LOT 028 : la consigne … survit à un pull »), à côté de son jumeau FV-3 et du banc
    // d'essai du faux Firebase — un test de comportement réel, pas une liste vérifiée.

    describe('Transmission réelle à l\'IA', () => {
        beforeEach(() => {
            vi.stubGlobal('fetch', vi.fn());
            fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ candidates: [{ content: { parts: [{ text: '[]' }] } }] })
            });
        });

        afterEach(() => {
            vi.unstubAllGlobals();
            vi.restoreAllMocks();
        });

        it('« chili con carne » part comme EXIGENCE : les 5 recettes doivent y répondre', async () => {
            const aiConfig = { ...defaultAiConfig(), envie: 'chili con carne', ppl: '2' };

            await generateRecipes('MOCK_KEY', [], aiConfig, [], []);

            const corps = corpsEnvoye();
            expect(corps).toContain("DEMANDE EXPRESSE DE L'UTILISATEUR : « chili con carne »");
            // Le cœur de la demande de Joel : pas « inspire-toi de », mais « toutes ».
            expect(corps).toContain('Les 5 recettes doivent TOUTES y répondre');
            expect(corps).toContain('JAMAIS 5 plats différents');
        });

        it('la hiérarchie voyage avec la consigne : elle bat les puces, jamais les imposés', async () => {
            const aiConfig = { ...defaultAiConfig(), envie: 'chili con carne', meal: 'dessert', ppl: '2' };

            await generateRecipes('MOCK_KEY', [], aiConfig, [], []);

            const corps = corpsEnvoye();
            expect(corps).toContain('PRIME sur les contraintes 1 (TYPE DE PLAT) et 2 (CUISINE)');
            expect(corps).toContain('ne prime JAMAIS sur la contrainte 3 (INGRÉDIENTS IMPOSÉS)');
            // La puce contredite continue de partir telle quelle : c'est l'IA qui arbitre,
            // avec la règle sous les yeux — on ne réécrit pas les réglages de Joel dans son dos.
            expect(corps).toContain('TYPE DE PLAT : Obligatoire -> dessert');
        });

        it('la consigne se lit AVANT la liste des contraintes', async () => {
            const aiConfig = { ...defaultAiConfig(), envie: 'chili con carne', ppl: '2' };

            await generateRecipes('MOCK_KEY', [], aiConfig, [], []);

            const corps = corpsEnvoye();
            expect(corps.indexOf('DEMANDE EXPRESSE')).toBeLessThan(corps.indexOf('CONTRAINTES'));
        });

        it('une consigne faite d\'espaces ne compte pas — comme si le champ était vide', async () => {
            const aiConfig = { ...defaultAiConfig(), envie: '   ', ppl: '2' };

            await generateRecipes('MOCK_KEY', [], aiConfig, [], []);

            expect(corpsEnvoye()).not.toContain('DEMANDE EXPRESSE');
        });

        it('NON-RÉGRESSION : sans consigne ni exception, le message est identique à celui d\'avant le lot', async () => {
            // Le test le plus important du fichier. La preuve n'est pas « ça a l'air pareil » :
            // les deux morceaux neufs sont ABSENTS, et la jointure d'origine (mission → liste
            // des contraintes, séparées par UNE ligne vide) est intacte au caractère près.
            const aiConfig = { ...defaultAiConfig(), ppl: '2' };

            await generateRecipes('MOCK_KEY', [], aiConfig, [], []);

            const corps = corpsEnvoye();
            expect(corps).not.toContain('DEMANDE EXPRESSE');
            expect(corps).not.toContain('EXCEPTIONS AUTORISÉES');
            expect(corps).toContain(
                'générer EXACTEMENT 5 recettes différentes.\\n\\n🚨 CONTRAINTES'
            );
        });
    });

    describe('« Exceptions autorisées » : la fin d\'un champ décoratif', () => {
        beforeEach(() => {
            vi.stubGlobal('fetch', vi.fn());
            fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ candidates: [{ content: { parts: [{ text: '[]' }] } }] })
            });
        });

        afterEach(() => {
            vi.unstubAllGlobals();
            vi.restoreAllMocks();
        });

        it('l\'exception saisie arrive enfin dans le message, sous les régimes', async () => {
            const aiConfig = { ...defaultAiConfig(), diet: ['vegetarien'], exceptions: 'parmesan', ppl: '2' };

            await generateRecipes('MOCK_KEY', [], aiConfig, [], []);

            const corps = corpsEnvoye();
            expect(corps).toContain('EXCEPTIONS AUTORISÉES malgré les régimes ci-dessus : parmesan.');
            // Rattachée à la contrainte 6, dont le libellé n'a pas bougé.
            expect(corps.indexOf('RÉGIMES & EXCLUSIONS')).toBeLessThan(corps.indexOf('EXCEPTIONS AUTORISÉES'));
        });

        it('champ vide : pas un mot de plus dans le message', async () => {
            const aiConfig = { ...defaultAiConfig(), diet: ['vegetarien'], ppl: '2' };

            await generateRecipes('MOCK_KEY', [], aiConfig, [], []);

            expect(corpsEnvoye()).not.toContain('EXCEPTIONS AUTORISÉES');
        });

        it('PREMIÈRE COUVERTURE : les exclusions/allergies arrivent bien dans le message', async () => {
            // Trou préexistant, comblé au passage : rien ne prouvait que ce champ-là non plus
            // n'était pas décoratif. Il l'était à moitié — lu par le prompt, jamais testé.
            const aiConfig = { ...defaultAiConfig(), exclusions: 'arachides, crustacés', ppl: '2' };

            await generateRecipes('MOCK_KEY', [], aiConfig, [], []);

            expect(corpsEnvoye()).toContain('Exclure formellement : arachides, crustacés.');
        });
    });
});
