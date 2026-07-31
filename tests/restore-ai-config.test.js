/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest';
import { state, defaultAiConfig } from '../src/state.js';
import { setupTestDOM } from './_helpers/dom-helpers.js';
// restoreAIConfig est exportée en ESM (js/app.js:556, bloc export{} réservé aux tests) —
// mais elle lit `document.getElementById` directement, donc elle exige quand même un DOM
// monté ; on passe par window pour rester cohérent avec le reste du fichier, la fonction
// étant AUSSI exposée (js/app.js — non, en réalité elle n'est PAS dans expose(), uniquement
// dans le bloc export{}). Import ESM nommé, cf. Option B corrigée de la fiche du lot.
import { restoreAIConfig } from '../js/app.js';

// LOT 013 — restoreAIConfig (js/app.js:990) n'avait qu'UN SEUL test avant ce lot
// (tests/cuisine-ssot.test.js:165, bout en bout sur les puces multi-valeurs). Le piège du
// LOT 008 (chantier 6) : une créativité VOLONTAIREMENT réglée à 0 est un minimum légitime du
// slider, pas une valeur absente — le code utilise déjà `??` (pas `||`) pour le préserver,
// mais rien ne le prouvait avant ce lot. Ce fichier fige ce point et le reste de la fonction.

describe('LOT 013 — restoreAIConfig', () => {
    beforeEach(() => {
        setupTestDOM(['aiSettings', 'systemInfo']);
    });

    it('créativité à 0 : reste 0, n\'est PAS remontée à 50 (piège `?? ` vs `||`, LOT 008)', () => {
        state.aiConfig = { ...defaultAiConfig(), creativity: 0 };
        restoreAIConfig();
        expect(document.getElementById('creativity-slider').value).toBe('0');
    });

    it('créativité absente (undefined) : retombe sur le défaut 50', () => {
        state.aiConfig = { ...defaultAiConfig() };
        delete state.aiConfig.creativity;
        restoreAIConfig();
        expect(document.getElementById('creativity-slider').value).toBe('50');
    });

    it('remplit la clé API, les exceptions et les exclusions depuis aiConfig', () => {
        state.aiConfig = { ...defaultAiConfig(), apiKey: 'AIzaTest', exceptions: 'sans gluten', exclusions: 'arachides' };
        restoreAIConfig();
        expect(document.getElementById('api-key-input').value).toBe('AIzaTest');
        expect(document.getElementById('ai-exceptions').value).toBe('sans gluten');
        expect(document.getElementById('ai-exclusions').value).toBe('arachides');
    });

    it('config vide (valeurs par défaut) : les champs texte restent vides, pas "undefined"', () => {
        state.aiConfig = defaultAiConfig();
        restoreAIConfig();
        expect(document.getElementById('api-key-input').value).toBe('');
        expect(document.getElementById('ai-exceptions').value).toBe('');
        expect(document.getElementById('ai-exclusions').value).toBe('');
    });

    it('rallume les puces d\'un champ TABLEAU (cuisines, régimes...) sans toucher aux autres', () => {
        state.aiConfig = { ...defaultAiConfig(), cuisines: ['italienne'] };
        restoreAIConfig();
        const italienne = document.querySelector('#ai-cuisines-chips [data-val="italienne"]');
        const japonaise = document.querySelector('#ai-cuisines-chips [data-val="japonaise"]');
        expect(italienne.classList.contains('active')).toBe(true);
        expect(japonaise.classList.contains('active')).toBe(false);
    });

    it('rallume la puce d\'un champ VALEUR SIMPLE (ex. meal) sans passer par la branche tableau', () => {
        state.aiConfig = { ...defaultAiConfig(), meal: 'rapide' };
        restoreAIConfig();
        const rapide = document.querySelector('#ai-meal-chips [data-val="rapide"]');
        const mijote = document.querySelector('#ai-meal-chips [data-val="mijote"]');
        expect(rapide.classList.contains('active')).toBe(true);
        expect(mijote.classList.contains('active')).toBe(false);
    });

    it('met à jour le résumé "meal · ppl pers." (updateAiCtaSummary)', () => {
        state.aiConfig = { ...defaultAiConfig(), meal: 'rapide', ppl: '4' };
        restoreAIConfig();
        expect(document.getElementById('ai-cta-summary').textContent).toBe('rapide · 4 pers.');
    });
});
