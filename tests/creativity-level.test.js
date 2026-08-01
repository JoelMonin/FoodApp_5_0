import { describe, it, expect } from 'vitest';
import { creativityLevel } from '../src/utils/helpers.js';

// LOT 023 — SSOT du seuillage de la créativité, extrait du curseur bricolé de l'IA.
// Ces seuils sont les mêmes depuis le LOT 011 (`creativityInstruction`, `gemini.js`) :
// ce test ne fige pas une nouveauté, il rend visible une règle qui existait déjà en
// silence, pour que le nouveau curseur à 3 crans s'y réfère au lieu de la redupliquer.
describe('LOT 023 — creativityLevel (SSOT des paliers)', () => {
    it('les trois positions FERMES du nouveau curseur (0 / 50 / 100)', () => {
        expect(creativityLevel(0)).toBe('classique');
        expect(creativityLevel(50)).toBe('equilibre');
        expect(creativityLevel(100)).toBe('creatif');
    });

    it('les deux frontières exactes : 33 encore classique, 34 déjà équilibré', () => {
        expect(creativityLevel(33)).toBe('classique');
        expect(creativityLevel(34)).toBe('equilibre');
    });

    it('les deux frontières exactes : 66 encore équilibré, 67 déjà créatif', () => {
        expect(creativityLevel(66)).toBe('equilibre');
        expect(creativityLevel(67)).toBe('creatif');
    });

    // Valeurs héritées d'anciennes sauvegardes (avant ce lot, le curseur était continu) :
    // elles doivent continuer à être classées, pas rejetées.
    it('classe aussi les valeurs intermédiaires historiques', () => {
        expect(creativityLevel(10)).toBe('classique');
        expect(creativityLevel(42)).toBe('equilibre');
        expect(creativityLevel(95)).toBe('creatif');
    });
});
