/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from 'vitest';
import { initSwipeToClose } from '../js/app.js';

// LOT 009 — casse C7 : le glissement pour fermer devait survivre au rendu dynamique
// (initSwipeToClose délègue à l'overlay). Contre-vérification Codex : le premier
// correctif laissait `currentY` périmer d'un geste à l'autre — un simple toucher
// sans glissement, après une fermeture réussie, pouvait refermer le modal suivant
// à tort. Ces tests simulent des évènements tactiles minimaux (un objet `touches`
// suffit : le code ne lit que `e.touches[0].clientY`, jsdom n'a pas besoin de
// TouchEvent natif).

function touchEvent(type, clientY) {
  const ev = new Event(type, { bubbles: true });
  ev.touches = [{ clientY }];
  return ev;
}

function freshModalContent(overlay) {
  overlay.replaceChildren();
  const content = document.createElement('div');
  content.className = 'modal-content';
  overlay.appendChild(content);
  return content;
}

describe('Glissement pour fermer (LOT 009, casse C7)', () => {
  let overlay;

  beforeEach(() => {
    document.body.innerHTML = `<div class="modal-overlay open" id="modal-recipe-detail"></div>`;
    overlay = document.getElementById('modal-recipe-detail');
    freshModalContent(overlay);
    initSwipeToClose('modal-recipe-detail');
  });

  it('un glissement suffisant (>100px) depuis l\'en-tête ferme le modal', () => {
    overlay.dispatchEvent(touchEvent('touchstart', 50));
    overlay.dispatchEvent(touchEvent('touchmove', 250));
    overlay.dispatchEvent(touchEvent('touchend', 250));
    expect(overlay.classList.contains('open')).toBe(false);
  });

  it('un glissement insuffisant (<100px) ne ferme pas le modal', () => {
    overlay.dispatchEvent(touchEvent('touchstart', 50));
    overlay.dispatchEvent(touchEvent('touchmove', 90));
    overlay.dispatchEvent(touchEvent('touchend', 90));
    expect(overlay.classList.contains('open')).toBe(true);
  });

  it('un simple toucher SANS glissement, juste après une fermeture réussie, ne referme ' +
     'pas la réouverture suivante (audit Codex : currentY périmé d\'un geste à l\'autre)', () => {
    // Premier geste : fermeture réelle par glissement.
    overlay.dispatchEvent(touchEvent('touchstart', 50));
    overlay.dispatchEvent(touchEvent('touchmove', 250));
    overlay.dispatchEvent(touchEvent('touchend', 250));
    expect(overlay.classList.contains('open')).toBe(false);

    // Réouverture avec un NOUVEAU noeud .modal-content (replaceChildren réel).
    overlay.classList.add('open');
    freshModalContent(overlay);

    // Second geste : un toucher dans la zone d'en-tête SANS AUCUN touchmove.
    overlay.dispatchEvent(touchEvent('touchstart', 55));
    overlay.dispatchEvent(touchEvent('touchend', 55));

    expect(overlay.classList.contains('open')).toBe(true); // ne doit PAS se refermer
  });

  it('trois cycles ouverture/glissement/fermeture successifs fonctionnent tous ' +
     '(critère du §Plan de test de la fiche)', () => {
    for (let i = 0; i < 3; i++) {
      overlay.classList.add('open');
      freshModalContent(overlay);
      overlay.dispatchEvent(touchEvent('touchstart', 50));
      overlay.dispatchEvent(touchEvent('touchmove', 250));
      overlay.dispatchEvent(touchEvent('touchend', 250));
      expect(overlay.classList.contains('open')).toBe(false);
    }
  });

  it('un toucher hors de la zone d\'en-tête (>100px) ne déclenche aucune fermeture', () => {
    overlay.dispatchEvent(touchEvent('touchstart', 300));
    overlay.dispatchEvent(touchEvent('touchend', 300));
    expect(overlay.classList.contains('open')).toBe(true);
  });
});
