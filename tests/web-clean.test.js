import { describe, it, expect } from 'vitest';
import { nettoyerPageWeb, extraireTitrePage } from '../src/utils/webClean.js';

// LOT 025, volet B — jusqu'ici la page rapatriée partait ENTIÈRE à l'IA. Le montage
// ci-dessous reprend la STRUCTURE RÉELLE de la page Marmiton importée par Joel le
// 2026-08-02 (`recette_aubergines-au-four_13572.aspx`), raccourcie mais fidèle dans son
// ordre : métadonnées du lecteur, bandeau de consentement, menus, fil d'Ariane, titre de
// niveau 1, recette, puis pied de page (recettes liées, commentaires, mentions légales).
const PAGE_MARMITON = `Title: Aubergines au four : la meilleure recette

URL Source: https://www.marmiton.org/recettes/recette_aubergines-au-four_13572.aspx

Published Time: Mon, 25 May 2026 03:02:24 GMT

Markdown Content:
![Image 5: Marmiton](https://static.afcdn.com/logo-cmp-200px.png?popupDidomi=1)

Marmiton et ses [1117 partenaires](javascript:Didomi.preferences.show("vendors");) souhaitent utiliser des cookies pour :

 - Mesure d'audience,

 - Publicités personnalisées,

Paramétrer Je n'accepte rien J'accepte tout

[](https://www.marmiton.org/)

*   [Apéro](https://www.marmiton.org/dossier-recettes-aperitif)
*   [Entrées](https://www.marmiton.org/recettes/index/categorie/entree/)

1.   [Accueil](https://www.marmiton.org/)
2.   [Recettes](https://www.marmiton.org/recettes)
6.   Aubergines au four

# Aubergines au four

[4.3/5](https://www.marmiton.org/recettes/recette_aubergines-au-four_13572.aspx#topReviewsTitle)

 40 min

 Très facile

## Ingrédients

- [x]

[![Image 19: aubergine](https://assets.afcdn.com/67479_w115h115.webp) 4 aubergines](https://www.marmiton.org/shopping/aubergine.html)

- [x]

[![Image 20: sel](https://assets.afcdn.com/67687_w115h115.webp) sel](https://fliz.ly/qWW5_w)

## Préparation

étape 1

![Image 29: aubergine](https://assets.afcdn.com/67479_w40h40.webp)

Coupez chaque aubergine en 2 dans le sens de la longueur (ne pas les éplucher). Zébrez la chair avec un couteau.

étape 4

Mettre au four à 200°C (thermostat 6-7) jusqu'à ce que la chair soit molle.

## Vous aimerez aussi...

[Aubergine au four](https://www.marmiton.org/recettes/recette_aubergine-au-four_21506.aspx)

## Commentaires (176)

sucreglacelm 5/5 01/08/2024 11:46 Merci beaucoup pour votre recette

*   [Mentions légales](https://www.marmiton.org/sp/aide/mentions-legales.html)

© 2026 marmiton.org - Tous droits réservés`;

