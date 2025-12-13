# Site GitHub Pages — Loups-Garous

Ce dossier contient un site statique (HTML/CSS/JS) :
- génération de compositions (6–18 joueurs)
- édition de composition personnalisée
- assistant Meneur de Jeu « tour par tour »

## Déploiement (GitHub Pages)

1. Dans GitHub: **Settings → Pages**
2. Source: **Deploy from a branch**
3. Branch: `main` (ou `master`) et dossier: `/ (root)`
4. Le site est accessible via l’URL GitHub Pages.

Le fichier racine `index.html` redirige vers `site/`.

## Fonctionnement des données

La liste des rôles et leur balance sont lues depuis `../README.md` (le tableau markdown).
Cela évite de dupliquer les données.

> Remarque: GitHub Pages doit pouvoir servir `README.md` (c’est le cas en général).
