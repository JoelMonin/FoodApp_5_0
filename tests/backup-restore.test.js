/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { exportJSON, importJSON, importStockOnly } from '../src/actions.js';
import {
    state, shoppingChecked, sanitizeGlobalState,
    registerSyncScheduler, registerSyncBarrier
} from '../src/state.js';
import { BACKUP_STATE_KEYS } from '../src/constants.js';
import { DEFAULT_DB } from '../src/data.js';
// Importé pour `window.restoreJSON` : le réarmement du champ fichier vit dans le pont
// `window` de `js/app.js`, pas dans `src/actions.js`.
import '../js/app.js';

// LOT 015, sous-lot C — sauvegarde et restauration.
//
// La partie la plus sensible du lot : elle touche l'état, les coches de courses et la
// synchro cloud. Aucun test n'existait sur `importJSON` ni `restoreJSON` avant ce lot.
//
// Quatre défauts fermés ici, dont deux qualifiés BLOQUANTS à l'audit de la fiche :
//  - la sauvegarde emportait l'état d'écran, et le restaurer cassait l'affichage ;
//  - les coches à la racine auraient créé un doublon dans l'état (SSOT) ;
//  - un fichier à inventaire vide (ou à `ingredients` non-tableau) passait la garde ;
//  - la restauration ne se sérialisait pas avec un envoi cloud déjà en vol.

let capturedBlobParts;
let lectureEnCours;
let contenuFichier;

function ing(over = {}) {
    return {
        id: 'ing_1', name: 'Pomme', emoji: '🍎', category: 'Fruits',
        inStock: false, inCart: false, pinned: false, frozen: false,
        shoppingSource: null, ...over
    };
}

function aiConfig(over = {}) {
    return {
        apiKey: '', models: {}, diet: [], exceptions: '', cuisines: [], equip: [],
        meal: 'indifferent', time: 'libre', diff: 'indifferent', ppl: '2',
        creativity: 50, exclusions: '', ...over
    };
}

/** Déclenche une restauration à partir d'un objet, et attend la fin du traitement. */
async function restaurer(objet) {
    contenuFichier = typeof objet === 'string' ? objet : JSON.stringify(objet);
    importJSON({});
    await lectureEnCours;
}

function fichierExporte() {
    exportJSON();
    return JSON.parse(capturedBlobParts[0]);
}

function toasts() {
    return [...document.querySelectorAll('.toast')].map(t => t.textContent);
}

