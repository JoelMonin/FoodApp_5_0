/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { state } from '../src/state.js';
import { renderTopbar } from '../js/app.js';
import '../js/app.js';

// LOT 015, sous-lot A — les formats de copie vers le presse-papiers.
//
// La zone n'avait AUCUN test avant ce lot : on pouvait supprimer n'importe quel bouton de
// Réglages sans qu'un seul test proteste. Ce fichier fige les 4 chantiers de copie.
//
// Le test le plus important est celui du garde-fou « rien à copier » : l'audit Gemini du
// 2026-07-30 (Q1) a montré que le porter depuis l'oracle tel quel (`if (!text)`,
// `foodapp-v5-Joel.html` l.6483) ne corrigerait RIEN — chaque format écrit son en-tête
// AVANT de regarder les données, donc le texte n'est jamais vide. Le garde-fou porte
// désormais sur la SOURCE, et le test le prouve en vérifiant qu'aucune écriture n'a lieu.

let writeText;

function stubClipboard(impl) {
    writeText = vi.fn(impl || (() => Promise.resolve()));
    Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        configurable: true,
        writable: true
    });
    return writeText;
}

function removeClipboard() {
    Object.defineProperty(navigator, 'clipboard', {
        value: undefined,
        configurable: true,
        writable: true
    });
}

function copied() {
    return writeText.mock.calls.length ? writeText.mock.calls[0][0] : null;
}

function toasts() {
    return [...document.querySelectorAll('.toast')].map(t => t.textContent);
}

function ing(over = {}) {
    return {
        id: 'i1', name: 'Tomate', category: 'Légumes', emoji: '🍅',
        inStock: false, inCart: false, ...over
    };
}

