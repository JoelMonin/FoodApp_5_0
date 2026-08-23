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

        it('le bloc Markdown n\'est PAS lu par le sauvetage : les champs inconnus survivent', async () => {
            // La preuve que le chemin propre est bien pris. Le sauvetage ne reconstruit que
            // `name`/`ingredients`/`steps` en ne gardant que les objets qu'il reconnaît ;
            // une lecture entière conserve TOUT, y compris ce qu'il ignorerait.
            const avecExtras = '```json\n[{"name":"Crêpes","cuisine":"Française","time":"25 min",'
                + '"ingredients":[{"n":"Farine","q":"250 g"}],"steps":["Mélanger."]}]\n```';
            fetch.mockResolvedValue(reponse(avecExtras));

            const recettes = await generateRecipes('MOCK_KEY', [], defaultAiConfig(), [], []);

            expect(recettes[0].cuisine).toBe('Française');
            expect(recettes[0].time).toBe('25 min');
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
