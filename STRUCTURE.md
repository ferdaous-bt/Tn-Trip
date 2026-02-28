# 📁 Structure Modulaire - TUN Trip

## 🎯 Objectif
Organisation du code en modules réutilisables et maintenables pour faciliter le développement et la collaboration.

## 📂 Arborescence Complète

```
roamsmart-app/
├── public/
│   └── images/             # Images statiques
│       ├── logo.webp
│       ├── sidi bou said.jpg
│       ├── sahra tunise.jpg
│       ├── forets nord.png
│       ├── tbarka.jpg
│       └── el jem.png
│
├── src/
│   ├── components/         # Composants réutilisables UI
│   │   ├── Logo.jsx       ✅ Créé
│   │   ├── Carousel.jsx   ✅ Créé
│   │   ├── DayView.jsx    # Vue d'un jour de voyage
│   │   ├── LoadingUI.jsx  # Animation de chargement
│   │   └── LeafletMap.jsx # Composant carte interactive
│   │
│   ├── pages/              # Pages/Vues principales
│   │   ├── Auth.jsx       # Page de connexion/inscription
│   │   ├── Home.jsx       # Page d'accueil
│   │   ├── AIPrefs.jsx    # Préférences IA
│   │   ├── AIResult.jsx   # Résultats IA
│   │   ├── ManualPrefs.jsx# Préférences manuelles
│   │   ├── ManualSelection.jsx # Sélection manuelle
│   │   ├── ManualResult.jsx # Résultats manuels
│   │   ├── Trips.jsx      # Liste des voyages
│   │   └── TripDetail.jsx # Détails d'un voyage
│   │
│   ├── constants/          # Données et configuration
│   │   ├── theme.js       ✅ Créé - Couleurs et polices
│   │   ├── slides.js      ✅ Créé - Images du carousel
│   │   ├── categories.js  ✅ Créé - Catégories de lieux
│   │   ├── data.js        ✅ Créé - Régions, profils, zones
│   │   └── places.js      # Liste complète des 262 destinations
│   │
│   ├── utils/              # Fonctions utilitaires
│   │   ├── scoring.js     # Algorithmes de scoring
│   │   ├── planning.js    # Planification d'itinéraire
│   │   └── distance.js    # Calculs de distance
│   │
│   ├── hooks/              # Custom React Hooks
│   │   └── useAuth.js     # Gestion de l'authentification
│   │
│   ├── App.jsx             # Composant racine
│   ├── main.jsx            # Point d'entrée
│   └── index.css           # Styles globaux
│
├── package.json
└── vite.config.js
```

## 📦 Fichiers Créés

### ✅ Constants

#### `constants/theme.js`
```javascript
export const TN = {
  bg: "#f8f9fa",
  card: "#ffffff",
  pr: "#d42b2b",      // Rouge primaire (logo)
  pD: "#a01c1c",       // Rouge foncé
  // ... autres couleurs
};
export const F = "Inter, system-ui, sans-serif";
```

#### `constants/slides.js`
```javascript
export const SLIDES = [
  { t: "Sidi Bou Saïd", s: "Village bleu et blanc", img: "/images/..." },
  { t: "Sahara Tunisien", s: "Dunes dorées", img: "/images/..." },
  // ...
];
```

#### `constants/categories.js`
```javascript
export const CATS = {
  attraction: { i: "🏛️", l: "Attractions" },
  restaurant: { i: "🍽️", l: "Restaurants" },
  // ...
};
```

#### `constants/data.js`
- `REGIONS` - 11 régions de Tunisie
- `PROFILES` - 8 profils de voyageurs
- `COMPS` - 5 types de compagnons
- `SEASONS` - 4 saisons
- `ZONES` - Zones géographiques pour l'IA

### ✅ Components

#### `components/Logo.jsx`
```javascript
export default function Logo({ size = 60 }) {
  return <img src="/images/logo.webp" ... />;
}
```

#### `components/Carousel.jsx`
- Carousel automatique (4s)
- Navigation par points
- Images réelles de Tunisie

## 🔄 Comment Migrer

### Étape 1: Import dans App.jsx
```javascript
import { TN, F, F2 } from "./constants/theme";
import { SLIDES } from "./constants/slides";
import Logo from "./components/Logo";
import Carousel from "./components/Carousel";
```

### Étape 2: Supprimer les déclarations en double
- Supprimer `var TN = {...}`
- Supprimer `function Logo() {...}`
- Supprimer `function Carousel() {...}`

### Étape 3: Utiliser les imports
Le code reste identique, mais les constantes viennent des fichiers modulaires.

## 🎨 Avantages de la Structure

### 1. **Séparation des préoccupations**
- UI Components ≠ Business Logic ≠ Data
- Chaque fichier a une responsabilité unique

### 2. **Réutilisabilité**
```javascript
// Logo peut être utilisé partout
import Logo from "./components/Logo";
<Logo size={40} />
```

### 3. **Maintenance facilitée**
- Modifier les couleurs → `constants/theme.js`
- Ajouter une région → `constants/data.js`
- Fix bug carousel → `components/Carousel.jsx`

### 4. **Tests unitaires**
```javascript
// Tester le Logo isolément
import { render } from '@testing-library/react';
import Logo from './components/Logo';

test('Logo renders correctly', () => {
  const { getByAlt } = render(<Logo size={60} />);
  expect(getByAlt('TUN Trip Logo')).toBeInTheDocument();
});
```

### 5. **Travail en équipe**
- Dev A → Components
- Dev B → Pages
- Dev C → Utils
- Moins de conflits Git!

## 📝 Prochaines Étapes

### Phase 1: Extraire les utils
```javascript
// utils/scoring.js
export function scoreAll(profs, comp) {
  // ... logique de scoring
}

// utils/planning.js
export function aiPlan(profs, comp, nD, ...) {
  // ... algorithme de planification
}
```

### Phase 2: Créer les pages
```javascript
// pages/Home.jsx
export default function Home({ user, setVw }) {
  return (
    <div>
      <Carousel />
      {/* ... contenu */}
    </div>
  );
}
```

### Phase 3: Custom Hooks
```javascript
// hooks/useAuth.js
export function useAuth() {
  const [user, setUser] = useState(null);
  const login = (email, password) => { ... };
  const logout = () => { ... };
  return { user, login, logout };
}
```

## 🚀 Utilisation

L'application actuelle fonctionne normalement. Les fichiers modulaires sont prêts à être utilisés progressivement sans casser le code existant.

### Option 1: Migration Progressive
Migrer module par module, tester après chaque changement.

### Option 2: Nouvelle Feature
Utiliser la structure modulaire pour toute nouvelle fonctionnalité.

## 📚 Ressources

- **React Components**: https://react.dev/learn/your-first-component
- **ES6 Modules**: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules
- **Project Structure**: https://react.dev/learn/thinking-in-react

---

✨ **Structure créée par Claude Code** - Prête pour le développement professionnel!
