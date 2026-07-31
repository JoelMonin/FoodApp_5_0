/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { state, defaultAiConfig } from '../src/state.js';
import { setupTestDOM } from './_helpers/dom-helpers.js';
// `saveAiConfigFromUI` n'est PAS dans le bloc `export {}` de js/app.js — uniquement dans
// `expose()` (js/app.js:1508). On l'atteint donc par `window`, comme le fait le navigateur.
import '../js/app.js';

// LOT 017 — ZONE AVEUGLE couverte AVANT déplacement (règle du LOT 014 : jamais déménager une
// fonction non couverte). `saveAiConfigFromUI` (js/app.js:704) n'avait AUCUN test : ses seules
// références du dépôt sont sa définition, son exposition, et trois `oninput=` d'index.html
// (:386 exceptions, :430 créativité, :443 exclusions). Sa seule couverture était l'EXISTENCE,
// via tests/html-window-parity.test.js — un `window.saveAiConfigFromUI = () => {}` l'aurait
// laissé vert alors que les réglages de Joel ne se seraient plus jamais enregistrés.
//
// C'est le pendant exact de `restoreAIConfig` (tests/restore-ai-config.test.js) : celle-là
// écrit l'état DANS les champs, celle-ci lit les champs POUR l'état.
//
// LE PIÈGE QUE CE FICHIER FIGE : la créativité passe par
// `parseInt(document.getElementById('creativity-slider')?.value || '50')`. Le `||` porte ici
// sur une CHAÎNE, et `'0'` est une chaîne non vide, donc conservée — une créativité
// volontairement réglée à 0 survit. Réécrire cette ligne en travaillant sur le nombre
// (`parseInt(...) || 50`) la remonterait silencieusement à 50, exactement le défaut corrigé
// au LOT 008 sur le chemin inverse. Aucun test ne l'interdisait avant celui-ci.

const champ = (id, valeur) => { document.getElementById(id).value = valeur; };

describe('LOT 017 — saveAiConfigFromUI (zone aveugle, couverte avant déplacement)', () => {
    beforeEach(() => {
        setupTestDOM(['aiSettings', 'systemInfo']);
        state.aiConfig = { ...defaultAiConfig() };
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('recopie les exceptions, les exclusions et la créativité dans l\'état', () => {
        champ('ai-exceptions', 'sans gluten');
        champ('ai-exclusions', 'arachides');
        champ('creativity-slider', '80');

        window.saveAiConfigFromUI();

        expect(state.aiConfig.exceptions).toBe('sans gluten');
        expect(state.aiConfig.exclusions).toBe('arachides');
        expect(state.aiConfig.creativity).toBe(80);
    });

    it('la créativité est enregistrée comme un NOMBRE, pas comme le texte du champ', () => {
        champ('creativity-slider', '35');

        window.saveAiConfigFromUI();

        expect(state.aiConfig.creativity).toBe(35);
        expect(typeof state.aiConfig.creativity).toBe('number');
    });

    it('créativité volontairement réglée à 0 : reste 0, n\'est PAS remontée à 50 '
       + '(le `||` porte sur la chaîne « 0 », qui est truthy — piège symétrique du LOT 008)', () => {
        champ('creativity-slider', '0');

        window.saveAiConfigFromUI();

        expect(state.aiConfig.creativity).toBe(0);
    });

    it('champ de créativité VIDE : retombe sur 50', () => {
        champ('creativity-slider', '');

        window.saveAiConfigFromUI();

        expect(state.aiConfig.creativity).toBe(50);
    });

    it('textes vidés : enregistre bien des chaînes vides, sans laisser l\'ancienne valeur', () => {
        state.aiConfig.exceptions = 'ancienne exception';
        state.aiConfig.exclusions = 'ancienne exclusion';
        champ('ai-exceptions', '');
        champ('ai-exclusions', '');

        window.saveAiConfigFromUI();

        expect(state.aiConfig.exceptions).toBe('');
        expect(state.aiConfig.exclusions).toBe('');
    });

    it('persiste réellement dans le stockage local', () => {
        champ('ai-exceptions', 'végétarien');

        window.saveAiConfigFromUI();

        const stocke = JSON.parse(localStorage.getItem('pantry_v5'));
        expect(stocke.aiConfig.exceptions).toBe('végétarien');
    });

    // Le `false` de `saveState(false)` n'est pas un détail : ces trois champs sont câblés en
    // `oninput`, donc appelés à CHAQUE FRAPPE. Redéclencher un rendu complet à chaque lettre
    // ferait perdre le focus du champ en cours de saisie.
    it('ne déclenche AUCUN re-rendu (appelée à chaque frappe : `saveState(false)`)', () => {
        const rendus = vi.fn();
        window.addEventListener('stateUpdated', rendus);

        window.saveAiConfigFromUI();

        expect(rendus).not.toHaveBeenCalled();
        window.removeEventListener('stateUpdated', rendus);
    });

    it('champs absents du DOM : ne lève pas, et applique les valeurs de repli', () => {
        document.body.innerHTML = '';

        expect(() => window.saveAiConfigFromUI()).not.toThrow();
        expect(state.aiConfig.exceptions).toBe('');
        expect(state.aiConfig.creativity).toBe(50);
    });
});