describe('LOT 015 / sous-lot C — sauvegarde et restauration', () => {
    let errorSpy;

    beforeEach(() => {
        document.body.innerHTML = '';
        const store = {};
        Object.defineProperty(window, 'localStorage', {
            value: {
                getItem: vi.fn(k => store[k] ?? null),
                setItem: vi.fn((k, v) => { store[k] = String(v); }),
                removeItem: vi.fn(k => { delete store[k]; }),
                clear: vi.fn(() => { for (const k in store) delete store[k]; })
            },
            configurable: true
        });

        Object.assign(state, {
            ingredients: [], customCartItems: [], favorites: [], extraIngredients: [],
            currentView: 'pantry', filter: 'all', search: '',
            aiSuggestions: null, currentSuggestionIdx: null, lastSync: null,
            showInStockOnly: false, showInCartOnly: false,
            aiConfig: aiConfig()
        });
        delete state.shoppingChecked;
        shoppingChecked.clear();
        // `js/app.js` inscrit ses propres crochets de synchro à l'import : on repart d'une
        // ardoise vierge à CHAQUE test, pas seulement après.
        registerSyncScheduler(null);
        registerSyncBarrier(null);

        errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        capturedBlobParts = null;
        vi.stubGlobal('Blob', vi.fn(function (parts) { capturedBlobParts = parts; return {}; }));
        vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() });

        lectureEnCours = null;
        vi.stubGlobal('FileReader', vi.fn(function () {
            this.readAsText = () => { lectureEnCours = this.onload({ target: { result: contenuFichier } }); };
        }));
    });

    afterEach(() => {
        errorSpy.mockRestore();
        vi.unstubAllGlobals();
        registerSyncScheduler(null);
        registerSyncBarrier(null);
    });

    // ─────────────────────────────────────────────────────────────────
    // Chantier 10a — le périmètre du fichier
    // ─────────────────────────────────────────────────────────────────
    describe('chantier 10a — le fichier n\'emporte QUE des données durables', () => {
        it('aucun champ d\'écran ne part dans la sauvegarde — c\'était le défaut BLOQUANT', () => {
            state.ingredients = [ing()];
            state.currentView = 'shopping';
            state.search = 'tomate';
            state.filter = 'Légumes';
            state.showInStockOnly = true;
            state.showInCartOnly = true;
            state.aiSuggestions = [{ name: 'Tarte' }];
            state.currentSuggestionIdx = 2;
            state.lastSync = 12345;

            const fichier = fichierExporte();

            ['currentView', 'search', 'filter', 'showInStockOnly', 'showInCartOnly',
             'aiSuggestions', 'currentSuggestionIdx', 'lastSync'].forEach(cle => {
                expect(fichier).not.toHaveProperty(cle);
            });
        });

        it('les données durables sont toutes là, et rien d\'autre', () => {
            state.ingredients = [ing()];

            const fichier = fichierExporte();

            expect(Object.keys(fichier).sort())
                .toEqual([...BACKUP_STATE_KEYS, 'exportedAt', 'shoppingChecked'].sort());
        });

        it('la sauvegarde est horodatée — l\'oracle l\'avait (l.6490), l\'app l\'avait perdu', () => {
            state.ingredients = [ing()];

            const fichier = fichierExporte();

            expect(Number.isNaN(Date.parse(fichier.exportedAt))).toBe(false);
        });

        it('la clé API n\'est JAMAIS écrite dans le fichier (acquis LOT 008, non régressé)', () => {
            state.ingredients = [ing()];
            state.aiConfig = aiConfig({ apiKey: 'AIzaSyKEY-SECRETE-DE-JOEL' });

            expect(capturedBlobParts).toBeNull();
            const fichier = fichierExporte();

            expect(fichier.aiConfig.apiKey).toBe('');
            expect(capturedBlobParts[0]).not.toContain('AIzaSyKEY-SECRETE-DE-JOEL');
        });

        it('une sauvegarde prise avec un filtre actif se restaure sur un écran PROPRE', async () => {
            state.search = 'tomate';
            state.filter = 'Légumes';
            state.showInStockOnly = true;
            state.currentView = 'ai';

            await restaurer({ ingredients: [ing()] });

            expect(state.search).toBe('');
            expect(state.filter).toBe('all');
            expect(state.showInStockOnly).toBe(false);
            expect(state.showInCartOnly).toBe(false);
            expect(state.currentView).toBe('pantry');
        });

        it('un ANCIEN fichier, qui contient encore la vue et la recherche, ne les réapplique pas', async () => {
            await restaurer({
                ingredients: [ing()],
                currentView: 'shopping', search: 'farine', filter: 'Fruits',
                showInStockOnly: true, aiSuggestions: [{ name: 'X' }]
            });

            expect(state.currentView).toBe('pantry');
            expect(state.search).toBe('');
            expect(state.filter).toBe('all');
        });
    });

    // ─────────────────────────────────────────────────────────────────
    // Chantiers 5 / 10b / 10c — les coches
    // ─────────────────────────────────────────────────────────────────
    describe('chantiers 5 et 10b/10c — les coches de la liste de courses', () => {
        it('aller-retour complet : les coches sont sauvegardées puis restaurées', async () => {
            state.ingredients = [ing({ id: 'a', inCart: true }), ing({ id: 'b', inCart: true })];
            shoppingChecked.add('a');

            const fichier = fichierExporte();
            expect(fichier.shoppingChecked).toEqual(['a']);

            shoppingChecked.clear();
            await restaurer(fichier);

            expect([...shoppingChecked]).toEqual(['a']);
        });

        it('les ANCIENNES coches ne survivent JAMAIS à une restauration', async () => {
            shoppingChecked.add('vieux_id');

            await restaurer({ ingredients: [ing({ id: 'a', inCart: true })], shoppingChecked: ['a'] });

            expect(shoppingChecked.has('vieux_id')).toBe(false);
            expect(shoppingChecked.has('a')).toBe(true);
        });

        it('une ANCIENNE sauvegarde, dépourvue du champ, vide les coches — pas de coche fantôme', async () => {
            shoppingChecked.add('vieux_id');

            await restaurer({ ingredients: [ing({ id: 'a', inCart: true })] });

            expect(shoppingChecked.size).toBe(0);
        });

        it('les coches restaurées sont FILTRÉES : un id absent de l\'inventaire n\'entre pas', async () => {
            await restaurer({
                ingredients: [ing({ id: 'a', inCart: true })],
                shoppingChecked: ['a', 'fantome']
            });

            expect([...shoppingChecked]).toEqual(['a']);
        });

        it('les coches restaurées sont FILTRÉES : un id présent mais PAS « à acheter » n\'entre pas '
           + '— sinon il serait invisible à l\'écran mais poussé au cloud', async () => {
            await restaurer({
                ingredients: [ing({ id: 'a', inCart: true }), ing({ id: 'b', inCart: false })],
                shoppingChecked: ['a', 'b']
            });

            expect([...shoppingChecked]).toEqual(['a']);
        });

        it('les coches n\'apparaissent JAMAIS comme une clé de l\'état — le doublon SSOT '
           + 'était le second défaut BLOQUANT', async () => {
            await restaurer({
                ingredients: [ing({ id: 'a', inCart: true })],
                shoppingChecked: ['a']
            });

            expect('shoppingChecked' in state).toBe(false);
            expect(shoppingChecked).toBeInstanceOf(Set);
        });

        it('un état déjà pollué par une version antérieure se répare tout seul (audit Gemini Q9)', () => {
            state.ingredients = [ing()];
            state.shoppingChecked = ['a', 'b'];

            sanitizeGlobalState();

            expect('shoppingChecked' in state).toBe(false);
        });

        it('l\'état pollué ne peut donc plus se ré-exporter indéfiniment', () => {
            state.ingredients = [ing({ id: 'a', inCart: true })];
            state.shoppingChecked = ['orpheline'];
            shoppingChecked.add('a');

            sanitizeGlobalState();
            const fichier = fichierExporte();

            expect(fichier.shoppingChecked).toEqual(['a']);
        });
    });

    // ─────────────────────────────────────────────────────────────────
    // Chantier 10d — la garde d'entrée
    // ─────────────────────────────────────────────────────────────────
    describe('chantier 10d — la garde d\'entrée du fichier restauré', () => {
        it('un fichier à inventaire VIDE est refusé, sans reconstruire les 297 par défaut', async () => {
            state.ingredients = [ing({ id: 'existant' })];

            await restaurer({ ingredients: [] });

            expect(state.ingredients).toHaveLength(1);
            expect(state.ingredients[0].id).toBe('existant');
            expect(state.ingredients.length).not.toBe(DEFAULT_DB.length);
            expect(toasts()).toContain('Format non reconnu');
        });

        it('un fichier refusé ne déclenche AUCUN envoi cloud', async () => {
            const planificateur = vi.fn();
            registerSyncScheduler(planificateur);
            state.ingredients = [ing({ id: 'existant' })];

            await restaurer({ ingredients: [] });

            expect(planificateur).not.toHaveBeenCalled();
        });

        it('« ingredients » en CHAÎNE est refusé : "abc" devenait [a,b,c], filtré à vide, '
           + 'puis reconstruit en 297 et envoyé au cloud (piège P5)', async () => {
            const planificateur = vi.fn();
            registerSyncScheduler(planificateur);
            state.ingredients = [ing({ id: 'existant' })];

            await restaurer({ ingredients: 'abc' });

            expect(state.ingredients).toHaveLength(1);
            expect(planificateur).not.toHaveBeenCalled();
            expect(toasts()).toContain('Format non reconnu');
        });

        it('un fichier sans inventaire du tout est refusé', async () => {
            await restaurer({ favorites: [{ id: 'f1' }] });

            expect(state.favorites).toHaveLength(0);
            expect(toasts()).toContain('Format non reconnu');
        });

        it('un JSON illisible affiche une erreur au lieu de planter', async () => {
            await restaurer('{ ceci n\'est pas du JSON');

            expect(toasts().some(t => t.startsWith('Erreur lors de l\'import'))).toBe(true);
        });
    });

    // ─────────────────────────────────────────────────────────────────
    // Chantier 5 — l'articulation avec la synchro (le risque principal)
    // ─────────────────────────────────────────────────────────────────
    describe('chantier 5 — articulation avec la synchro cloud', () => {
        it('la restauration ATTEND la fin d\'un envoi déjà en vol avant d\'écrire quoi que ce soit '
           + '— sans quoi cet envoi pouvait aboutir après et réécraser l\'ancien état', async () => {
            state.ingredients = [ing({ id: 'ancien' })];
            let inventaireAuMomentDeLaBarriere = null;
            registerSyncBarrier(() => {
                inventaireAuMomentDeLaBarriere = state.ingredients.map(i => i.id);
                return Promise.resolve();
            });

            await restaurer({ ingredients: [ing({ id: 'restaure' })] });

            expect(inventaireAuMomentDeLaBarriere).toEqual(['ancien']);
            expect(state.ingredients.map(i => i.id)).toEqual(['restaure']);
        });

        it('l\'état ET les coches sont écrits AVANT que l\'envoi cloud soit planifié, '
           + 'pour qu\'ils partent dans le MÊME document', async () => {
            let vuALaPlanification = null;
            registerSyncScheduler(() => {
                vuALaPlanification = {
                    ingredients: state.ingredients.map(i => i.id),
                    coches: [...shoppingChecked]
                };
            });

            await restaurer({
                ingredients: [ing({ id: 'a', inCart: true })],
                shoppingChecked: ['a']
            });

            expect(vuALaPlanification).toEqual({ ingredients: ['a'], coches: ['a'] });
        });

        it('la clé API locale survit à la restauration, même si le fichier en contient une autre', async () => {
            state.aiConfig = aiConfig({ apiKey: 'MA-CLE-LOCALE' });

            await restaurer({
                ingredients: [ing()],
                aiConfig: aiConfig({ apiKey: 'CLE-DU-FICHIER' })
            });

            expect(state.aiConfig.apiKey).toBe('MA-CLE-LOCALE');
        });

        it('un fichier PARTIEL laisse intactes les données qu\'il ne contient pas', async () => {
            state.favorites = [{ id: 'fav_garde' }];

            await restaurer({ ingredients: [ing()] });

            expect(state.favorites).toEqual([{ id: 'fav_garde' }]);
        });
    });

    // ─────────────────────────────────────────────────────────────────
    // §G — la porte laissée ouverte à côté (arbitrage de Joel)
    // ─────────────────────────────────────────────────────────────────
    describe('§G — « Importer uniquement le stock » ne laisse plus de coche fantôme', () => {
        it('un article coché que le fichier repasse à « plus à acheter » sort du Set', () => {
            state.ingredients = [ing({ id: 'a', inCart: true })];
            shoppingChecked.add('a');
            contenuFichier = JSON.stringify({ ingredients: [{ id: 'a', inCart: false, inStock: true }] });

            importStockOnly({});

            expect(state.ingredients[0].inCart).toBe(false);
            expect(shoppingChecked.has('a')).toBe(false);
        });

        it('un article qui RESTE à acheter garde sa coche (pas de purge aveugle)', () => {
            state.ingredients = [ing({ id: 'a', inCart: true })];
            shoppingChecked.add('a');
            contenuFichier = JSON.stringify({ ingredients: [{ id: 'a', inCart: true }] });

            importStockOnly({});

            expect(shoppingChecked.has('a')).toBe(true);
        });

        // jsdom interdit d'affecter une valeur non vide à un `input[type=file]` : un test
        // qui lirait `champ.value` passerait au vert SANS le correctif, puisque la valeur
        // vaut déjà ''. On observe donc l'ÉCRITURE elle-même, via un accesseur témoin.
        function champTemoin(avecFichier = true) {
            let valeur = 'C:/fakepath/sauvegarde.json';
            return {
                files: avecFichier ? [{}] : [],
                get value() { return valeur; },
                set value(v) { valeur = v; },
                get aEteReArme() { return valeur === ''; }
            };
        }

        it('le champ fichier est RÉARMÉ après une restauration : sans cela, resélectionner '
           + 'LE MÊME fichier ne déclenche plus rien la seconde fois', async () => {
            contenuFichier = JSON.stringify({ ingredients: [ing()] });
            const champ = champTemoin();

            window.restoreJSON({ target: champ });
            await lectureEnCours;

            expect(champ.aEteReArme).toBe(true);
        });

        it('le réarmement a lieu MÊME quand l\'utilisateur annule la boîte de dialogue '
           + '(aucun fichier choisi) — il est posé HORS du test de présence', () => {
            const champ = champTemoin(false);

            expect(() => window.restoreJSON({ target: champ })).not.toThrow();
            expect(champ.aEteReArme).toBe(true);
        });

        it('la fusion douce reste une fusion : favoris et réglages ne bougent pas', () => {
            state.ingredients = [ing({ id: 'a' })];
            state.favorites = [{ id: 'fav' }];
            state.aiConfig = aiConfig({ apiKey: 'MA-CLE', ppl: '4' });
            contenuFichier = JSON.stringify({ ingredients: [{ id: 'a', inStock: true }] });

            importStockOnly({});

            expect(state.favorites).toEqual([{ id: 'fav' }]);
            expect(state.aiConfig.apiKey).toBe('MA-CLE');
            expect(state.aiConfig.ppl).toBe('4');
            expect(state.ingredients[0].inStock).toBe(true);
        });
    });
});
