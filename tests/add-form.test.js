/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { state, shoppingChecked, defaultAiConfig } from '../src/state.js';
import { setupTestDOM, resetTestState } from './_helpers/dom-helpers.js';
import { DEFAULT_DB } from '../src/data.js';
import '../js/app.js';

// LOT 014, volet A — TESTS DE CARACTÉRISATION, écrits AVANT le déplacement du formulaire
// d'ajout vers `src/ui/addForm.js`.
//
// Trois fonctions de la zone n'avaient AUCUN test direct : `selectEmoji` (relevée en zone
// aveugle par la découverte), plus `updateEmojiSuggestions` et `showCategoryIndicator` que
// la découverte avait manquées. Les déplacer sans filet aurait rouvert un trou exactement là
// où le code bouge — c'est ce que la règle du lot interdit.
//
// Un test de caractérisation ne juge pas : il DÉCRIT le comportement actuel, défauts compris,
// pour que le déplacement soit prouvé fidèle. La divergence d'accents documentée plus bas est
// donc figée telle quelle, pas corrigée.

describe('LOT 014 §A — selectEmoji (caractérisation avant déplacement)', () => {
    beforeEach(() => {
        setupTestDOM('add');
        resetTestState(state, shoppingChecked, defaultAiConfig);
    });

    afterEach(() => {
        // `_isManualCategory` est une variable de MODULE sans trappe de reset : seul
        // `switchView('add')` la remet à zéro. Sans cet appel, un test qui active le mode
        // manuel contaminerait tous les suivants du fichier.
        window.switchView('add');
    });

    it('écrit l\'emoji choisi dans le champ', () => {
        window.selectEmoji('🥐');
        expect(document.getElementById('add-emoji').value).toBe('🥐');
    });

    it('un emoji connu de la base remplit AUSSI la catégorie', () => {
        // 🐔 n'est porté que par « Poulet » dans DEFAULT_DB : la reprise de catégorie est
        // donc sans ambiguïté. Vérifié sur la donnée réelle plutôt que sur une constante
        // recopiée, pour que le test suive la base si elle évolue.
        const poulet = DEFAULT_DB.find(i => i.emoji === '🐔');
        expect(poulet).toBeTruthy();
        window.selectEmoji('🐔');
        expect(document.getElementById('add-category').value).toBe(poulet.category);
    });

    it('un emoji INCONNU de la base laisse la catégorie intacte', () => {
        const catSelect = document.getElementById('add-category');
        catSelect.value = 'Fruits';
        window.selectEmoji('🛸'); // absent de DEFAULT_DB
        expect(catSelect.value).toBe('Fruits');
    });

    it('la catégorie choisie À LA MAIN n\'est jamais écrasée par l\'emoji', () => {
        const catSelect = document.getElementById('add-category');
        catSelect.value = 'Fruits';
        window._onManualCategoryChange();   // Joel a choisi lui-même
        window.selectEmoji('🐔');           // 🐔 = Protéines dans la base
        expect(catSelect.value).toBe('Fruits');
        expect(document.getElementById('add-emoji').value).toBe('🐔'); // l'emoji, lui, est bien posé
    });

    it('marque le bouton correspondant et DÉmarque les autres', () => {
        const grille = document.getElementById('emoji-suggestions');
        for (const e of ['🥐', '🍅', '🥕']) {
            const b = document.createElement('span');
            b.className = 'emoji-sug-btn';
            b.textContent = e;
            grille.appendChild(b);
        }
        document.querySelectorAll('.emoji-sug-btn')[2].classList.add('selected'); // 🥕 marqué avant

        window.selectEmoji('🍅');

        const marques = [...document.querySelectorAll('.emoji-sug-btn')]
            .filter(b => b.classList.contains('selected'))
            .map(b => b.textContent);
        expect(marques).toEqual(['🍅']); // exactement un, et c'est le bon
    });

    it('sans champ emoji dans la page, ne fait RIEN et ne lève pas', () => {
        document.getElementById('add-emoji').remove();
        const catSelect = document.getElementById('add-category');
        catSelect.value = 'Fruits';
        expect(() => window.selectEmoji('🐔')).not.toThrow();
        // La garde porte sur le champ emoji : sans lui, même la catégorie n'est pas touchée.
        expect(catSelect.value).toBe('Fruits');
    });
});

