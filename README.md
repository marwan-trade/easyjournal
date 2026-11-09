# EasyJournal

Journal de trading personnel : trades, lots, argent, statistiques, import de ton Excel. Interface React, design Or et noir.

## Lancer en local

```bash
npm install
npm run build          # génère dist/
npx serve dist         # ou : python3 -m http.server -d dist 8080
npm test               # 29 tests du cœur de calcul et des imports
```

`npm run dev` reconstruit à chaque modification (sers ensuite `dist/`).

## Structure

```
src/core/domain   modèle de trade, argent, statistiques (fonctions pures, testées)
src/core/io       lecture .xlsx / CSV / JSON, export
src/core/store    stockage (IndexedDB) et état partagé
src/components    composants React réutilisables
src/pages         Tableau de bord, Journal, Analyse, Idées, Réglages
src/styles.css    design Or et noir et animations
```

## Déploiement

GitHub Pages via `.github/workflows/pages.yml` : tests, build, publication du dossier `dist/`.
Réglage unique : Settings → Pages → Source « GitHub Actions ».

## Données

Pour l'instant tout reste dans le navigateur (IndexedDB). Le cœur de stockage est isolé dans `src/core/store` pour brancher
la base en ligne (étape 3) sans toucher aux écrans. Ne mets jamais tes fichiers de trades dans le dépôt (le `.gitignore` les bloque).

## Feuille de route

1. Socle React (fait)
2. Images : collage / glisser-déposer, import des images de l'Excel
3. Base en ligne (Supabase), connexion et synchronisation
4. Calendrier des gains, revue hebdomadaire, checklist avant trade
