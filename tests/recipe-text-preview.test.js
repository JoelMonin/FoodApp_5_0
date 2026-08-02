/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { recetteEnTexte } from '../src/utils/recipeText.js';
import { state } from '../src/state.js';
import { transformRecipeAI, openModal } from '../js/app.js';

// LOT 025, volet A — après « Transformer avec l'IA », la fenêtre n'affichait que
// `recipe.description`. La recette structurée existait pourtant en entier en mémoire :
// Joel a lu cet écran comme une perte de sa recette (constat du 2026-08-02), et à raison —
// on lui demandait de sauvegarder ce qu'il ne pouvait pas voir.

const RECETTE_COMPLETE = {
    name: 'Aubergines au four',
    description: 'Demi-aubergines rôties aux herbes de Provence.',
    time: '40 min',
    difficulty: 'Très facile',
    people: 4,
    cuisine: 'française',
    ingredients: [
        { n: 'Aubergine', q: '4 pièces', e: '🍆', c: 'Légumes', s: 'stock' },
        { n: "Huile d'olive", q: '4 c. à soupe', e: '🫒', c: 'Épicerie', s: 'stock' },
        { n: 'Herbes de Provence', q: '2 c. à café', e: '🌿', c: 'Épices', s: 'missing' }
    ],
    steps: [
        'Coupez chaque aubergine en 2 dans le sens de la longueur.',
        "Tartinez d'huile d'olive la chair de chaque demi-aubergine.",
        'Enfournez à 200°C jusqu\'à ce que la chair soit molle.'
    ]
};

describe('LOT 025 / volet A — composition de l\'aperçu (recetteEnTexte)', () => {
    const texte = recetteEnTexte(RECETTE_COMPLETE);

    it('affiche le titre et la phrase d\'accroche', () => {
        expect(texte).toContain('AUBERGINES AU FOUR');
        expect(texte).toContain('Demi-aubergines rôties aux herbes de Provence.');
    });

    it('affiche les repères pratiques : temps, personnes, difficulté, cuisine', () => {
        expect(texte).toContain('40 min');
        expect(texte).toContain('4 personnes');
        expect(texte).toContain('Très facile');
        expect(texte).toContain('française');
    });

    // LE CŒUR DU LOT : ces deux blocs manquaient entièrement à l'écran.
    it('affiche TOUS les ingrédients avec leurs quantités', () => {
        expect(texte).toContain('INGRÉDIENTS (3)');
        expect(texte).toContain('Aubergine — 4 pièces');
        expect(texte).toContain("Huile d'olive — 4 c. à soupe");
        expect(texte).toContain('Herbes de Provence — 2 c. à café');
    });

    it('affiche TOUTES les étapes, numérotées', () => {
        expect(texte).toContain('PRÉPARATION (3 étapes)');
        expect(texte).toContain('1. Coupez chaque aubergine en 2');
        expect(texte).toContain("2. Tartinez d'huile d'olive");
        expect(texte).toContain('3. Enfournez à 200°C');
    });

    describe('robustesse — chaque section est optionnelle', () => {
        it('une recette sans étapes affiche quand même ses ingrédients', () => {
            const t = recetteEnTexte({ name: 'Salade', ingredients: [{ n: 'Tomate', q: '3' }] });

            expect(t).toContain('SALADE');
            expect(t).toContain('Tomate — 3');
            expect(t).not.toContain('PRÉPARATION');
        });

        it('une recette sans ingrédients n\'affiche pas de section vide', () => {
            const t = recetteEnTexte({ name: 'Eau chaude', steps: ['Faire bouillir.'] });

            expect(t).not.toContain('INGRÉDIENTS');
            expect(t).toContain('1. Faire bouillir.');
        });

        it('accepte l\'autre forme du projet (title / ppl / name / qty)', () => {
            const t = recetteEnTexte({
                title: 'Soupe', ppl: 2, ingredients: [{ name: 'Carotte', qty: '500 g' }]
            });

            expect(t).toContain('SOUPE');
            expect(t).toContain('2 personnes');
            expect(t).toContain('Carotte — 500 g');
        });

        it('un ingrédient sans quantité s\'affiche quand même', () => {
            expect(recetteEnTexte({ name: 'X', ingredients: [{ n: 'Sel' }] })).toContain('• Sel');
        });

        it('les ingrédients sans nom et les étapes vides sont ignorés, sans trou de numérotation', () => {
            const t = recetteEnTexte({
                name: 'X',
                ingredients: [{ n: 'Sel', q: '1 pincée' }, { q: '2' }, null],
                steps: ['Première étape.', '   ', 'Seconde étape.']
            });

            expect(t).toContain('INGRÉDIENTS (1)');
            expect(t).toContain('PRÉPARATION (2 étapes)');
            expect(t).toContain('1. Première étape.');
            expect(t).toContain('2. Seconde étape.');
            expect(t).not.toContain('3.');
        });

        it('« 1 personne » au singulier (leçon « mon 1 achat », LOT 020)', () => {
            expect(recetteEnTexte({ name: 'X', people: 1 })).toContain('1 personne');
            expect(recetteEnTexte({ name: 'X', people: 1 })).not.toContain('1 personnes');
        });

        it('un nombre de personnes absent ou aberrant n\'affiche rien plutôt qu\'un « NaN »', () => {
            expect(recetteEnTexte({ name: 'X' })).not.toContain('personne');
            expect(recetteEnTexte({ name: 'X', people: 0 })).not.toContain('personne');
            expect(recetteEnTexte({ name: 'X', people: 'beaucoup' })).not.toContain('personne');
        });

        it('objet vide ou non exploitable : rend une chaîne vide sans planter', () => {
            expect(recetteEnTexte(null)).toBe('');
            expect(recetteEnTexte(undefined)).toBe('');
            expect(recetteEnTexte('une recette')).toBe('');
            expect(recetteEnTexte({})).toBe('');
        });
    });
});