describe('LOT 014 §A — updateEmojiSuggestions (caractérisation avant déplacement)', () => {
    beforeEach(() => {
        setupTestDOM('add');
        resetTestState(state, shoppingChecked, defaultAiConfig);
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
    });

    const emojisAffiches = () =>
        [...document.querySelectorAll('#emoji-suggestions .emoji-sug-btn')].map(b => b.textContent);

    // PIÈGE DE DÉPLACEMENT : ce qui est publié sous le nom `updateEmojiSuggestions` n'est PAS
    // la fonction brute mais sa version TEMPORISÉE (`debounce(..., 200)`). Un découpage qui
    // republierait la fonction brute sous le même nom supprimerait la temporisation sans
    // qu'aucun autre test ne s'en aperçoive.
    it('la fonction publiée est TEMPORISÉE (200 ms), pas immédiate', () => {
        window.updateEmojiSuggestions('tomate');
        expect(emojisAffiches().length).toBe(0);   // rien tout de suite
        vi.advanceTimersByTime(199);
        expect(emojisAffiches().length).toBe(0);   // toujours rien
        vi.advanceTimersByTime(1);
        expect(emojisAffiches().length).toBeGreaterThan(0); // à 200 ms exactement
    });

    it('une valeur vide affiche la grille de repli générique', () => {
        window.updateEmojiSuggestions('');
        vi.advanceTimersByTime(200);
        expect(emojisAffiches()).toEqual(['🧂', '🧅', '🧄', '🥦', '🥩', '🍎', '🥚', '🥛']);
    });

    it('les emojis de la base sont DÉDUPLIQUÉS et gardent leur ordre d\'apparition', () => {
        // 6 ingrédients contiennent « tomate » mais ne portent que 2 emojis distincts.
        const noms = DEFAULT_DB.filter(i => i.name.toLowerCase().includes('tomate'));
        const attendus = [...new Set(noms.map(i => i.emoji))];
        expect(noms.length).toBeGreaterThan(attendus.length); // le cas teste bien la déduplication

        window.updateEmojiSuggestions('tomate');
        vi.advanceTimersByTime(200);
        expect(emojisAffiches()).toEqual(attendus);
    });

    it('un clic sur un emoji proposé le sélectionne', () => {
        window.updateEmojiSuggestions('tomate');
        vi.advanceTimersByTime(200);
        const premier = document.querySelector('#emoji-suggestions .emoji-sug-btn');
        // `h()` branche par `addEventListener` (src/utils/dom.js:13), pas par `.onclick` :
        // il faut un vrai clic — ce qui reproduit aussi mieux le geste de Joel.
        premier.click();
        expect(document.getElementById('add-emoji').value).toBe(premier.textContent);
    });

    it('une recherche sans correspondance vide la grille — elle n\'invente rien', () => {
        window.updateEmojiSuggestions('xyzabc');
        vi.advanceTimersByTime(200);
        expect(emojisAffiches()).toEqual([]);
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // DÉFAUT RÉEL, figé tel quel (annoncé à Joel le 2026-07-31).
    // Dans le MÊME formulaire, deux comparaisons de texte différentes cohabitent :
    //   · la liste de résultats passe par `normalizeString` → insensible aux accents ;
    //   · cette grille d'emojis fait `name.toLowerCase().includes(...)` → SENSIBLE aux accents.
    // Conséquence visible : taper « epinard » sans accent propose bien « Épinards » dans la
    // liste, mais laisse la grille d'emojis VIDE. Corriger serait un changement de
    // comportement, donc une décision de Joel — pas un déplacement.
    // ─────────────────────────────────────────────────────────────────────────────
    it('DÉFAUT CONNU : la grille est SENSIBLE aux accents, contrairement à la liste de résultats', () => {
        window.updateEmojiSuggestions('épinard');
        vi.advanceTimersByTime(200);
        expect(emojisAffiches()).toEqual(['🥬']); // avec l'accent : trouvé

        window.updateEmojiSuggestions('epinard');
        vi.advanceTimersByTime(200);
        expect(emojisAffiches()).toEqual([]);     // sans l'accent : rien, alors que la liste, elle, trouve

        // Preuve que les deux moitiés du formulaire divergent bien sur la MÊME saisie :
        window.handleAddInput('epinard');
        const resultats = [...document.querySelectorAll('#add-results-list .add-res-item')];
        expect(resultats.length).toBeGreaterThan(0);
    });
});

describe('LOT 014 §A — showCategoryIndicator (caractérisation avant déplacement)', () => {
    beforeEach(() => {
        setupTestDOM('add');
        resetTestState(state, shoppingChecked, defaultAiConfig);
        vi.useFakeTimers();
    });

    afterEach(() => {
        window.switchView('add');
        vi.clearAllTimers();
        vi.useRealTimers();
    });

    const indicateur = () => document.getElementById('category-suggestion-indicator');

    // La fonction est purement interne (ni exportée, ni publiée sur window) : elle ne
    // s'observe qu'à travers ses appelants. C'est volontaire — on caractérise ce que Joel
    // voit, pas une signature.
    it('détection LOCALE : affiche « auto-détectée » en vert', () => {
        state.aiConfig.apiKey = '';        // pas d'IA : on isole la branche locale
        window.handleAddInput('carotte des sables');
        expect(indicateur().style.display).toBe('block');
        expect(indicateur().textContent).toBe('✨ Catégorie auto-détectée');
        expect(indicateur().style.color).toBe('var(--green)');
    });

    it('attente de l\'IA : affiche « Analyse par l\'IA… » en texte doux', () => {
        state.aiConfig.apiKey = 'CLE_TEST';
        // « xyzfoo » ne correspond à aucun nom exact ni à aucune règle de premier mot :
        // la déduction locale échoue, donc la branche « thinking » est la seule atteignable.
        window.handleAddInput('xyzfoo');
        expect(indicateur().style.display).toBe('block');
        expect(indicateur().textContent).toBe("✨ Analyse par l'IA...");
        expect(indicateur().style.color).toBe('var(--txt-soft)');
    });

    it('sans clé API, aucune attente d\'IA n\'est annoncée', () => {
        state.aiConfig.apiKey = '';
        window.handleAddInput('xyzfoo');
        expect(indicateur().style.display).toBe('none');
    });

    it('champ vidé : l\'indicateur disparaît', () => {
        state.aiConfig.apiKey = '';
        window.handleAddInput('carotte des sables');
        expect(indicateur().style.display).toBe('block');
        window.handleAddInput('');
        expect(indicateur().style.display).toBe('none');
    });

    it('catégorie choisie À LA MAIN : l\'indicateur disparaît', () => {
        state.aiConfig.apiKey = '';
        window.handleAddInput('carotte des sables');
        expect(indicateur().style.display).toBe('block');
        window._onManualCategoryChange();
        expect(indicateur().style.display).toBe('none');
    });

    it('moins de 3 caractères : pas d\'annonce d\'IA, même avec une clé', () => {
        state.aiConfig.apiKey = 'CLE_TEST';
        window.handleAddInput('xy');
        expect(indicateur().style.display).toBe('none');
    });
});
