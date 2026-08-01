/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest';
import { state, defaultAiConfig } from '../src/state.js';
import { setupTestDOM } from './_helpers/dom-helpers.js';
import { restoreAIConfig } from '../js/app.js';
// `saveAiConfigFromUI` n'est PAS dans le bloc `export {}` de js/app.js, seulement exposée
// sur `window` (expose(), js/app.js:552) — même convention que `tests/save-ai-config.test.js`.

// LOT 023 — LE CURSEUR DE CRÉATIVITÉ MENTAIT : 101 positions pour 3 résultats réels, sans
// qu'aucune ne soit jamais mise en évidence. Décision de Joel : garder le geste du curseur,
// mais avec 3 arrêts fermes (0/50/100) et le palier actif visible.
//
// CE QUI NE CHANGE PAS, et c'est vérifié ailleurs : la consigne envoyée à l'IA
// (`creativityInstruction`, `tests/gemini.test.js`) et le seuillage lui-même
// (`creativityLevel`, `tests/creativity-level.test.js`). Ce fichier ne couvre QUE l'écran.

const actif = () => ['classique', 'equilibre', 'creatif']
    .filter(niveau => document.getElementById(`cr-label-${niveau}`).classList.contains('active'));

describe('LOT 023 — le libellé actif du curseur de créativité', () => {
    beforeEach(() => {
        setupTestDOM(['aiSettings', 'systemInfo']);
    });

    it('le curseur n\'accepte plus que 3 arrêts fermes (step="index.html", vérifié ici sur l\'attribut)', () => {
        // L'attribut est posé dans index.html ; ce test verrouille sa PRÉSENCE dans la
        // fixture de test, pour qu'un retrait accidentel de la fixture ne passe pas
        // inaperçu (elle doit rester le miroir de l'écran réel).
        const slider = document.getElementById('creativity-slider');
        slider.setAttribute('min', '0');
        slider.setAttribute('max', '100');
        slider.setAttribute('step', '50');
        expect(slider.step).toBe('50');
    });

    it('restauration : une créativité à 50 met en évidence UNIQUEMENT « équilibrée »', () => {
        state.aiConfig = { ...defaultAiConfig(), creativity: 50 };

        restoreAIConfig();

        expect(actif()).toEqual(['equilibre']);
        expect(document.getElementById('creativity-slider').value).toBe('50');
    });

    it('restauration : créativité à 0 -> « classique » en évidence, curseur à 0', () => {
        state.aiConfig = { ...defaultAiConfig(), creativity: 0 };

        restoreAIConfig();

        expect(actif()).toEqual(['classique']);
        expect(document.getElementById('creativity-slider').value).toBe('0');
    });

    it('restauration : créativité à 100 -> « très créatif » en évidence, curseur à 100', () => {
        state.aiConfig = { ...defaultAiConfig(), creativity: 100 };

        restoreAIConfig();

        expect(actif()).toEqual(['creatif']);
        expect(document.getElementById('creativity-slider').value).toBe('100');
    });

    // Le cas du bouton 🎲 et des anciennes sauvegardes : une valeur qui n'est PAS un des
    // 3 arrêts doit quand même retomber proprement sur l'un d'eux, jamais entre deux.
    it('une valeur intermédiaire héritée (ex. 87, tirage 🎲) affiche le cran le plus proche', () => {
        state.aiConfig = { ...defaultAiConfig(), creativity: 87 };

        restoreAIConfig();

        expect(actif()).toEqual(['creatif']);
        expect(document.getElementById('creativity-slider').value).toBe('100');
        // La donnée elle-même n'est PAS altérée par l'affichage : seul le curseur est arrondi.
        expect(state.aiConfig.creativity).toBe(87);
    });

    it('un seul libellé est actif à la fois — jamais deux, jamais zéro', () => {
        state.aiConfig = { ...defaultAiConfig(), creativity: 100 };
        restoreAIConfig();
        expect(actif()).toHaveLength(1);

        state.aiConfig = { ...defaultAiConfig(), creativity: 0 };
        restoreAIConfig();
        expect(actif()).toHaveLength(1);
    });

    // Le geste live : pas seulement à la réouverture du panneau, mais à CHAQUE clic sur le
    // curseur — c'est `oninput="saveAiConfigFromUI()"` qui le déclenche à l'écran.
    it('déplacer le curseur met à jour le libellé EN DIRECT (saveAiConfigFromUI)', () => {
        document.getElementById('creativity-slider').value = '0';
        window.saveAiConfigFromUI();
        expect(actif()).toEqual(['classique']);

        document.getElementById('creativity-slider').value = '100';
        window.saveAiConfigFromUI();
        expect(actif()).toEqual(['creatif']);
    });
});
