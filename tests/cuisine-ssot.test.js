/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { state, sanitizeGlobalState, defaultAiConfig } from '../src/state.js';
import { buildSyncDocument } from '../src/services/firebase.js';
import { generateRecipes } from '../src/services/gemini.js';
import { toggleAiChip, restoreAIConfig } from '../js/app.js';

// LOT 010 — casse C5 : le filtre « Type de cuisine » n'arrivait jamais à l'IA.
// Les puces écrivaient `aiConfig.cuisine`, le prompt lisait `aiConfig.cuisines`.
// Arbitrage de Joel (2026-07-30) : SSOT strict — `cuisines` est l'unique champ
// canonique, l'ancien `cuisine` est versé dedans puis SUPPRIMÉ sur tous les chemins.

const INDEX_HTML = readFileSync(resolve(__dirname, '../index.html'), 'utf8');

function resetAiConfig(extra = {}) {
    state.aiConfig = { ...defaultAiConfig(), ...extra };
}

describe('LOT 010 / C5 — champ canonique unique `cuisines`', () => {
    beforeEach(() => {
        state.ingredients = [{ id: 'i1', name: 'Pomme', category: 'Fruits', emoji: '🍎' }];
        resetAiConfig();
    });

    describe('Migration douce (sanitizeGlobalState)', () => {
        it('verse la valeur de l\'ancien `cuisine` dans `cuisines` puis supprime `cuisine`', () => {
            resetAiConfig({ cuisine: ['italienne'], cuisines: [] });

            sanitizeGlobalState();

            expect(state.aiConfig.cuisines).toEqual(['italienne']);
            expect('cuisine' in state.aiConfig).toBe(false);
        });

        it('est idempotente : un second passage ne change plus rien', () => {
            resetAiConfig({ cuisine: ['libanaise'] });

            sanitizeGlobalState();
            const apresPremierPassage = JSON.stringify(state.aiConfig);
            sanitizeGlobalState();

            expect(JSON.stringify(state.aiConfig)).toBe(apresPremierPassage);
            expect(state.aiConfig.cuisines).toEqual(['libanaise']);
        });

        it('ne fait rien sur une config déjà canonique (cas du démarrage courant)', () => {
            resetAiConfig({ cuisines: ['asiatique'] });

            sanitizeGlobalState();

            expect(state.aiConfig.cuisines).toEqual(['asiatique']);
            expect('cuisine' in state.aiConfig).toBe(false);
        });

        it('collision des deux champs : l\'ancien `cuisine` gagne (arbitrage Joel — c\'est le ' +
           'champ que l\'interface cassée écrivait, donc le choix le plus récent)', () => {
            resetAiConfig({ cuisine: ['italienne'], cuisines: ['française'] });

            sanitizeGlobalState();

            expect(state.aiConfig.cuisines).toEqual(['italienne']);
            expect('cuisine' in state.aiConfig).toBe(false);
        });

        it('un ancien `cuisine` corrompu (non tableau) est supprimé sans écraser `cuisines`', () => {
            resetAiConfig({ cuisine: 'italienne', cuisines: ['espagnole'] });

            sanitizeGlobalState();

            expect(state.aiConfig.cuisines).toEqual(['espagnole']);
            expect('cuisine' in state.aiConfig).toBe(false);
        });

        it('garantit toujours un tableau dans `cuisines`, même si la donnée reçue est corrompue', () => {
            resetAiConfig({ cuisines: 'italienne' });

            sanitizeGlobalState();

            expect(state.aiConfig.cuisines).toEqual([]);
        });

        it('survit à une config IA totalement absente (donnée externe minimale)', () => {
            state.aiConfig = null;

            sanitizeGlobalState();

            expect(Array.isArray(state.aiConfig.cuisines)).toBe(true);
            expect('cuisine' in state.aiConfig).toBe(false);
        });
    });

    describe('Étanchéité du cloud', () => {
        it('le document envoyé au cloud ne contient JAMAIS `cuisine` — sans quoi le champ ' +
           'mort ressusciterait sur l\'autre appareil', () => {
            resetAiConfig({ cuisine: ['italienne'] });
            sanitizeGlobalState();

            const doc = buildSyncDocument(state, []);

            expect('cuisine' in doc.aiConfig).toBe(false);
            expect(doc.aiConfig.cuisines).toEqual(['italienne']);
        });
    });

    describe('Transmission réelle à l\'IA', () => {
        beforeEach(() => {
            vi.stubGlobal('fetch', vi.fn());
            fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({
                    candidates: [{ content: { parts: [{ text: '[]' }] } }]
                })
            });
        });

        it('le prompt généré contient la cuisine choisie', async () => {
            const aiConfig = { ...defaultAiConfig(), cuisines: ['italienne'], ppl: '2' };

            await generateRecipes('MOCK_KEY', [], aiConfig, [], []);

            const body = fetch.mock.calls[0][1].body;
            expect(body).toContain('italienne');
            expect(body).toContain('CUISINE : italienne');
        });

        it('sans cuisine choisie, le prompt reste « Libre » (comportement d\'origine)', async () => {
            const aiConfig = { ...defaultAiConfig(), cuisines: [], ppl: '2' };

            await generateRecipes('MOCK_KEY', [], aiConfig, [], []);

            expect(fetch.mock.calls[0][1].body).toContain('CUISINE : Libre');
        });
    });

    describe('Alignement interface ↔ champ (le piège du renommage)', () => {
        it('index.html n\'écrit plus que dans `cuisines`', () => {
            expect(INDEX_HTML).not.toContain("toggleAiChip('cuisine',");
            expect(INDEX_HTML).toContain("toggleAiChip('cuisines',");
        });

        it('l\'id de la rangée de puces est aligné sur le nom du champ — `restoreAIConfig` ' +
           'en déduit le champ à relire, un id périmé rendrait les puces amnésiques', () => {
            expect(INDEX_HTML).not.toContain('id="ai-cuisine-chips"');
            expect(INDEX_HTML).toContain('id="ai-cuisines-chips"');
        });

        it('bout en bout : cliquer une puce puis recharger la rallume', () => {
            document.body.innerHTML = `
                <div class="ai-settings">
                    <div class="chips-row" id="ai-cuisines-chips">
                        <div class="chip" data-val="italienne">Italienne</div>
                        <div class="chip" data-val="française">Française</div>
                    </div>
                </div>`;
            const italienne = document.querySelector('[data-val="italienne"]');

            // 1. L'utilisateur clique la puce « Italienne ».
            toggleAiChip('cuisines', italienne);
            expect(state.aiConfig.cuisines).toEqual(['italienne']);

            // 2. Rechargement : le DOM repart éteint, seul l'état persiste.
            document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
            restoreAIConfig();

            expect(italienne.classList.contains('active')).toBe(true);
            expect(document.querySelector('[data-val="française"]').classList.contains('active')).toBe(false);
        });
    });
});
