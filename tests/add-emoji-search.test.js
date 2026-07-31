/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { state, shoppingChecked, defaultAiConfig } from '../src/state.js';
import { setupTestDOM, resetTestState, mockFetchResponse, mockFetchNetworkError, readToasts } from './_helpers/dom-helpers.js';
// searchEmojiAddAI n'est exposée que sur `window` (js/app.js:2795, bloc expose()) — jamais
// dans le bloc `export {}` réservé aux tests. C'est l'Option B du LOT 013 : import à effet de
// bord, puis accès par window.*, patron déjà éprouvé par tests/export-clipboard.test.js.
import '../js/app.js';

// LOT 013 — searchEmojiAddAI (js/app.js:2295) n'avait AUCUN test avant ce lot.

function reponseGemini(texte) {
    return { candidates: [{ content: { parts: [{ text: texte }] } }] };
}

describe('LOT 013 — searchEmojiAddAI (js/app.js, accessible via window)', () => {
    beforeEach(() => {
        setupTestDOM('add');
        resetTestState(state, shoppingChecked, defaultAiConfig, { aiConfig: { ...defaultAiConfig(), apiKey: 'CLE_TEST' } });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('happy path : peuple la grille avec les emojis reçus, uniques', async () => {
        document.getElementById('add-emoji-search').value = 'tomate';
        mockFetchResponse(reponseGemini('🍅 🍅 🍎'));

        await window.searchEmojiAddAI();

        const spans = [...document.querySelectorAll('#emoji-suggestions .emoji-sug-btn')].map(s => s.textContent);
        expect(spans.sort()).toEqual(['🍅', '🍎']);
    });

    it('repli sur le nom de l\'ingrédient si le champ de recherche d\'emoji est vide', async () => {
        document.getElementById('add-emoji-search').value = '';
        document.getElementById('add-name').value = 'Courgette';
        const fetchMock = mockFetchResponse(reponseGemini('🥒'));

        await window.searchEmojiAddAI();

        expect(fetchMock).toHaveBeenCalled();
        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(JSON.stringify(body)).toContain('Courgette');
    });

    // LOT 014, volet C — la valeur saisie est interpolée ENTRE GUILLEMETS dans la consigne
    // envoyée à l'IA. Un `"` tapé cassait la consigne ; un texte construit exprès pouvait la
    // réécrire. Ce test vérifie que l'échappement est réellement appliqué AU PROMPT.
    it('§C — un guillemet saisi est échappé dans la consigne envoyée à l\'IA', async () => {
        document.getElementById('add-emoji-search').value = 'tomate "cerise"';
        const fetchMock = mockFetchResponse(reponseGemini('🍅'));

        await window.searchEmojiAddAI();

        const prompt = JSON.parse(fetchMock.mock.calls[0][1].body).contents[0].parts[0].text;
        expect(prompt).toContain('tomate \\"cerise\\"');
        expect(prompt).not.toContain('"cerise"'); // jamais la forme brute, qui casse la consigne
    });

    it('ni recherche ni nom : ne fait AUCUN appel réseau', async () => {
        document.getElementById('add-emoji-search').value = '';
        document.getElementById('add-name').value = '';
        const fetchMock = mockFetchResponse(reponseGemini('🍅'));

        await window.searchEmojiAddAI();

        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('sans clé API : ne fait AUCUN appel réseau, même avec un texte saisi — sort AVANT '
       + 'même de désactiver le bouton (pas seulement grâce à la garde de callAI en aval)', async () => {
        state.aiConfig.apiKey = '';
        document.getElementById('add-emoji-search').value = 'tomate';
        const fetchMock = mockFetchResponse(reponseGemini('🍅'));
        const btn = document.getElementById('add-emoji-search-btn');
        btn.textContent = '✨';

        await window.searchEmojiAddAI();

        expect(fetchMock).not.toHaveBeenCalled();
        // Distingue la garde PROPRE de searchEmojiAddAI (retour avant toute mutation du
        // DOM, js/app.js:2308) d'une garde en aval de callAI qui produirait le même résultat
        // réseau mais en passant par le bouton désactivé "..." puis restauré (audit
        // adversarial du diff : une mutation qui retire CETTE garde précise reste masquée
        // par celle de callAI si on ne vérifie que l'absence d'appel fetch).
        expect(btn.textContent).toBe('✨');
    });

    it('zéro emoji dans la réponse : grille vide, pas de plantage, pas d\'auto-sélection', async () => {
        document.getElementById('add-emoji-search').value = 'tomate';
        document.getElementById('add-emoji').value = '';
        mockFetchResponse(reponseGemini('Aucun symbole pertinent trouvé, désolé.'));

        await expect(window.searchEmojiAddAI()).resolves.not.toThrow();

        expect(document.querySelectorAll('#emoji-suggestions .emoji-sug-btn').length).toBe(0);
        expect(document.getElementById('add-emoji').value).toBe('');
    });

    it('auto-sélectionne le PREMIER emoji reçu seulement si #add-emoji est vide', async () => {
        document.getElementById('add-emoji-search').value = 'tomate';
        document.getElementById('add-emoji').value = '';
        mockFetchResponse(reponseGemini('🍅 🍎 🥕'));

        await window.searchEmojiAddAI();

        expect(document.getElementById('add-emoji').value).toBe('🍅');
    });

    it('ne remplace PAS un emoji déjà choisi manuellement', async () => {
        document.getElementById('add-emoji-search').value = 'tomate';
        document.getElementById('add-emoji').value = '🥬';
        mockFetchResponse(reponseGemini('🍅 🍎'));

        await window.searchEmojiAddAI();

        expect(document.getElementById('add-emoji').value).toBe('🥬');
    });

    it('une panne réseau affiche un toast d\'erreur explicite', async () => {
        document.getElementById('add-emoji-search').value = 'tomate';
        mockFetchNetworkError('Panne réseau');

        await window.searchEmojiAddAI();

        expect(readToasts().some(t => t.includes('Erreur emoji'))).toBe(true);
    });

    it('le bouton revient toujours à ✨ (succès ET échec) — jamais bloqué sur "..."', async () => {
        document.getElementById('add-emoji-search').value = 'tomate';
        mockFetchResponse(reponseGemini('🍅'));
        await window.searchEmojiAddAI();
        expect(document.getElementById('add-emoji-search-btn').textContent).toBe('✨');

        mockFetchNetworkError();
        await window.searchEmojiAddAI();
        expect(document.getElementById('add-emoji-search-btn').textContent).toBe('✨');
    });
});
