/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { generateSuggestions, transformRecipeAI, analyzeNutrition } from '../js/app.js';
import { callAI } from '../src/services/gemini.js';
import { state, shoppingChecked, defaultAiConfig } from '../src/state.js';
import { MESSAGE_CLE_API_MANQUANTE } from '../src/constants.js';
import { setupTestDOM, readToasts, resetTestState } from './_helpers/dom-helpers.js';

// LOT 014 — « il manque la clé Gemini » s'annonçait de QUATRE façons différentes selon
// l'écran. Joel a tranché le 2026-07-31 : un seul texte partout, mais chaque écran garde SA
// réaction (ouvrir les Réglages, ou seulement prévenir). Ces tests verrouillent les deux
// moitiés de la décision — le texte unique ET les réactions qui restent distinctes.

// ─────────────────────────────────────────────────────────────────────────
// 1. Le verrou anti-récidive : plus aucun texte de clé manquante écrit en dur.
// ─────────────────────────────────────────────────────────────────────────

const MOTIF_MESSAGE_CLE = /Clé API[^'"`\n]{0,40}(?:requise|manquante)/i;

function fichiersJsApplicatifs(dossier, acc = []) {
    for (const entree of readdirSync(dossier, { withFileTypes: true })) {
        const chemin = join(dossier, entree.name);
        if (entree.isDirectory()) fichiersJsApplicatifs(chemin, acc);
        else if (entree.name.endsWith('.js')) acc.push(chemin);
    }
    return acc;
}

const RACINE = process.cwd();
const FICHIERS = [...fichiersJsApplicatifs(resolve(RACINE, 'src')), resolve(RACINE, 'js', 'app.js')];
const SSOT = resolve(RACINE, 'src', 'constants.js');

describe('SSOT du message de clé API — le verrou de source', () => {
    // Garde anti-vide : sans elle, tout ce bloc passerait au vert le jour où le scan ne
    // trouverait plus un seul fichier, ou où le motif cesserait de reconnaître le message.
    it('le scan porte sur un inventaire réel et le motif reconnaît bien le message', () => {
        expect(FICHIERS.length).toBeGreaterThanOrEqual(15);
        expect(MESSAGE_CLE_API_MANQUANTE).toMatch(MOTIF_MESSAGE_CLE);
        expect(readFileSync(SSOT, 'utf8')).toMatch(MOTIF_MESSAGE_CLE);
    });

    it('src/constants.js est le SEUL fichier qui écrit ce message', () => {
        const coupables = FICHIERS
            .filter(f => f !== SSOT)
            .filter(f => MOTIF_MESSAGE_CLE.test(readFileSync(f, 'utf8')))
            .map(f => f.slice(RACINE.length + 1).replace(/\\/g, '/'));

        expect(coupables).toEqual([]);
    });
});

// ─────────────────────────────────────────────────────────────────────────
// 2. Les quatre sites : même texte, réactions distinctes.
// ─────────────────────────────────────────────────────────────────────────

describe('SSOT du message de clé API — ce que Joel voit', () => {
    beforeEach(() => {
        setupTestDOM(['aiResults', 'pasteRecipe', 'recipeDetail']);
        document.body.insertAdjacentHTML('beforeend', '<div id="modal-api-config"></div>');
        resetTestState(state, shoppingChecked, defaultAiConfig);
        state.aiConfig.apiKey = '';
        vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        document.body.innerHTML = '';
    });

    const reglagesOuverts = () => document.getElementById('modal-api-config').classList.contains('open');

    it('générateur de recettes : prévient ET ouvre les Réglages', async () => {
        await generateSuggestions();

        expect(readToasts()).toContain(MESSAGE_CLE_API_MANQUANTE);
        expect(reglagesOuverts()).toBe(true);
        expect(fetch).not.toHaveBeenCalled();
    });

    it('transformation d\'une recette collée : prévient ET ouvre les Réglages', async () => {
        document.getElementById('paste-content').value = 'Ma recette : des pâtes, du beurre.';

        await transformRecipeAI();

        expect(readToasts()).toContain(MESSAGE_CLE_API_MANQUANTE);
        expect(reglagesOuverts()).toBe(true);
        expect(fetch).not.toHaveBeenCalled();
    });

    it('analyse nutritionnelle : prévient SANS ouvrir les Réglages (la recette ouverte '
       + 'resterait cachée derrière) — l\'action de chaque site est préservée', async () => {
        await analyzeNutrition(
            { name: 'Poulet rôti', people: 2, ingredients: [{ name: 'Poulet', amount: '1' }], steps: ['Cuire'] },
            'ai', null
        );

        expect(readToasts()).toContain(MESSAGE_CLE_API_MANQUANTE);
        expect(reglagesOuverts()).toBe(false);
        expect(fetch).not.toHaveBeenCalled();
    });

    it('la garde de dernier recours (callAI) refuse avec le MÊME texte', async () => {
        await expect(callAI('un prompt', '')).rejects.toThrow(MESSAGE_CLE_API_MANQUANTE);
        expect(fetch).not.toHaveBeenCalled();
    });
});
