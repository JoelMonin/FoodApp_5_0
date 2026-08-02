/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { lireFicheRecette, normaliserFiche, ficheExploitable, ficheEnTexteSource } from '../src/utils/recipeSchema.js';

// LOT 025, volet D — les formes ci-dessous ne sont pas inventées : elles sont relevées sur
// les pages réelles importées le 2026-08-02. Chaque bizarrerie testée a été VUE sur un site.

function pageAvecFiche(objet) {
    return `<!doctype html><html><head>
        <script type="application/ld+json">${JSON.stringify(objet)}</script>
    </head><body><p>du contenu</p></body></html>`;
}

// Forme réelle Marmiton (blanquette) : `recipeYield` en « 4 personnes », durée ISO.
const BLANQUETTE = {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: 'Blanquette de veau : recette traditionnelle',
    recipeYield: '4 personnes',
    totalTime: 'PT2H15M',
    recipeIngredient: ['1 kg de blanquette de veau', '25 cl de vin blanc', '2 carottes'],
    recipeInstructions: [
        'Faire revenir la viande dans un peu de beurre doux.',
        'Saupoudrer de 2 cuillères de farine. Bien remuer.'
    ]
};

describe('LOT 025 / volet D — lecture de la fiche recette structurée', () => {
    describe('cas nominal (forme Marmiton)', () => {
        const fiche = lireFicheRecette(pageAvecFiche(BLANQUETTE));

        it('rend la recette avec ses ingrédients et ses étapes', () => {
            expect(fiche.name).toBe('Blanquette de veau : recette traditionnelle');
            expect(fiche.ingredients).toEqual(['1 kg de blanquette de veau', '25 cl de vin blanc', '2 carottes']);
            expect(fiche.steps).toHaveLength(2);
            expect(fiche.steps[0]).toContain('Faire revenir la viande');
        });

        it('traduit le nombre de personnes et la durée', () => {
            expect(fiche.people).toBe(4);
            expect(fiche.time).toBe('2 h 15');
        });
    });

    describe('pièges de normalisation documentés par le domaine', () => {
        // CAS RÉEL 750g : un ingrédient nommé « Ingrédients: », des apostrophes codées,
        // et une étape préfixée « Préparation:… » collée au texte.
        it('750g — retire la ligne parasite « Ingrédients: » et décode les entités', () => {
            const fiche = lireFicheRecette(pageAvecFiche({
                '@type': 'Recipe',
                name: 'Aubergines au four',
                recipeIngredient: ['3 aubergines', 'Ingrédients:', '200 g viande hachée'],
                recipeInstructions: ['Préparation:Mettre les aubergines avec un peu d&#039;huile.']
            }));

            expect(fiche.ingredients).toEqual(['3 aubergines', '200 g viande hachée']);
            expect(fiche.steps[0]).toBe("Mettre les aubergines avec un peu d'huile.");
            expect(fiche.steps[0]).not.toContain('Préparation:');
            expect(fiche.steps[0]).not.toContain('&#039;');
        });

        // CAS RÉEL Marie Claire : `recipeIngredient` est UNE chaîne à retours ligne.
        it('Marie Claire — une chaîne unique à retours ligne devient une liste', () => {
            const fiche = lireFicheRecette(pageAvecFiche({
                '@type': 'Recipe',
                name: 'Aubergines au four, ail et parmesan',
                recipeIngredient: "\r\n2 aubergines \r\n2 gousses d'ail\r\n100 g de parmesan\r\n",
                recipeInstructions: [{ '@type': 'HowToStep', text: 'Préchauffez le four à 180°.' }]
            }));

            expect(fiche.ingredients).toEqual(['2 aubergines', "2 gousses d'ail", '100 g de parmesan']);
        });

        it('aplatit RÉCURSIVEMENT les étapes rangées en sections (HowToSection)', () => {
            const fiche = lireFicheRecette(pageAvecFiche({
                '@type': 'Recipe',
                name: 'Recette en deux temps',
                recipeIngredient: ['1 aubergine'],
                recipeInstructions: [
                    {
                        '@type': 'HowToSection', name: 'La farce',
                        itemListElement: [
                            { '@type': 'HowToStep', text: 'Hacher la viande.' },
                            { '@type': 'HowToStep', text: 'Assaisonner.' }
                        ]
                    },
                    {
                        '@type': 'HowToSection', name: 'La cuisson',
                        itemListElement: [{ '@type': 'HowToStep', text: 'Enfourner 30 minutes.' }]
                    }
                ]
            }));

            expect(fiche.steps).toEqual(['Hacher la viande.', 'Assaisonner.', 'Enfourner 30 minutes.']);
        });

        it('les 4 formes réelles de « nombre de personnes » donnent toutes un entier', () => {
            const avec = y => normaliserFiche({ name: 'X', recipeYield: y }).people;

            expect(avec('4 personnes')).toBe(4);      // Marmiton
            expect(avec(['2', '2 personnes'])).toBe(2); // Deliacious
            expect(avec('4')).toBe(4);                 // Marie Claire
            expect(avec(3)).toBe(3);                   // forme numérique
            expect(avec('3 personnes')).toBe(3);       // 750g
        });

        it('traduit les durées ISO rencontrées', () => {
            const avec = t => normaliserFiche({ name: 'X', totalTime: t }).time;

            expect(avec('PT2H15M')).toBe('2 h 15');
            expect(avec('PT25M')).toBe('25 min');
            expect(avec('PT0H15M')).toBe('15 min');   // Journal des Femmes
            expect(avec('PT1H')).toBe('1 h');
        });

        // CRITÈRE 6 réécrit après l'audit de spec : « forme invalide » est désormais une
        // liste ÉNUMÉRÉE, et le comportement attendu est « champ absent », pas « pas de
        // plantage » (qui ne se prouve pas).
        it('formes de durée invalides : le champ est ABSENT, la fiche reste utilisable', () => {
            for (const invalide of ['', '1 hour', '90', 90, null, undefined, {}]) {
                const fiche = normaliserFiche({
                    name: 'X', totalTime: invalide,
                    recipeIngredient: ['1 aubergine'], recipeInstructions: ['Cuire.']
                });
                expect(fiche.time).toBeUndefined();
                expect(ficheExploitable(fiche)).toBe(true);
            }
        });

        it('retombe sur la cuisson puis la préparation quand la durée totale manque', () => {
            expect(normaliserFiche({ name: 'X', cookTime: 'PT35M' }).time).toBe('35 min');
            expect(normaliserFiche({ name: 'X', prepTime: 'PT5M' }).time).toBe('5 min');
        });
    });

    describe('choix de la fiche — la PLUS COMPLÈTE, jamais la première (finding 3)', () => {
        // CAS RÉEL « Mes brouillons de cuisine » : 3 nœuds Recipe sur la même page.
        it('sur trois nœuds, celui qui est complet gagne même s\'il est le dernier', () => {
            const html = `<!doctype html><html><head>
                <script type="application/ld+json">${JSON.stringify({ '@type': 'Recipe', name: 'Version pauvre', recipeIngredient: ['1 aubergine'], recipeInstructions: ['Cuire.'] })}</script>
                <script type="application/ld+json">${JSON.stringify({ '@type': 'Recipe', name: 'Version moyenne', recipeIngredient: ['1 aubergine', '1 tomate'], recipeInstructions: ['Cuire.'] })}</script>
                <script type="application/ld+json">${JSON.stringify(BLANQUETTE)}</script>
            </head><body></body></html>`;

            expect(lireFicheRecette(html).name).toBe('Blanquette de veau : recette traditionnelle');
        });

        it('descend dans un @graph et dans les tableaux racine', () => {
            expect(lireFicheRecette(pageAvecFiche({
                '@context': 'https://schema.org',
                '@graph': [{ '@type': 'WebPage' }, BLANQUETTE]
            })).people).toBe(4);

            expect(lireFicheRecette(pageAvecFiche([{ '@type': 'Organization' }, BLANQUETTE])).name)
                .toContain('Blanquette');
        });

        it('accepte un @type sous forme de tableau', () => {
            expect(lireFicheRecette(pageAvecFiche({ ...BLANQUETTE, '@type': ['Recipe', 'NewsArticle'] })))
                .not.toBeNull();
        });
    });

    describe('fiches à REFUSER — le repli vaut mieux qu\'une fausse bonne recette', () => {
        // CAS RÉEL Chef Simon : fiche présente, 4 ingrédients, ZÉRO étape.
        it('Chef Simon — une fiche sans aucune étape est refusée', () => {
            expect(lireFicheRecette(pageAvecFiche({
                '@type': 'Recipe', name: 'Gratin d\'aubergines',
                recipeIngredient: ['2 aubergines', '100 g de reblochon']
            }))).toBeNull();
        });

        it('une fiche sans ingrédient est refusée', () => {
            expect(lireFicheRecette(pageAvecFiche({
                '@type': 'Recipe', name: 'Recette vide', recipeInstructions: ['Cuire.']
            }))).toBeNull();
        });

        // FINDING 4 de l'audit de spec : sans le retrait préalable des intitulés, cette
        // fiche passerait pour exploitable et remplacerait un repli propre.
        it('une fiche qui ne contient que des intitulés de section est refusée', () => {
            expect(lireFicheRecette(pageAvecFiche({
                '@type': 'Recipe', name: 'Fausse fiche',
                recipeIngredient: ['Ingrédients', 'Ustensiles :'],
                recipeInstructions: ['Préparation', 'Étapes :']
            }))).toBeNull();
        });

        it('une fiche sans nom est refusée', () => {
            expect(lireFicheRecette(pageAvecFiche({
                '@type': 'Recipe', recipeIngredient: ['1 aubergine'], recipeInstructions: ['Cuire.']
            }))).toBeNull();
        });
    });

    describe('entrées dégradées — jamais d\'exception, toujours le repli', () => {
        it('page sans données structurées', () => {
            expect(lireFicheRecette('<html><body><h1>Une recette</h1></body></html>')).toBeNull();
        });

        it('bloc de données illisible : n\'invalide pas les autres blocs', () => {
            const html = `<!doctype html><html><head>
                <script type="application/ld+json">{ ceci n'est pas du JSON }</script>
                <script type="application/ld+json">${JSON.stringify(BLANQUETTE)}</script>
            </head><body></body></html>`;

            expect(lireFicheRecette(html).name).toContain('Blanquette');
        });

        it('données structurées présentes mais sans recette (article, organisation)', () => {
            expect(lireFicheRecette(pageAvecFiche({ '@type': 'NewsArticle', name: 'Un article' }))).toBeNull();
        });

        it('entrées non textuelles', () => {
            expect(lireFicheRecette('')).toBeNull();
            expect(lireFicheRecette(null)).toBeNull();
            expect(lireFicheRecette(undefined)).toBeNull();
            expect(lireFicheRecette(42)).toBeNull();
            expect(normaliserFiche(null)).toBeNull();
            expect(normaliserFiche([])).toBeNull();
            expect(ficheExploitable(null)).toBe(false);
        });
    });

    // FINDING 6 de l'audit de spec : ce sérialiseur est SÉPARÉ de `recetteEnTexte`, qui
    // habille l'aperçu de Joel. Ces tests figent la frontière — si un jour quelqu'un les
    // fusionne, le message envoyé à l'IA se mettrait à porter des emojis et des majuscules.
    describe('ficheEnTexteSource — texte NU destiné à l\'IA', () => {
        const texte = ficheEnTexteSource(normaliserFiche(BLANQUETTE));

        it('porte tous les faits de la recette', () => {
            expect(texte).toContain('Titre : Blanquette de veau');
            expect(texte).toContain('Nombre de personnes : 4');
            expect(texte).toContain('Temps total : 2 h 15');
            expect(texte).toContain('- 1 kg de blanquette de veau');
            expect(texte).toContain('1. Faire revenir la viande');
        });

        it('ne porte AUCUNE décoration d\'aperçu (frontière avec recetteEnTexte)', () => {
            expect(texte).not.toContain('🧺');
            expect(texte).not.toContain('👨‍🍳');
            expect(texte).not.toContain('INGRÉDIENTS (');
            expect(texte).not.toContain('BLANQUETTE DE VEAU'); // pas de titre en majuscules
        });

        it('omet les sections absentes plutôt que d\'écrire des libellés vides', () => {
            const nu = ficheEnTexteSource({ name: 'X', ingredients: [], steps: [] });

            expect(nu).toBe('Titre : X');
        });

        it('entrée non exploitable : chaîne vide', () => {
            expect(ficheEnTexteSource(null)).toBe('');
            expect(ficheEnTexteSource('recette')).toBe('');
        });
    });
});
