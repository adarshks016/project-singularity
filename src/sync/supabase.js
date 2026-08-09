const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const syncEnabled = Boolean(URL && KEY);

let client = null;

async function getClient() {
  if (!syncEnabled) return null;
  if (client) return client;
  const { createClient } = await import("@supabase/supabase-js");
  client = createClient(URL, KEY);
  return client;
}

export async function currentUser() {
  const db = await getClient();
  if (!db) return null;
  const { data } = await db.auth.getUser();
  return data?.user ?? null;
}

export async function signInWithEmail(email) {
  const db = await getClient();
  if (!db) throw new Error("Sync is not configured");
  const { error } = await db.auth.signInWithOtp({ email });
  if (error) throw error;
}

export async function signOut() {
  const db = await getClient();
  if (db) await db.auth.signOut();
}

export async function syncPush(snapshot) {
  const db = await getClient();
  if (!db) return { ok: false, reason: "disabled" };
  const user = await currentUser();
  if (!user) return { ok: false, reason: "signed-out" };

  const { error } = await db
    .from("app_state")
    .upsert(
      { user_id: user.id, payload: snapshot, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
  return error ? { ok: false, reason: error.message } : { ok: true };
}

export async function syncPull() {
  const db = await getClient();
  if (!db) return { ok: false, reason: "disabled" };
  const user = await currentUser();
  if (!user) return { ok: false, reason: "signed-out" };

  const { data, error } = await db
    .from("app_state")
    .select("payload, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return { ok: false, reason: error.message };
  if (!data) return { ok: true, payload: null };
  return { ok: true, payload: data.payload, updatedAt: data.updated_at };
}
