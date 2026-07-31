/** @vitest-environment jsdom */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// LOT 015, sous-lot B — les textes de la page Réglages.
//
// Plusieurs cartes MENTAIENT : « Copier mon stock » copiait la liste de courses,
// « Données techniques (JSON) » ne produisait pas de JSON, « Mise à zéro complète »
// annonçait d'effacer la clé API alors qu'elle la conserve, et « Importer uniquement le
// stock » prétendait ne toucher qu'à la « disponibilité » alors qu'il applique quatre
// états et peut ajouter des ingrédients.
//
// Ces tests lisent le VRAI `index.html` (aucun test du dépôt ne le faisait avant ce lot).
//
// LOT 013 (écart d'ancrage autorisé par Joel, 2026-07-30) : les 9 cartes portent désormais
// un `id` stable (`settings-*`) — posé PRÉCISÉMENT parce que ce fichier ciblait jusqu'ici les
// boutons par leur `onclick`, ce qui casserait tout le fichier au moindre renommage de
// fonction prévu par le LOT 014 (`exportClipboard` → `src/services/exports.js`). Migré vers
// une sélection par `id` ; l'`onclick` n'est plus lu que là où c'est LUI le comportement
// testé (l'argument exact passé à `exportClipboard`), jamais comme simple sélecteur.

let doc;

function carte(id) {
    const bouton = doc.querySelector(`#view-export #${id}`);
    if (!bouton) return null;
    return {
        titre: bouton.querySelector('.export-btn-label')?.textContent.trim() ?? '',
        sous: bouton.querySelector('.export-btn-sub')?.textContent.trim() ?? ''
    };
}

function titresDeSection() {
    return [...doc.querySelectorAll('#view-export .export-section-title')]
        .map(t => t.textContent.trim());
}

beforeAll(() => {
    // `import.meta.url` est servi en http:// sous jsdom — on passe par la racine du projet.
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
    doc = new DOMParser().parseFromString(html, 'text/html');
});

