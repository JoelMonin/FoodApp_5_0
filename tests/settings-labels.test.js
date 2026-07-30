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
// Ces tests lisent le VRAI `index.html` (aucun test du dépôt ne le faisait avant ce lot) et
// ciblent les boutons par leur `onclick` — jamais par leur texte, ce qui rendrait
// l'assertion circulaire. Aucun bouton de cette page ne porte d'`id`.

let doc;

function carte(onclick) {
    const bouton = [...doc.querySelectorAll('#view-export button.export-btn')]
        .find(b => b.getAttribute('onclick') === onclick);
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
        expect(carte("exportClipboard('full')")).toBeNull();
    });

    it('plus AUCUNE carte de la page ne promet du JSON dans son titre — le mot ne reste '
       + 'admis que dans un sous-titre, pour décrire le fichier', () => {
        const titres = [...doc.querySelectorAll('#view-export .export-btn-label')]
            .map(t => t.textContent);
        expect(titres.filter(t => /json/i.test(t))).toHaveLength(0);
    });

    it('il reste exactement trois façons de copier, dont la liste de courses', () => {
        const copies = [...doc.querySelectorAll('#view-export button.export-btn')]
            .map(b => b.getAttribute('onclick'))
            .filter(a => a?.startsWith('exportClipboard'));
        expect(copies).toEqual([
            "exportClipboard('simple')",
            "exportClipboard('categorized')",
            "exportClipboard('cart')"
        ]);
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
        const c = carte("exportClipboard('simple')");
        expect(c.titre).toBe('Copier mon stock (liste simple)');
        expect(c.sous).not.toMatch(/course/i);
    });

    // ─── Chantier 3 : les articles libres sont désormais inclus, il faut le dire ───
    it('« Copier ma liste de courses » annonce les articles libres, maintenant qu\'ils y sont', () => {
        const c = carte("exportClipboard('cart')");
        expect(c.sous).toMatch(/articles libres/i);
    });

    // ─── Chantier 5 : la clé API ne sort jamais dans le fichier ───
    it('« Télécharger une sauvegarde » prévient que la clé API n\'est PAS dans le fichier', () => {
        const c = carte('exportJSON()');
        expect(c.sous).toMatch(/clé API/i);
        expect(c.sous).toMatch(/jamais/i);
    });

    // ─── Chantier 8 : la paire Restaurer / Importer doit être limpide ───
    it('« Restaurer » annonce un REMPLACEMENT total et la conservation de la clé locale', () => {
        const c = carte("document.getElementById('import-file').click()");
        expect(c.titre).toBe('Restaurer une sauvegarde');
        expect(c.sous).toMatch(/REMPLACE/);
        expect(c.sous).toMatch(/clé API/i);
    });

    it('« Importer uniquement le stock » annonce une FUSION, le même fichier, '
       + 'les quatre états repris et l\'ajout d\'inconnus — l\'ancien texte n\'en disait aucun', () => {
        const c = carte("document.getElementById('restore-file').click()");
        expect(c.sous).toMatch(/douceur|fusion/i);
        expect(c.sous).toMatch(/MÊME fichier/i);
        expect(c.sous).toMatch(/stock/i);
        expect(c.sous).toMatch(/acheter/i);
        expect(c.sous).toMatch(/épinglé/i);
        expect(c.sous).toMatch(/surgelé/i);
        expect(c.sous).toMatch(/ajoute/i);
        // L'inexactitude d'origine : il ne met pas à jour que « la disponibilité ».
        expect(c.sous).not.toMatch(/sans modifier votre configuration/i);
    });

    it('les deux cartes de fichier se distinguent nettement l\'une de l\'autre', () => {
        const remplace = carte("document.getElementById('import-file').click()");
        const fusionne = carte("document.getElementById('restore-file').click()");
        expect(remplace.sous).not.toBe(fusionne.sous);
        expect(remplace.sous).toMatch(/REMPLACE/);
        expect(fusionne.sous).not.toMatch(/REMPLACE/);
    });

    // ─── Chantier 6 : le texte contredisait le code ───
    it('« Mise à zéro complète » ne prétend plus effacer la clé API — le code la conserve', () => {
        const c = carte('resetAllData()');
        expect(c.sous).toMatch(/clé API est conservée/i);
        expect(c.sous).not.toMatch(/Efface absolument tout/i);
    });

    it('« Mise à zéro complète » précise que le cloud est visé lui aussi', () => {
        expect(carte('resetAllData()').sous).toMatch(/cloud/i);
    });

    // ─── Chantier 7 : comportement inchangé, texte complété ───
    it('« Réinitialiser mon panier » dit qu\'il emporte AUSSI les articles libres '
       + 'et qu\'il épargne le stock', () => {
        const c = carte('resetCart()');
        expect(c.sous).toMatch(/articles libres/i);
        expect(c.sous).toMatch(/stock n'est pas touché/i);
    });

    // ─── Trouvaille de la phase découverte, hors fiche ───
    it('l\'infobulle qui ouvre les Réglages n\'est plus écrite « rglages »', () => {
        const lien = doc.querySelector('.sb-footer [data-view="export"]');
        expect(lien.getAttribute('title')).toBe('Ouvrir les réglages');
    });
});
