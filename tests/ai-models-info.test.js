/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { state, sanitizeGlobalState, defaultAiConfig } from '../src/state.js';
import { AI_ROLES } from '../src/constants.js';
import { openModal, renderAiModelsInfo, saveApiKey } from '../js/app.js';

// LOT 010 (arbitrage Joel du 2026-07-29, §6) : le menu « Moteur Tâches Complexes »
// choisissait un modèle qui était de toute façon écrasé à chaque démarrage
// (sanitizeGlobalState force les modèles depuis AI_ROLES). Décision de Joel :
// supprimer le menu, le remplacer par une information en lecture seule dérivée de
// la SSOT — aucun nom de modèle jamais écrit en dur dans le HTML.

const INDEX_HTML = readFileSync(resolve(__dirname, '../index.html'), 'utf8');

describe('LOT 010 / §6 — menu de modèles supprimé, info en lecture seule', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div class="modal-overlay" id="modal-api-config">
                <input id="api-key-input">
                <p id="api-models-info"></p>
            </div>
        `;
        state.aiConfig = defaultAiConfig();
        sanitizeGlobalState();
    });

    it('le select « Moteur Tâches Complexes » a disparu du HTML', () => {
        expect(INDEX_HTML).not.toContain('id="api-model-complex"');
        expect(INDEX_HTML).not.toContain('Moteur Tâches Complexes');
    });

    it('aucun nom de modèle n\'est écrit en dur dans le HTML (SSOT)', () => {
        expect(INDEX_HTML).not.toContain('gemini-3.6-flash');
        expect(INDEX_HTML).not.toContain('gemini-3.5-flash');
    });

    it('le conteneur d\'information en lecture seule existe', () => {
        expect(INDEX_HTML).toContain('id="api-models-info"');
    });

    it('affiche les modèles réellement utilisés, dérivés de la SSOT', () => {
        renderAiModelsInfo();

        const texte = document.getElementById('api-models-info').textContent;
        expect(texte).toContain(AI_ROLES.REASONING);
        expect(texte).toContain(AI_ROLES.FAST);
        expect(texte).toContain('Recettes, nutrition et transformation de texte');
        expect(texte).toContain('Catégories et emojis');
    });

    it('se remplit automatiquement à l\'ouverture du modal', () => {
        openModal('modal-api-config');

        expect(document.getElementById('api-models-info').textContent).toContain(AI_ROLES.REASONING);
    });

    it('ne casse pas si le conteneur est absent de la page', () => {
        document.body.innerHTML = '';
        expect(() => renderAiModelsInfo()).not.toThrow();
    });

    it('reste à jour même si `state.aiConfig.models` a été altéré, car sanitizeGlobalState ' +
       'le réaligne à chaque chargement (comportement volontaire, inchangé par ce chantier)', () => {
        state.aiConfig.models.recipeGeneration = 'gemini-2.0-flash-perime';
        sanitizeGlobalState();

        renderAiModelsInfo();

        expect(document.getElementById('api-models-info').textContent).toContain(AI_ROLES.REASONING);
        expect(document.getElementById('api-models-info').textContent).not.toContain('perime');
    });
});

describe('LOT 010 / §6 — l\'enregistrement de la clé API continue de fonctionner ' +
    '(non-régression explicitement demandée par l\'audit de spec)', () => {
    beforeEach(() => {
        document.body.innerHTML = `
            <div class="modal-overlay open" id="modal-api-config">
                <input id="api-key-input" value="AIzaTestKey123456789">
                <p id="api-models-info"></p>
            </div>
        `;
        state.aiConfig = defaultAiConfig();
        sanitizeGlobalState();
    });

    it('sauvegarde la clé API sans qu\'aucun select de modèle n\'existe sur la page', () => {
        saveApiKey();

        expect(state.aiConfig.apiKey).toBe('AIzaTestKey123456789');
    });

    it('une clé vide est refusée, comportement inchangé', () => {
        document.getElementById('api-key-input').value = '';

        saveApiKey();

        expect(state.aiConfig.apiKey).toBe('');
    });

    it('ferme le modal après sauvegarde réussie', () => {
        saveApiKey();

        expect(document.getElementById('modal-api-config').classList.contains('open')).toBe(false);
    });
});
