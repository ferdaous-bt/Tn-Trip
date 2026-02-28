# RoamSmart Database Documentation

## Vue d'ensemble

L'application RoamSmart utilise maintenant une base de données SQLite intégrée pour stocker les utilisateurs et leurs voyages. La base de données fonctionne entièrement dans le navigateur grâce à sql.js et est sauvegardée dans le localStorage.

## Architecture

### Fichiers créés

1. **`src/utils/database.js`** - Utilitaires de base de données
   - Initialisation de la base de données
   - Opérations CRUD pour les utilisateurs et les voyages
   - Sauvegarde automatique dans localStorage

2. **`src/utils/auth.js`** - Système d'authentification
   - Inscription (signUp)
   - Connexion (login)
   - Déconnexion (logout)
   - Gestion de session
   - Hachage de mot de passe (SHA-256)

## Schéma de base de données

### Table `users`
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
```

### Table `trips`
```sql
CREATE TABLE trips (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  region TEXT,
  start_date TEXT,
  end_date TEXT,
  budget TEXT,
  preferences TEXT,  -- JSON
  profile TEXT,
  itinerary TEXT,    -- JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

## Fonctionnalités

### Authentification

**Inscription**
```javascript
import { signUp } from './utils/auth';

const result = await signUp("Nom", "email@example.com", "motdepasse");
if (result.success) {
  // Utilisateur créé et connecté
  console.log(result.user);
}
```

**Connexion**
```javascript
import { login } from './utils/auth';

const result = await login("email@example.com", "motdepasse");
if (result.success) {
  // Utilisateur connecté
  console.log(result.user);
}
```

**Déconnexion**
```javascript
import { logout } from './utils/auth';

logout();
```

### Gestion des voyages

**Créer un voyage**
```javascript
import { createTrip } from './utils/database';

const result = await createTrip(userId, {
  title: "Mon voyage en Tunisie",
  region: "tunis,sfax",
  start_date: "2024-06-01",
  end_date: "2024-06-10",
  budget: "1000",
  preferences: {
    profiles: ["aventurier", "culturel"],
    companion: "couple",
    zones: ["nord"],
    meals: { breakfast: true, lunch: true, dinner: true }
  },
  profile: "aventurier,culturel",
  itinerary: [/* jours du voyage */]
});
```

**Récupérer les voyages d'un utilisateur**
```javascript
import { getTripsByUserId } from './utils/database';

const trips = await getTripsByUserId(userId);
console.log(trips); // Array de voyages
```

**Mettre à jour un voyage**
```javascript
import { updateTrip } from './utils/database';

const result = await updateTrip(tripId, {
  title: "Nouveau titre",
  budget: "1500",
  // autres champs...
});
```

**Supprimer un voyage**
```javascript
import { deleteTrip } from './utils/database';

const result = await deleteTrip(tripId);
```

## Stockage des données

- La base de données est stockée dans le localStorage du navigateur sous la clé `roamsmart_db`
- La version du schéma est stockée sous la clé `roamsmart_db_version`
- La session utilisateur est stockée sous la clé `roamsmart_session`
- Les données persistent entre les sessions de navigation
- Les données sont spécifiques à chaque navigateur/appareil

### Gestion des versions

Le système inclut un mécanisme de versioning automatique :
- Chaque changement de schéma incrémente `DB_VERSION` dans `database.js`
- Au démarrage, si la version sauvegardée ne correspond pas, la base est recréée
- Cela évite les erreurs de contraintes lors des mises à jour du schéma

## Sécurité

⚠️ **Note de sécurité** : Cette implémentation utilise un hachage SHA-256 simple pour les mots de passe. Pour une application en production, utilisez :
- bcrypt ou Argon2 pour le hachage des mots de passe
- HTTPS pour toutes les communications
- Un backend sécurisé avec une vraie base de données
- Validation des entrées côté serveur

## Migration et maintenance

### Vider la base de données
```javascript
import { clearDatabase } from './utils/database';

await clearDatabase(); // Supprime tous les utilisateurs et voyages
```

### Réinitialiser complètement
```javascript
localStorage.removeItem('roamsmart_db');
localStorage.removeItem('roamsmart_session');
location.reload();
```

## Intégration dans App.jsx

L'application a été mise à jour pour :
1. Initialiser la base de données au montage du composant
2. Vérifier et restaurer la session existante
3. Charger automatiquement les voyages de l'utilisateur connecté
4. Sauvegarder les nouveaux voyages dans la base de données
5. Gérer la déconnexion proprement

## Dépendances

- **sql.js** : Implémentation JavaScript de SQLite pour le navigateur
