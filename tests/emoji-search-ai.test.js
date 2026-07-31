/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { state, shoppingChecked, defaultAiConfig } from '../src/state.js';
import { setupTestDOM, resetTestState, mockFetchResponse, mockFetchNetworkError, readToasts } from './_helpers/dom-helpers.js';
import { MESSAGE_CLE_API_MANQUANTE } from '../src/constants.js';
import '../js/app.js';

// LOT 014, volet A — TESTS DE CARACTÉRISATION de `searchEmojiAI`, écrits AVANT le
// déplacement de la modale d'édition d'icône vers son module.
//
// Dernière zone aveugle de la liste du lot à n'avoir AUCUN test : appel réseau, publiée sur
// `window`, câblée en dur dans `index.html`. À ne pas confondre avec `searchEmojiAddAI`
// (`tests/add-emoji-search.test.js`), son JUMEAU du formulaire d'ajout : deux fonctions
// distinctes, deux champs, deux grilles, et — c'est le point — deux comportements qui
// divergent. Ces divergences sont FIGÉES ici, pas corrigées : ce sont des candidates du
// volet D, donc des décisions de Joel.

const reponseGemini = (texte) => ({ candidates: [{ content: { parts: [{ text: texte }] } }] });

const tuiles = () => [...document.querySelectorAll('#edit-emoji-grid .emoji-edit-btn')].map(b => b.textContent);

