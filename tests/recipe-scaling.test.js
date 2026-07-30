/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { scaleQty } from '../src/utils/helpers.js';
import { state } from '../src/state.js';
import { openRecipeDetail, changePplScale, analyzeNutrition } from '../js/app.js';

// LOT 010 — casse C12 : les boutons −/+ changeaient le chiffre affiché sans jamais
// recalculer les quantités (300 g restait 300 g pour 2 comme pour 6 personnes).
// Porté depuis l'oracle (`scaleQty`/`changePplScale`, foodapp-v5-Joel.html
// l.5357-5359, l.5467-5484), avec un dépassement volontaire assumé (arbitrage Joel
// du 2026-07-30) : les fractions ASCII et Unicode sont vraiment prises en charge,
// là où l'oracle les corrompait (`1/2` x2 → `2/4`).

describe('LOT 010 / C12 — scaleQty (fonction pure)', () => {
    describe('Nombres simples — comportement identique à l\'oracle', () => {
        it('multiplie un entier', () => {
            expect(scaleQty('300', 1.5)).toBe('450');
        });

        it('multiplie un décimal à point', () => {
            expect(scaleQty('2.5', 2)).toBe('5');
        });

        it('multiplie un décimal à virgule française', () => {
            expect(scaleQty('2,5', 2)).toBe('5');
        });

        it('arrondit à 1 décimale maximum', () => {
            expect(scaleQty('1', 1 / 3)).toBe('0,3');
        });

        it('à l\'échelle 1, renvoie la chaîne D\'ORIGINE sans la reformater ' +
           '(aucun aller-retour ne doit introduire de dérive)', () => {
            expect(scaleQty('300 g', 1)).toBe('300 g');
            expect(scaleQty('1/2 citron', 1)).toBe('1/2 citron');
        });

        it('une chaîne vide ou absente ne fait pas planter', () => {
            expect(scaleQty('', 2)).toBe('');
            expect(scaleQty(undefined, 2)).toBe('');
            expect(scaleQty(null, 2)).toBe('');
        });

        it('un texte sans aucun nombre reste inchangé', () => {
            expect(scaleQty('au goût', 2)).toBe('au goût');
        });
    });

    describe('Unités — collées ou séparées, TOUJOURS préservées (demande explicite de Joel)', () => {
        it('unité séparée par un espace (g)', () => {
            expect(scaleQty('300 g', 2)).toBe('600 g');
        });

        it('unité collée sans espace (g)', () => {
            expect(scaleQty('300g', 2)).toBe('600g');
        });

        it('millilitres (ml), séparés', () => {
            expect(scaleQty('250 ml', 2)).toBe('500 ml');
        });

        it('millilitres (ml), collés', () => {
            expect(scaleQty('250ml', 2)).toBe('500ml');
        });

        it('kilogrammes (kg)', () => {
            expect(scaleQty('1.5 kg', 2)).toBe('3 kg');
        });

        it('centilitres (cl)', () => {
            expect(scaleQty('10 cl', 3)).toBe('30 cl');
        });

        it('cuillères à soupe (c. à s.)', () => {
            expect(scaleQty('2 c. à s.', 2)).toBe('4 c. à s.');
        });

        it('unité en tête de chaîne (ex. pincée) laissée intacte, seul le nombre change', () => {
            expect(scaleQty('1 pincée de sel', 2)).toBe('2 pincée de sel');
        });

        it('une quantité sans unité (compte simple) reste correcte', () => {
            expect(scaleQty('3 œufs', 2)).toBe('6 œufs');
        });
    });

    describe('Fractions ASCII — le cœur de l\'arbitrage de Joel', () => {
        it('« 1/2 » à l\'échelle 2 devient « 1 », PAS « 2/4 » (le bug exact de l\'oracle)', () => {
            expect(scaleQty('1/2 citron', 2)).toBe('1 citron');
        });

        it('« 3/4 » à l\'échelle 2', () => {
            expect(scaleQty('3/4 verre', 2)).toBe('1,5 verre');
        });

        it('fraction avec unité collée', () => {
            expect(scaleQty('1/2c. à café', 2)).toBe('1c. à café');
        });

        it('deux changements d\'échelle successifs sans dérive — recalculé depuis ' +
           'l\'échelle courante à chaque fois, jamais accumulé sur un résultat déjà arrondi', () => {
            const original = '1/2 citron';
            const apres2x = scaleQty(original, 2);
            const apres3x = scaleQty(original, 3); // recalculé depuis l'ORIGINAL, pas depuis apres2x
            expect(apres2x).toBe('1 citron');
            expect(apres3x).toBe('1,5 citron');
        });
    });

    describe('Fractions Unicode — arbitrage de Joel', () => {
        it('½ à l\'échelle 3', () => {
            expect(scaleQty('½ citron', 3)).toBe('1,5 citron');
        });

        it('¼ à l\'échelle 4', () => {
            expect(scaleQty('¼ litre', 4)).toBe('1 litre');
        });

        it('¾ à l\'échelle 2', () => {
            expect(scaleQty('¾ tasse', 2)).toBe('1,5 tasse');
        });

        it('fraction Unicode collée à l\'unité', () => {
            expect(scaleQty('½kg', 2)).toBe('1kg');
        });
    });

    describe('Plusieurs nombres dans la même chaîne', () => {
        it('« 2-3 c. à soupe » met les deux nombres à l\'échelle indépendamment', () => {
            expect(scaleQty('2-3 c. à soupe', 2)).toBe('4-6 c. à soupe');
        });
    });
});

