/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fetchRecipeFromUrl } from '../js/app.js';

// LOT 011, chantier 6 — allorigins (HTML brut, pas de titre) remplacé par Jina Reader
// (texte propre + titre auto), à l'identique de l'oracle (foodapp-v5-Joel.html l.5944-5974).
// Arbitrage Joel (fiche LOT 011, §9 Q2) : AUCUN repli sur un autre service — un seul
// lecteur, message d'erreur explicite sinon. Durcissements post-audit (§10-D) : délai
// d'expiration de 10 s, réponse vide traitée comme un échec.

function setupDom() {
    document.body.innerHTML = `
        <input id="paste-url">
        <button id="paste-fetch-btn"></button>
        <textarea id="paste-content"></textarea>
        <input id="paste-title">
    `;
}

function dernierToast() {
    return document.querySelector('#toast-container .toast')?.textContent;
}

describe('LOT 011 / chantier 6 — récupération d\'URL via Jina Reader', () => {
    beforeEach(() => {
        setupDom();
        vi.stubGlobal('fetch', vi.fn());
    });

    it('URL vide : refuse sans appeler le réseau (restauration oracle, validation oubliée par la version appauvrie)', async () => {
        document.getElementById('paste-url').value = '';

        await fetchRecipeFromUrl();

        expect(fetch).not.toHaveBeenCalled();
        expect(dernierToast()).toContain('Veuillez entrer une adresse URL');
    });

    it('URL sans http(s) : refuse sans appeler le réseau', async () => {
        document.getElementById('paste-url').value = 'exemple.com/recette';

        await fetchRecipeFromUrl();

        expect(fetch).not.toHaveBeenCalled();
        expect(dernierToast()).toContain('doit commencer par http');
    });

    // ⚠️ TEST MODIFIÉ AU LOT 025, VOLET D — modification DÉCLARÉE dans la spec (§10.1 bis),
    // conséquence du finding 5 de l'audit Codex. Son INTENTION est intacte : URL exacte, sans
    // encodage, jamais allorigins. Seul le comptage `toHaveBeenCalledTimes(1)` change : une
    // page sans fiche structurée est désormais lue DEUX fois (HTML puis texte), par le même
    // service. Le comptage à 1 était incident à ce test, pas son objet — le nombre d'appels
    // est vérifié explicitement par les tests du volet D ci-dessous.
    it('appelle Jina Reader avec l\'URL exacte (sans encodage), jamais allorigins', async () => {
        document.getElementById('paste-url').value = 'https://exemple.com/recette-tarte';
        fetch.mockResolvedValue({
            ok: true,
            text: () => Promise.resolve('# Tarte aux pommes\nUne recette simple.')
        });

        await fetchRecipeFromUrl();

        for (const [calledUrl] of fetch.mock.calls) {
            expect(calledUrl).toBe('https://r.jina.ai/https://exemple.com/recette-tarte');
            expect(calledUrl).not.toContain('allorigins');
        }
    });

    it('remplit le contenu ET extrait le titre de la première ligne Markdown', async () => {
        document.getElementById('paste-url').value = 'https://exemple.com/recette';
        fetch.mockResolvedValue({
            ok: true,
            text: () => Promise.resolve('## Tarte aux pommes\nUne recette simple.')
        });

        await fetchRecipeFromUrl();

        expect(document.getElementById('paste-content').value).toContain('Une recette simple.');
        expect(document.getElementById('paste-title').value).toBe('Tarte aux pommes');
    });

    it('page vide : traitée comme un échec, contenu non rempli (durcissement §10-D)', async () => {
        document.getElementById('paste-url').value = 'https://exemple.com/recette';
        fetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('   ') });

        await fetchRecipeFromUrl();

        expect(dernierToast()).toContain('Erreur de lecture');
        expect(document.getElementById('paste-content').value).toBe('');
    });

    it('échec HTTP : message exact de l\'oracle, aucun repli sur un autre service (arbitrage Q2)', async () => {
        document.getElementById('paste-url').value = 'https://exemple.com/recette';
        fetch.mockResolvedValue({ ok: false });

        await fetchRecipeFromUrl();

        expect(dernierToast()).toBe("Erreur de lecture. Vérifiez l'URL ou copiez le texte manuellement.");
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('réactive le bouton après un échec', async () => {
        document.getElementById('paste-url').value = 'https://exemple.com/recette';
        fetch.mockResolvedValue({ ok: false });

        await fetchRecipeFromUrl();

        const btn = document.getElementById('paste-fetch-btn');
        expect(btn.disabled).toBe(false);
        expect(btn.textContent).toBe('🌍 Lire la page');
    });

    it('abandonne après 10 secondes si le service ne répond pas (durcissement §10-D)', async () => {
        vi.useFakeTimers();
        document.getElementById('paste-url').value = 'https://exemple.com/recette';
        fetch.mockImplementation((url, { signal }) => new Promise((resolve, reject) => {
            signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }));

        const promise = fetchRecipeFromUrl();
        await vi.advanceTimersByTimeAsync(10000);
        await promise;

        expect(dernierToast()).toContain('Erreur de lecture');
        vi.useRealTimers();
    });
});