describe('LOT 014 §A — searchEmojiAI (caractérisation avant déplacement)', () => {
    beforeEach(() => {
        setupTestDOM('editEmoji');
        resetTestState(state, shoppingChecked, defaultAiConfig, { aiConfig: { ...defaultAiConfig(), apiKey: 'CLE_TEST' } });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('remplit la grille d\'édition avec les emojis reçus', async () => {
        document.getElementById('emoji-search-input').value = 'tomate';
        mockFetchResponse(reponseGemini('🍅 🍎 🥕'));

        await window.searchEmojiAI();

        expect(tuiles()).toEqual(['🍅', '🍎', '🥕']);
    });

    it('un clic sur une tuile applique l\'emoji à l\'ingrédient en cours d\'édition', async () => {
        state.ingredients = [{ id: 'ing_1', name: 'Pomme', emoji: '🍏', category: 'Fruits', inStock: true, inCart: false }];
        window.openEditEmoji?.('ing_1') ?? document.body; // fixe _currentEditingIngId si exposé
        document.getElementById('emoji-search-input').value = 'pomme';
        mockFetchResponse(reponseGemini('🍎'));

        await window.searchEmojiAI();
        document.querySelector('#edit-emoji-grid .emoji-edit-btn').click();

        expect(state.ingredients[0].emoji).toBe('🍎');
    });

    it('champ vide : ne lance AUCUN appel réseau', async () => {
        document.getElementById('emoji-search-input').value = '   ';
        const fetchMock = mockFetchResponse(reponseGemini('🍅'));

        await window.searchEmojiAI();

        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('sans le bouton dans la page, sort proprement — sans appel réseau NI erreur', async () => {
        // Le champ est REMPLI : sinon ce test sortirait par la garde « champ vide » et ne
        // prouverait rien de la garde sur le bouton (faux verrou trouvé par mutation).
        document.getElementById('emoji-search-input').value = 'tomate';
        document.getElementById('emoji-search-btn').remove();
        const fetchMock = mockFetchResponse(reponseGemini('🍅'));

        await expect(window.searchEmojiAI()).resolves.toBeUndefined();

        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('le bouton est désactivé pendant la recherche, puis RÉARMÉ à l\'identique', async () => {
        const btn = document.getElementById('emoji-search-btn');
        btn.innerHTML = '🔍';
        document.getElementById('emoji-search-input').value = 'tomate';

        let pendantLaRecherche;
        vi.stubGlobal('fetch', vi.fn(() => {
            pendantLaRecherche = { desactive: btn.disabled, contenu: btn.innerHTML };
            return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(reponseGemini('🍅')) });
        }));

        await window.searchEmojiAI();

        expect(pendantLaRecherche.desactive).toBe(true);
        expect(pendantLaRecherche.contenu).toContain('spinner-small');
        expect(btn.disabled).toBe(false);
        expect(btn.innerHTML).toBe('🔍'); // restauré à l'identique, pas vidé
    });

    it('panne réseau : le bouton est réarmé et Joel voit un message', async () => {
        document.getElementById('emoji-search-input').value = 'tomate';
        mockFetchNetworkError();

        await window.searchEmojiAI();

        expect(document.getElementById('emoji-search-btn').disabled).toBe(false);
        expect(readToasts().join(' ')).toContain('Erreur recherche emoji');
    });

    it('réponse sans aucun emoji : la grille est vidée, jamais remplie de n\'importe quoi', async () => {
        document.getElementById('emoji-search-input').value = 'tomate';
        mockFetchResponse(reponseGemini('desole je ne sais pas'));

        await window.searchEmojiAI();

        expect(tuiles()).toEqual([]);
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // DIVERGENCES avec son jumeau `searchEmojiAddAI`, relevées par la phase découverte
    // (§B11) et vérifiées ici sur pièce. La première a été CORRIGÉE par Joel le
    // 2026-07-31 ; la seconde reste figée telle quelle.
    // ─────────────────────────────────────────────────────────────────────────────

    it('sans clé API : dit EXACTEMENT ce qui manque, et n\'ouvre pas les Réglages (correctif '
       + 'décidé par Joel le 2026-07-31 — cet écran affichait « Erreur recherche emoji », un '
       + 'message d\'échec générique là où il ne manquait qu\'un réglage)', async () => {
        state.aiConfig.apiKey = '';
        document.getElementById('emoji-search-input').value = 'tomate';
        const fetchMock = mockFetchResponse(reponseGemini('🍅'));

        await window.searchEmojiAI();

        expect(fetchMock).not.toHaveBeenCalled();
        expect(readToasts().join(' ')).toContain(MESSAGE_CLE_API_MANQUANTE);
        expect(readToasts().join(' ')).not.toContain('Erreur recherche emoji');
        expect(document.getElementById('emoji-search-btn').disabled).toBe(false);
    });

    it('champ de recherche VIDE : toujours aucun message, même sans clé — inutile de réclamer '
       + 'une clé à quelqu\'un qui n\'a rien tapé', async () => {
        state.aiConfig.apiKey = '';
        document.getElementById('emoji-search-input').value = '   ';
        const fetchMock = mockFetchResponse(reponseGemini('🍅'));

        await window.searchEmojiAI();

        expect(fetchMock).not.toHaveBeenCalled();
        expect(readToasts()).toEqual([]);
    });

    // La phase découverte (§B11) annonçait « une regex qui rate des émojis ». Vérifié sur
    // pièce : c'est l'INVERSE. Elle n'en rate pas, elle les DÉCOUPE — ses plages de codes
    // écrites à la main attrapent chaque morceau d'un emoji composite séparément, là où le
    // `\p{Emoji_Presentation}` du jumeau prend l'emoji entier.
    it('DIVERGENCE 2 : sa regex DÉCOUPE les emojis composites en morceaux, dont des tuiles INVISIBLES', async () => {
        document.getElementById('emoji-search-input').value = 'famille';
        mockFetchResponse(reponseGemini('👨‍👩‍👧'));

        await window.searchEmojiAI();

        // Un seul emoji reçu → CINQ tuiles, dont deux liaisons de largeur nulle : Joel voit
        // trois personnages séparés et deux cases vides sur lesquelles il peut cliquer.
        expect(tuiles()).toEqual(['👨', '‍', '👩', '‍', '👧']);
    });

    it('DIVERGENCE 2 (suite) : un chiffre encadré se réduit à un caractère combinant seul', async () => {
        document.getElementById('emoji-search-input').value = 'un';
        mockFetchResponse(reponseGemini('1️⃣'));

        await window.searchEmojiAI();

        // Ni le « 1 », ni l'emoji complet : seulement l'encadrement, inaffichable seul.
        expect(tuiles()).toEqual(['⃣']);
    });
});
