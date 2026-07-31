/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { state, shoppingChecked, defaultAiConfig } from '../src/state.js';
import { setupTestDOM, resetTestState } from './_helpers/dom-helpers.js';
// handleAddInput n'est exposée que sur `window` (js/app.js:2795, bloc expose()) — comme
// searchEmojiAddAI, jamais dans le bloc `export {}` réservé aux tests.
import '../js/app.js';

// LOT 013 — handleAddInput (js/app.js:2089) n'avait AUCUN test avant ce lot. C'est la
// fonction la plus coûteuse du périmètre : double temporisation (200 ms grille d'emojis,
// 800 ms suggestion IA) et un jeton anti-course (`_aiSuggestGenId`) qui protège contre
// l'inversion de deux réponses IA en vol (LOT 006, acquis #14).
//
// "xyzfoo"/"xyzbar" sont choisis parce qu'ils ne matchent NI un nom exact de DEFAULT_DB NI
// aucune règle de premier mot de guessCategoryLocally — ils forcent le passage par l'IA.
// "Tomate" (exact, DEFAULT_DB) et "tomate surprise" (premier mot seulement) couvrent les
// deux branches de la détection locale.

async function flush(n = 15) {
    for (let i = 0; i < n; i++) await Promise.resolve();
}

function fetchOk(body) {
    return { ok: true, status: 200, json: () => Promise.resolve(body) };
}

function geminiEnveloppe(objetJson) {
    return { candidates: [{ content: { parts: [{ text: JSON.stringify(objetJson) }] } }] };
}

