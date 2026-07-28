# .claude/audit_memory.md
# Catalogue des faux positifs récurrents validés par l'utilisateur.
# Sémantique : "ignore ce pattern, ce n'est pas un vrai problème dans CE projet".
# Chaque entrée DOIT être révisée tous les 6 mois (champ last_validated).
#
# Format YAML strict — voir .agents/workflows/ultra-audit.md §"Formats"

- pattern: "js/app.js dépasse le seuil 1500 lignes"
  rule: "Le fichier fait 1290 lignes au moment de l'audit, sous le seuil. Un agent a halluciné le seuil. Vérifier réellement la taille avec wc/Get-Content avant de remonter."
  scope: "js/app.js"
  agent: archi
  date_added: 2026-05-01
  last_validated: 2026-05-01
  validated_by: "joel.monin"

- pattern: "autoEmoji() jamais utilisée dans app.js"
  rule: "autoEmoji est utilisée ligne 463 dans openEnhancedCartPicker (fallback emoji pour recettes IA). Vérifier les usages indirects avant de claim 'unused'."
  scope: "js/app.js, src/utils/helpers.js"
  agent: archi
  date_added: 2026-05-01
  last_validated: 2026-05-01
  validated_by: "joel.monin"

- pattern: "Clé API Gemini envoyée dans l'URL fetch (?key=...)"
  rule: "Trade-off architectural assumé. App 100% client-side, pas de backend pour proxy. L'utilisateur fournit sa propre clé. Risque accepté."
  scope: "src/services/gemini.js"
  agent: security
  date_added: 2026-05-01
  last_validated: 2026-05-01
  validated_by: "joel.monin"

- pattern: "apiKey stockée en clair dans localStorage"
  rule: "Trade-off architectural assumé. Pas de mécanisme de chiffrement côté client robuste sans saisie de mot de passe à chaque session. Choix UX prioritaire sur sécurité absolue."
  scope: "src/state.js"
  agent: security
  date_added: 2026-05-01
  last_validated: 2026-05-01
  validated_by: "joel.monin"

- pattern: "Proxy tiers allorigins.win pour bypasser CORS"
  rule: "Trade-off assumé. Workaround CORS pour la fonctionnalité 'Lire la page' de scraping de recettes. Risque privacy mineur (URLs publiques uniquement)."
  scope: "js/app.js — fetchRecipeFromUrl"
  agent: security
  date_added: 2026-05-01
  last_validated: 2026-05-01
  validated_by: "joel.monin"

- pattern: "AI_ROLES.REASONING et AI_ROLES.FAST pointent vers le même modèle"
  rule: "Choix volontaire — gemini-2.5-flash est suffisant pour tous les usages FoodApp. Distinction conservée pour permettre une évolution future (ex: REASONING vers gemini-2.5-pro pour la nutrition)."
  scope: "src/constants.js"
  agent: archi
  date_added: 2026-05-01
  last_validated: 2026-05-01
  validated_by: "joel.monin"

- pattern: "Base Firebase RTDB accessible sans authentification (lecture/ecriture anonymes)"
  rule: "Trade-off assume par Joel (2026-07-28, audit #2). Usage familial, URL non indexee et non devinable, donnees non sensibles (inventaire de garde-manger et recettes). Le cout d'une mise en place d'authentification n'est pas justifie a ce stade. A rouvrir si l'app est diffusee plus largement ou si des donnees personnelles y transitent."
  scope: "src/services/firebase.js, src/constants.js (FB_URL, FB_USER)"
  agent: security
  date_added: 2026-07-28
  last_validated: 2026-07-28
  validated_by: "joel.monin"
