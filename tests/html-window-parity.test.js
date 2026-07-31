/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import '../js/app.js';

// LOT 014, volet F — VERROU ANTI-RÉCIDIVE : parité entre les gestes d'`index.html` et les
// fonctions réellement disponibles.
//
// POURQUOI CE VERROU EXISTE. La migration monolithe → modules a perdu ~30 comportements en
// silence, et une bonne part de ces pertes avaient la même forme : un bouton de la page
// appelait une fonction qui n'était plus branchée nulle part. Rien ne cassait au build, aucun
// test ne rougissait — Joel cliquait, et il ne se passait rien. Ce verrou rend cette panne
// IMPOSSIBLE à réintroduire sans qu'un test rougisse.
//
// IL EST VOLONTAIREMENT UNIDIRECTIONNEL : il vérifie que tout ce que la page APPELLE existe,
// jamais l'inverse. Le sens retour épinglerait à tort `pushToFirebase`, exposé
// DÉLIBÉRÉMENT sans bouton (décision tracée dans la fiche du LOT 007).
//
// IL EST À L'EXÉCUTION, PAS PAR ANALYSE DE TEXTE : importer `js/app.js` exécute son bloc
// `expose()`, donc on interroge le vrai `window`. Comparer deux listes de noms extraites de
// deux fichiers ne prouverait que la ressemblance de deux textes — pas que le bouton marche.

const HTML = readFileSync(resolve(__dirname, '../index.html'), 'utf-8');

// Mots-clés du langage : `onclick="if(...) x()"` ne référence pas une fonction nommée `if`.
const MOTS_CLES = new Set([
    'if', 'else', 'for', 'while', 'switch', 'return', 'typeof', 'new',
    'catch', 'function', 'do', 'try', 'delete', 'void', 'in', 'of'
]);

/**
 * Relève les fonctions GLOBALES appelées depuis les attributs `on*=` de la page.
 * `(?<![.\w$])` écarte les appels de méthode (`document.getElementById(…)`,
 * `classList.toggle(…)`) : seul un identifiant nu est un accès à `window`.
 */
function globalesAppeleesParLaPage() {
    const trouvees = new Map(); // nom → exemple d'attribut, pour un message d'erreur utile
    for (const [, evenement, code] of HTML.matchAll(/\son([a-z]+)\s*=\s*"([^"]*)"/g)) {
        for (const [, nom] of code.matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/g)) {
            if (!MOTS_CLES.has(nom) && !trouvees.has(nom)) trouvees.set(nom, `on${evenement}="${code}"`);
        }
    }
    return trouvees;
}

describe('LOT 014 §F — verrou de parité : tout geste de la page trouve sa fonction', () => {
    const appelees = globalesAppeleesParLaPage();

    // GARDE CONTRE CE VERROU LUI-MÊME. Sans elle, une réécriture d'`index.html` (guillemets
    // simples, attributs générés en JS…) ferait que l'extraction ne trouve plus RIEN — et le
    // verrou passerait au vert À VIDE, en donnant l'illusion de protéger quelque chose.
    // C'est exactement le profil de faux verrou que la chasse de l'étape C0 a trouvé 12 fois.
    it('l\'inventaire lui-même est non trivial (sinon le verrou serait vert à vide)', () => {
        expect(appelees.size).toBeGreaterThanOrEqual(25);
        // Deux ancres nommées : si l'extraction déraille, ces gestes très stables la trahiront.
        expect([...appelees.keys()]).toContain('switchView');
        expect([...appelees.keys()]).toContain('closeModal');
    });

    it('chaque fonction appelée par un attribut on*= est réellement disponible', () => {
        const manquantes = [...appelees.entries()]
            .filter(([nom]) => typeof window[nom] !== 'function')
            .map(([nom, exemple]) => `${nom}  (appelée par ${exemple.slice(0, 70)}…)`);

        expect(manquantes,
            'Ces fonctions sont appelées par index.html mais ne sont branchées nulle part : ' +
            'le bouton correspondant ne ferait RIEN au clic, sans message d\'erreur. ' +
            'Les exposer via expose({…}) dans js/app.js.'
        ).toEqual([]);
    });
});
