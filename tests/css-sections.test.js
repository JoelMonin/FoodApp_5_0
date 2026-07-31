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
