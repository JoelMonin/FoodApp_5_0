/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CATEGORIES, CATEGORIES_WITH_EMOJI, CATEGORIE_PAR_DEFAUT, getCategoryEmoji } from '../src/data.js';

// LOT 014, volet D — VERROU SSOT : la liste des catégories n'existe qu'à UN endroit.
//
// POURQUOI. Les catégories du menu déroulant d'`index.html` étaient recopiées À LA MAIN, et
// elles avaient DÉJÀ divergé : « Autres » manquait, alors que c'est précisément la catégorie
// que le code impose en repli (`src/state.js`). Joel pouvait donc se retrouver avec des
// ingrédients rangés dans « Autres » sans jamais pouvoir les y ranger lui-même.
//
// POURQUOI UN VERROU PLUTÔT QUE DE GÉNÉRER LES OPTIONS EN JS. Le rendu instantané au
// démarrage est un acquis du LOT 005 : le menu est dans le HTML statique, donc affiché avant
// le moindre script. Générer les options coûterait cet acquis pour un bénéfice que ce test
// obtient gratuitement. La SSOT est ici garantie par une PREUVE, pas par une génération.

const HTML = readFileSync(resolve(__dirname, '../index.html'), 'utf-8');

function optionsDuMenu() {
    const debut = HTML.indexOf('id="add-category"');
    if (debut === -1) return null;                    // trahit un renommage de l'id
    const bloc = HTML.slice(debut, HTML.indexOf('</select>', debut));
    return [...bloc.matchAll(/<option value="([^"]*)"/g)].map(m => m[1]).filter(Boolean);
}

describe('LOT 014 §D — SSOT des catégories', () => {
    it('le menu déroulant de la page existe et a bien été analysé', () => {
        // Garde contre ce verrou lui-même : un renommage de l'id le rendrait vert à vide.
        const options = optionsDuMenu();
        expect(options).not.toBeNull();
        expect(options.length).toBeGreaterThanOrEqual(15);
    });

    it('le menu propose EXACTEMENT les catégories du code, dans le même ordre', () => {
        expect(optionsDuMenu()).toEqual(CATEGORIES);
    });

    it('la catégorie de repli est proposée — sinon elle est subie, jamais choisie', () => {
        // C'est le défaut réel corrigé ici : `Autres` était imposée par le code en repli
        // mais absente du menu.
        expect(CATEGORIES).toContain(CATEGORIE_PAR_DEFAUT);
        expect(optionsDuMenu()).toContain(CATEGORIE_PAR_DEFAUT);
    });

    it('`CATEGORIES` dérive bien de la table à émojis — jamais une seconde liste', () => {
        expect(CATEGORIES).toEqual(CATEGORIES_WITH_EMOJI.map(c => c.name));
    });

    it('chaque catégorie a son émoji, et le repli des inconnues est celui de « Autres »', () => {
        for (const c of CATEGORIES) expect(getCategoryEmoji(c)).toBeTruthy();
        const emojiAutres = CATEGORIES_WITH_EMOJI.find(c => c.name === CATEGORIE_PAR_DEFAUT).emoji;
        expect(getCategoryEmoji('categorie qui n existe pas')).toBe(emojiAutres);
    });
});