describe('LOT 015 / sous-lot B — les cartes de Réglages disent la vérité', () => {
    it('la page est bien celle attendue (garde-fou du test lui-même)', () => {
        expect(doc.querySelector('#view-export')).toBeTruthy();
        expect(doc.querySelectorAll('#view-export button.export-btn').length).toBeGreaterThan(5);
    });

    // ─── Chantier 4 : la carte qui mentait sur le JSON a disparu ───
    it('la carte « Données techniques (JSON) » n\'existe plus', () => {
        // Pas d'id à chercher : cette carte n'a jamais existé depuis la pose des ancres du
        // LOT 013. On prouve son absence par le seul lien qu'elle aurait pu laisser :
        // aucun bouton de la page n'appelle plus `exportClipboard('full')`.
        const appelsFull = [...doc.querySelectorAll('#view-export button')]
            .filter(b => b.getAttribute('onclick') === "exportClipboard('full')");
        expect(appelsFull).toHaveLength(0);
    });

    it('plus AUCUNE carte de la page ne promet du JSON dans son titre — le mot ne reste '
       + 'admis que dans un sous-titre, pour décrire le fichier', () => {
        const titres = [...doc.querySelectorAll('#view-export .export-btn-label')]
            .map(t => t.textContent);
        expect(titres.filter(t => /json/i.test(t))).toHaveLength(0);
    });

    it('il reste exactement trois façons de copier, dont la liste de courses, dans cet ordre', () => {
        // L'id ancre l'IDENTITÉ et l'ORDRE des boutons ; l'onclick, lui, reste la seule
        // preuve de l'ARGUMENT exact envoyé à exportClipboard — les deux ne se remplacent
        // pas l'un l'autre.
        const idsDeCopie = ['settings-copy-stock', 'settings-copy-stock-categorized', 'settings-copy-cart'];
        const ordreReel = [...doc.querySelectorAll('#view-export button.export-btn')]
            .map(b => b.id)
            .filter(id => idsDeCopie.includes(id));
        expect(ordreReel).toEqual(idsDeCopie);

        expect(doc.getElementById('settings-copy-stock').getAttribute('onclick')).toBe("exportClipboard('simple')");
        expect(doc.getElementById('settings-copy-stock-categorized').getAttribute('onclick')).toBe("exportClipboard('categorized')");
        expect(doc.getElementById('settings-copy-cart').getAttribute('onclick')).toBe("exportClipboard('cart')");
    });

    // ─── Chantier 8 : titres de sections orientés intention ───
    it('les sections sont nommées par leur intention, sans jargon de fichier', () => {
        const titres = titresDeSection();
        expect(titres).toContain('Partager');
        expect(titres).toContain('Sauvegarde');
        expect(titres).not.toContain('Copier dans le presse-papiers');
        expect(titres).not.toContain('Fichier JSON');
    });

    // ─── Chantier 1 : le titre annonçait le stock, le bouton copiait les courses ───
    it('« Copier mon stock » parle bien du stock, jamais de courses', () => {
        const c = carte('settings-copy-stock');
        expect(c.titre).toBe('Copier mon stock (liste simple)');
        expect(c.sous).not.toMatch(/course/i);
    });

    // ─── LOT 014, volet G : les articles libres ont été SUPPRIMÉS (décision de Joel du
    // 2026-07-30). Le texte du LOT 015 qui les annonçait deviendrait un mensonge — c'est
    // exactement le défaut que le LOT 015 avait corrigé, à l'envers. Le test ne disparaît
    // pas : il s'inverse, pour interdire que la mention réapparaisse sans la fonction. ───
    it('« Copier ma liste de courses » ne promet plus d\'articles libres (supprimés, volet G)', () => {
        const c = carte('settings-copy-cart');
        expect(c.sous).not.toMatch(/articles libres/i);
        expect(c.sous).toMatch(/acheter/i); // mais dit toujours ce qu'il copie
    });

    // ─── Chantier 5 : la clé API ne sort jamais dans le fichier ───
    it('« Télécharger une sauvegarde » prévient que la clé API n\'est PAS dans le fichier', () => {
        const c = carte('settings-download-backup');
        expect(c.sous).toMatch(/clé API/i);
        expect(c.sous).toMatch(/jamais/i);
    });

    // ─── Chantier 8 : la paire Restaurer / Importer doit être limpide ───
    it('« Restaurer » annonce un REMPLACEMENT total et la conservation de la clé locale', () => {
        const c = carte('settings-restore-backup');
        expect(c.titre).toBe('Restaurer une sauvegarde');
        expect(c.sous).toMatch(/REMPLACE/);
        expect(c.sous).toMatch(/clé API/i);
    });

    // LOT 014 (demande de Joel du 2026-07-31) — le titre « Importer uniquement le stock »
    // portait à confusion : le mot « stock » laissait croire à une reprise de la seule
    // disponibilité, alors que la fonction fusionne AUSSI le catalogue d'ingrédients
    // (`src/actions.js`, branche d'ajout des inconnus). Renommé « Fusionner le catalogue ».
    //
    // ⚠️ ÉCART DE PRÉCISION ASSUMÉ PAR JOEL, tracé ici pour qu'il ne se perde pas : la
    // nouvelle description ne nomme plus les ÉPINGLÉS ni les SURGELÉS, que la fusion reprend
    // pourtant (`target.pinned` / `target.frozen`). Le LOT 015 les avait fait figurer exprès,
    // parce que l'ancien texte en disait moins que ce que le bouton faisait. Les assertions
    // correspondantes sont donc retirées — volontairement, pas par omission.
    it('« Fusionner le catalogue » annonce une FUSION, le même fichier, ce qui est repris '
       + 'et ce qui est épargné', () => {
        const c = carte('settings-import-stock-only');
        expect(c.titre).toBe('Fusionner le catalogue');
        expect(c.sous).toMatch(/douceur|fusionne/i);
        expect(c.sous).toMatch(/MÊME fichier/i);
        expect(c.sous).toMatch(/base d'ingrédients/i); // le catalogue, ce que le titre promet
        expect(c.sous).toMatch(/inventaire/i);
        expect(c.sous).toMatch(/courses/i);
        expect(c.sous).toMatch(/ajoute/i);
        expect(c.sous).toMatch(/favoris/i);
        expect(c.sous).toMatch(/réglages/i);
        // L'inexactitude d'origine : il ne met pas à jour que « la disponibilité ».
        expect(c.sous).not.toMatch(/sans modifier votre configuration/i);
    });

    // Le titre ne doit plus employer « uniquement le stock » : c'est le mot qui trompait.
    it('le titre ne promet plus « uniquement le stock » — la fusion touche aussi le catalogue', () => {
        expect(carte('settings-import-stock-only').titre).not.toMatch(/uniquement le stock/i);
    });

    it('les deux cartes de fichier se distinguent nettement l\'une de l\'autre', () => {
        const remplace = carte('settings-restore-backup');
        const fusionne = carte('settings-import-stock-only');
        expect(remplace.sous).not.toBe(fusionne.sous);
        expect(remplace.sous).toMatch(/REMPLACE/);
        expect(fusionne.sous).not.toMatch(/REMPLACE/);
    });

    // ─── Chantier 6 : le texte contredisait le code ───
    it('« Mise à zéro complète » ne prétend plus effacer la clé API — le code la conserve', () => {
        const c = carte('settings-reset-all');
        expect(c.sous).toMatch(/clé API est conservée/i);
        expect(c.sous).not.toMatch(/Efface absolument tout/i);
    });

    it('« Mise à zéro complète » précise que le cloud est visé lui aussi', () => {
        expect(carte('settings-reset-all').sous).toMatch(/cloud/i);
    });

    // ─── LOT 014, volet G : même inversion que ci-dessus. Ce qui compte et qui reste
    // vrai, c'est la promesse que le stock est épargné. ───
    it('« Réinitialiser mon panier » ne parle plus d\'articles libres, et promet toujours '
       + 'que le stock est épargné', () => {
        const c = carte('settings-reset-cart');
        expect(c.sous).not.toMatch(/articles libres/i);
        expect(c.sous).toMatch(/stock n'est pas touché/i);
    });

    // ─── Trouvaille de la phase découverte, hors fiche ───
    it('l\'infobulle qui ouvre les Réglages n\'est plus écrite « rglages »', () => {
        const lien = doc.querySelector('.sb-footer [data-view="export"]');
        expect(lien.getAttribute('title')).toBe('Ouvrir les réglages');
    });
});
