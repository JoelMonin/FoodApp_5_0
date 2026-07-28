---
description: Met à jour le site sur GitHub en renommant temporairement le fichier local.
---

Ce workflow permet de synchroniser le fichier local `foodapp-v5-Joel.html` avec le dépôt GitHub `JoelMonin/FoodApp_5_0` en l'écrasant au nom de `index.html`.

// turbo-all
1. Création de la copie temporaire pour GitHub Pages :
   `cp foodapp-v5-Joel.html index.html`

2. Ajout des fichiers modifiés à l'index Git :
   `& "C:\Program Files\Git\cmd\git.exe" add index.html foodapp-data.js`

3. Création du commit avec un message automatique (horodaté) :
   `& "C:\Program Files\Git\cmd\git.exe" commit -m "Mise à jour automatique - $(Get-Date -Format 'yyyy-MM-dd HH:mm')"`

4. Envoi vers la branche principale de GitHub (avec force car on écrase le distant) :
   `& "C:\Program Files\Git\cmd\git.exe" push origin main --force`

5. Nettoyage du fichier temporaire local :
   `rm index.html`

6. Confirmation visuelle :
   `Afficher un message de succès : 'Dépôt GitHub mis à jour avec succès !'`