describe('LOT 025 / volet A — l\'aperçu à l\'écran après transformation', () => {
    function pasteModalDom() {
        document.body.innerHTML = `
            <div class="modal-overlay" id="modal-paste-recipe">
                <input id="paste-url">
                <button id="paste-fetch-btn"></button>
                <input id="paste-title">
                <textarea id="paste-content"></textarea>
                <button id="paste-ai-btn"></button>
                <button id="paste-save-btn"></button>
                <button id="paste-list-btn" style="display:none"></button>
            </div>
        `;
    }

    function reponseIA(objet) {
        fetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                candidates: [{ content: { parts: [{ text: JSON.stringify(objet) }] } }]
            })
        });
    }

    beforeEach(() => {
        pasteModalDom();
        vi.stubGlobal('fetch', vi.fn());
        state.aiConfig.apiKey = 'MOCK_KEY';
        // Parcours réel : la fenêtre s'ouvre avant de servir (purge `_lastTransformedRecipe`).
        openModal('modal-paste-recipe');
        document.getElementById('paste-title').value = 'Titre initial';
        document.getElementById('paste-content').value = 'Texte à transformer';
    });

    it('CRITÈRE 1 — le champ montre la recette COMPLÈTE, pas seulement l\'accroche', async () => {
        reponseIA(RECETTE_COMPLETE);

        await transformRecipeAI();

        const affiche = document.getElementById('paste-content').value;
        expect(affiche).toContain("analysée et formatée par l'IA");
        expect(affiche).toContain('Demi-aubergines rôties');
        // Ce que Joel ne voyait PAS avant ce lot :
        expect(affiche).toContain('Aubergine — 4 pièces');
        expect(affiche).toContain('Herbes de Provence — 2 c. à café');
        expect(affiche).toContain('1. Coupez chaque aubergine en 2');
        expect(affiche).toContain('3. Enfournez à 200°C');
    });

    it('CRITÈRE 2 — le champ reste verrouillé après transformation (acquis LOT 011)', async () => {
        reponseIA(RECETTE_COMPLETE);

        await transformRecipeAI();

        expect(document.getElementById('paste-content').disabled).toBe(true);
    });

    it('CRITÈRE 3 — une réponse refusée n\'écrit AUCUN aperçu : le texte de Joel est intact', async () => {
        reponseIA({ ingredients: [], steps: ['Cuire.'] }); // pas de `name` → refusée

        await transformRecipeAI();

        expect(document.getElementById('paste-content').value).toBe('Texte à transformer');
        expect(document.getElementById('paste-content').value).not.toContain('INGRÉDIENTS');
        expect(document.getElementById('paste-content').disabled).toBe(false);
    });

    it('CRITÈRE 4 — aucun aperçu ne survit à la réouverture de la fenêtre', async () => {
        reponseIA(RECETTE_COMPLETE);
        await transformRecipeAI();
        expect(document.getElementById('paste-content').value).toContain('Aubergine');

        openModal('modal-paste-recipe');

        expect(document.getElementById('paste-content').value).toBe('');
        expect(document.getElementById('paste-content').disabled).toBe(false);
    });
});
