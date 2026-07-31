/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest';
import { state } from '../src/state.js';
import { openRecipeDetail } from '../js/app.js';

// LOT 011, chantier 2 — l'écran de détail avait perdu : pastilles d'état par ingrédient,
// section « État des stocks », description et cuisine, Nutri-Score visuel, étapes
// cochables, et surtout le cas `r.content` (un favori texte brut collé sans IA
// s'affichait VIDE — confirmé par la découverte du LOT 011, corrigé par l'arbitrage A1).
// Oracle : `openRecipeDetail`/`renderRecipeBody`, foodapp-v5-Joel.html l.5362, l.5486-5597.

function recette(overrides = {}) {
    return {
        id: 'r1',
        name: 'Tarte aux pommes',
        people: 2,
        emoji: '🥧',
        time: '45 min',
        difficulty: 'Moyen',
        cuisine: 'Française',
        description: 'Une tarte simple et gourmande',
        ingredients: [
            { n: 'Pomme', q: '4', s: 'stock' },
            { n: 'Farine', q: '250 g', s: 'missing' }
        ],
        steps: ['Éplucher les pommes.', 'Cuire 30 min.'],
        ...overrides
    };
}

describe('LOT 011 / chantier 2 — écran de détail complet', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div class="modal-overlay" id="modal-recipe-detail"></div>';
        state.aiSuggestions = [];
        state.favorites = [];
        state.aiConfig = { apiKey: '', models: {} };
        state.ingredients = [
            { id: 'i1', name: 'Pomme', inStock: true, pinned: false },
            { id: 'i2', name: 'Farine', inStock: false, pinned: false }
        ];
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // TROU TROUVÉ PAR MUTATION (LOT 014 §A) : 88 tests de la zone vérifiaient le CONTENU de
    // cette modale, aucun ne vérifiait qu'elle S'AFFICHE. Débrancher son ouverture ne faisait
    // rougir personne — Joel aurait cliqué sur une recette et rien ne serait apparu, le
    // contenu étant pourtant correctement construit dans un conteneur resté invisible.
    // Même trou exactement que celui trouvé sur le sélecteur de courses : les tests de modale
    // de ce projet testaient ce qu'il y a DEDANS, jamais qu'on la voit.
    // ─────────────────────────────────────────────────────────────────────────────
    it('ouvrir une recette AFFICHE réellement la modale, pas seulement son contenu', () => {
        state.favorites = [{ id: 'f1', title: 'Recette de mamie', content: 'Un texte.' }];
        const modale = document.getElementById('modal-recipe-detail');
        expect(modale.classList.contains('open')).toBe(false);

        openRecipeDetail('f1', 'fav');

        expect(modale.classList.contains('open')).toBe(true);
    });

    describe('Le cas r.content — le plus important (arbitrage A1)', () => {
        it('un favori texte brut affiche son texte, JAMAIS une fiche vide', () => {
            state.favorites = [{ id: 'f1', title: 'Recette de mamie', content: 'Mélanger, cuire, déguster.' }];

            openRecipeDetail('f1', 'fav');

            const texte = document.getElementById('modal-recipe-detail').textContent;
            expect(texte).toContain('Mélanger, cuire, déguster.');
            expect(texte).toContain('Recette de mamie');
        });

        it('masque le bouton panier pour un favori texte brut (rien de structuré à proposer)', () => {
            state.favorites = [{ id: 'f1', title: 'Recette de mamie', content: 'Un texte.' }];

            openRecipeDetail('f1', 'fav');

            const texte = document.getElementById('modal-recipe-detail').textContent;
            expect(texte).not.toContain('Liste de courses');
        });

        it('un favori texte brut garde le bouton Supprimer', () => {
            state.favorites = [{ id: 'f1', title: 'Recette de mamie', content: 'Un texte.' }];

            openRecipeDetail('f1', 'fav');

            const texte = document.getElementById('modal-recipe-detail').textContent;
            expect(texte).toContain('Supprimer');
        });
    });

    describe('Recette structurée — méta, description, cuisine', () => {
        it('affiche la description entre guillemets', () => {
            state.aiSuggestions = [recette()];
            openRecipeDetail(0, 'ai');

            expect(document.getElementById('modal-recipe-detail').textContent)
                .toContain('Une tarte simple et gourmande');
        });

        it('omet la description quand elle est absente', () => {
            state.aiSuggestions = [recette({ description: undefined })];
            openRecipeDetail(0, 'ai');

            expect(document.querySelector('.rd-top + p')).toBeNull();
        });

        it('affiche la cuisine, avec repli « Française »', () => {
            state.aiSuggestions = [recette({ cuisine: undefined })];
            openRecipeDetail(0, 'ai');

            expect(document.getElementById('modal-recipe-detail').textContent).toContain('Française');
        });
    });

    describe('Pastilles et « État des stocks »', () => {
        it('affiche une pastille par ingrédient et la série de tags SANS limite à 6', () => {
            const beaucoup = Array.from({ length: 9 }, (_, i) => ({ n: `Ingrédient ${i}`, s: 'missing' }));
            state.aiSuggestions = [recette({ ingredients: beaucoup, steps: ['Une étape.'] })];

            openRecipeDetail(0, 'ai');

            expect(document.querySelectorAll('.recipe-ing-list .r-tag').length).toBe(9);
        });

        it('les pastilles reflètent le vrai statut du stock (rouge pour manquant)', () => {
            state.aiSuggestions = [recette()];
            openRecipeDetail(0, 'ai');

            const tags = [...document.querySelectorAll('.recipe-ing-list .r-tag')];
            expect(tags.find(t => t.textContent.includes('Pomme')).className).toContain('green');
            expect(tags.find(t => t.textContent.includes('Farine')).className).toContain('red');
        });
    });

    describe('Nutri-Score visuel', () => {
        it('affiche le bouton d\'estimation quand aucune analyse n\'existe encore', () => {
            state.aiSuggestions = [recette()];
            openRecipeDetail(0, 'ai');

            const btn = document.getElementById('rd-nutri-btn');
            expect(btn).toBeTruthy();
            expect(btn.textContent).toContain('Estimer');
        });

        it('affiche les barres Nutri-Score avec la bonne lettre active une fois analysé', () => {
            state.aiSuggestions = [recette({ nutrition: { score: 'B', kcal: 320, tags: ['Léger'] } })];
            openRecipeDetail(0, 'ai');

            expect(document.getElementById('rd-nutri-btn')).toBeNull();
            const active = document.querySelector('.ns-bar.active');
            expect(active.textContent).toBe('B');
            expect(active.className).toContain('ns-B');
            expect(document.getElementById('modal-recipe-detail').textContent).toContain('320 kcal');
            expect(document.getElementById('modal-recipe-detail').textContent).toContain('Léger');
        });
    });

    describe('Étapes cochables (purement visuel, décision D4 — aucune persistance)', () => {
        it('cliquer une étape la coche (classe done), aucune autre n\'est affectée', () => {
            state.aiSuggestions = [recette()];
            openRecipeDetail(0, 'ai');

            const etapes = document.querySelectorAll('.recipe-steps li');
            expect(etapes.length).toBe(2);
            etapes[0].click();

            expect(etapes[0].classList.contains('done')).toBe(true);
            expect(etapes[1].classList.contains('done')).toBe(false);
        });

        it('une recette sans étapes affiche le message de repli, sans planter', () => {
            state.aiSuggestions = [recette({ steps: [] })];

            expect(() => openRecipeDetail(0, 'ai')).not.toThrow();
            expect(document.getElementById('modal-recipe-detail').textContent)
                .toContain('Aucune étape de préparation détaillée');
        });
    });

    describe('Défense en profondeur — recette IA tronquée (sans étapes) ne doit jamais ' +
             's\'afficher vide (trouvé par l\'audit du sous-lot 11B)', () => {
        it('ingrédients présents mais `steps` absent : affiche la fiche complète, PAS le ' +
           'rendu texte brut (qui serait vide, faute de r.content)', () => {
            state.aiSuggestions = [recette({ steps: undefined })];

            openRecipeDetail(0, 'ai');

            const texte = document.getElementById('modal-recipe-detail').textContent;
            expect(texte).toContain('Tarte aux pommes');
            expect(texte).toContain('Pomme');
            expect(texte).toContain('Aucune étape de préparation détaillée');
        });
    });

    describe('Non-régression — les 4 acquis 009/010 doivent survivre à cette réécriture', () => {
        it('le bouton 🖨️ imprimer est toujours présent dans l\'en-tête', () => {
            state.aiSuggestions = [recette()];
            openRecipeDetail(0, 'ai');

            const btn = [...document.querySelectorAll('.mh-btn')].find(b => b.title === 'Imprimer');
            expect(btn).toBeTruthy();
        });

        it('le bouton ⛶ plein écran est toujours présent dans l\'en-tête', () => {
            state.aiSuggestions = [recette()];
            openRecipeDetail(0, 'ai');

            const btn = [...document.querySelectorAll('.mh-btn')].find(b => b.title === 'Plein écran');
            expect(btn).toBeTruthy();
        });

        // LOT 013 — audit adversarial du diff : le VRAI plein écran natif (`requestFullscreen`)
        // est bien hors de portée de jsdom (absent), mais le REPLI CSS pur
        // (`toggleRecipeFullscreen`, js/app.js:1189) est un mécanisme JS+classe testable qui
        // ne l'était pas encore — l'étiquette « Preuve navigateur » de la matrice de
        // couverture ne portait donc que sur une PARTIE de l'acquis #33.
        it('le repli CSS bascule la classe .recipe-fullscreen (mécanisme testable sans '
           + 'l\'API native, qui reste elle hors de portée de jsdom)', () => {
            const el = document.getElementById('modal-recipe-detail');
            expect(el.classList.contains('recipe-fullscreen')).toBe(false);

            window.toggleRecipeFullscreen('modal-recipe-detail');
            expect(el.classList.contains('recipe-fullscreen')).toBe(true);

            window.toggleRecipeFullscreen('modal-recipe-detail');
            expect(el.classList.contains('recipe-fullscreen')).toBe(false);
        });

        it('la racine reste `.modal-content` — le glissement pour fermer (LOT 009) en dépend', () => {
            state.aiSuggestions = [recette()];
            openRecipeDetail(0, 'ai');

            expect(document.getElementById('modal-recipe-detail').querySelector('.modal-content')).toBeTruthy();
        });

        it('les boutons d\'échelle et le compteur de personnes existent toujours (LOT 010)', () => {
            state.aiSuggestions = [recette()];
            openRecipeDetail(0, 'ai');

            expect(document.querySelectorAll('.scale-btn').length).toBe(2);
            expect(document.getElementById('rd-ppl-count')).toBeTruthy();
        });

        it('ouvrir puis rouvrir une recette texte brut après une recette structurée ne plante pas', () => {
            state.aiSuggestions = [recette()];
            openRecipeDetail(0, 'ai');

            state.favorites = [{ id: 'f1', title: 'Brut', content: 'Texte.' }];
            expect(() => openRecipeDetail('f1', 'fav')).not.toThrow();
        });
    });
});
