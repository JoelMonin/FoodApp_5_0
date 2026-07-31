import { CATEGORIE_PAR_DEFAUT, getCategoryEmoji } from '../data.js';
import { formatDateFr } from '../utils/helpers.js';

/**
 * COMPOSITION DES TEXTES DE PARTAGE — extrait de `js/app.js` au LOT 014, volet A.
 *
 * Déplacement PUR : aucune règle métier n'a changé, seul le domicile du code. Le découpage
 * en « fonction pure + effet de bord isolé » datait déjà du LOT 015 ; ce module ne fait que
 * lui donner un fichier.
 *
 * `buildClipboardText` reçoit désormais l'état en PARAMÈTRE au lieu de le lire dans la
 * portée du module. C'est ce qui la rend réellement pure — et testable sans monter toute
 * l'application. `js/app.js` conserve le point d'entrée `exportClipboard`, parce qu'il est
 * publié sur `window` par `expose()` et que ce contrat public ne doit pas bouger.
 */

/**
 * Regroupe des ingrédients par catégorie en UNE passe, catégories triées alphabétiquement.
 * @returns {Array<[string, Array]>} paires [catégorie, ingrédients] triées.
 */
export function groupByCategory(ingredients) {
    const grouped = new Map();
    for (const i of ingredients) {
        if (!grouped.has(i.category)) grouped.set(i.category, []);
        grouped.get(i.category).push(i);
    }
    // Tri par défaut volontaire (et NON `localeCompare`) : conserve à l'identique l'ordre
    // des rubriques dans le texte exporté. Ne pas « améliorer » sans le décider.
    return [...grouped.keys()].sort().map(cat => [cat, grouped.get(cat)]);
}

/**
 * Nom affichable d'un article, ou null s'il n'en a pas (LOT 015, audit Gemini Q12 puis
 * audit adversarial).
 *
 * `sanitizeGlobalState` garantit `category` et `emoji` sur un ingrédient, PAS `name` (il ne
 * recopie que l'ancien champ court `n`). Un ingrédient venu du cloud sans nom produisait
 * « 🥩 undefined » dans le texte copié, avec un toast annonçant « 1 ingrédient » : le compte
 * mentait. Un article sans nom exploitable est ignoré, jamais rendu.
 */
export function itemDisplayName(item) {
    const name = typeof item?.name === 'string' ? item.name.trim() : '';
    return name || null;
}

/**
 * Ne garde que les éléments réellement affichables, dans l'ordre.
 *
 * Protège AUSSI du TYPE : Firebase renvoie parfois un tableau creux sous forme d'objet.
 * Attention — cette garde n'est pas une récupération : une source non-tableau donne une
 * liste VIDE, donc le garde-fou « rien à copier ». C'est le comportement voulu.
 */
export function copyableItems(source) {
    return (Array.isArray(source) ? source : []).filter(i => itemDisplayName(i));
}

