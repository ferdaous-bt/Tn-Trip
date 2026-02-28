# 📁 Structure du Projet TUN Trip

## 🗂️ Organisation des Fichiers

```
src/
├── components/          # Composants réutilisables
│   ├── Logo.jsx        # Logo de l'application
│   ├── Carousel.jsx    # Carousel d'images
│   └── ...
│
├── pages/              # Pages/Vues principales
│   └── (à créer)
│
├── constants/          # Constantes et configuration
│   ├── theme.js        # Couleurs et styles
│   ├── slides.js       # Données du carousel
│   ├── categories.js   # Catégories de lieux
│   └── data.js         # Régions, profils, zones
│
├── utils/              # Fonctions utilitaires
│   └── (à créer)
│
├── App.jsx             # Composant principal
├── main.jsx            # Point d'entrée
└── index.css           # Styles globaux
```

## 📦 Modules Créés

### Constants
- **theme.js** - Palette de couleurs et polices
- **slides.js** - Images du carousel
- **categories.js** - Catégories de destinations
- **data.js** - Régions, profils de voyage, compagnons, saisons, zones

### Components
- **Logo.jsx** - Logo cliquable de l'application
- **Carousel.jsx** - Carousel automatique d'images

## 🔄 Migration en Cours

Le fichier `App.jsx` contient actuellement toute la logique. La structure modulaire permet:
- ✅ Maintenance plus facile
- ✅ Réutilisation des composants
- ✅ Tests unitaires simplifiés
- ✅ Collaboration en équipe facilitée

## 📝 Prochaines Étapes

1. Extraire les composants de pages (Auth, Home, AIPrefs, etc.)
2. Créer les utils (scoring, planning, distance)
3. Séparer les données de lieux (PL) dans un fichier dédié
4. Créer les composants UI réutilisables (DayView, LoadingUI, etc.)
