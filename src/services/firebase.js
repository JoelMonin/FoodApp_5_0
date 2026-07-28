import { FB_URL, FB_USER } from '../constants.js';

/**
 * Envoie l'état local vers Firebase Cloud.
 * @param {Object} state - L'état complet de l'application.
 * @returns {Promise<Object>} - L'état synchronisé (horodaté).
 */
export async function syncPush(state) {
  // 1. Préparation des données (sécurité : retrait de la clé API)
  const stateToSync = JSON.parse(JSON.stringify(state)); // Deep clone simple
  if (stateToSync.aiConfig) {
    stateToSync.aiConfig.apiKey = ""; // NEVER SYNC API KEY TO CLOUD
  }

  const url = `${FB_URL}/users/${encodeURIComponent(FB_USER)}.json`;
  
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(stateToSync)
  });

  if (!res.ok) {
    throw new Error(`Erreur Firebase Push: ${res.statusText}`);
  }

  return {
    ...state,
    lastSync: new Date().toISOString()
  };
}

/**
 * Récupère les données depuis Firebase Cloud.
 * @returns {Promise<Object|null>} - Les données récupérées ou null si vide.
 */
export async function syncPull() {
  const url = `${FB_URL}/users/${encodeURIComponent(FB_USER)}.json`;
  
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Erreur Firebase Pull: ${res.statusText}`);
  }

  const data = await res.json();
  return data;
}