describe('LOT 013 — handleAddInput (js/app.js, accessible via window)', () => {
    beforeEach(() => {
        setupTestDOM('add');
        resetTestState(state, shoppingChecked, defaultAiConfig, { aiConfig: { ...defaultAiConfig(), apiKey: 'CLE_TEST' } });
        vi.useFakeTimers();
    });

    afterEach(() => {
        // `_isManualCategory` est une variable de MODULE (`src/ui/addForm.js` depuis le LOT 014),
        // sans trappe de reset dédiée (P10 relevé en découverte du LOT 013) — seule
        // `switchView('add')` les remet à zéro (js/app.js:628 + renderAdd() via
        // renderCurrentView). Sans cet appel, un test qui active le mode manuel
        // contaminerait tous les suivants du même fichier.
        window.switchView('add');
        vi.clearAllTimers();
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('champ vidé : réinitialise résultats, emoji, catégorie et indicateur', () => {
        document.getElementById('add-results-list').innerHTML = '<div>reste d\'un tour précédent</div>';
        document.getElementById('add-emoji').value = '🍅';
        document.getElementById('add-category').value = 'Légumes';
        document.getElementById('category-suggestion-indicator').style.display = 'block';

        window.handleAddInput('');

        expect(document.getElementById('add-results-list').children.length).toBe(0);
        expect(document.getElementById('add-emoji').value).toBe('');
        expect(document.getElementById('add-category').value).toBe('');
        expect(document.getElementById('category-suggestion-indicator').style.display).toBe('none');
    });

    it('champ vidé (espaces uniquement) : traité comme vide', () => {
        document.getElementById('add-emoji').value = '🍅';
        window.handleAddInput('   ');
        expect(document.getElementById('add-emoji').value).toBe('');
    });

    it('autocomplétion DB : propose jusqu\'à 5 correspondances, immédiatement (pas de temporisation)', () => {
        window.handleAddInput('tomate');
        const items = [...document.querySelectorAll('#add-results-list .add-res-item')];
        expect(items.length).toBeGreaterThan(0);
        expect(items.length).toBeLessThanOrEqual(5);
        expect(items.some(i => i.textContent.includes('Tomate'))).toBe(true);
    });

    it('sous le seuil de 3 caractères : pas d\'appel IA programmé, même avec une clé API', async () => {
        window.handleAddInput('to');
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        await vi.advanceTimersByTimeAsync(800);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('détection locale — correspondance EXACTE : catégorie et emoji appliqués tout de suite, '
       + 'et l\'IA n\'est PAS appelée', async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);

        window.handleAddInput('Tomate');

        expect(document.getElementById('add-category').value).toBe('Légumes');
        expect(document.getElementById('add-emoji').value).toBe('🍅');
        expect(document.getElementById('category-suggestion-indicator').textContent).toMatch(/auto-détectée/);

        await vi.advanceTimersByTimeAsync(800);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('détection locale — correspondance par PREMIER MOT (pas d\'entrée exacte) : catégorie '
       + 'posée tout de suite, mais l\'IA reste appelée ensuite et peut la réécraser '
       + '(acquis LOT 006 : "l\'IA écrase toujours la détection locale")', async () => {
        window.handleAddInput('tomate surprise'); // "tomate" = 1er mot de la liste "légumes"
        expect(document.getElementById('add-category').value).toBe('Légumes');

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fetchOk(geminiEnveloppe({ category: 'Plats & Préparations', emojis: ['🍽️'] }))));
        await vi.advanceTimersByTimeAsync(800);
        await flush();

        expect(document.getElementById('add-category').value).toBe('Plats & Préparations');
    });

    it('catégorie choisie manuellement (_onManualCategoryChange) : la détection locale ET '
       + 'l\'IA sont court-circuitées, la valeur de l\'utilisateur n\'est jamais touchée', async () => {
        window._onManualCategoryChange();
        document.getElementById('add-category').value = 'Épices sèches';

        const fetchMock = vi.fn();
        vi.stubGlobal('fetch', fetchMock);
        window.handleAddInput('tomate'); // aurait normalement déclenché la détection locale

        expect(document.getElementById('add-category').value).toBe('Épices sèches');
        await vi.advanceTimersByTimeAsync(800);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('réponse IA sans JSON exploitable : n\'écrase rien, remet juste l\'indicateur à zéro '
       + '(pas de plantage)', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fetchOk({ candidates: [{ content: { parts: [{ text: 'Désolé, je ne sais pas.' }] } }] })));

        window.handleAddInput('xyzfoo');
        await vi.advanceTimersByTimeAsync(800);
        await flush();

        expect(document.getElementById('add-category').value).toBe('');
        expect(document.getElementById('category-suggestion-indicator').style.display).toBe('none');
    });

    // LOT 014 — trouvé par audit adversarial le 2026-07-31, vérifié sur pièce : un élément du
    // tableau `emojis` qui n'a pas la forme d'un emoji construisait un sélecteur CSS invalide
    // (`[data-emoji="${e}"]`), ce qui LEVAIT dans le `catch` global et éteignait la catégorie
    // déjà correctement posée juste avant. Même filet que `cartPicker.js`/`stockMatch.js`
    // (SSOT `AI_EMOJI_ONLY`).
    it('un emoji malformé (guillemet dans la valeur) ne casse plus le sélecteur et n\'efface '
       + 'pas la catégorie déjà posée', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fetchOk(
            geminiEnveloppe({ category: 'Fruits', emojis: ['🍎', 'trop "bon"'] })
        )));

        window.handleAddInput('xyzfoo');
        await vi.advanceTimersByTimeAsync(800);
        await flush();

        expect(document.getElementById('add-category').value).toBe('Fruits');
        expect(document.getElementById('category-suggestion-indicator').textContent)
            .toBe('✨ Catégorie suggérée par l\'IA');
        expect([...document.querySelectorAll('#emoji-suggestions .emoji-sug-btn')].map(b => b.dataset.emoji))
            .toEqual(['🍎']);
    });

    it('un emoji qui est en fait un mot de texte est écarté de la grille, la catégorie reste',
       async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fetchOk(
            geminiEnveloppe({ category: 'Fruits', emojis: ['pomme', '🍎'] })
        )));

        window.handleAddInput('xyzfoo');
        await vi.advanceTimersByTimeAsync(800);
        await flush();

        expect(document.getElementById('add-category').value).toBe('Fruits');
        expect([...document.querySelectorAll('#emoji-suggestions .emoji-sug-btn')].map(b => b.dataset.emoji))
            .toEqual(['🍎']);
    });

    // ─── LOT 014 — extracteur JSON unique (correctif validé par Joel le 2026-07-31) ────────
    // Avant : la lecture de la réponse s'arrêtait à la première accolade fermante, et c'est
    // son ÉCHEC qui servait de signal « réponse inutilisable » pour éteindre l'indicateur.
    // Deux conséquences réelles, verrouillées ci-dessous.

    it('réponse IA contenant un objet IMBRIQUÉ : la suggestion est appliquée (avant ce '
       + 'correctif, la lecture coupait au premier « } » et la suggestion disparaissait '
       + 'SANS le moindre message)', async () => {
        const brut = '{"category":"Fruits","meta":{"source":"db"},"emojis":["🍎"]}';
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fetchOk({ candidates: [{ content: { parts: [{ text: brut }] } }] })));

        window.handleAddInput('xyzfoo');
        await vi.advanceTimersByTimeAsync(800);
        await flush();

        expect(document.getElementById('add-category').value).toBe('Fruits');
        expect(document.getElementById('add-emoji').value).toBe('🍎');
        expect(document.getElementById('category-suggestion-indicator').textContent)
            .toBe('✨ Catégorie suggérée par l\'IA');
    });

    it('réponse LISIBLE mais sans catégorie : « Analyse par l\'IA… » s\'éteint quand même — '
       + 'sinon le message tournerait indéfiniment sous les yeux de Joel', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
            fetchOk(geminiEnveloppe({ erreur: 'je ne sais pas' }))
        ));

        window.handleAddInput('xyzfoo');
        expect(document.getElementById('category-suggestion-indicator').textContent)
            .toBe('✨ Analyse par l\'IA...');   // le message est bien allumé avant la réponse

        await vi.advanceTimersByTimeAsync(800);
        await flush();

        expect(document.getElementById('category-suggestion-indicator').style.display).toBe('none');
    });

    it('réponse rendue sous forme de TABLEAU : même règle — l\'indicateur s\'éteint. C\'est '
       + 'le piège exact du correctif : une lecture plus tolérante réussit désormais là où '
       + 'elle échouait, donc l\'extinction ne peut plus reposer sur son échec', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
            fetchOk(geminiEnveloppe([{ category: 'Fruits' }]))
        ));

        window.handleAddInput('xyzfoo');
        await vi.advanceTimersByTimeAsync(800);
        await flush();

        expect(document.getElementById('add-category').value).toBe('');
        expect(document.getElementById('category-suggestion-indicator').style.display).toBe('none');
    });

    it('catégorie qui n\'est PAS un texte : la garde de type de `sanitizeCategory` fait '
       + 'toujours autorité (repli sur une catégorie utilisable), la lecture du JSON ne la '
       + 'court-circuite pas', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
            fetchOk(geminiEnveloppe({ category: 42, emojis: ['🛸'] }))
        ));

        window.handleAddInput('xyzfoo');
        await vi.advanceTimersByTimeAsync(800);
        await flush();

        expect(document.getElementById('add-category').value).toBe('Conserves & bocaux');
        expect(document.getElementById('category-suggestion-indicator').textContent)
            .toBe('✨ Catégorie suggérée par l\'IA');
    });

    it('liste d\'emojis rendue en CHAÎNE au lieu d\'un tableau : elle est ignorée, mais la '
       + 'catégorie comprise reste acquise (avant, elle faisait lever et effaçait '
       + 'l\'indicateur qu\'on venait de poser)', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
            fetchOk(geminiEnveloppe({ category: 'Fruits', emojis: '🍎🍏' }))
        ));

        window.handleAddInput('xyzfoo');
        await vi.advanceTimersByTimeAsync(800);
        await flush();

        expect(document.getElementById('add-category').value).toBe('Fruits');
        // `display` autant que le texte : sans lui, une exception levée APRÈS la pose de la
        // catégorie éteignait l'indicateur en laissant son texte en place — et le test
        // passait quand même (faux verrou trouvé par la preuve par retrait, LOT 014).
        expect(document.getElementById('category-suggestion-indicator').style.display).toBe('block');
        expect(document.getElementById('category-suggestion-indicator').textContent)
            .toBe('✨ Catégorie suggérée par l\'IA');
    });

    it('panne réseau pendant l\'appel IA : n\'écrase rien, ne relève pas d\'exception '
       + 'observable par l\'appelant', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

        window.handleAddInput('xyzfoo');
        await expect(vi.advanceTimersByTimeAsync(800)).resolves.not.toThrow();
        await flush();

        expect(document.getElementById('add-category').value).toBe('');
    });

    it('JETON ANTI-COURSE : une réponse IA périmée, résolue APRÈS la réponse fraîche, '
       + 'est ignorée — la saisie la plus récente gagne toujours (acquis LOT 006, #14)', async () => {
        const resolveurs = [];
        vi.stubGlobal('fetch', vi.fn(() => new Promise(resolve => resolveurs.push(resolve))));

        // Frappe n°1 : "xyzfoo" — programme l'appel IA n°1.
        window.handleAddInput('xyzfoo');
        await vi.advanceTimersByTimeAsync(800); // le timer n°1 se déclenche, l'appel n°1 part (en vol)

        // Avant que la réponse n°1 revienne, l'utilisateur corrige sa saisie.
        window.handleAddInput('xyzbar');
        await vi.advanceTimersByTimeAsync(800); // le timer n°2 se déclenche, l'appel n°2 part (en vol)

        expect(resolveurs.length).toBe(2);

        // La réponse n°1 (périmée) revient EN DERNIER — c'est le scénario que le jeton protège.
        resolveurs[1](fetchOk(geminiEnveloppe({ category: 'Produits laitiers', emojis: ['🧀'] }))); // n°2 (frais) d'abord
        await flush();
        resolveurs[0](fetchOk(geminiEnveloppe({ category: 'Épices sèches', emojis: ['🌶️'] }))); // n°1 (périmé) ensuite
        await flush();

        // Le résultat visible doit être celui de la saisie ENCORE PRÉSENTE ("xyzbar"), jamais
        // celui de "xyzfoo" qui a répondu en dernier.
        expect(document.getElementById('add-category').value).toBe('Produits laitiers');
        expect(document.getElementById('add-emoji').value).toBe('🧀');
        // Sélecteur d'ATTRIBUT PAR VALEUR évité ici (piège P13 — jsdom ne matche pas un
        // attribut de valeur astrale entre guillemets) : présence + lecture JS, pas requête.
        const emojisAffiches = [...document.querySelectorAll('#emoji-suggestions [data-emoji]')].map(e => e.dataset.emoji);
        expect(emojisAffiches).not.toContain('🌶️');
    });

    // FAUX VERROU FV-4 (audit adversarial du 2026-07-31, mutation M21) : le test ci-dessus
    // ne couvre que la course FRAPPE → FRAPPE, dont le jeton est pris en js/app.js:2154 et
    // vérifié en :2160. L'invalidation lors de l'EFFACEMENT du champ vit ailleurs
    // (js/app.js:2099) : la supprimer laissait les 559 tests verts, alors qu'une réponse IA
    // en vol venait alors réécrire catégorie et emoji dans un formulaire que Joel avait vidé.
    it('JETON ANTI-COURSE (2e moitié) : vider le champ invalide la requête IA en vol — '
       + 'elle ne réécrit rien dans un formulaire vidé', async () => {
        const resolveurs = [];
        vi.stubGlobal('fetch', vi.fn(() => new Promise(resolve => resolveurs.push(resolve))));

        window.handleAddInput('xyzfoo');
        await vi.advanceTimersByTimeAsync(800); // l'appel IA part, il est en vol
        expect(resolveurs.length).toBe(1);

        // Joel efface tout avant que la réponse revienne.
        window.handleAddInput('');
        expect(document.getElementById('add-category').value).toBe('');

        // La réponse périmée atterrit maintenant.
        resolveurs[0](fetchOk(geminiEnveloppe({ category: 'Épices sèches', emojis: ['🌶️'] })));
        await flush();

        expect(document.getElementById('add-category').value).toBe('');
        expect(document.getElementById('add-emoji').value).toBe('');
    });

    // LOT 014, volet C — même règle que `searchEmojiAddAI` : la saisie de Joel est interpolée
    // entre guillemets dans une consigne qui décrit elle-même du JSON à guillemets doubles.
    // C'est le prompt le plus exposé de l'app, puisqu'il part à chaque frappe.
    it('§C — un guillemet saisi est échappé dans la consigne de catégorisation', async () => {
        const fetchMock = vi.fn().mockResolvedValue(fetchOk(geminiEnveloppe({ category: 'Légumes', emojis: ['🥕'] })));
        vi.stubGlobal('fetch', fetchMock);

        window.handleAddInput('xyz"foo');
        await vi.advanceTimersByTimeAsync(800);
        await flush();

        const prompt = JSON.parse(fetchMock.mock.calls[0][1].body).contents[0].parts[0].text;
        expect(prompt).toContain('xyz\\"foo');
    });

    // FAUX VERROU FV-5 (audit adversarial du 2026-07-31, mutation M26) : la garde
    // `!emojiInput.value` de js/app.js:2189 empêche l'IA d'écraser un emoji que Joel a déjà
    // choisi. La retirer laissait les 559 tests verts. La règle jumelle de searchEmojiAddAI
    // était testée, celle de handleAddInput ne l'était pas.
    it('l\'IA n\'écrase JAMAIS un emoji déjà choisi manuellement', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fetchOk(geminiEnveloppe({ category: 'Légumes', emojis: ['🥕'] }))));
        document.getElementById('add-emoji').value = '🥬'; // choix de Joel, antérieur

        window.handleAddInput('xyzfoo');
        await vi.advanceTimersByTimeAsync(800);
        await flush();

        expect(document.getElementById('add-emoji').value).toBe('🥬');
        // La catégorie, elle, se remplit normalement : seule l'écrasement d'emoji est bloqué.
        expect(document.getElementById('add-category').value).toBe('Légumes');
    });

    it('ajoute les emojis proposés par l\'IA à la grille, avec leur ancre data-emoji '
       + '(dédoublonnage NON prouvable ici — voir commentaire)', async () => {
        // La production dédoublonne via `container.querySelector('[data-emoji="${e}"]')`
        // (js/app.js:2180) AVANT d'ajouter chaque emoji. Vérifié empiriquement en découverte
        // de ce lot (piège P13, fiche du lot) : le moteur de sélecteurs CSS de jsdom (nwsapi)
        // ne matche PAS un sélecteur d'attribut entre guillemets dont la valeur contient un
        // caractère astral (hors plan multilingue de base — le cas de la plupart des emojis
        // alimentaires, dont 🥕 U+1F955), alors qu'un vrai navigateur le fait correctement.
        // Sous jsdom, `handleAddInput` ne peut donc PAS empêcher un doublon : ce test ne
        // prétend PAS prouver le dédoublonnage (jsdom en est incapable), seulement que les
        // emojis reçus atteignent bien la grille — le dédoublonnage exact reste une preuve
        // navigateur, consignée comme telle dans la matrice de couverture.
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fetchOk(geminiEnveloppe({ category: 'Légumes', emojis: ['🥕', '🌿'] }))));

        window.handleAddInput('xyzfoo');
        await vi.advanceTimersByTimeAsync(800);
        await flush();

        const emojis = [...document.querySelectorAll('#emoji-suggestions [data-emoji]')].map(e => e.dataset.emoji);
        expect(emojis).toContain('🥕');
        expect(emojis).toContain('🌿');
    });
});
