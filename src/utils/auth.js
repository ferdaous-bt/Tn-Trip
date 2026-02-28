import { createUser, getUserByEmail } from './database';

// Validate email format
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Simple hash function (for demo - in production use bcrypt or similar)
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Sign up a new user
export async function signUp(name, email, password) {
  // Validate inputs
  if (!name || !email || !password) {
    return { success: false, error: 'Tous les champs sont requis' };
  }

  // Trim whitespace
  name = name.trim();
  email = email.trim().toLowerCase();

  // Validate email format
  if (!isValidEmail(email)) {
    return { success: false, error: 'Format d\'email invalide' };
  }

  if (name.length < 2) {
    return { success: false, error: 'Le nom doit contenir au moins 2 caractères' };
  }

  if (password.length < 6) {
    return { success: false, error: 'Le mot de passe doit contenir au moins 6 caractères' };
  }

  try {
    // Check if user already exists
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return { success: false, error: 'Cet email est déjà utilisé' };
    }

    // Hash password and create user
    const passwordHash = await hashPassword(password);
    const result = await createUser(name, email, passwordHash);

    if (result.success) {
      // Store session
      const session = {
        userId: result.id,
        name,
        email,
        loginTime: new Date().toISOString()
      };
      localStorage.setItem('roamsmart_session', JSON.stringify(session));
      return { success: true, user: session };
    }

    return result;
  } catch (error) {
    console.error('Error during signup:', error);
    return { success: false, error: 'Erreur lors de l\'inscription. Veuillez réessayer.' };
  }
}

// Log in an existing user
export async function login(email, password) {
  if (!email || !password) {
    return { success: false, error: 'Email et mot de passe requis' };
  }

  // Trim and normalize email
  email = email.trim().toLowerCase();

  // Validate email format
  if (!isValidEmail(email)) {
    return { success: false, error: 'Format d\'email invalide' };
  }

  try {
    const user = await getUserByEmail(email);
    if (!user) {
      return { success: false, error: 'Email ou mot de passe incorrect' };
    }

    const passwordHash = await hashPassword(password);
    if (user.password_hash !== passwordHash) {
      return { success: false, error: 'Email ou mot de passe incorrect' };
    }

    // Store session
    const session = {
      userId: user.id,
      name: user.name,
      email: user.email,
      loginTime: new Date().toISOString()
    };
    localStorage.setItem('roamsmart_session', JSON.stringify(session));

    return { success: true, user: session };
  } catch (error) {
    console.error('Error during login:', error);
    return { success: false, error: 'Erreur lors de la connexion. Veuillez réessayer.' };
  }
}

// Log out
export function logout() {
  localStorage.removeItem('roamsmart_session');
  return { success: true };
}

// Get current session
export function getSession() {
  const sessionData = localStorage.getItem('roamsmart_session');
  if (!sessionData) return null;

  try {
    return JSON.parse(sessionData);
  } catch {
    return null;
  }
}

// Check if user is logged in
export function isLoggedIn() {
  return getSession() !== null;
}
