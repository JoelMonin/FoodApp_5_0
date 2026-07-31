import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

// LOT 014, volet E — VERROU DU DECOUPAGE CSS.
//
// `css/style.css` n'est plus une feuille : c'est un sommaire. Deux pannes silencieuses
// deviennent possibles avec ce montage, et ce sont elles que ce fichier interdit :
//  1. une section posee dans `css/sections/` mais jamais appelee — du style qui n'arrive
//     jamais a l'ecran, sans la moindre erreur ;
//  2. une regle ecrite directement dans le sommaire — en CSS, les `@import` doivent ouvrir
//     la feuille, donc une telle regle passerait AVANT tout le reste et perdrait contre a
//     peu pres n'importe quoi.
//
// L'ORDRE, lui, n'est pas verifie ici : c'est le build qui en fait la preuve (la feuille
// produite doit rester identique octet pour octet, cf. la fiche du lot). Un test qui
// recopierait l'ordre attendu ne serait qu'une seconde liste a maintenir.

const RACINE = process.cwd();
const CHAPEAU = resolve(RACINE, 'css', 'style.css');
const DOSSIER = resolve(RACINE, 'css', 'sections');

const sommaire = readFileSync(CHAPEAU, 'utf8');
const appelees = [...sommaire.matchAll(/@import\s+"\.\/sections\/([^"]+)"/g)].map(m => m[1]);
const presentes = readdirSync(DOSSIER).filter(f => f.endsWith('.css'));