function recette(overrides = {}) {
    return {
        id: 'r1',
        name: 'Test',
        people: 2,
        emoji: '🍽️',
        time: '20 min',
        difficulty: 'Facile',
        ingredients: [
            { n: 'Farine', q: '300 g' },
            { n: 'Citron', q: '1/2' },
            { n: 'Lait', q: '250 ml' }
        ],
        steps: ['Étape 1'],
        ...overrides
    };
}

describe('LOT 010 / C12 — intégration écran recette', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div class="modal-overlay" id="modal-recipe-detail"></div>';
        state.aiSuggestions = null;
        state.favorites = [];
        state.aiConfig = { apiKey: '', models: {} };
    });

    it('à l\'ouverture, les quantités affichées sont EXACTEMENT celles d\'origine (échelle 1)', () => {
        state.aiSuggestions = [recette()];

        openRecipeDetail(0, 'ai');

        const texte = document.getElementById('modal-recipe-detail').textContent;
        expect(texte).toContain('300 g');
        expect(texte).toContain('1/2');
        expect(texte).toContain('250 ml');
    });

    it('cliquer + recalcule réellement toutes les quantités, unités comprises', () => {
        state.aiSuggestions = [recette()];
        openRecipeDetail(0, 'ai');

        document.querySelectorAll('.scale-btn')[1].click(); // + : 2 → 3 pers.

        const texte = document.getElementById('modal-recipe-detail').textContent;
        expect(texte).toContain('450 g'); // 300 g * 1.5
        expect(texte).toContain('375 ml'); // 250 ml * 1.5
        expect(texte).toContain('0,8'); // 1/2 (= 0,5) * 1.5 = 0,75 → arrondi 1 décimale = 0,8
        expect(document.getElementById('rd-ppl-count').textContent).toBe('3');
    });

    it('les bornes 1-20 sont respectées : impossible de descendre sous 1 personne', () => {
        state.aiSuggestions = [recette({ people: 1 })];
        openRecipeDetail(0, 'ai');

        document.querySelectorAll('.scale-btn')[0].click(); // − depuis 1

        expect(document.getElementById('rd-ppl-count').textContent).toBe('1');
    });

    it('les bornes 1-20 sont respectées : impossible de dépasser 20 personnes', () => {
        state.aiSuggestions = [recette({ people: 20 })];
        openRecipeDetail(0, 'ai');

        document.querySelectorAll('.scale-btn')[1].click(); // + depuis 20

        expect(document.getElementById('rd-ppl-count').textContent).toBe('20');
    });

    it('revenir au nombre initial redonne les quantités EXACTES d\'origine (pas de dérive)', () => {
        state.aiSuggestions = [recette()];
        openRecipeDetail(0, 'ai');

        const plus = () => document.querySelectorAll('.scale-btn')[1].click();
        const moins = () => document.querySelectorAll('.scale-btn')[0].click();
        plus(); plus(); plus(); moins(); moins(); moins(); // 2→5→2

        const texte = document.getElementById('modal-recipe-detail').textContent;
        expect(texte).toContain('300 g');
        expect(texte).toContain('250 ml');
    });

    it('recette SANS ingredients (ex. favori corrompu) ne fait pas planter l\'échelle', () => {
        state.aiSuggestions = [recette({ ingredients: [] })];
        openRecipeDetail(0, 'ai');

        expect(() => document.querySelectorAll('.scale-btn')[1].click()).not.toThrow();
    });

    it('la recette elle-même (`r.ingredients`) n\'est JAMAIS modifiée par le changement ' +
       'd\'échelle — sinon un favori serait corrompu de façon permanente', () => {
        const r = recette();
        state.aiSuggestions = [r];
        openRecipeDetail(0, 'ai');

        document.querySelectorAll('.scale-btn')[1].click();

        expect(r.ingredients[0].q).toBe('300 g'); // toujours la chaîne d'origine
    });

    it('fermer puis rouvrir le modal revient à l\'échelle 1, même si elle avait été changée', () => {
        state.aiSuggestions = [recette(), recette({ id: 'r2', name: 'Autre' })];
        openRecipeDetail(0, 'ai');
        document.querySelectorAll('.scale-btn')[1].click();
        expect(document.getElementById('rd-ppl-count').textContent).toBe('3');

        openRecipeDetail(1, 'ai'); // nouvelle ouverture

        expect(document.getElementById('rd-ppl-count').textContent).toBe('2');
    });

    it('l\'échelle fonctionne identiquement pour une recette ouverte depuis les favoris', () => {
        state.favorites = [{ id: 'f1', recipe: recette() }];

        openRecipeDetail('f1', 'fav');
        document.querySelectorAll('.scale-btn')[1].click();

        expect(document.getElementById('modal-recipe-detail').textContent).toContain('450 g');
    });

    // Durcissement demandé par l'audit Codex Terra (2026-07-30) : la préservation de
    // l'échelle par `analyzeNutrition` était vérifiée par lecture de code, jamais
    // exercée par un test qui déclenche réellement l'analyse.
    it('une analyse nutritionnelle déclenchée APRÈS un changement d\'échelle conserve ' +
       'l\'échelle choisie — elle ne doit jamais la remettre à sa valeur d\'origine', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                candidates: [{ content: { parts: [{ text: '{"score":"A","kcal":450,"tags":["Sain"]}' }] } }]
            })
        }));
        state.aiConfig = { apiKey: 'MOCK_KEY', models: {} };
        const r = recette();
        state.aiSuggestions = [r];
        openRecipeDetail(0, 'ai');
        document.querySelectorAll('.scale-btn')[1].click(); // 2 → 3 pers.
        expect(document.getElementById('rd-ppl-count').textContent).toBe('3');

        await analyzeNutrition(r, 'ai', null);

        expect(document.getElementById('rd-ppl-count').textContent).toBe('3');
        expect(document.getElementById('modal-recipe-detail').textContent).toContain('450 g');
        vi.unstubAllGlobals();
    });

    it('la requête d\'analyse nutritionnelle utilise le nombre de personnes D\'ORIGINE, ' +
       'jamais l\'échelle en cours — la portion analysée ne doit pas varier avec l\'affichage', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                candidates: [{ content: { parts: [{ text: '{"score":"A","kcal":450,"tags":["Sain"]}' }] } }]
            })
        });
        vi.stubGlobal('fetch', fetchMock);
        state.aiConfig = { apiKey: 'MOCK_KEY', models: {} };
        const r = recette();
        state.aiSuggestions = [r];
        openRecipeDetail(0, 'ai');
        document.querySelectorAll('.scale-btn')[1].click(); // 2 → 3 pers.

        await analyzeNutrition(r, 'ai', null);

        const body = fetchMock.mock.calls[0][1].body;
        expect(body).toContain('pour 2 pers');
        vi.unstubAllGlobals();
    });
});