// LOT 025, volet B — le nettoyage est branché ICI, dans le chemin de lecture, et non côté
// service : Joel voit dans le champ exactement ce qui partira à l'IA, et peut le corriger.
describe('LOT 025 / volet B — la page est nettoyée avant d\'atterrir dans le champ', () => {
    beforeEach(() => {
        setupDom();
        vi.stubGlobal('fetch', vi.fn());
        document.getElementById('paste-url').value = 'https://exemple.com/recette';
    });

    it('retire le bandeau de consentement et le pied de page, garde la recette', async () => {
        fetch.mockResolvedValue({
            ok: true,
            text: () => Promise.resolve(
                'Title: Tarte aux pommes : la meilleure recette\n\n' +
                'URL Source: https://exemple.com/recette\n\n' +
                'Nous et nos [1117 partenaires](javascript:show();) utilisons des cookies.\n\n' +
                'Paramétrer Je n\'accepte rien J\'accepte tout\n\n' +
                '# Tarte aux pommes\n\n' +
                'Étalez la pâte puis disposez les pommes en rosace.\n\n' +
                '## Commentaires (42)\n\n' +
                'martine 5/5 Très bonne recette merci\n\n' +
                '© 2026 exemple.com'
            )
        });

        await fetchRecipeFromUrl();

        const contenu = document.getElementById('paste-content').value;
        expect(contenu).toContain('Étalez la pâte puis disposez les pommes en rosace.');
        expect(contenu).not.toContain('1117 partenaires');
        expect(contenu).not.toContain('J\'accepte tout');
        expect(contenu).not.toContain('martine');
        expect(contenu).not.toContain('© 2026');
        expect(contenu).not.toContain('URL Source:');
    });

    // DÉFAUT RÉEL constaté par Joel le 2026-08-02 sur la page Marmiton : le champ Titre
    // affichait « Title: Aubergines au four : la meilleure recette ». L'IA le rattrapait ;
    // « Sauvegarder tel quel », qui ne passe pas par l'IA, ne le rattrapait pas.
    it('propose un titre sans le préfixe « Title: » du lecteur de page', async () => {
        fetch.mockResolvedValue({
            ok: true,
            text: () => Promise.resolve('Title: Tarte aux pommes : la meilleure recette\n\n# Tarte aux pommes\n\nÉtalez la pâte finement.')
        });

        await fetchRecipeFromUrl();

        expect(document.getElementById('paste-title').value).toBe('Tarte aux pommes');
    });
});

