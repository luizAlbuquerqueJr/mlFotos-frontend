import { initializeApp, getApps, getApp } from "firebase/app";
import {
  browserSessionPersistence,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut,
  type Auth,
  type User,
} from "firebase/auth";

const ADMIN_ALLOWED_EMAILS = new Set(["luizkoff@gmail.com", "barbosalima010@gmail.com"]);

const UNAUTHENTICATED_MESSAGE = "Você não está autenticado";

export class AdminAuthError extends Error {
  constructor(message = UNAUTHENTICATED_MESSAGE) {
    super(message);
    this.name = "AdminAuthError";
  }
}

function getEnv(name: string): string {
  const value = (import.meta.env as Record<string, unknown>)[name];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Variável ${name} não configurada`);
  }
  return value.trim();
}

function getFirebaseAuth(): Auth {
  const app = getApps().length
    ? getApp()
    : initializeApp({
        apiKey: getEnv("VITE_FIREBASE_API_KEY"),
        authDomain: getEnv("VITE_FIREBASE_AUTH_DOMAIN"),
        projectId: getEnv("VITE_FIREBASE_PROJECT_ID"),
        appId: getEnv("VITE_FIREBASE_APP_ID"),
      });

  return getAuth(app);
}

function normalizeEmail(user: User | null): string {
  return String(user?.email || "")
    .trim()
    .toLowerCase();
}

function getFirebaseErrorCode(error: unknown): string {
  if (!error || typeof error !== "object" || !("code" in error)) return "";
  return String((error as { code?: unknown }).code || "");
}

async function prepareAuth(): Promise<Auth> {
  const auth = getFirebaseAuth();
  await setPersistence(auth, browserSessionPersistence).catch(() => null);
  if (typeof auth.authStateReady === "function") {
    await auth.authStateReady();
  }
  return auth;
}

function isAuthorizedAdminUser(user: User | null): user is User {
  if (!user) return false;
  return ADMIN_ALLOWED_EMAILS.has(normalizeEmail(user));
}

async function assertAuthorizedAdmin(auth: Auth, user: User | null): Promise<User> {
  if (!isAuthorizedAdminUser(user)) {
    if (user) {
      await signOut(auth);
    }
    throw new AdminAuthError(UNAUTHENTICATED_MESSAGE);
  }

  return user;
}

export function subscribeAdminAuth(onChange: (isAdmin: boolean) => void): () => void {
  let cancelled = false;
  let unsubscribe: (() => void) | undefined;

  void prepareAuth()
    .then((auth) => {
      if (cancelled) return;
      unsubscribe = onAuthStateChanged(auth, (user) => {
        onChange(isAuthorizedAdminUser(user));
      });
    })
    .catch(() => {
      if (!cancelled) onChange(false);
    });

  return () => {
    cancelled = true;
    unsubscribe?.();
  };
}

export async function getAdminUploadTokenIfAuthenticated(): Promise<string | null> {
  const auth = await prepareAuth();
  if (!auth.currentUser) {
    return null;
  }

  const user = await assertAuthorizedAdmin(auth, auth.currentUser);
  return user.getIdToken();
}

export async function logoutAdmin(): Promise<void> {
  const auth = getFirebaseAuth();
  await signOut(auth);
}

export async function ensureAdminUploadToken(): Promise<string> {
  const auth = await prepareAuth();

  if (auth.currentUser) {
    const user = await assertAuthorizedAdmin(auth, auth.currentUser);
    return user.getIdToken();
  }

  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  try {
    const result = await signInWithPopup(auth, provider);
    const user = await assertAuthorizedAdmin(auth, result.user);
    return user.getIdToken();
  } catch (error) {
    if (error instanceof AdminAuthError) {
      throw error;
    }

    const code = getFirebaseErrorCode(error);
    if (
      code === "auth/popup-closed-by-user" ||
      code === "auth/cancelled-popup-request" ||
      code === "auth/popup-blocked" ||
      code === "auth/user-cancelled"
    ) {
      throw new AdminAuthError(UNAUTHENTICATED_MESSAGE);
    }

    throw new AdminAuthError(UNAUTHENTICATED_MESSAGE);
  }
}
