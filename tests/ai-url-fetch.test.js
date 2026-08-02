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

    it('appelle Jina Reader avec l\'URL exacte (sans encodage), jamais allorigins', async () => {
        document.getElementById('paste-url').value = 'https://exemple.com/recette-tarte';
        fetch.mockResolvedValue({
            ok: true,
            text: () => Promise.resolve('# Tarte aux pommes\nUne recette simple.')
        });

        await fetchRecipeFromUrl();

        expect(fetch).toHaveBeenCalledTimes(1);
        const [calledUrl] = fetch.mock.calls[0];
        expect(calledUrl).toBe('https://r.jina.ai/https://exemple.com/recette-tarte');
        expect(calledUrl).not.toContain('allorigins');
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
