import { describe, it, expect } from 'vitest';
import { extraireJsonIA, decouperJsonIA } from '../src/utils/aiJson.js';

// LOT 014 — SSOT de la lecture des reponses JSON de l'IA (correctif valide par Joel le
// 2026-07-31). Quatre extracteurs divergents partageaient le meme defaut : un motif non
// gourmand qui s'arrete a la premiere accolade fermante. Ces tests figent la regle unique
// qui les remplace.

// Le motif exact qui vivait dans les quatre appelants. Il n'est PAS importe : il est recopie
// ici pour que le defaut reste demontrable meme apres sa disparition du code.
const ANCIEN_MOTIF = /\{[\s\S]*?\}/;

describe('extraireJsonIA — le cas normal', () => {
    it('lit une reponse qui est deja du JSON pur', () => {
        expect(extraireJsonIA('{"category":"Fruits"}')).toEqual({ category: 'Fruits' });
    });

    it('lit un TABLEAU aussi bien qu\'un objet', () => {
        expect(extraireJsonIA('[{"n":"Pomme"},{"n":"Poire"}]')).toEqual([{ n: 'Pomme' }, { n: 'Poire' }]);
    });

    it('tolere les espaces et retours a la ligne autour', () => {
        expect(extraireJsonIA('\n\n  {"a":1}  \n')).toEqual({ a: 1 });
    });
});

describe('extraireJsonIA — LE DEFAUT CORRIGE : les objets imbriques', () => {
    // C'est le cas mesure avant le correctif : la suggestion de categorie disparaissait
    // SANS message des que l'IA ajoutait un objet a l'interieur de sa reponse.
    const REPONSE_IMBRIQUEE = '{"category":"Fruits","meta":{"src":"db"},"emojis":["🍎"]}';

    it('l\'ANCIEN motif rendait bien du JSON invalide sur cette reponse (preuve du defaut)', () => {
        const capture = REPONSE_IMBRIQUEE.match(ANCIEN_MOTIF)[0];
        expect(capture).toBe('{"category":"Fruits","meta":{"src":"db"}');
        expect(() => JSON.parse(capture)).toThrow();
    });

    it('la regle unique lit la reponse en entier', () => {
        expect(extraireJsonIA(REPONSE_IMBRIQUEE)).toEqual({
            category: 'Fruits', meta: { src: 'db' }, emojis: ['🍎']
        });
    });

    it('meme quand la reponse imbriquee est noyee dans du bavardage', () => {
        const brut = 'Bien sur ! Voici : {"score":"A","detail":{"kcal":420}} — bon appetit.';
        expect(extraireJsonIA(brut)).toEqual({ score: 'A', detail: { kcal: 420 } });
    });
});

describe('extraireJsonIA — pieges de decoupage', () => {
    // Les deux cas ci-dessous portent une accolade NON REFERMEE a l'interieur d'un texte :
    // c'est la seule forme qui distingue vraiment le suivi des chaines. Avec une accolade
    // refermee (« Sauce {maison} »), le comptage retombe juste par hasard — un test ecrit
    // ainsi passait au vert meme apres avoir debranche le suivi (faux verrou trouve par la
    // preuve par retrait, LOT 014).
    it('une accolade ouverte DANS un texte ne fausse pas le comptage', () => {
        expect(extraireJsonIA('{"name":"Sauce {maison","q":"20 cl"}'))
            .toEqual({ name: 'Sauce {maison', q: '20 cl' });
    });

    it('un guillemet echappe ne fait pas croire a une fin de chaine', () => {
        expect(extraireJsonIA('{"note":"guillemet \\" puis accolade {","x":1}'))
            .toEqual({ note: 'guillemet " puis accolade {', x: 1 });
    });

    it('un crochet a l\'interieur d\'un objet ne le referme pas', () => {
        expect(extraireJsonIA('{"tags":["Sain","Léger"]}')).toEqual({ tags: ['Sain', 'Léger'] });
    });

    it('sur deux blocs successifs, c\'est le PREMIER qui est retenu', () => {
        expect(extraireJsonIA('Bla {"a":1} blo {"b":2}')).toEqual({ a: 1 });
    });
});

