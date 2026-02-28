import initSqlJs from 'sql.js';

let db = null;

const DB_VERSION = 6; // Increment this when schema changes

// Initialize the database
export async function initDatabase() {
  try {
    const SQL = await initSqlJs({
      locateFile: file => {
        if (file.endsWith('.wasm')) {
          return `/sql-wasm.wasm`;
        }
        return file;
      }
    });

    const savedVersion = parseInt(localStorage.getItem('roamsmart_db_version') || '0');

    // If version mismatch, force complete reset
    if (savedVersion !== DB_VERSION) {
      localStorage.removeItem('roamsmart_db');
      localStorage.removeItem('roamsmart_session');
      db = null;
    }

    // Check if already initialized
    if (db) {
      return db;
    }

    // Try to load from localStorage
    const savedDb = localStorage.getItem('roamsmart_db');
    if (savedDb && savedVersion === DB_VERSION) {
      try {
        const uint8Array = new Uint8Array(JSON.parse(savedDb));
        db = new SQL.Database(uint8Array);
        return db;
      } catch (e) {
        console.error('Failed to load saved database:', e);
      }
    }

    // Create new database
    db = new SQL.Database();
    createTables();
    localStorage.setItem('roamsmart_db_version', DB_VERSION.toString());

    return db;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

// Create database tables
function createTables() {
  // Drop existing tables first to ensure fresh schema
  try {
    db.run('DROP TABLE IF EXISTS trips');
    db.run('DROP TABLE IF EXISTS users');
  } catch (e) {
    // Ignore errors
  }

  // Users table
  db.run(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Trips table
  db.run(`
    CREATE TABLE trips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      region TEXT,
      start_date TEXT,
      end_date TEXT,
      budget TEXT,
      preferences TEXT,
      profile TEXT,
      itinerary TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  saveDatabase();
}

// Save database to localStorage
function saveDatabase() {
  if (!db) return;
  const data = db.export();
  const buffer = Array.from(data);
  localStorage.setItem('roamsmart_db', JSON.stringify(buffer));
  localStorage.setItem('roamsmart_db_version', DB_VERSION.toString());
}

// User operations
export async function createUser(name, email, passwordHash) {
  if (!db) await initDatabase();

  try {
    // Escape single quotes in strings for SQL
    const escapedName = name.replace(/'/g, "''");
    const escapedEmail = email.replace(/'/g, "''");
    const escapedHash = passwordHash.replace(/'/g, "''");

    const sql = `INSERT INTO users (name, email, password_hash) VALUES ('${escapedName}', '${escapedEmail}', '${escapedHash}')`;
    db.run(sql);
    saveDatabase();

    // Get the user we just inserted
    const result = db.exec(`SELECT id FROM users WHERE email = '${escapedEmail}'`);
    const userId = result[0].values[0][0];
    return { success: true, id: userId };
  } catch (error) {
    console.error('Error creating user:', error);
    return { success: false, error: error.message };
  }
}

export async function getUserByEmail(email) {
  if (!db) await initDatabase();

  const escapedEmail = email.replace(/'/g, "''");
  const result = db.exec(`SELECT * FROM users WHERE email = '${escapedEmail}'`);
  if (result.length === 0) return null;

  const row = result[0].values[0];
  return {
    id: row[0],
    name: row[1],
    email: row[2],
    password_hash: row[3],
    created_at: row[4]
  };
}

export async function getUserById(id) {
  if (!db) await initDatabase();

  const result = db.exec(`SELECT * FROM users WHERE id = ${parseInt(id)}`);
  if (result.length === 0) return null;

  const row = result[0].values[0];
  return {
    id: row[0],
    name: row[1],
    email: row[2],
    created_at: row[4]
  };
}

// Trip operations
export async function createTrip(userId, tripData) {
  if (!db) await initDatabase();

  const { title, region, start_date, end_date, budget, preferences, profile, itinerary } = tripData;

  try {
    const escapedTitle = (title || '').replace(/'/g, "''");
    const escapedRegion = (region || '').replace(/'/g, "''");
    const escapedStartDate = (start_date || '').replace(/'/g, "''");
    const escapedEndDate = (end_date || '').replace(/'/g, "''");
    const escapedBudget = (budget || '').replace(/'/g, "''");
    const escapedPreferences = JSON.stringify(preferences || {}).replace(/'/g, "''");
    const escapedProfile = (profile || '').replace(/'/g, "''");
    const escapedItinerary = JSON.stringify(itinerary || []).replace(/'/g, "''");

    const sql = `INSERT INTO trips (user_id, title, region, start_date, end_date, budget, preferences, profile, itinerary)
       VALUES (${parseInt(userId)}, '${escapedTitle}', '${escapedRegion}', '${escapedStartDate}', '${escapedEndDate}', '${escapedBudget}', '${escapedPreferences}', '${escapedProfile}', '${escapedItinerary}')`;

    db.run(sql);
    saveDatabase();
    const result = db.exec('SELECT id FROM trips ORDER BY id DESC LIMIT 1');
    return { success: true, id: result[0].values[0][0] };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function getTripsByUserId(userId) {
  if (!db) await initDatabase();

  const result = db.exec(`SELECT * FROM trips WHERE user_id = ${parseInt(userId)} ORDER BY created_at DESC`);
  if (result.length === 0) return [];

  return result[0].values.map(row => ({
    id: row[0],
    user_id: row[1],
    title: row[2],
    region: row[3],
    start_date: row[4],
    end_date: row[5],
    budget: row[6],
    preferences: JSON.parse(row[7] || '{}'),
    profile: row[8],
    itinerary: JSON.parse(row[9] || '[]'),
    created_at: row[10]
  }));
}

export async function getTripById(tripId) {
  if (!db) await initDatabase();

  const result = db.exec(`SELECT * FROM trips WHERE id = ${parseInt(tripId)}`);
  if (result.length === 0) return null;

  const row = result[0].values[0];
  return {
    id: row[0],
    user_id: row[1],
    title: row[2],
    region: row[3],
    start_date: row[4],
    end_date: row[5],
    budget: row[6],
    preferences: JSON.parse(row[7] || '{}'),
    profile: row[8],
    itinerary: JSON.parse(row[9] || '[]'),
    created_at: row[10]
  };
}

export async function updateTrip(tripId, tripData) {
  if (!db) await initDatabase();

  const { title, region, start_date, end_date, budget, preferences, profile, itinerary } = tripData;

  try {
    const escapedTitle = (title || '').replace(/'/g, "''");
    const escapedRegion = (region || '').replace(/'/g, "''");
    const escapedStartDate = (start_date || '').replace(/'/g, "''");
    const escapedEndDate = (end_date || '').replace(/'/g, "''");
    const escapedBudget = (budget || '').replace(/'/g, "''");
    const escapedPreferences = JSON.stringify(preferences || {}).replace(/'/g, "''");
    const escapedProfile = (profile || '').replace(/'/g, "''");
    const escapedItinerary = JSON.stringify(itinerary || []).replace(/'/g, "''");

    const sql = `UPDATE trips SET
        title = '${escapedTitle}',
        region = '${escapedRegion}',
        start_date = '${escapedStartDate}',
        end_date = '${escapedEndDate}',
        budget = '${escapedBudget}',
        preferences = '${escapedPreferences}',
        profile = '${escapedProfile}',
        itinerary = '${escapedItinerary}'
       WHERE id = ${parseInt(tripId)}`;

    db.run(sql);
    saveDatabase();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function deleteTrip(tripId) {
  if (!db) await initDatabase();

  try {
    db.run(`DELETE FROM trips WHERE id = ${parseInt(tripId)}`);
    saveDatabase();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function getAllTrips() {
  if (!db) await initDatabase();

  const result = db.exec('SELECT * FROM trips ORDER BY created_at DESC');
  if (result.length === 0) return [];

  return result[0].values.map(row => ({
    id: row[0],
    user_id: row[1],
    title: row[2],
    region: row[3],
    start_date: row[4],
    end_date: row[5],
    budget: row[6],
    preferences: JSON.parse(row[7] || '{}'),
    profile: row[8],
    itinerary: JSON.parse(row[9] || '[]'),
    created_at: row[10]
  }));
}

// Utility function to clear all data (for testing)
export async function clearDatabase() {
  if (!db) await initDatabase();
  db.run('DELETE FROM trips');
  db.run('DELETE FROM users');
  saveDatabase();
}
