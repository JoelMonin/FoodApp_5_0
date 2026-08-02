/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { state, defaultAiConfig } from '../src/state.js';
import { generateRecipes } from '../src/services/gemini.js';
import { toggleAiChip, restoreAIConfig } from '../js/app.js';

// LOT 027 — la puce « Keto » rejoint les options diététiques. La découverte a montré
// qu'AUCUNE liste blanche des régimes n'existe : le `data-val` posé dans index.html est
// LA valeur stockée, synchronisée ET envoyée telle quelle à l'IA (ligne « RÉGIMES &
// EXCLUSIONS » du prompt). Ces tests sont donc le seul verrou entre une faute de frappe
// dans la page et un prompt silencieusement faux — et les premiers à couvrir cette ligne.

const INDEX_HTML = readFileSync(resolve(__dirname, '../index.html'), 'utf8');

describe('LOT 027 — option diététique Keto', () => {
    beforeEach(() => {
        state.aiConfig = { ...defaultAiConfig() };
    });

    describe('La puce dans la vraie page', () => {
        it('la rangée diététique porte exactement les 6 valeurs, `keto` en dernier', () => {
            const vals = [...INDEX_HTML.matchAll(
                /data-val="([^"]+)"\s+onclick="toggleAiChip\('diet',this\)"/g
            )].map(m => m[1]);

            expect(vals).toEqual([
                'sans-cereales', 'sans-gluten', 'sans-laitiers', 'vegetarien', 'vegan', 'keto',
            ]);
        });

        it('valeur, groupe et libellé sont soudés sur la même puce — un écart entre les ' +
           'trois ferait mentir l\'écran ou le prompt', () => {
            expect(INDEX_HTML).toContain(
                `data-val="keto" onclick="toggleAiChip('diet',this)">Keto</div>`
            );
        });
    });

    describe('Bout en bout : clic → état → rechargement', () => {
        it('cliquer « Keto » puis recharger la rallume, sans toucher ses voisines', () => {
            document.body.innerHTML = `
                <div class="ai-settings">
                    <div class="chips-row" id="ai-diet-chips">
                        <div class="chip" data-val="vegan">Vegan</div>
                        <div class="chip" data-val="keto">Keto</div>
                    </div>
                </div>`;
            const keto = document.querySelector('[data-val="keto"]');

            // 1. L'utilisateur clique la puce « Keto ».
            toggleAiChip('diet', keto);
            expect(state.aiConfig.diet).toEqual(['keto']);

            // 2. Rechargement : le DOM repart éteint, seul l'état persiste.
            document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
            restoreAIConfig();

            expect(keto.classList.contains('active')).toBe(true);
            expect(document.querySelector('[data-val="vegan"]').classList.contains('active')).toBe(false);
        });
    });

    describe('Transmission réelle à l\'IA (première couverture de la ligne RÉGIMES)', () => {
        beforeEach(() => {
            vi.stubGlobal('fetch', vi.fn());
            fetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({
                    candidates: [{ content: { parts: [{ text: '[]' }] } }]
                })
            });
        });

        it('Keto cochée : le message envoyé porte « RÉGIMES & EXCLUSIONS : keto »', async () => {
            const aiConfig = { ...defaultAiConfig(), diet: ['keto'], ppl: '2' };

            await generateRecipes('MOCK_KEY', [], aiConfig, [], []);

            expect(fetch.mock.calls[0][1].body).toContain('RÉGIMES & EXCLUSIONS : keto');
        });

        it('plusieurs régimes cochés voyagent ensemble, dans l\'ordre des puces', async () => {
            const aiConfig = { ...defaultAiConfig(), diet: ['sans-gluten', 'keto'], ppl: '2' };

            await generateRecipes('MOCK_KEY', [], aiConfig, [], []);

            expect(fetch.mock.calls[0][1].body).toContain('RÉGIMES & EXCLUSIONS : sans-gluten, keto');
        });

        it('aucun régime coché : le prompt garde « Aucun régime » (comportement d\'origine)', async () => {
            const aiConfig = { ...defaultAiConfig(), diet: [], ppl: '2' };

            await generateRecipes('MOCK_KEY', [], aiConfig, [], []);

            expect(fetch.mock.calls[0][1].body).toContain('RÉGIMES & EXCLUSIONS : Aucun régime');
        });
    });
});
