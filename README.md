# EasyJournal

Journal de trading personnel : saisie des trades (réel et backtest séparés), tableau de bord, analyse de discipline, import/export.
**100 % dans le navigateur** : aucun serveur, aucun compte. Tes trades, lots et montants restent sur ton appareil (IndexedDB) et ne sont jamais envoyés ni stockés dans ce dépôt.

## Mise en ligne sur GitHub Pages

1. Crée un dépôt public `easyjournal` sur GitHub et envoie le code :
   ```bash
   git remote add origin https://github.com/<ton-compte>/easyjournal.git
   git push -u origin main
   ```
2. Dans le dépôt : **Settings → Pages → Build and deployment → Source : GitHub Actions**.
3. Chaque `git push` sur `main` lance les tests puis publie le site : `https://<ton-compte>.github.io/easyjournal/`.

> Le code est public, pas tes données. Ne commite jamais d'export (`.xlsx`, `.csv`, sauvegarde `.json`) : le `.gitignore` les exclut déjà.

## Utiliser en local

```bash
npm run serve     # puis ouvre http://localhost:8080
npm test          # tests de la logique (Node ≥ 20, aucune dépendance)
```

## Structure

```
index.html            page unique
css/                  tokens (thèmes), base, composants
js/app.js             démarrage, navigation, thème
js/routes.js          REGISTRE DES ÉCRANS (ajouter une page = 1 fichier + 1 ligne ici)
js/domain/            logique pure et testée : trade, money, stats
js/store/             IndexedDB, réglages, état, migrations
js/io/                import/export : Excel (lecteur sans dépendance), CSV, JSON
js/views/             écrans : tableau de bord, journal, formulaire, analyse, idées, réglages
js/components/        graphiques SVG, utilitaires d'interface
tests/                tests Node (node --test)
```

## Règles de calcul

- **Taux de réussite** = gagnants ÷ (gagnants + perdants). Les égalités comptent dans « trades terminés » mais pas dans le taux.
- **Signe** : le résultat (Gagnant / Perdant) décide du signe des pips et de l'argent. Saisir `45` ou `-45` pour une perte donne le même résultat.
- **Argent** : le montant net saisi (courtier) est la source de vérité. À défaut, estimation = pips × lots × valeur du pip − frais, toujours marquée « ≈ ». La valeur du pip se règle par paire.
- **Profit factor** = gains bruts ÷ pertes brutes. **R** = résultat net ÷ risque.
- Backtest et réel ne sont jamais mélangés dans les statistiques.

## Ajouter une fonctionnalité

- **Un écran** : `js/views/mon-ecran.js` exporte `render(root)` ; ajoute une ligne dans `js/routes.js`.
- **Une colonne personnalisée** : sans code, dans Réglages → Champs personnalisés.
- **Un champ standard** : ajoute-le dans `emptyTrade`/`normalizeTrade` (`js/domain/trade.js`) ; les anciennes données restent valides. Si la forme des données change, ajoute une migration dans `js/store/state.js` (`schemaVersion`).
- Idées en attente : voir l'écran **Idées** de l'application.

## Limites connues

- Pas de synchronisation entre appareils : passe par la sauvegarde JSON (Réglages → Données).
- Les captures d'écran sont enregistrées dans le navigateur (réduites à 1280 px) et incluses dans la sauvegarde JSON.
- Pas encore de mode hors ligne installable (piste dans l'écran Idées).
