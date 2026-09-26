/**
 * The one connection to Supabase (database + login).
 *
 * Only the public URL and anon key are used here (CLAUDE.md hard rule 11); they come from .env.
 * "Keep me signed in": when on, the session is saved on the phone; when off, it's kept in memory
 * only, so closing the app signs out.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** False until .env has the Supabase URL and anon key. */
export const isSupabaseConfigured = Boolean(url && anonKey && !url.includes("YOUR-PROJECT"));

const KEEP_SIGNED_IN_KEY = "pumphisaab.keepSignedIn";
let keepSignedIn = true;
const memoryOnly = new Map<string, string>();

export async function loadKeepSignedIn(): Promise<boolean> {
  try {
    keepSignedIn = (await AsyncStorage.getItem(KEEP_SIGNED_IN_KEY)) !== "0";
  } catch {
    keepSignedIn = true;
  }
  return keepSignedIn;
}

export function setKeepSignedIn(value: boolean) {
  keepSignedIn = value;
  AsyncStorage.setItem(KEEP_SIGNED_IN_KEY, value ? "1" : "0").catch(() => {});
}

const sessionStorage = {
  getItem: (key: string) => (keepSignedIn ? AsyncStorage.getItem(key) : Promise.resolve(memoryOnly.get(key) ?? null)),
  setItem: (key: string, value: string) => {
    if (keepSignedIn) return AsyncStorage.setItem(key, value);
    memoryOnly.set(key, value);
    return Promise.resolve();
  },
  removeItem: (key: string) => {
    memoryOnly.delete(key);
    return AsyncStorage.removeItem(key);
  },
};

export const supabase: SupabaseClient = createClient(
  isSupabaseConfigured ? (url as string) : "http://localhost:54321",
  isSupabaseConfigured ? (anonKey as string) : "not-configured",
  {
    auth: {
      storage: sessionStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
