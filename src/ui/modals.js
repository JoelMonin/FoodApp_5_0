import { quitterPleinEcranSiBesoin } from './recipeModal.js';

/**
 * MODALES — socle commun, extrait de `js/app.js` au LOT 017.
 *
 * Deplacement PUR : pas une regle n'a change. La zone etait deja couverte — le LOT 014 avait
 * comble par mutation le trou historique des tests de modale (ils verifiaient le CONTENU sans
 * jamais verifier que la fenetre S'AFFICHE). Huit tests repartis sur cinq fichiers rougissent
 * aujourd'hui si `openModal` cesse de poser la classe `open`.
 *
 * POURQUOI CE MODULE SORT EN PREMIER, ET NON EN DERNIER.
 * Le plan du lot le placait a la fin, comme le morceau le plus risque. La decouverte a montre
 * l'inverse : `openModal` est le HUB dont cinq zones dependent, et tant qu'il vivait dans
 * `js/app.js`, chacune devait se le faire INJECTER. Trois des cinq crochets du projet
 * n'existaient que pour ca. Le sortir d'abord les rend inutiles : le selecteur de courses et
 * la modale d'icone l'importent desormais DIRECTEMENT.
 *
 * OU PASSE LA FRONTIERE, ET POURQUOI LA.
 * `openModal` portait 34 lignes qui ne lui appartenaient pas : la remise a zero de la fenetre
 * « coller une recette » et l'affichage des modeles IA des reglages. Le premier bloc ECRIT
 * `_lastTransformedRecipe`, une variable PRIVEE d'un autre ecran — un import ne peut pas faire
 * ca, c'est un vrai cycle. Ces deux blocs deviennent donc des crochets : ce module sait
 * QU'IL FAUT prevenir quelqu'un a l'ouverture, il ne sait plus QUOI faire a sa place.
 *
 * DEUX CROCHETS, PAS PLUS. Le LOT 014 a grave la regle du seuil : « un module qui a besoin de
 * six crochets pour vivre n'est pas un module ». Si un troisieme apparait ici un jour, c'est
 * que la frontiere aura derape.
 *
 * UN SEUL IMPORT SORTANT, ASSUME : `quitterPleinEcranSiBesoin`. C'est lui qui interdit a
 * `recipeModal.js` d'importer ce module en retour (le cycle serait reel) — d'ou le crochet
 * `registerRecipeModalHooks`, CONSERVE, alors que les deux autres disparaissent.
 */

// Ce que ce module delegue a l'exterieur. Les no-op par defaut rendent tout appel partiel
// sans danger — mais ils sont d'ordinaire AUSSI un trou : un crochet jamais branche echoue
// en silence (c'etait le cas de `registerAddFormNav`, dont le debranchement ne cassait aucun
// test au LOT 014).
//
// VERIFIE ICI, PAS SUPPOSE : oublier `registerModalHooks({...})` au demarrage fait rougir
// 7 tests, et debrancher chacun des deux crochets en fait rougir 6 et 1. Le branchement est
// donc reellement couvert par les tests d'ecran existants, sans qu'il faille un test dedie —
// c'est ce qui a permis de sortir ces 34 lignes sans en ecrire un seul de plus.
const _hooks = {
    resetPasteModal: () => {},
    onApiConfigOpen: () => {}
};

export function registerModalHooks(hooks = {}) {
    for (const cle of Object.keys(_hooks)) {
        if (typeof hooks[cle] === 'function') _hooks[cle] = hooks[cle];
    }
}

export function openModal(id) {
    document.getElementById(id)?.classList.add('open');

    // L'ORDRE COMPTE : la classe est posee AVANT de prevenir l'ecran concerne, car sa remise
    // a zero lit et ecrit des champs qui doivent deja etre affiches.
    if (id === 'modal-paste-recipe') _hooks.resetPasteModal();
    if (id === 'modal-api-config') _hooks.onApiConfigOpen();
}

export function closeModal(id) {
    const el = document.getElementById(id);
    el?.classList.remove('open');
    if (el?.classList.contains('recipe-fullscreen')) {
        el.classList.remove('recipe-fullscreen');
        quitterPleinEcranSiBesoin();
    }
}

export function initSwipeToClose(modalId) {
    const overlay = document.getElementById(modalId);
    if (!overlay) return;

    let startY = 0;
    let currentY = 0;
    let isSwiping = false;
    let modal = null;

    // Écouteurs posés UNE FOIS sur l'overlay, qui survit à tout `replaceChildren`
    // de son contenu (ex. `openRecipeDetail`) — le noeud `.modal-content`/`.modal`
    // visé est recalculé à CHAQUE geste, jamais capturé une fois pour toutes
    // (LOT 009, casse C7 : le glissement mourait après le premier rendu dynamique).
    overlay.addEventListener('touchstart', (e) => {
        modal = overlay.querySelector('.modal-content') || overlay.querySelector('.modal');
        if (!modal) return;
        const touch = e.touches[0];
        const rect = modal.getBoundingClientRect();
        // Allow swipe from the top 100px (header/drag handle)
        if (touch.clientY - rect.top < 100) {
            startY = touch.clientY;
            // Repart de zéro à CHAQUE geste (audit Codex, LOT 009) : sans ce reset,
            // currentY gardait la valeur du geste PRÉCÉDENT — un simple toucher sans
            // glissement après une fermeture réussie pouvait re-fermer aussitôt.
            currentY = touch.clientY;
            isSwiping = true;
            modal.style.transition = 'none';
        }
    }, { passive: true });

    overlay.addEventListener('touchmove', (e) => {
        if (!isSwiping || !modal) return;
        currentY = e.touches[0].clientY;
        const diff = currentY - startY;
        if (diff > 0) {
            modal.style.transform = `translateY(${diff}px)`;
            const opacity = 1 - (diff / 500);
            overlay.style.backgroundColor = `rgba(0,0,0, ${Math.max(0, opacity * 0.5)})`;
        }
    }, { passive: true });

    overlay.addEventListener('touchend', () => {
        if (!isSwiping || !modal) return;
        isSwiping = false;
        const diff = currentY - startY;
        if (diff > 100) {
            closeModal(modalId);
        }
        modal.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        modal.style.transform = '';
        overlay.style.backgroundColor = '';
    });

    // Durcissement (contre-vérification Codex, LOT 009) : un geste interrompu par le
    // système (appel entrant, geste OS concurrent...) ne doit ni fermer le modal ni le
    // laisser visuellement décalé — même remise en place que touchend, sans décision
    // de fermeture.
    overlay.addEventListener('touchcancel', () => {
        if (!isSwiping || !modal) return;
        isSwiping = false;
        modal.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
        modal.style.transform = '';
        overlay.style.backgroundColor = '';
    });
}