describe('LOT 025 / volet B — nettoyage de la page importée', () => {
    describe('sur la page Marmiton réelle (critères d\'acceptation 5 et 6)', () => {
        const nettoye = nettoyerPageWeb(PAGE_MARMITON);

        it('garde la recette : titre, ingrédients et étapes', () => {
            expect(nettoye).toContain('Aubergines au four');
            expect(nettoye).toContain('4 aubergines');
            expect(nettoye).toContain('sel');
            expect(nettoye).toContain('Zébrez la chair avec un couteau');
            expect(nettoye).toContain('200°C');
        });

        it('jette le bandeau de consentement et les menus de navigation', () => {
            expect(nettoye).not.toContain('1117 partenaires');
            expect(nettoye).not.toContain("J'accepte tout");
            expect(nettoye).not.toContain('Apéro');
            expect(nettoye).not.toContain('Accueil');
        });

        it('jette les recettes liées, les commentaires et le pied de page', () => {
            expect(nettoye).not.toContain('Vous aimerez aussi');
            expect(nettoye).not.toContain('sucreglacelm');
            expect(nettoye).not.toContain('Mentions légales');
            expect(nettoye).not.toContain('© 2026');
        });

        it('jette les métadonnées techniques du lecteur de page', () => {
            expect(nettoye).not.toContain('URL Source:');
            expect(nettoye).not.toContain('Published Time:');
            expect(nettoye).not.toContain('Markdown Content:');
        });

        it('ne laisse plus aucune image ni adresse web', () => {
            expect(nettoye).not.toContain('![');
            expect(nettoye).not.toContain('https://');
            expect(nettoye).not.toContain('assets.afcdn.com');
        });

        // La mesure qui justifie le volet : le bruit payé au jeton à chaque import.
        it('réduit le texte envoyé à l\'IA d\'au moins 60 %', () => {
            expect(nettoye.length).toBeLessThan(PAGE_MARMITON.length * 0.4);
        });

        it('propose « Aubergines au four » comme titre, sans le préfixe du lecteur', () => {
            expect(extraireTitrePage(PAGE_MARMITON)).toBe('Aubergines au four');
        });
    });

    describe('garde-fous — une heuristique ne doit jamais casser un import', () => {
        it('rend le texte d\'origine quand ses règles ont tout mangé (critère 7)', () => {
            // Que des liens et des puces : après nettoyage il ne resterait presque rien.
            const quePuces = '* [un lien](https://a.fr)\n* [un autre](https://b.fr)\n- [x]\n* [encore](https://c.fr)';

            expect(nettoyerPageWeb(quePuces)).toBe(quePuces);
        });

        it('ne coupe RIEN en tête quand la page n\'a pas de titre de niveau 1', () => {
            const sansTitre1 = '## Tarte aux pommes\nUne recette simple et rapide à préparer.';

            const nettoye = nettoyerPageWeb(sansTitre1);

            expect(nettoye).toContain('## Tarte aux pommes');
            expect(nettoye).toContain('Une recette simple');
        });

        it('un titre de niveau 1 en toute première ligne ne fait rien perdre', () => {
            const nettoye = nettoyerPageWeb('# Tarte aux pommes\n\nMélangez la farine et le beurre longuement.');

            expect(nettoye).toContain('Tarte aux pommes');
            expect(nettoye).toContain('Mélangez la farine');
        });

        it('texte vide ou non textuel : rend une chaîne vide sans planter', () => {
            expect(nettoyerPageWeb('')).toBe('');
            expect(nettoyerPageWeb('   ')).toBe('');
            expect(nettoyerPageWeb(null)).toBe('');
            expect(nettoyerPageWeb(undefined)).toBe('');
            expect(nettoyerPageWeb(42)).toBe('');
        });

        it('plafonne une page démesurée sans la vider', () => {
            const enorme = '# Recette\n\n' + 'Faites revenir les oignons doucement. '.repeat(2000);

            const nettoye = nettoyerPageWeb(enorme);

            expect(nettoye.length).toBeLessThan(13000);
            expect(nettoye).toContain('Faites revenir les oignons');
            expect(nettoye).toContain('suite de la page ignorée');
        });

        it('ne colle pas les paragraphes entre eux (les blancs deviennent UN blanc)', () => {
            const nettoye = nettoyerPageWeb('# Titre\n\nPremier paragraphe de la recette.\n\n\n\nSecond paragraphe de la recette.');

            expect(nettoye).toContain('Premier paragraphe de la recette.\n\nSecond paragraphe de la recette.');
        });
    });

    describe('extraireTitrePage', () => {
        it('préfère le titre de niveau 1 au « Title: » du lecteur (souvent enrichi pour les moteurs)', () => {
            const texte = 'Title: Blanquette de veau : la meilleure recette facile\n\n# Blanquette de veau\n\nUne recette.';

            expect(extraireTitrePage(texte)).toBe('Blanquette de veau');
        });

        it('retombe sur « Title: » quand la page n\'a pas de titre de niveau 1', () => {
            expect(extraireTitrePage('Title: Gratin dauphinois\n\nDes pommes de terre.')).toBe('Gratin dauphinois');
        });

        it('retombe sur la première ligne utile, sans ses dièses', () => {
            expect(extraireTitrePage('## Tarte aux pommes\nUne recette simple.')).toBe('Tarte aux pommes');
        });

        it('retire liens et images du titre trouvé', () => {
            expect(extraireTitrePage('# [Tarte aux pommes](https://exemple.fr)')).toBe('Tarte aux pommes');
        });

        it('texte vide ou non textuel : rend une chaîne vide', () => {
            expect(extraireTitrePage('')).toBe('');
            expect(extraireTitrePage(null)).toBe('');
            expect(extraireTitrePage(123)).toBe('');
        });
    });
});
