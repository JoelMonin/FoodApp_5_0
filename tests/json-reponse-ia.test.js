import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { generateRecipes } from '../src/services/gemini.js';
import { defaultAiConfig } from '../src/state.js';

// LOT 029 — LA VRAIE CAUSE DE LA PANNE DE JOEL, trouvée en instrumentant SON navigateur le
// 2026-08-03 (« t'as qu'à le faire tourner toi-même dans mon Chrome »).
//
// Mon premier diagnostic — une réponse coupée au plafond — était FAUX, et il était faux parce
// que je ne l'avais jamais vérifié sur une vraie réponse en échec. Mesuré sur 11 générations
// réelles, le verdict est tout autre :
//
//  · la réponse en échec était COMPLÈTE (motif d'arrêt `STOP`, 10 579 jetons sur 65 536) ;
//  · le modèle y écrivait `"name": 'Crêpes douces...'` — des GUILLEMETS SIMPLES comme
//    délimiteurs, donc du JSON invalide ;
//  · il le faisait parce que NOTRE PROPRE CONSIGNE le lui demandait : « Utilise UNIQUEMENT
//    des guillemets simples (') dans les textes » (LOT 025). Cette phrase visait le CONTENU
//    des textes ; le modèle la comprenait par moments comme visant les DÉLIMITEURS. D'où
//    l'intermittence — 1 échec sur 4 — et l'impossibilité de la reproduire par le raisonnement.
//
// Second constat de la même campagne : environ UNE réponse sur DEUX arrive enveloppée dans un
// bloc Markdown (```json). Elles sont valides, mais partaient au sauvetage d'urgence — un
// chemin qui ne récolte que les objets ayant un nom ET des ingrédients, et jette le reste.

const corps = () => fetch.mock.calls[0][1].body;

/** Fabrique une réponse Google complète (motif STOP) portant le texte donné. */
function reponse(texte) {
    return {
        ok: true,
        json: () => Promise.resolve({
            candidates: [{ finishReason: 'STOP', content: { parts: [{ text: texte }] } }]
        })
    };
}

const UNE_RECETTE = '[{"name":"Crêpes","ingredients":[{"n":"Farine","q":"250 g","e":"🌾","c":"Épicerie salée","s":"stock"}],"steps":["Mélanger."]}]';

