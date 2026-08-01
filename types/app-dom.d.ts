// LOT 021 — Ajustements de types pour le vérificateur (`jsconfig.json`).
// Ce fichier ne contient AUCUN code : il ne fait que décrire au vérificateur des réalités
// du navigateur que sa bibliothèque standard ignore. Rien ici n'est exécuté.

// ─────────────────────────────────────────────────────────────────────────────
// 1. LES SÉLECTEURS DU DOM — 87 des 128 erreurs du premier passage
//
// `document.getElementById('champ')` est décrit par la bibliothèque standard comme rendant
// un élément GÉNÉRIQUE, qui n'a donc ni `.value`, ni `.disabled`, ni `.checked`. Or toute
// l'application lit des champs de formulaire par cette porte : 53 `.value`, 16 `.disabled`,
// 5 `.checked`.
//
// POURQUOI `HTMLInputElement` ET NON `any` : `any` ferait taire le vérificateur pour de
// bon — y compris sur une faute de frappe (`.valeu`). En annonçant un champ de saisie, on
// garde la détection des fautes de frappe sur TOUTES les propriétés, y compris celles des
// éléments ordinaires (un champ de saisie EST un élément ordinaire).
//
// CE QU'ON PERD, et c'est assumé : le vérificateur ne dira plus « ce div n'a pas de
// `.value` ». Ce n'était pas la cible de ce lot. La cible — un import qui pointe vers une
// fonction inexistante (incident du LOT 017) — reste vérifiée à pleine force.
interface Document {
    getElementById(elementId: string): HTMLInputElement | null;
}

interface ParentNode {
    querySelector(selectors: string): HTMLInputElement | null;
    // Même raison pour les LISTES d'éléments : sans cette ligne, chaque `.dataset`,
    // `.focus()` ou `.checked` lu dans une boucle `forEach` était signalé à tort.
    querySelectorAll(selectors: string): NodeListOf<HTMLInputElement>;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. LE PLEIN ÉCRAN DES VIEUX NAVIGATEURS
//
// `src/ui/recipeModal.js` gère le plein écran avec les quatre variantes historiques
// (standard, Safari, Firefox, Internet Explorer). Ce ne sont PAS des fautes de frappe :
// ce sont de vraies fonctions de vrais navigateurs, absentes de la bibliothèque standard
// parce qu'elles ne sont pas normalisées. Les déclarer ici évite de faire croire à un
// défaut là où il y a une précaution.
interface Document {
    webkitFullscreenElement?: Element | null;
    mozFullScreenElement?: Element | null;
    msFullscreenElement?: Element | null;
    webkitExitFullscreen?: () => Promise<void>;
    mozCancelFullScreen?: () => Promise<void>;
    msExitFullscreen?: () => Promise<void>;
}

interface Element {
    webkitRequestFullscreen?: () => Promise<void>;
    mozRequestFullScreen?: () => Promise<void>;
    msRequestFullscreen?: () => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. LE CODE D'ÉTAT ACCROCHÉ À UNE ERREUR
//
// Les appels réseau attachent le code de réponse HTTP à l'erreur qu'ils lèvent, pour que
// l'appelant sache distinguer « clé d'API refusée » de « service indisponible ». C'est un
// usage courant en JavaScript, mais le type standard `Error` n'a pas de champ pour ça.
interface Error {
    status?: number;
}