describe('LOT 014 §E — verrou du découpage CSS', () => {
    // Garde anti-vide : sans elle, tout ce fichier passerait au vert le jour où le sommaire
    // cesserait d'être lu (chemin changé, renommage), en ne comparant que des listes vides.
    it('le sommaire et le dossier de sections sont bien peuplés', () => {
        expect(presentes.length).toBeGreaterThanOrEqual(10);
        expect(appelees.length).toBe(presentes.length);
    });

    it('chaque section posée sur le disque est bien appelée par le sommaire', () => {
        const orphelines = presentes.filter(f => !appelees.includes(f));
        expect(orphelines).toEqual([]);
    });

    it('chaque appel du sommaire pointe vers un fichier qui existe', () => {
        const introuvables = appelees.filter(f => !presentes.includes(f));
        expect(introuvables).toEqual([]);
    });

    it('aucune section n\'est appelée deux fois (elle s\'appliquerait en double, et la '
       + 'seconde copie gagnerait sur des surcharges écrites entre les deux)', () => {
        const doublons = appelees.filter((f, i) => appelees.indexOf(f) !== i);
        expect(doublons).toEqual([]);
    });

    it('le sommaire ne contient AUCUNE règle CSS — seulement des appels et des commentaires', () => {
        const sansCommentaires = sommaire.replace(/\/\*[\s\S]*?\*\//g, '');
        const restant = sansCommentaires
            .split('\n')
            .map(l => l.trim())
            .filter(l => l && !l.startsWith('@import'));

        expect(restant).toEqual([]);
    });

    it('aucune section n\'importe une autre section (le sommaire doit rester le seul '
       + 'endroit qui décide de l\'ordre)', () => {
        const fautives = presentes.filter(f => readFileSync(join(DOSSIER, f), 'utf8').includes('@import'));
        expect(fautives).toEqual([]);
    });
});

// LOT 014 §E — trouvé par audit adversarial le 2026-07-31 : `.recipe-detail-section` était
// définie deux fois AU MÊME NIVEAU (hors `@media`), dans deux fichiers différents, avec des
// valeurs CONTRADICTOIRES — héritage du monolithe d'origine, invisible avant le découpage en
// sections nommées. Comme les deux définitions partagent la même spécificité, c'est TOUJOURS
// la dernière importée qui gagne : l'autre n'a jamais eu le moindre effet visuel. Corrigée
// (la version morte a été retirée de `05-ai.css`, seule celle de `09-modals.css` demeure).
//
// UN VERROU GÉNÉRIQUE « aucun sélecteur ne se répète entre sections » A ÉTÉ ESSAYÉ ET
// ABANDONNÉ : il remontait 14 « doublons », et les 14 étaient des surcharges `@media`
// (mobile, impression) — le mécanisme CSS standard pour le responsive, pas un défaut. Un tel
// verrou aurait exigé une liste blanche sans fin pour rester vert, donc plus de bruit que de
// protection. Verrou étroit à la place : seul le sélecteur réellement fautif est surveillé.
describe('LOT 014 §E — .recipe-detail-section ne redevient pas un doublon mort', () => {
    it('n\'est défini qu\'UNE seule fois hors @media, dans 09-modals.css', () => {
        const definitions = presentes
            .map(f => ({ f, corps: readFileSync(join(DOSSIER, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '') }))
            .filter(({ corps }) => /(?:^|\n|\})[ \t]*\.recipe-detail-section[ \t]*\{/.test(corps))
            .map(({ f }) => f);

        expect(definitions).toEqual(['09-modals.css']);
    });
});

// LOT 016 — même défaut que ci-dessus, sur les étiquettes de recette, et il avait survécu au
// LOT 014 : `.r-tag` figurait sur la liste des classes « CSS REBRANCHÉ par la campagne »
// (interdiction de les traiter en CSS mort), donc l'audit l'avait signalé sans y toucher.
//
// `.r-tag.red` et `.r-tag.green` étaient définies dans `05-ai.css` ET dans `12-utilities.css`.
// À spécificité égale, la dernière importée gagne : `12-utilities.css`. Conséquence mesurée —
// `.r-tag.green` de `05-ai.css` était INTÉGRALEMENT morte, tandis que `.r-tag.red` ne
// survivait plus que par `font-weight` et `box-shadow`, produisant une étiquette rose pâle
// portant le gras et l'ombre dessinés pour un fond rouge vif. Un mélange que personne n'avait
// choisi. Joel a tranché le 2026-07-31 : garder l'apparence telle quelle, ranger le code.
//
// CE VERROU EST DIFFÉRENT DU PRÉCÉDENT SUR UN POINT : `.r-tag` a une définition LÉGITIME dans
// `@media print` (12-utilities.css) — les étiquettes passent en noir et blanc à l'impression.
// Une recherche naïve la compterait comme un doublon. Les blocs `@media` sont donc retirés
// AVANT comptage, sans quoi ce verrou serait rouge à tort dès sa naissance.
function sansCommentairesNiMedia(css) {
    const sansCommentaires = css.replace(/\/\*[\s\S]*?\*\//g, '');
    let sortie = '';
    let i = 0;
    while (i < sansCommentaires.length) {
        const debut = sansCommentaires.indexOf('@media', i);
        if (debut === -1) { sortie += sansCommentaires.slice(i); break; }
        sortie += sansCommentaires.slice(i, debut);
        const ouvrante = sansCommentaires.indexOf('{', debut);
        if (ouvrante === -1) break;
        let profondeur = 1;
        let j = ouvrante + 1;
        while (j < sansCommentaires.length && profondeur > 0) {
            if (sansCommentaires[j] === '{') profondeur++;
            else if (sansCommentaires[j] === '}') profondeur--;
            j++;
        }
        i = j;
    }
    return sortie;
}

const corpsHorsMedia = presentes.map(f => ({ f, corps: sansCommentairesNiMedia(readFileSync(join(DOSSIER, f), 'utf8')) }));

function fichiersQuiDefinissent(selecteur) {
    // `(?![\w.-])` interdit à `.r-tag` de capturer `.r-tag.red` : sans lui, la base et ses
    // variantes seraient comptées ensemble et le verrou ne prouverait plus rien.
    const motif = new RegExp(`(?:^|\\n|\\})[ \\t]*${selecteur.replace(/\./g, '\\.')}(?![\\w.-])[ \\t]*\\{`);
    return corpsHorsMedia.filter(({ corps }) => motif.test(corps)).map(({ f }) => f);
}

describe('LOT 016 — les étiquettes de recette n\'ont plus qu\'une définition chacune', () => {
    // Garde anti-vide : si le retrait des `@media` ou le motif venait à ne plus rien trouver,
    // les tests ci-dessous compareraient des listes vides et passeraient au vert en silence.
    it('le lecteur trouve bien les sections et les définitions qu\'il prétend surveiller', () => {
        expect(corpsHorsMedia.length).toBeGreaterThanOrEqual(10);
        expect(fichiersQuiDefinissent('.r-tag')).toEqual(['05-ai.css']);
    });

    it.each([
        ['.r-tag.red', '12-utilities.css'],
        ['.r-tag.green', '12-utilities.css'],
        ['.r-tag.orange', '12-utilities.css'],
        ['.r-tag.blue', '05-ai.css']
    ])('%s n\'est défini qu\'une seule fois hors @media, dans %s', (selecteur, attendu) => {
        expect(fichiersQuiDefinissent(selecteur)).toEqual([attendu]);
    });

    // Ces deux propriétés viennent de l'ancien doublon de `05-ai.css`. Elles sont les seules
    // qui y étaient encore vivantes : les perdre en « nettoyant » changerait l'apparence de
    // l'étiquette (perte du gras et de l'ombre) sans qu'aucun autre test ne s'en aperçoive.
    it('l\'étiquette rouge conserve le gras et l\'ombre rapatriés depuis 05-ai.css', () => {
        const utilities = corpsHorsMedia.find(({ f }) => f === '12-utilities.css').corps;
        const bloc = utilities.match(/\.r-tag\.red[ \t]*\{([^}]*)\}/);

        expect(bloc).not.toBeNull();
        expect(bloc[1]).toMatch(/font-weight:\s*600/);
        expect(bloc[1]).toMatch(/box-shadow:\s*0 1px 2px rgba\(214, 48, 49, 0\.2\)/);
    });
});
