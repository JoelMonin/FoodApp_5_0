/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { state, shoppingChecked, defaultAiConfig } from '../src/state.js';
import { setupTestDOM, resetTestState } from './_helpers/dom-helpers.js';
// handleAddInput n'est exposée que sur `window` (js/app.js:2795, bloc expose()) — comme
// searchEmojiAddAI, jamais dans le bloc `export {}` réservé aux tests.
import '../js/app.js';

// LOT 013 — handleAddInput (js/app.js:2089) n'avait AUCUN test avant ce lot. C'est la
// fonction la plus coûteuse du périmètre : double temporisation (200 ms grille d'emojis,
// 800 ms suggestion IA) et un jeton anti-course (`_aiSuggestGenId`) qui protège contre
// l'inversion de deux réponses IA en vol (LOT 006, acquis #14).
//
// "xyzfoo"/"xyzbar" sont choisis parce qu'ils ne matchent NI un nom exact de DEFAULT_DB NI
// aucune règle de premier mot de guessCategoryLocally — ils forcent le passage par l'IA.
// "Tomate" (exact, DEFAULT_DB) et "tomate surprise" (premier mot seulement) couvrent les
// deux branches de la détection locale.

async function flush(n = 15) {
    for (let i = 0; i < n; i++) await Promise.resolve();
}

function fetchOk(body) {
    return { ok: true, status: 200, json: () => Promise.resolve(body) };
}

function geminiEnveloppe(objetJson) {
    return { candidates: [{ content: { parts: [{ text: JSON.stringify(objetJson) }] } }] };
}

