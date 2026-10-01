# Vitalis — muscle, nutrition & longévité

Application mobile (PWA installable sur iPhone et Android) qui :

- **récupère les données de ta balance Withings** (poids, % de gras, masse musculaire, gras viscéral, pas…) et calcule une **tendance lissée** de ton poids ;
- choisit automatiquement ta **phase** (sèche, recomposition, prise de muscle) et calcule tes **calories et macros**, puis les **réajuste chaque semaine** selon ta vitesse réelle d’évolution ;
- génère ton **menu de la semaine** (recettes « longévité » : aliments bruts, poissons gras, légumineuses, fermentés, 30 plantes/semaine) adapté à ton régime et tes allergies, avec des **portions calculées** pour tes macros ;
- en déduit ta **liste de courses** par rayon (semaine en cours, jours restants ou semaine suivante), partageable ;
- crée ton **programme de musculation** (split selon tes jours, ton matériel, tes blessures ; exercices en position étirée ; cycles de 5 semaines avec décharge ; double progression automatique ; chrono de repos) et ton **cardio longévité** (zone 2 + VO2max 4×4) ;
- analyse ta **prise de sang** (≈ 30 marqueurs, unités françaises g/L, plages normales et optimales) et te donne la **liste du bilan à demander** à ton médecin ;
- propose un **protocole de compléments personnalisé** (créatine, vitamine D selon ton taux, oméga-3 selon ton menu/index, fer uniquement si ferritine basse, B12 si végétal…) avec le **niveau de preuve** de chacun ;
- suit tes **habitudes longévité** (sommeil, lumière, pas, protéines, crème solaire, rétinoïde…) et un protocole complet intérieur & extérieur ;
- intègre un **coach IA** (Claude) optionnel qui connaît toutes tes données.

Toutes les données restent **sur ton téléphone** (stockage local). Seuls Withings (si tu le connectes) et Anthropic (si tu actives le coach) reçoivent des données.

> ⚠️ Vitalis ne remplace pas un avis médical. Pathologie, traitement, grossesse ou résultat sanguin anormal : parles-en à ton médecin.

## Installer l’app sur ton téléphone

1. **Une seule fois**, dans GitHub : *Settings → Pages → Build and deployment → Source : « GitHub Actions »*, puis relance le workflow *Tests & déploiement* (onglet *Actions*).
2. L’app est publiée sur `https://dam321.github.io/Appli-tel/`.
3. Ouvre cette adresse :
   - **iPhone** (Safari) : bouton *Partager* → *Sur l’écran d’accueil* ;
   - **Android** (Chrome) : menu ⋮ → *Installer l’application*.
4. Lance Vitalis depuis l’icône : elle fonctionne en plein écran, même hors ligne.

## Connecter la balance Withings

1. Crée une application gratuite sur [developer.withings.com](https://developer.withings.com/dashboard/) (*Public API integration*).
2. Dans *Callback URL*, colle l’adresse affichée dans *Réglages → Balance Withings* (`https://dam321.github.io/Appli-tel/`).
3. Copie le *Client ID* et le *Client Secret* dans l’app, puis *Connecter ma balance*.

La synchro se fait ensuite automatiquement à chaque ouverture (et via le bouton *Synchroniser*).
Sans compte développeur : exporte `weight.csv` depuis l’app Withings et importe-le dans l’onglet *Corps*.

## Coach IA

Ajoute ta clé API Anthropic dans *Réglages → Coach IA* ([console.anthropic.com](https://console.anthropic.com/settings/keys)). Le coach utilise le modèle Claude Opus 5.5 et reçoit un résumé de ton profil, tes mesures, ton programme, ton menu et ta prise de sang.

## Développement

```bash
npm install
npm run dev      # serveur de développement
npm test         # tests des moteurs (nutrition, menu, programme, sang, compléments, imports)
npm run build    # build de production dans dist/
```

Organisation :

| Dossier | Contenu |
|---|---|
| `src/lib/` | moteurs de calcul (composition corporelle, nutrition, menu, courses, programme, sang, compléments, longévité, Withings, coach) |
| `src/data/` | bases d’aliments, de recettes et d’exercices |
| `src/pages/` | écrans de l’application |
| `tests/` | tests unitaires (Vitest) |

## Bases scientifiques (principales)

- Protéines 1,6-2,2 g/kg, plus en déficit (ISSN 2017, Helms 2014, Morton 2018).
- Volume 10-20 séries/muscle/semaine, proximité de l’échec, entraînement en position étirée (Schoenfeld 2017, Maeo 2021-2023, Pedrosa 2022).
- Tendance de poids lissée et ajustement calorique adaptatif.
- VO2max et force comme prédicteurs de mortalité (Mandsager 2018), zone 2 + intervalles 4×4 (Helgerud 2007).
- Aliments ultra-transformés (Hall 2019), diversité végétale (American Gut 2018), fermentés (Wastyk 2021).
- Compléments : créatine, vitamine D, oméga-3 (VITAL, REDUCE-IT), fer un jour sur deux (Stoffel 2017), psyllium et LDL, antioxydants à haute dose et adaptations (Paulsen 2014).
