/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { state, defaultAiConfig, sanitizeGlobalState, applyExternalState, registerSyncScheduler } from '../src/state.js';
import { generateRecipes } from '../src/services/gemini.js';

// LOT 022 — LA FICHE DE RÉGLAGES IA NE PEUT PLUS ARRIVER À MOITIÉ VIDE.
//
// Défaut trouvé en creusant un signalement du vérificateur de types (LOT 021). Deux
// chemins fabriquaient cette fiche À LA MAIN avec la seule clé d'API, alors que
// `defaultAiConfig()` est la représentation canonique. Tout le reste — type de plat,
// nombre de personnes, temps, difficulté, régime, cuisines… — disparaissait.
//
// CE QUE ÇA PRODUISAIT VRAIMENT, et c'est là qu'est la gravité : la moitié des réglages
// ont un filet dans le constructeur de message (`aiConfig.diet || []`), l'autre moitié
// n'en a AUCUN. Le message envoyé à Gemini contenait donc, mot pour mot :
//     « 1. TYPE DE PLAT : Obligatoire -> undefined. »
//     « 4. NOMBRE DE PERSONNES : Exactement undefined personnes. »
//     « 7. TEMPS & DIFFICULTÉ : Max undefined minutes max, niveau undefined. »
// Rien ne plantait, une partie des consignes tenait — d'où la discrétion du défaut.
//
// LE CORRECTIF tient en un seul endroit : `sanitizeGlobalState`, dont c'est précisément
// le rôle, et par lequel passent TOUS les chemins d'entrée (chargement local, `setState`,
// réinitialisation). Les cases manquantes sont comblées, celles de Joel jamais touchées.

const CHAMPS_SANS_FILET = ['meal', 'ppl', 'time', 'diff'];

describe('LOT 022 — la fiche de réglages IA est toujours complète', () => {
    beforeEach(() => {
        registerSyncScheduler(() => {});
        Object.assign(state, { ingredients: [], favorites: [], aiSuggestions: [] });
        state.aiConfig = defaultAiConfig();
    });

    describe('réparation par sanitizeGlobalState', () => {
        it('une fiche réduite à la seule clé d\'API retrouve TOUTES ses cases', () => {
            state.aiConfig = /** @type {any} */ ({ apiKey: 'MA_CLE' });

            sanitizeGlobalState();

            const attendu = defaultAiConfig();
            for (const champ of Object.keys(attendu)) {
                expect(state.aiConfig[champ], `champ « ${champ} » manquant`).toBeDefined();
            }
            expect(state.aiConfig.apiKey).toBe('MA_CLE'); // la clé de Joel n'est pas écrasée
            expect(state.aiConfig.creativity).toBe(50);
            expect(state.aiConfig.ppl).toBe('2');
        });

        // Le point le plus important du lot : réparer ne doit JAMAIS écraser un choix.
        it('ne touche à AUCUN réglage déjà présent, y compris les valeurs « vides »', () => {
            state.aiConfig = /** @type {any} */ ({
                apiKey: 'MA_CLE',
                creativity: 0,          // 0 est un choix légitime, pas une absence
                exclusions: '',         // chaîne vide voulue
                cuisines: ['Thaï'],
                ppl: '6'
            });

            sanitizeGlobalState();

            expect(state.aiConfig.creativity).toBe(0);
            expect(state.aiConfig.exclusions).toBe('');
            expect(state.aiConfig.cuisines).toEqual(['Thaï']);
            expect(state.aiConfig.ppl).toBe('6');
            expect(state.aiConfig.meal).toBe('indifferent'); // seule la case absente est comblée
        });

        it('une fiche entièrement absente est reconstruite, pas laissée nulle', () => {
            state.aiConfig = null;

            sanitizeGlobalState();

            expect(state.aiConfig).toEqual(expect.objectContaining({ ppl: '2', creativity: 50 }));
        });
    });

    describe('la porte d\'entrée réelle : restauration cloud ou fichier', () => {
        it('une sauvegarde SANS réglages ne vide plus la fiche', () => {
            state.aiConfig = { ...defaultAiConfig(), apiKey: 'MA_CLE', ppl: '4' };

            applyExternalState({ ingredients: [], favorites: [] }, { scheduleSync: false });

            for (const champ of CHAMPS_SANS_FILET) {
                expect(state.aiConfig[champ], `champ « ${champ} » perdu`).toBeDefined();
            }
            expect(state.aiConfig.apiKey).toBe('MA_CLE'); // la clé locale l'emporte toujours
        });

        it('une sauvegarde PARTIELLE conserve ce qu\'elle apporte et comble le reste', () => {
            state.aiConfig = { ...defaultAiConfig(), apiKey: 'MA_CLE' };

            applyExternalState({ aiConfig: { diet: ['Végétarien'] } }, { scheduleSync: false });

            expect(state.aiConfig.diet).toEqual(['Végétarien']);
            expect(state.aiConfig.ppl).toBe('2');
            expect(state.aiConfig.apiKey).toBe('MA_CLE');
        });
    });

    // LA PREUVE DE BOUT EN BOUT — celle qui décrit ce que Joel aurait constaté.
    // On ne vérifie pas une structure de données : on lit le message réellement envoyé.
    describe('ce qui part vraiment vers l\'IA', () => {
        beforeEach(() => {
            vi.stubGlobal('fetch', vi.fn());
            fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({ candidates: [{ content: { parts: [{ text: '[]' }] } }] })
            });
        });

        it('après restauration d\'une sauvegarde sans réglages, le message ne contient plus « undefined »', async () => {
            state.aiConfig = { ...defaultAiConfig(), apiKey: 'MA_CLE' };
            applyExternalState({ ingredients: [] }, { scheduleSync: false });

            await generateRecipes('MOCK_KEY', [], state.aiConfig, [], []);

            const message = fetch.mock.calls[0][1].body;
            expect(message).not.toContain('undefined');
            expect(message).toContain('Exactement 2 personnes');
            expect(message).toContain('TYPE DE PLAT : Obligatoire -> Tous types');
        });
    });
});
