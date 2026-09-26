// ═════════════════════════════════════════════════════════════════════════════
//  Supabase Edge Function: create-user
//
//  Lets a pump's OWNER manage manager logins:
//    • create         a new manager login (username + password)
//    • resetPassword  give a manager a new password
//    • setActive      switch a manager's login off or back on
//
//  It runs on Supabase's servers with the secret service key, which never goes into the app
//  (CLAUDE.md hard rule 11). It refuses anyone who isn't the active owner of that pump.
//
//  HOW TO DEPLOY (decision D35): Supabase › Edge Functions › Deploy a new function › Via editor,
//  name it exactly  create-user , paste this whole file, Deploy. Keep "Verify JWT" ON.
// ═════════════════════════════════════════════════════════════════════════════

import { createClient } from "npm:@supabase/supabase-js@2";

// Same rules as src/lib/username.ts and the database (pump_members.username).
const USERNAME_RULE = /^[a-z0-9][a-z0-9._]{2,29}$/;
const LOGIN_EMAIL_DOMAIN = "users.pumphisaab.com"; // decision D36
const MIN_PASSWORD_LENGTH = 8;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
const problem = (status: number, message: string) => reply(status, { ok: false, message });

type Request_ =
  | { action: "create"; pumpId: string; username: string; fullName: string; password: string }
  | { action: "resetPassword"; pumpId: string; memberId: string; password: string }
  | { action: "setActive"; pumpId: string; memberId: string; active: boolean };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return problem(405, "Use POST.");

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // 1. Who is asking? (their own sign-in token)
  const asCaller = createClient(url, anonKey, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false },
  });
  const { data: who } = await asCaller.auth.getUser();
  const caller = who.user;
  if (!caller) return problem(401, "Please sign in again.");

  let body: Request_;
  try {
    body = await req.json();
  } catch {
    return problem(400, "Something went wrong. Try again.");
  }

  // 2. Are they the active owner of this pump?
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: me } = await admin
    .from("pump_members")
    .select("role, is_active")
    .eq("pump_id", body.pumpId)
    .eq("user_id", caller.id)
    .maybeSingle();
  if (!me || me.role !== "OWNER" || !me.is_active) return problem(403, "Only the pump's owner can manage logins.");

  // 3. Do what was asked.
  if (body.action === "create") {
    const username = String(body.username ?? "").trim().toLowerCase();
    const fullName = String(body.fullName ?? "").trim();
    if (!USERNAME_RULE.test(username)) return problem(400, "Use only letters, numbers, dot and underscore (3 to 30).");
    if (!fullName) return problem(400, "Type the manager's full name.");
    if (String(body.password ?? "").length < MIN_PASSWORD_LENGTH) return problem(400, `Use a password of at least ${MIN_PASSWORD_LENGTH} characters.`);

    const { data: taken } = await admin.from("pump_members").select("id").eq("username", username).maybeSingle();
    if (taken) return problem(409, `The username ${username} is already taken.`);

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: `${username}@${LOGIN_EMAIL_DOMAIN}`,
      password: body.password,
      email_confirm: true,
      user_metadata: { username, full_name: fullName },
    });
    if (createError || !created.user) return problem(409, `The username ${username} is already taken.`);

    const { data: member, error: memberError } = await admin
      .from("pump_members")
      .insert({ pump_id: body.pumpId, user_id: created.user.id, username, full_name: fullName, role: "MANAGER", created_by: caller.id })
      .select("id")
      .single();
    if (memberError) {
      await admin.auth.admin.deleteUser(created.user.id); // undo, so no half-made login is left behind
      return problem(500, "Couldn't create the login. Try again.");
    }
    return reply(200, { ok: true, memberId: member.id });
  }

  // resetPassword and setActive work only on this pump's managers.
  const { data: member } = await admin
    .from("pump_members")
    .select("id, user_id, role, version")
    .eq("id", body.memberId)
    .eq("pump_id", body.pumpId)
    .maybeSingle();
  if (!member || member.role !== "MANAGER") return problem(404, "That manager wasn't found.");

  if (body.action === "resetPassword") {
    if (String(body.password ?? "").length < MIN_PASSWORD_LENGTH) return problem(400, `Use a password of at least ${MIN_PASSWORD_LENGTH} characters.`);
    const { error } = await admin.auth.admin.updateUserById(member.user_id, { password: body.password });
    if (error) return problem(500, "Couldn't change the password. Try again.");
    return reply(200, { ok: true });
  }

  if (body.action === "setActive") {
    const active = Boolean(body.active);
    const { error } = await admin
      .from("pump_members")
      .update({ is_active: active, updated_by: caller.id, version: member.version })
      .eq("id", member.id);
    if (error) return problem(500, "Couldn't change the login. Try again.");
    // A switched-off login is also signed out everywhere and can't sign back in.
    await admin.auth.admin.updateUserById(member.user_id, { ban_duration: active ? "none" : "876000h" });
    return reply(200, { ok: true });
  }

  return problem(400, "Something went wrong. Try again.");
});
