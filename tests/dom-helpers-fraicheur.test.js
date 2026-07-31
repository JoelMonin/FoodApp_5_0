/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { idsEncoreValides, setupTestDOM } from './_helpers/dom-helpers.js';

// LOT 013 — le garde-fou que la découverte a signalé comme manquant : aucun des 21
// squelettes ad hoc existants n'était vérifié contre le vrai `index.html`, donc un id
// pouvait dériver en silence sans qu'aucun test ne le remarque. Ce fichier casse fort et
// tôt si `tests/_helpers/dom-helpers.js` cite un id qui n'existe plus dans `index.html`.

const ZONES = [
    'add', 'pantry', 'shopping', 'aiSettings', 'systemInfo', 'syncIndicators',
    'recipeDetail', 'picker', 'editEmoji', 'topbar', 'aiResults', 'favorites', 'pasteRecipe'
];

describe('LOT 013 — fraîcheur des squelettes de tests/_helpers/dom-helpers.js', () => {
    it.each(ZONES)('zone "%s" : tous ses ids existent encore dans index.html', (zone) => {
        expect(idsEncoreValides(zone)).toEqual([]);
    });

    it('une zone inconnue lève une erreur explicite, plutôt qu\'un DOM vide silencieux', () => {
        expect(() => setupTestDOM('zone-qui-n-existe-pas')).toThrow(/zone inconnue/);
    });
});