describe('LOT 013 — handleAddInput (js/app.js, accessible via window)', () => {
    beforeEach(() => {
        setupTestDOM('add');
        resetTestState(state, shoppingChecked, defaultAiConfig, { aiConfig: { ...defaultAiConfig(), apiKey: 'CLE_TEST' } });
        vi.useFakeTimers();
    });

    afterEach(() => {
        // `_isManualCategory`/`_localCategoryFill` sont des variables de MODULE (js/app.js),
        // sans trappe de reset dédiée (P10 relevé en découverte du LOT 013) — seule
        // `switchView('add')` les remet à zéro (js/app.js:628 + renderAdd() via
        // renderCurrentView). Sans cet appel, un test qui active le mode manuel
        // contaminerait tous les suivants du même fichier.
        window.switchView('add');
        vi.clearAllTimers();
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('champ vidé : réinitialise résultats, emoji, catégorie et indicateur', () => {
        document.getElementById('add-results-list').innerHTML = '<div>reste d\'un tour précédent</div>';
        document.getElementById('add-emoji').value = '🍅';
        document.getElementById('add-category').value = 'Légumes';
        document.getElementById('category-suggestion-indicator').style.display = 'block';

        window.handleAddInput('');

        expect(document.getElementById('add-results-list').children.length).toBe(0);
        expect(document.getElementById('add-emoji').value).toBe('');
        expect(document.getElementById('add-category').value).toBe('');
        expect(document.getElementById('category-suggestion-indicator').style.display).toBe('none');
    });

    it('champ vidé (espaces uniquement) : traité comme vide', () => {
        document.getElementById('add-emoji').value = '🍅';
        window.handleAddInput('   ');
        expect(document.getElementById('add-emoji').value).toBe('');
    });

    it('autocomplétion DB : propose jusqu\'à 5 correspondances, immédiatement (pas de temporisation)', () => {
        window.handleAddInput('tomate');
        const items = [...document.querySelectorAll('#add-results-list .add-res-item')];
        expect(items.length).toBeGreaterThan(0);
        expect(items.length).toBeLessThanOrEqual(5);
        expect(items.some(i => i.textContent.includes('Tomate'))).toBe(true);
    });

    it('sous le seuil de 3 caractères : pas d\'appel IA programmé, même avec une clé API', async () => {
        window.handleAddInput('to');
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        await vi.advanceTimersByTimeAsync(800);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('détection locale — correspondance EXACTE : catégorie et emoji appliqués tout de suite, '
       + 'et l\'IA n\'est PAS appelée', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        window.handleAddInput('Tomate');

        expect(document.getElementById('add-category').value).toBe('Légumes');
        expect(document.getElementById('add-emoji').value).toBe('🍅');
        expect(document.getElementById('category-suggestion-indicator').textContent).toMatch(/auto-détectée/);

        await vi.advanceTimersByTimeAsync(800);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('détection locale — correspondance par PREMIER MOT (pas d\'entrée exacte) : catégorie '
       + 'posée tout de suite, mais l\'IA reste appelée ensuite et peut la réécraser '
       + '(acquis LOT 006 : "l\'IA écrase toujours la détection locale")', async () => {
        window.handleAddInput('tomate surprise'); // "tomate" = 1er mot de la liste "légumes"
        expect(document.getElementById('add-category').value).toBe('Légumes');

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fetchOk(geminiEnveloppe({ category: 'Plats & Préparations', emojis: ['🍽️'] }))));
        await vi.advanceTimersByTimeAsync(800);
        await flush();

        expect(document.getElementById('add-category').value).toBe('Plats & Préparations');
    });

    it('catégorie choisie manuellement (_onManualCategoryChange) : la détection locale ET '
       + 'l\'IA sont court-circuitées, la valeur de l\'utilisateur n\'est jamais touchée', async () => {
        window._onManualCategoryChange();
        document.getElementById('add-category').value = 'Épices sèches';

        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        window.handleAddInput('tomate'); // aurait normalement déclenché la détection locale

        expect(document.getElementById('add-category').value).toBe('Épices sèches');
        await vi.advanceTimersByTimeAsync(800);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('réponse IA sans JSON exploitable : n\'écrase rien, remet juste l\'indicateur à zéro '
       + '(pas de plantage)', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fetchOk({ candidates: [{ content: { parts: [{ text: 'Désolé, je ne sais pas.' }] } }] })));

        window.handleAddInput('xyzfoo');
        await vi.advanceTimersByTimeAsync(800);
        await flush();

        expect(document.getElementById('add-category').value).toBe('');
        expect(document.getElementById('category-suggestion-indicator').style.display).toBe('none');
    });

    it('panne réseau pendant l\'appel IA : n\'écrase rien, ne relève pas d\'exception '
       + 'observable par l\'appelant', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

        window.handleAddInput('xyzfoo');
        await expect(vi.advanceTimersByTimeAsync(800)).resolves.not.toThrow();
        await flush();

        expect(document.getElementById('add-category').value).toBe('');
    });

    it('JETON ANTI-COURSE : une réponse IA périmée, résolue APRÈS la réponse fraîche, '
       + 'est ignorée — la saisie la plus récente gagne toujours (acquis LOT 006, #14)', async () => {
        const resolveurs = [];
        vi.stubGlobal('fetch', vi.fn(() => new Promise(resolve => resolveurs.push(resolve))));

        // Frappe n°1 : "xyzfoo" — programme l'appel IA n°1.
        window.handleAddInput('xyzfoo');
        await vi.advanceTimersByTimeAsync(800); // le timer n°1 se déclenche, l'appel n°1 part (en vol)

        // Avant que la réponse n°1 revienne, l'utilisateur corrige sa saisie.
        window.handleAddInput('xyzbar');
        await vi.advanceTimersByTimeAsync(800); // le timer n°2 se déclenche, l'appel n°2 part (en vol)

        expect(resolveurs.length).toBe(2);

        // La réponse n°1 (périmée) revient EN DERNIER — c'est le scénario que le jeton protège.
        resolveurs[1](fetchOk(geminiEnveloppe({ category: 'Produits laitiers', emojis: ['🧀'] }))); // n°2 (frais) d'abord
        await flush();
        resolveurs[0](fetchOk(geminiEnveloppe({ category: 'Épices sèches', emojis: ['🌶️'] }))); // n°1 (périmé) ensuite
        await flush();

        // Le résultat visible doit être celui de la saisie ENCORE PRÉSENTE ("xyzbar"), jamais
        // celui de "xyzfoo" qui a répondu en dernier.
        expect(document.getElementById('add-category').value).toBe('Produits laitiers');
        expect(document.getElementById('add-emoji').value).toBe('🧀');
        // Sélecteur d'ATTRIBUT PAR VALEUR évité ici (piège P13 — jsdom ne matche pas un
        // attribut de valeur astrale entre guillemets) : présence + lecture JS, pas requête.
        const emojisAffiches = [...document.querySelectorAll('#emoji-suggestions [data-emoji]')].map(e => e.dataset.emoji);
        expect(emojisAffiches).not.toContain('🌶️');
    });

    it('ajoute les emojis proposés par l\'IA à la grille, avec leur ancre data-emoji '
       + '(dédoublonnage NON prouvable ici — voir commentaire)', async () => {
        // La production dédoublonne via `container.querySelector('[data-emoji="${e}"]')`
        // (js/app.js:2180) AVANT d'ajouter chaque emoji. Vérifié empiriquement en découverte
        // de ce lot (piège P13, fiche du lot) : le moteur de sélecteurs CSS de jsdom (nwsapi)
        // ne matche PAS un sélecteur d'attribut entre guillemets dont la valeur contient un
        // caractère astral (hors plan multilingue de base — le cas de la plupart des emojis
        // alimentaires, dont 🥕 U+1F955), alors qu'un vrai navigateur le fait correctement.
        // Sous jsdom, `handleAddInput` ne peut donc PAS empêcher un doublon : ce test ne
        // prétend PAS prouver le dédoublonnage (jsdom en est incapable), seulement que les
        // emojis reçus atteignent bien la grille — le dédoublonnage exact reste une preuve
        // navigateur, consignée comme telle dans la matrice de couverture.
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fetchOk(geminiEnveloppe({ category: 'Légumes', emojis: ['🥕', '🌿'] }))));

        window.handleAddInput('xyzfoo');
        await vi.advanceTimersByTimeAsync(800);
        await flush();

        const emojis = [...document.querySelectorAll('#emoji-suggestions [data-emoji]')].map(e => e.dataset.emoji);
        expect(emojis).toContain('🥕');
        expect(emojis).toContain('🌿');
    });
});