describe('LOT 029 — la consigne qui cassait le JSON', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
        fetch.mockResolvedValue(reponse('[]'));
    });
    afterEach(() => vi.unstubAllGlobals());

    describe('Ce que le message EXIGE du modèle', () => {
        it('impose le guillemet DOUBLE comme délimiteur, avec un contre-exemple explicite', async () => {
            await generateRecipes('MOCK_KEY', [], defaultAiConfig(), [], []);

            const msg = corps();
            expect(msg).toContain('guillemets doubles');
            // Le contre-exemple compte autant que la règle : c'est lui qui lève l'ambiguïté
            // sur laquelle le modèle trébuchait.
            expect(msg).toContain('est INVALIDE');
        });

        it('NE CONTIENT PLUS la formulation qui provoquait la panne', async () => {
            // Verrou de non-retour. Cette phrase exacte a produit un échec sur quatre chez
            // Joel : elle ne doit jamais revenir, même reformulée à l'identique par mégarde.
            await generateRecipes('MOCK_KEY', [], defaultAiConfig(), [], []);

            expect(corps()).not.toContain('UNIQUEMENT des guillemets simples');
        });

        // Finding F-06 de l'audit Codex : la phrase interdisant le guillemet double DANS le
        // contenu n'était couverte par aucun test. Or c'est elle qui empêche le modèle
        // d'écrire `"steps":["Passer en mode "grill"."]` — un cas que ni la lecture stricte
        // ni le sauvetage ne savent démêler, puisque rien ne distingue ce guillemet d'un
        // délimiteur. La règle est le SEUL rempart : elle doit être verrouillée comme tel.
        it('interdit aussi le guillemet double DANS le contenu — seul rempart côté code', async () => {
            await generateRecipes('MOCK_KEY', [], defaultAiConfig(), [], []);

            expect(corps()).toContain('aucun guillemet double');
        });

        it('préserve le correctif P2 : l\'apostrophe dans les mots reste obligatoire', async () => {
            // Non-régression du LOT 025. En durcissant la règle des délimiteurs, il aurait
            // été facile de réinterdire l'apostrophe — le défaut que Joel avait vu sur pièce
            // (« Tajine d agneau », « l huile d olive »).
            await generateRecipes('MOCK_KEY', [], defaultAiConfig(), [], []);

            const msg = corps();
            expect(msg).toContain('reste OBLIGATOIRE');
            expect(msg).toContain("l'eau");
        });
    });

    describe('Ce que l\'app sait LIRE', () => {
        it('une réponse enveloppée dans un bloc Markdown est lue entièrement', async () => {
            // ~1 réponse sur 2 en usage réel. Avant ce lot, elles passaient par le sauvetage
            // d'urgence ; désormais elles sont lues telles quelles, une fois les balises ôtées.
            fetch.mockResolvedValue(reponse('```json\n' + UNE_RECETTE + '\n```'));

            const recettes = await generateRecipes('MOCK_KEY', [], defaultAiConfig(), [], []);

            expect(recettes).toHaveLength(1);
            expect(recettes[0].name).toBe('Crêpes');
        });

        // ⚠️ FAUX VERROU CORRIGÉ (finding F-02 de l'audit Codex, justifié). Ce test vérifiait
        // d'abord que les champs `cuisine`/`time` survivaient — sauf que le sauvetage conserve
        // l'objet ENTIER (`results.push(p)`), donc ces champs survivaient aussi par son chemin.
        // Il restait vert en supprimant tout le correctif : il ne prouvait RIEN.
        //
        // Le discriminant réel est ailleurs : le sauvetage ne garde que les objets ayant un nom
        // ET des ingrédients non vides. Une recette sans ingrédients est donc SILENCIEUSEMENT
        // JETÉE par lui, et conservée par la lecture propre. C'est ce que ce test exerce.
        it('la lecture propre garde une recette que le sauvetage aurait jetée en silence', async () => {
            const cinqRecettes = '```json\n[' + [
                '{"name":"Crêpes 1","ingredients":[{"n":"Farine","q":"250 g"}],"steps":["Mélanger."]}',
                '{"name":"Crêpes 2","ingredients":[],"steps":["Garnir selon l\'envie."]}',
                '{"name":"Crêpes 3","ingredients":[{"n":"Lait","q":"500 ml"}],"steps":["Cuire."]}'
            ].join(',') + ']\n```';
            fetch.mockResolvedValue(reponse(cinqRecettes));

            const recettes = await generateRecipes('MOCK_KEY', [], defaultAiConfig(), [], []);

            // Par le sauvetage, la recette du milieu disparaîtrait sans un mot : 2 au lieu de 3.
            expect(recettes).toHaveLength(3);
            expect(recettes.map(r => r.name)).toEqual(['Crêpes 1', 'Crêpes 2', 'Crêpes 3']);
        });

        // Finding F-01 de l'audit Codex, CRITIQUE — la régression que J'AVAIS introduite en
        // croyant durcir : une réponse valide dont la racine n'est pas un tableau traversait
        // tout, et l'écran plantait plus loin sur `recipes.map is not a function`.
        it('UNE recette rendue hors tableau est remise dans le contrat, pas propagée telle quelle', async () => {
            fetch.mockResolvedValue(reponse('```json\n{"name":"Crêpes","ingredients":[{"n":"Farine","q":"250 g"}],"steps":["Mélanger."]}\n```'));

            const recettes = await generateRecipes('MOCK_KEY', [], defaultAiConfig(), [], []);

            expect(Array.isArray(recettes)).toBe(true);
            expect(recettes).toHaveLength(1);
            expect(recettes[0].name).toBe('Crêpes');
        });

        it('une recette seule SANS ingrédients est gardée — le sauvetage l\'aurait perdue', async () => {
            // Le discriminant de la remise en tableau : le sauvetage exige un nom ET des
            // ingrédients non vides, il jetterait donc cette recette et l'écran afficherait
            // une erreur. La lecture propre la conserve. Sans ce cas, la ligne de remise en
            // tableau n'était prouvée par rien — le sauvetage faisait le même travail.
            fetch.mockResolvedValue(reponse('{"name":"Crêpes à garnir","ingredients":[],"steps":["Garnir selon l\'envie."]}'));

            const recettes = await generateRecipes('MOCK_KEY', [], defaultAiConfig(), [], []);

            expect(recettes).toHaveLength(1);
            expect(recettes[0].name).toBe('Crêpes à garnir');
        });

        it('le MÊME contrat vaut sans balises Markdown — le trou existait déjà là', async () => {
            // Ce cas-ci n'est pas une régression du lot : la toute première lecture
            // (`JSON.parse(rawText)`) rendait déjà la racine sans la vérifier, depuis toujours.
            fetch.mockResolvedValue(reponse('{"name":"Crêpes nature","ingredients":[{"n":"Oeuf","q":"2"}],"steps":["Battre."]}'));

            const recettes = await generateRecipes('MOCK_KEY', [], defaultAiConfig(), [], []);

            expect(Array.isArray(recettes)).toBe(true);
            expect(recettes[0].name).toBe('Crêpes nature');
        });

        it('une racine inexploitable retombe sur le sauvetage au lieu de contaminer l\'écran', async () => {
            // Racine valide en JSON mais absurde ici : ni tableau, ni recette. Elle ne doit
            // surtout pas être rendue telle quelle — l'écran ferait `.map()` dessus.
            fetch.mockResolvedValue(reponse('"une chaîne de caractères, pas des recettes"'));

            await expect(
                generateRecipes('MOCK_KEY', [], defaultAiConfig(), [], [])
            ).rejects.toThrow(/Réessayez|coupée/);
        });

        it('une réponse VRAIMENT tronquée passe toujours au sauvetage', async () => {
            // Non-régression : le chemin de secours reste indispensable, et garde ce qu'il
            // peut plutôt que de tout perdre.
            const coupee = '[{"name":"Crêpes","ingredients":[{"n":"Farine","q":"250 g"}],"steps":["Mélanger."]},{"name":"Crêpes cou';
            fetch.mockResolvedValue(reponse(coupee));

            const recettes = await generateRecipes('MOCK_KEY', [], defaultAiConfig(), [], []);

            expect(recettes).toHaveLength(1);
            expect(recettes[0].name).toBe('Crêpes');
        });
    });
});
