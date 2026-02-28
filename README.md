# 🇹🇳 TUN Trip - Planificateur de Voyage en Tunisie

Application web de planification de voyages en Tunisie avec intelligence artificielle et sélection manuelle de destinations.

## 📹 Vidéo de Démonstration

**[▶️ Voir la vidéo de démonstration](https://drive.google.com/file/d/1dGBtgYlIaUWIE0Hrz29n9unQyeUX5-tn/view?usp=sharing)**

Découvrez toutes les fonctionnalités de TUN Trip en vidéo: planification IA, sélection manuelle de destinations, gestion des voyages, et bien plus!

## ✨ Fonctionnalités

### 🤖 Mode IA - Planification Intelligente
- Sélection personnalisée basée sur vos préférences
- Optimisation géographique automatique (regroupement par proximité ≤40km)
- Suggestions de restaurants et hôtels
- Itinéraire optimisé pour éviter les allers-retours

### 🗺️ Mode Manuel - Contrôle Total
- Sélection manuelle de destinations parmi 262 lieux
- Filtrage par région et catégorie
- Personnalisation complète de l'itinéraire
- Cartes interactives avec Leaflet

### 💾 Gestion des Voyages
- Système d'authentification sécurisé
- Base de données SQLite locale (sql.js)
- CRUD complet: Créer, Lire, Modifier, Supprimer
- Sauvegarde automatique dans le navigateur

### 🎨 Interface Utilisateur
- Design moderne et responsive
- Thème aux couleurs de la Tunisie
- Animations fluides
- Cartes interactives OpenStreetMap

## 📊 Données

- **262 lieux touristiques** répertoriés
- **11 régions** de Tunisie
- **8 catégories**: Attractions, Plages, Restaurants, Cafés, Mosquées, Hôtels, Nature, Culture
- **4 saisons** avec suggestions adaptées

## 🚀 Installation

### Prérequis
- Node.js (v16+)
- npm ou yarn

### Étapes

```bash
# Cloner le repository
git clone https://github.com/ferdaous-bt/Tn-Trip.git
cd Tn-Trip

# Installer les dépendances
npm install

# Lancer le serveur de développement
npm run dev

# Ouvrir dans le navigateur
# http://localhost:5173
```

## 🏗️ Structure du Projet

```
Tn-Trip/
├── public/
│   ├── images/          # Images des destinations
│   ├── sql-wasm.wasm    # WebAssembly pour SQLite
│   └── sql-wasm.js
├── src/
│   ├── components/      # Composants React
│   │   ├── Carousel.jsx
│   │   └── Logo.jsx
│   ├── constants/       # Données et configuration
│   │   ├── places.js    # 262 lieux touristiques
│   │   ├── data.js      # Régions, profils, zones
│   │   ├── categories.js
│   │   ├── slides.js
│   │   └── theme.js
│   ├── utils/           # Utilitaires
│   │   ├── database.js  # Gestion SQLite
│   │   └── auth.js      # Authentification
│   ├── App.jsx          # Composant principal
│   └── main.jsx
├── DATABASE.md          # Documentation base de données
├── STRUCTURE.md         # Architecture détaillée
└── package.json
```

## 🛠️ Technologies Utilisées

- **React** - Framework UI
- **Vite** - Build tool rapide
- **SQLite (sql.js)** - Base de données locale
- **Leaflet** - Cartes interactives
- **OpenStreetMap** - Tiles de carte
- **Crypto API** - Hachage de mots de passe

## 📖 Documentation

- [DATABASE.md](DATABASE.md) - Documentation complète de la base de données
- [STRUCTURE.md](STRUCTURE.md) - Architecture et structure du code

## 🎯 Utilisation

### 1. Inscription/Connexion
- Créez un compte ou connectez-vous
- Authentification sécurisée avec hachage SHA-256

### 2. Créer un Voyage

#### Mode IA
1. Sélectionnez vos styles de voyage (Aventurier, Culturel, Plage, etc.)
2. Choisissez votre compagnon (Couple, Famille, Amis, Solo, Guide)
3. Sélectionnez les zones de Tunisie
4. Définissez le nombre de jours et le budget
5. Ajoutez les repas souhaités
6. Cliquez "Créer mon voyage"

#### Mode Manuel
1. Choisissez une ou plusieurs régions
2. Sélectionnez vos spots préférés
3. Filtrez par catégorie
4. L'IA optimise géographiquement votre sélection
5. Sauvegardez votre voyage

### 3. Gérer vos Voyages
- Consultez vos voyages sauvegardés
- Modifiez les itinéraires existants
- Supprimez les voyages non souhaités

## 🔒 Sécurité

- Hachage des mots de passe avec SHA-256
- Validation des emails
- Données stockées localement (localStorage)
- Pas de transmission de données sensibles

⚠️ **Note**: Pour une application en production, utilisez bcrypt/Argon2 et une vraie base de données backend.

## 📝 License

Ce projet est sous licence MIT.

## 👤 Auteur

**Ferdaous Ben Taleb**
- GitHub: [@ferdaous-bt](https://github.com/ferdaous-bt)
- Email: bentaleb.ferdaous3@gmail.com

## 🙏 Remerciements

- Données touristiques de la Tunisie
- OpenStreetMap pour les cartes
- sql.js pour SQLite en navigateur

---

⭐ Si ce projet vous plaît, n'hésitez pas à lui donner une étoile sur GitHub!