describe('extraireJsonIA — LE DEFAUT CORRIGE : un crochet de PROSE avant le vrai JSON', () => {
    // Trouve par audit adversarial (LOT 014, 2026-07-31), verifie sur piece avant correctif :
    // la premiere version de ce module ne regardait QUE depuis le tout premier `{`/`[` du
    // texte. Un crochet de prose (lien Markdown, enumeration) qui s'EQUILIBRE sans etre du
    // JSON valide faisait echouer toute l'extraction — recreant exactement le symptome que
    // ce module devait eliminer (la suggestion disparait sans message).
    it('un lien Markdown avant le JSON ne bloque plus l\'extraction', () => {
        const brut = 'Voir [la documentation](https://exemple.com) pour plus d\'info. {"category":"Fruits"}';
        expect(extraireJsonIA(brut)).toEqual({ category: 'Fruits' });
    });

    it('un crochet de prose (enumeration) avant le JSON ne bloque plus l\'extraction', () => {
        const brut = 'Je ne peux pas traiter la categorie [inconnue] mais voici : {"category":"Fruits"}';
        expect(extraireJsonIA(brut)).toEqual({ category: 'Fruits' });
    });

    it('meme piege A L\'INTERIEUR d\'un bloc Markdown', () => {
        const brut = '```json\nLe format est [ainsi] : {"category":"Fruits"}\n```';
        expect(extraireJsonIA(brut)).toEqual({ category: 'Fruits' });
    });

    it('decouperJsonIA beneficie du meme correctif (contrat chaine de callAI)', () => {
        const brut = 'Voir [la documentation] : {"category":"Fruits"}';
        expect(decouperJsonIA(brut)).toBe('{"category":"Fruits"}');
    });
});

describe('extraireJsonIA — bloc Markdown', () => {
    it('lit un bloc ```json ... ```', () => {
        expect(extraireJsonIA('Voici le JSON :\n```json\n{"data":123}\n```')).toEqual({ data: 123 });
    });

    it('lit aussi un bloc ``` sans la balise json', () => {
        expect(extraireJsonIA('```\n{"data":123}\n```')).toEqual({ data: 123 });
    });

    it('lit le JSON meme si l\'IA a bavarde A L\'INTERIEUR du bloc', () => {
        expect(extraireJsonIA('```json\nRéponse : {"data":123}\n```')).toEqual({ data: 123 });
    });

    // C'est LE cas qui justifie de regarder dans le bloc AVANT de regarder la reponse
    // entiere : sans cette priorite, le decoupage mord sur les accolades du bavardage qui
    // precede. Sans ce test, debrancher la lecture du bloc Markdown ne faisait rougir
    // personne (faux verrou trouve par la preuve par retrait, LOT 014).
    it('le bloc PRIME sur des accolades ecrites avant lui dans le bavardage', () => {
        const brut = 'Format attendu : {clé: valeur}. Voici :\n```json\n{"data":123}\n```';
        expect(extraireJsonIA(brut)).toEqual({ data: 123 });
    });
});

describe('extraireJsonIA — ce qui doit echouer, et echouer FRANCHEMENT', () => {
    it.each([
        ['une phrase sans le moindre JSON', 'Désolé, je ne peux pas répondre.'],
        ['une reponse vide', ''],
        ['des espaces seuls', '   \n  '],
        ['un bloc jamais referme (reponse tronquee)', '{"name":"Recette","ingredients":[{"n":"Pomme"'],
        ['du JSON syntaxiquement casse', '{"name":"Recette",,}'],
        ['un texte litteral "null"', 'null'],
        ['un nombre seul', '42'],
        ['une chaine JSON seule', '"juste du texte"'],
        ['autre chose qu\'une chaine', null],
        ['un objet JS deja parse', { a: 1 }]
    ])('rend null pour %s', (_libelle, entree) => {
        expect(extraireJsonIA(entree)).toBeNull();
    });
});

describe('decouperJsonIA — le contrat CHAINE de callAI', () => {
    it('rend la portion JSON telle quelle, sans la parser', () => {
        expect(decouperJsonIA('Voici : {"a": 1} merci')).toBe('{"a": 1}');
    });

    it('rend le contenu du bloc Markdown, sans les balises', () => {
        expect(decouperJsonIA('```json\n{"data": 123}\n```')).toBe('{"data": 123}');
    });

    it('rend null quand il n\'y a rien a decouper — a l\'appelant de decider du repli', () => {
        expect(decouperJsonIA('aucun json ici')).toBeNull();
    });

    it('ne coupe plus un objet imbrique en deux (meme correctif que l\'extraction)', () => {
        expect(decouperJsonIA('{"a":{"b":1}}')).toBe('{"a":{"b":1}}');
    });

    it('applique la MEME priorite au bloc Markdown que l\'extraction', () => {
        expect(decouperJsonIA('Format : {clé: valeur}. Voici :\n```json\n{"data": 123}\n```'))
            .toBe('{"data": 123}');
    });
});