describe('LOT 015 / sous-lot A — copie vers le presse-papiers', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        state.ingredients = [];
        state.customCartItems = [];
        stubClipboard();
    });

    afterEach(() => {
        delete document.execCommand;
    });

    // ─────────────────────────────────────────────────────────────────
    // Chantier 1 — « Copier mon stock » copiait la liste de courses
    // ─────────────────────────────────────────────────────────────────
    describe('chantier 1 — « Copier mon stock (liste simple) »', () => {
        it('copie les ingrédients EN STOCK, jamais ceux à acheter (oracle l.6466-6468)', async () => {
            state.ingredients = [
                ing({ id: 'a', name: 'Tomate', inStock: true }),
                ing({ id: 'b', name: 'Farine', inCart: true }),
                ing({ id: 'c', name: 'Oignon', inStock: false, inCart: false })
            ];

            await window.exportClipboard('simple');

            expect(copied()).toContain('Tomate');
            expect(copied()).not.toContain('Farine');
            expect(copied()).not.toContain('Oignon');
        });

        it('l\'en-tête annonce le stock, plus « LISTE DE COURSES » — c\'est le défaut d\'origine', async () => {
            state.ingredients = [ing({ inStock: true })];

            await window.exportClipboard('simple');

            expect(copied()).toContain('MON STOCK');
            expect(copied()).not.toContain('LISTE DE COURSES');
        });

        it('un ingrédient sans emoji retombe sur le repli 🔸 (comportement conservé)', async () => {
            state.ingredients = [ing({ inStock: true, emoji: '' })];

            await window.exportClipboard('simple');

            expect(copied()).toContain('🔸 Tomate');
        });

        it('un ingrédient SANS NOM est ignoré, et le toast ne le compte pas — l\'assainissement '
           + 'garantit la catégorie et l\'emoji, jamais le nom : la copie affichait '
           + '« 🥩 undefined » en annonçant « 1 ingrédient »', async () => {
            state.ingredients = [
                ing({ id: 'a', name: undefined, emoji: '🥩', inStock: true }),
                ing({ id: 'b', name: '   ', inStock: true }),
                ing({ id: 'c', name: 'Tomate', inStock: true })
            ];

            await window.exportClipboard('simple');

            expect(copied()).not.toContain('undefined');
            expect(toasts()).toContain('Stock copié (1 ingrédient)');
        });

        it('si AUCUN ingrédient n\'a de nom, le garde-fou se déclenche : rien n\'est copié', async () => {
            state.ingredients = [ing({ name: undefined, inStock: true })];

            await window.exportClipboard('simple');

            expect(writeText).not.toHaveBeenCalled();
            expect(toasts()).toContain('Votre stock est vide — rien à copier');
        });
    });

    // ─────────────────────────────────────────────────────────────────
    // Chantier 2 — « Partager par rayons » emportait tout l'inventaire
    // ─────────────────────────────────────────────────────────────────
    describe('chantier 2 — « Partager mon stock par rayons »', () => {
        it('n\'emporte QUE le stock : ni les absents, ni ceux seulement à acheter', async () => {
            state.ingredients = [
                ing({ id: 'a', name: 'Tomate', inStock: true }),
                ing({ id: 'b', name: 'Farine', category: 'Farines & liants', inCart: true }),
                ing({ id: 'c', name: 'Oignon' })
            ];

            await window.exportClipboard('categorized');

            expect(copied()).toContain('Tomate');
            expect(copied()).not.toContain('Farine');
            expect(copied()).not.toContain('Oignon');
        });

        it('chaque rubrique porte l\'emoji de sa catégorie, pris de la SSOT getCategoryEmoji', async () => {
            state.ingredients = [ing({ inStock: true, category: 'Légumes' })];

            await window.exportClipboard('categorized');

            // src/data.js : Légumes → 🥦
            expect(copied()).toContain('🥦 LÉGUMES');
        });

        it('le marqueur ✅ est retiré : la source étant le stock, il vaudrait toujours ✅', async () => {
            state.ingredients = [ing({ inStock: true })];

            await window.exportClipboard('categorized');

            expect(copied()).not.toContain('✅ 🍅');
        });

        it('groupe réellement : deux ingrédients d\'une même catégorie partagent UN SEUL '
           + 'en-tête — vérifier la simple présence des libellés laisserait passer un '
           + 'en-tête répété par ingrédient', async () => {
            state.ingredients = [
                ing({ id: 'a', name: 'Tomate', category: 'Légumes', inStock: true }),
                ing({ id: 'b', name: 'Carotte', category: 'Légumes', emoji: '🥕', inStock: true }),
                ing({ id: 'c', name: 'Pomme', category: 'Fruits', emoji: '🍎', inStock: true })
            ];

            await window.exportClipboard('categorized');

            expect(copied().match(/LÉGUMES/g)).toHaveLength(1);
            expect(copied().match(/FRUITS/g)).toHaveLength(1);
            // Les deux légumes se suivent sous leur unique en-tête.
            expect(copied()).toMatch(/LÉGUMES ---\n🍅 Tomate\n🥕 Carotte/);
        });
    });

    // ─────────────────────────────────────────────────────────────────
    // Chantier 3 — la liste de courses ignorait les articles libres
    // ─────────────────────────────────────────────────────────────────
    describe('chantier 3 — « Copier ma liste de courses » et les articles libres', () => {
        it('inclut les articles libres, invisibles dans l\'app depuis la migration', async () => {
            state.ingredients = [ing({ inCart: true })];
            // Structure RÉELLE de la donnée de Joel (export du 2026-07-29) : id en
            // `extra_cart_`, source `ai-extra`, et AUCUNE catégorie.
            state.customCartItems = [{
                id: 'extra_cart_1774530250912_n3apl4r8w5s',
                name: 'porc haché', emoji: '🥩', checked: false, source: 'ai-extra'
            }];

            await window.exportClipboard('cart');

            expect(copied()).toContain('porc haché');
            expect(copied()).toContain('[ ARTICLES LIBRES ]');
        });

        it('les articles libres ne sont JAMAIS versés dans « Autres » — une vraie catégorie', async () => {
            state.ingredients = [ing({ inCart: true, category: 'Autres', name: 'Bicarbonate' })];
            state.customCartItems = [{ id: 'x', name: 'porc haché', emoji: '🥩' }];

            await window.exportClipboard('cart');

            const autresBlock = copied().split('[ ARTICLES LIBRES ]')[0];
            expect(autresBlock).toContain('Bicarbonate');
            expect(autresBlock).not.toContain('porc haché');
        });

        it('la rubrique des articles libres sort EN DERNIER, même face à une catégorie accentuée '
           + '— le tri par défaut placerait « [ » au milieu (piège P3)', async () => {
            state.ingredients = [
                ing({ id: 'a', name: 'Tomate', category: 'Légumes', inCart: true }),
                ing({ id: 'b', name: 'Cumin', category: 'Épices sèches', emoji: '🫙', inCart: true })
            ];
            state.customCartItems = [{ id: 'x', name: 'porc haché', emoji: '🥩' }];

            await window.exportClipboard('cart');

            const texte = copied();
            expect(texte.indexOf('[ ARTICLES LIBRES ]')).toBeGreaterThan(texte.indexOf('[ LÉGUMES ]'));
            expect(texte.indexOf('[ ARTICLES LIBRES ]')).toBeGreaterThan(texte.indexOf('[ ÉPICES SÈCHES ]'));
        });

        it('sans article libre, aucune rubrique dédiée n\'apparaît (non-régression du cas nominal)', async () => {
            state.ingredients = [ing({ inCart: true })];
            state.customCartItems = [];

            await window.exportClipboard('cart');

            expect(copied()).not.toContain('ARTICLES LIBRES');
        });

        it('un article libre SANS nom exploitable est ignoré — jamais « undefined » '
           + '(audit Gemini Q12 : ces objets ne sont jamais normalisés)', async () => {
            state.ingredients = [ing({ inCart: true })];
            state.customCartItems = [
                { id: 'x', emoji: '🥩' },
                { id: 'y', name: '   ', emoji: '🥩' },
                { id: 'z', name: 42, emoji: '🥩' },
                { id: 'ok', name: 'porc haché', emoji: '🥩' }
            ];

            await window.exportClipboard('cart');

            expect(copied()).not.toContain('undefined');
            expect(copied()).toContain('porc haché');
            expect(copied().match(/☐ 🥩/g)).toHaveLength(1);
        });

        it('un `customCartItems` d\'un TYPE aberrant ne fait pas planter la copie en silence '
           + '— Firebase renvoie parfois un tableau creux sous forme d\'objet', async () => {
            state.ingredients = [ing({ inCart: true })];

            for (const valeurAberrante of [{ 0: { name: 'porc' } }, 'porc haché', 42, null]) {
                writeText.mockClear();
                state.customCartItems = valeurAberrante;

                await expect(window.exportClipboard('cart')).resolves.toBeUndefined();

                expect(copied()).toContain('Tomate');
                expect(copied()).not.toContain('undefined');
            }
        });

        it('des articles libres SEULS suffisent à produire une liste — le panier peut être vide', async () => {
            state.ingredients = [];
            state.customCartItems = [{ id: 'x', name: 'porc haché', emoji: '🥩' }];

            await window.exportClipboard('cart');

            expect(copied()).toContain('porc haché');
            expect(toasts()).toContain('Liste de courses copiée (1 article)');
        });
    });

    // ─────────────────────────────────────────────────────────────────
    // Chantier 4 — suppression sèche du format 'full'
    // ─────────────────────────────────────────────────────────────────
    describe('chantier 4 — le format « Données techniques (JSON) » a disparu', () => {
        it('« full » ne copie plus rien et ne prétend plus avoir réussi', async () => {
            state.ingredients = [ing({ inStock: true })];

            await window.exportClipboard('full');

            expect(writeText).not.toHaveBeenCalled();
            expect(toasts()).toContain('Rien à copier');
        });
    });

    // ─────────────────────────────────────────────────────────────────
    // Chantier 9 — garde-fou « rien à copier » (LE test du sous-lot)
    // ─────────────────────────────────────────────────────────────────
    describe('chantier 9 — garde-fou « rien à copier »', () => {
        it('stock vide → AUCUNE écriture dans le presse-papiers. Un garde-fou naïf sur le '
           + 'texte final laisserait passer « en-tête + (Vide) » et ce test resterait vert à tort', async () => {
            state.ingredients = [ing({ inStock: false, inCart: true })];

            await window.exportClipboard('simple');

            expect(writeText).not.toHaveBeenCalled();
            expect(toasts()).toContain('Votre stock est vide — rien à copier');
        });

        it('partage par rayons sur stock vide → aucune écriture non plus', async () => {
            state.ingredients = [ing({ inStock: false })];

            await window.exportClipboard('categorized');

            expect(writeText).not.toHaveBeenCalled();
        });

        it('liste de courses vide DES DEUX sources → aucune écriture', async () => {
            state.ingredients = [ing({ inStock: true })];
            state.customCartItems = [];

            await window.exportClipboard('cart');

            expect(writeText).not.toHaveBeenCalled();
            expect(toasts()).toContain('Votre liste de courses est vide — rien à copier');
        });

        it('type inconnu → aucune écriture (5e état vide malhonnête, piège P1 : il n\'y '
           + 'avait aucune branche par défaut)', async () => {
            state.ingredients = [ing({ inStock: true })];

            await window.exportClipboard('inexistant');

            expect(writeText).not.toHaveBeenCalled();
            expect(toasts()).toContain('Rien à copier');
        });
    });

    // ─────────────────────────────────────────────────────────────────
    // Chantier 9 — repli de copie
    // ─────────────────────────────────────────────────────────────────
    describe('chantier 9 — repli de copie quand le presse-papiers moderne échoue', () => {
        it('presse-papiers en échec → le texte part quand même par le repli', async () => {
            stubClipboard(() => Promise.reject(new Error('refusé')));
            document.execCommand = vi.fn(() => true);
            state.ingredients = [ing({ inStock: true })];

            await window.exportClipboard('simple');

            expect(document.execCommand).toHaveBeenCalledWith('copy');
            expect(toasts()).toContain('Stock copié (1 ingrédient)');
        });

        it('presse-papiers absent (contexte non sécurisé) → repli aussi', async () => {
            removeClipboard();
            document.execCommand = vi.fn(() => true);
            state.ingredients = [ing({ inStock: true })];

            await window.exportClipboard('simple');

            expect(document.execCommand).toHaveBeenCalledWith('copy');
        });

        it('le repli nettoie derrière lui : aucun <textarea> ne reste dans la page', async () => {
            removeClipboard();
            document.execCommand = vi.fn(() => true);
            state.ingredients = [ing({ inStock: true })];

            await window.exportClipboard('simple');

            expect(document.querySelectorAll('textarea')).toHaveLength(0);
        });

        it('le nettoyage a lieu MÊME si execCommand LÈVE — sans quoi un <textarea> invisible '
           + 'restait dans la page jusqu\'au rechargement', async () => {
            removeClipboard();
            document.execCommand = vi.fn(() => { throw new Error('interdit'); });
            state.ingredients = [ing({ inStock: true })];

            await window.exportClipboard('simple');

            expect(document.querySelectorAll('textarea')).toHaveLength(0);
            expect(toasts()).toContain('Erreur lors de la copie');
        });

        // FAUX VERROU FV-1 (audit adversarial du 2026-07-31, mutations M18 vs M48) — ce test
        // était TAUTOLOGIQUE dans sa forme d'origine. Il n'assertait que
        // `document.activeElement === champ` : or sous jsdom, le `ta.select()` du repli
        // (js/app.js:1702) ne DÉPLACE PAS le focus. Le repli ne volait donc jamais le focus
        // dans l'environnement de test, et l'assertion était vraie par construction — supprimer
        // purement la restauration (js/app.js:1710) laissait le test vert.
        //
        // On teste donc le MÉCANISME et non son effet observable : la restauration doit être
        // réellement appelée sur le champ mémorisé. C'est la seule chose que jsdom permette de
        // prouver ici ; l'effet visuel reste, lui, une preuve navigateur.
        it('le repli REND le focus au champ que l\'utilisateur était en train de remplir '
           + '(mécanisme espionné : jsdom ne vole jamais le focus, cf. FV-1)', async () => {
            removeClipboard();
            document.execCommand = vi.fn(() => true);
            document.body.innerHTML = '<input id="saisie-en-cours">';
            const champ = document.getElementById('saisie-en-cours');
            champ.focus();
            const focusSpy = vi.spyOn(champ, 'focus');
            state.ingredients = [ing({ inStock: true })];

            await window.exportClipboard('simple');

            expect(focusSpy).toHaveBeenCalled();
            expect(document.activeElement).toBe(champ);
        });

        // Corollaire : la restauration vit dans le `finally` (js/app.js:1706-1711), donc elle
        // doit avoir lieu MÊME quand la copie échoue — sinon un échec de copie laisserait Joel
        // avec le curseur nulle part.
        it('le focus est rendu MÊME si la copie de repli échoue', async () => {
            removeClipboard();
            document.execCommand = vi.fn(() => { throw new Error('interdit'); });
            document.body.innerHTML = '<input id="saisie-en-cours">';
            const champ = document.getElementById('saisie-en-cours');
            champ.focus();
            const focusSpy = vi.spyOn(champ, 'focus');
            state.ingredients = [ing({ inStock: true })];

            await window.exportClipboard('simple');

            expect(focusSpy).toHaveBeenCalled();
        });

        it('execCommand qui échoue SILENCIEUSEMENT (retour false) est traité comme un échec '
           + '— l\'oracle ne lisait pas ce retour', async () => {
            removeClipboard();
            document.execCommand = vi.fn(() => false);
            state.ingredients = [ing({ inStock: true })];

            await window.exportClipboard('simple');

            expect(toasts()).toContain('Erreur lors de la copie');
        });

        it('aucun moyen de copier du tout → message d\'erreur, pas de plantage', async () => {
            removeClipboard();
            state.ingredients = [ing({ inStock: true })];

            await expect(window.exportClipboard('simple')).resolves.toBeUndefined();
            expect(toasts()).toContain('Erreur lors de la copie');
        });
    });

    // ─────────────────────────────────────────────────────────────────
    // Chantier 8 — toasts honnêtes et chiffrés
    // ─────────────────────────────────────────────────────────────────
    describe('chantier 8 — toasts chiffrés', () => {
        it('annonce le nombre réel d\'ingrédients copiés', async () => {
            state.ingredients = [
                ing({ id: 'a', inStock: true }),
                ing({ id: 'b', name: 'Pomme', inStock: true }),
                ing({ id: 'c', name: 'Farine', inCart: true })
            ];

            await window.exportClipboard('simple');

            expect(toasts()).toContain('Stock copié (2 ingrédients)');
        });

        it('accorde le singulier', async () => {
            state.ingredients = [ing({ inStock: true })];

            await window.exportClipboard('simple');

            expect(toasts()).toContain('Stock copié (1 ingrédient)');
        });

        it('la liste de courses compte les DEUX sources ensemble', async () => {
            state.ingredients = [ing({ inCart: true })];
            state.customCartItems = [
                { id: 'x', name: 'porc haché', emoji: '🥩' },
                { id: 'y', name: 'piles', emoji: '🔋' }
            ];

            await window.exportClipboard('cart');

            expect(toasts()).toContain('Liste de courses copiée (3 articles)');
        });
    });

    // ─────────────────────────────────────────────────────────────────
    // Critère d'acceptation permanent : la clé API ne sort jamais de l'appareil.
    // Le fichier de sauvegarde est couvert par tests/backup-restore.test.js ; ici on
    // ferme l'autre sortie possible, le presse-papiers.
    // ─────────────────────────────────────────────────────────────────
    describe('la clé API ne part JAMAIS dans le presse-papiers', () => {
        it.each(['simple', 'categorized', 'cart'])('format « %s »', async (format) => {
            state.aiConfig = { ...(state.aiConfig || {}), apiKey: 'AIzaSyKEY-SECRETE-DE-JOEL' };
            state.ingredients = [ing({ inStock: true, inCart: true })];

            await window.exportClipboard(format);

            expect(copied()).toBeTruthy();
            expect(copied()).not.toContain('AIzaSy');
        });
    });

    // ─────────────────────────────────────────────────────────────────
    // Le SECOND point d'entrée, trouvé à la phase découverte : il n'était
    // couvert que sur son LIBELLÉ (tests/topbar-context.test.js), jamais sur son effet —
    // on pouvait donc casser la copie sans qu'aucun test de la barre ne bronche.
    // ─────────────────────────────────────────────────────────────────
    describe('second point d\'entrée — bouton « 📋 Copier » de la barre supérieure', () => {
        it('copie réellement la liste de courses, articles libres compris', async () => {
            document.body.innerHTML = `
                <div id="topbar-title"></div>
                <div class="tb-search" id="tb-search-wrap"><input id="search-input"></div>
                <div class="header-actions"><div id="top-action-btn"></div></div>
                <div class="mh-sub" id="mh-subtitle"></div>
                <div class="mh-icons">
                    <div id="sync-indicator-mobile" class="sync-indicator"></div>
                    <div class="mh-icon" id="mh-context-icon" style="display:none"></div>
                </div>
                <div id="sb-label-principal"></div>
                <div id="mobile-search"></div>
            `;
            state.favorites = [];
            state.search = '';
            state.ingredients = [ing({ inCart: true })];
            state.customCartItems = [{ id: 'x', name: 'porc haché', emoji: '🥩' }];

            renderTopbar('shopping');
            const bouton = [...document.querySelectorAll('#top-action-btn button')]
                .find(b => b.textContent.includes('Copier'));
            expect(bouton).toBeTruthy();

            bouton.click();
            await Promise.resolve();
            await Promise.resolve();

            expect(copied()).toContain('Tomate');
            expect(copied()).toContain('porc haché');
        });
    });
});