// LOT 025, volet D — les TROIS chemins de la lecture d'URL. Décisions de Joel du 2026-08-02,
// prises après l'audit de spec Codex : D1 = un échec de lecture reste un échec SEC (aucune
// seconde tentative), D2 = budget de 10 s GLOBAL pour toute l'action.
describe('LOT 025 / volet D — la fiche officielle du site est lue en premier', () => {
    const FICHE = {
        '@context': 'https://schema.org',
        '@type': 'Recipe',
        name: 'Blanquette de veau',
        recipeYield: '4 personnes',
        totalTime: 'PT2H15M',
        recipeIngredient: ['1 kg de blanquette de veau', '25 cl de vin blanc'],
        recipeInstructions: ['Faire revenir la viande.', 'Saupoudrer de farine.']
    };
    const PAGE_AVEC_FICHE = `<!doctype html><html><head><script type="application/ld+json">${JSON.stringify(FICHE)}</script></head><body>
        <p>Bandeau cookies et 1117 partenaires</p></body></html>`;

    beforeEach(() => {
        setupDom();
        vi.stubGlobal('fetch', vi.fn());
        document.getElementById('paste-url').value = 'https://exemple.com/blanquette';
    });

    describe('chemin 1 — la page publie une fiche exploitable', () => {
        beforeEach(() => {
            fetch.mockResolvedValue({ ok: true, text: () => Promise.resolve(PAGE_AVEC_FICHE) });
        });

        it('remplit le champ depuis la fiche, avec quantités et étapes', async () => {
            await fetchRecipeFromUrl();

            const contenu = document.getElementById('paste-content').value;
            expect(contenu).toContain('1 kg de blanquette de veau');
            expect(contenu).toContain('25 cl de vin blanc');
            expect(contenu).toContain('1. Faire revenir la viande.');
            expect(contenu).toContain('Nombre de personnes : 4');
            expect(contenu).toContain('Temps total : 2 h 15');
        });

        it('le bruit de la page ne passe PAS dans le champ', async () => {
            await fetchRecipeFromUrl();

            expect(document.getElementById('paste-content').value).not.toContain('1117 partenaires');
            expect(document.getElementById('paste-content').value).not.toContain('cookies');
        });

        it('prend le titre de la fiche et prévient Joel', async () => {
            await fetchRecipeFromUrl();

            expect(document.getElementById('paste-title').value).toBe('Blanquette de veau');
            expect(dernierToast()).toContain('Fiche officielle du site trouvée');
        });

        it('UNE SEULE lecture : la seconde est inutile quand la fiche suffit', async () => {
            await fetchRecipeFromUrl();

            expect(fetch).toHaveBeenCalledTimes(1);
            expect(fetch.mock.calls[0][1].headers['x-return-format']).toBe('html');
        });
    });

    describe('chemin 2 — lecture réussie, mais aucune fiche exploitable', () => {
        it('bascule sur le texte nettoyé et le DIT honnêtement', async () => {
            fetch.mockResolvedValue({
                ok: true,
                text: () => Promise.resolve('# Tarte aux pommes\n\nÉtalez la pâte puis enfournez.')
            });

            await fetchRecipeFromUrl();

            expect(fetch).toHaveBeenCalledTimes(2);
            expect(document.getElementById('paste-content').value).toContain('Étalez la pâte');
            expect(dernierToast()).toContain('Pas de fiche officielle');
        });

        // CAS RÉEL Chef Simon : fiche présente mais sans aucune étape.
        //
        // Les deux lectures renvoient des choses DIFFÉRENTES, comme en vrai : la première du
        // HTML, la seconde du Markdown. Un montage qui renverrait le même HTML aux deux ferait
        // passer le test pour de mauvaises raisons — le JSON de la fiche se retrouverait dans
        // le texte nettoyé, et on croirait avoir prouvé le repli.
        it('une fiche présente mais inexploitable ne court-circuite pas le repli', async () => {
            const htmlSansEtapes = `<!doctype html><html><head><script type="application/ld+json">${JSON.stringify({ '@type': 'Recipe', name: 'Gratin', recipeIngredient: ['2 aubergines'] })}</script></head><body><p>Enfournez le gratin.</p></body></html>`;
            fetch
                .mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(htmlSansEtapes) })
                .mockResolvedValueOnce({
                    ok: true,
                    text: () => Promise.resolve("# Gratin d'aubergines\n\nEnfournez le gratin trente minutes.")
                });

            await fetchRecipeFromUrl();

            expect(fetch).toHaveBeenCalledTimes(2);
            expect(dernierToast()).toContain('Pas de fiche officielle');
            // C'est bien le TEXTE de la seconde lecture qui est retenu, pas la fiche refusée.
            expect(document.getElementById('paste-content').value).toContain('Enfournez le gratin trente minutes.');
            expect(document.getElementById('paste-content').value).not.toContain('recipeIngredient');
            expect(document.getElementById('paste-title').value).toBe("Gratin d'aubergines");
        });
    });

    describe('chemin 3 — la lecture échoue (décision D1 : échec SEC)', () => {
        it('échec HTTP : message d\'erreur, AUCUNE seconde tentative', async () => {
            fetch.mockResolvedValue({ ok: false });

            await fetchRecipeFromUrl();

            expect(fetch).toHaveBeenCalledTimes(1);
            expect(dernierToast()).toBe("Erreur de lecture. Vérifiez l'URL ou copiez le texte manuellement.");
            expect(document.getElementById('paste-content').value).toBe('');
        });

        it('page vide : traitée comme un échec, aucune seconde tentative', async () => {
            fetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('   ') });

            await fetchRecipeFromUrl();

            expect(fetch).toHaveBeenCalledTimes(1);
            expect(dernierToast()).toContain('Erreur de lecture');
        });

        // DÉCISION D2 : le budget de 10 s couvre TOUTE l'action, pas chaque lecture.
        it('budget GLOBAL : les deux lectures partagent le même signal d\'abandon', async () => {
            fetch.mockResolvedValue({
                ok: true,
                text: () => Promise.resolve('# Tarte\n\nÉtalez la pâte puis enfournez le tout.')
            });

            await fetchRecipeFromUrl();

            expect(fetch).toHaveBeenCalledTimes(2);
            const [, premieres] = fetch.mock.calls[0];
            const [, secondes] = fetch.mock.calls[1];
            expect(secondes.signal).toBe(premieres.signal);
        });
    });
});