export const clipboardCount = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`;

// Les sources de rubrique viennent toujours de `state.ingredients` (catégorie garantie par
// sanitizeGlobalState) ; le repli reste par prudence, car `cat.toUpperCase()` planterait
// SILENCIEUSEMENT — l'appel est hors du try/catch de la copie.
export const clipboardSectionLabel = (cat) => String(cat || CATEGORIE_PAR_DEFAUT).toUpperCase();

/**
 * Compose le texte d'un format de partage, ou null si le format est inconnu.
 *
 * Renvoie l'en-tête et le corps SÉPARÉMENT, et le nombre d'éléments de la SOURCE : c'est ce
 * qui permet au garde-fou « rien à copier » de porter sur les données et non sur le texte
 * final (LOT 015, chantier 9 + audit Gemini Q1).
 *
 * @param {string} type - 'simple' | 'categorized' | 'cart'
 * @param {Object} state - l'état applicatif (passé explicitement : fonction pure)
 * @param {Date} [maintenant] - injectable pour figer la date dans un test
 */
export function buildClipboardText(type, state, maintenant = new Date()) {
    const date = formatDateFr(maintenant);

    // Chantier 1 : le bouton promet le STOCK. Il copiait la liste de courses
    // (oracle foodapp-v5-Joel.html l.6466-6468 : `inStock`, confirmé).
    if (type === 'simple') {
        const items = copyableItems(state.ingredients).filter(i => i.inStock);
        return {
            count: items.length,
            emptyMessage: 'Votre stock est vide — rien à copier',
            successMessage: `Stock copié (${clipboardCount(items.length, 'ingrédient')})`,
            header: `✅ MON STOCK (${date})\n\n`,
            body: items.map(i => `${i.emoji || '🔸'} ${i.name}`).join('\n')
        };
    }

    // Chantier 2 : le partage par rayons emportait TOUT l'inventaire, absents compris
    // (oracle l.6469-6475 : `inStock` seul, avec l'emoji de rubrique).
    // Le marqueur de statut est RETIRÉ : la source étant restreinte à `inStock`, il vaudrait
    // toujours « ✅ » — information morte (arbitrage tranché, audit Gemini Q2).
    if (type === 'categorized') {
        const items = copyableItems(state.ingredients).filter(i => i.inStock);
        const sections = groupByCategory(items).map(([cat, catItems]) =>
            `--- ${getCategoryEmoji(cat)} ${clipboardSectionLabel(cat)} ---\n` +
            catItems.map(i => `${i.emoji || '🔸'} ${i.name}`).join('\n')
        );
        return {
            count: items.length,
            emptyMessage: 'Votre stock est vide — rien à copier',
            successMessage: `Stock copié par rayon (${clipboardCount(items.length, 'ingrédient')})`,
            header: `📦 MON STOCK PAR RAYON (${date})\n\n`,
            body: sections.join('\n\n')
        };
    }

    // LOT 014, volet G : la rubrique « [ ARTICLES LIBRES ] » posée au LOT 015 a été retirée
    // avec la fonctionnalité. La liste de courses n'a plus qu'une seule source.
    if (type === 'cart') {
        const items = copyableItems(state.ingredients).filter(i => i.inCart);
        const sections = groupByCategory(items).map(([cat, catItems]) =>
            `[ ${clipboardSectionLabel(cat)} ]\n` +
            catItems.map(i => `☐ ${i.emoji || '🔸'} ${i.name}`).join('\n')
        );
        return {
            count: items.length,
            emptyMessage: 'Votre liste de courses est vide — rien à copier',
            successMessage: `Liste de courses copiée (${clipboardCount(items.length, 'article')})`,
            header: `🛒 LISTE DE COURSES (${date})\n\n`,
            body: sections.join('\n\n')
        };
    }

    // Chantier 4 : le format 'full' a été SUPPRIMÉ (arbitrage de Joel du 2026-07-30).
    // Un type inconnu ne copie plus une chaîne vide en annonçant un succès.
    return null;
}

/**
 * Écrit dans le presse-papiers, avec le repli de l'oracle (l.6484-6486) DURCI.
 * L'oracle appelait `document.execCommand` sans garde d'existence et sans lire son retour
 * (il vaut `false` en cas d'échec silencieux) : le porter tel quel reproduirait un bug,
 * sous jsdom comme sur un vieux navigateur.
 * @returns {Promise<boolean>} vrai si le texte est réellement parti.
 */
export async function writeToClipboard(text) {
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch (err) {
        console.error('Erreur copie:', err);
    }

    if (typeof document.execCommand !== 'function' || !document.body) return false;

    // Le repli vole forcément le focus (`select()` est indispensable à execCommand) : on le
    // REND à l'élément actif, sinon un clic sur « Copier » effaçait la saisie en cours de
    // l'utilisateur sans explication (l'oracle avait ce défaut, l.6485).
    const focusPrecedent = document.activeElement;
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    let copied = false;
    try {
        document.body.appendChild(ta);
        ta.select();
        copied = document.execCommand('copy') === true;
    } catch (err) {
        console.error('Erreur copie (repli):', err);
    } finally {
        // `finally` : le textarea ne doit JAMAIS rester orphelin dans la page, même si
        // `appendChild`, `select()` ou `execCommand` lèvent.
        ta.remove();
        if (focusPrecedent && typeof focusPrecedent.focus === 'function') focusPrecedent.focus();
    }
    return copied;
}
