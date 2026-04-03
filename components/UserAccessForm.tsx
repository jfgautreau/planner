"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";

type Sultant = { id: string; Nom: string; Prénom: string };
type AccessRow = {
  id: string;
  user_id: string;
  sultant_id: string;
  role: "admin" | "chef_mission" | "consultant";
  can_read: boolean;
  can_write: boolean;
};

const NAVY = "#1a2744";
const ROLE_LABELS = {
  admin:        { label: "👑 Admin",            color: "#e67e22" },
  chef_mission: { label: "🧑‍💼 Chef de mission",  color: "#3498db" },
  consultant:   { label: "👤 Consultant",        color: "#7f8c8d" },
};

// Identifiants uniques des utilisateurs avec leur rôle
type UserMeta = { user_id: string; role: "admin"|"chef_mission"|"consultant" };

export default function UserAccessForm() {
  const [sultants, setSultants]     = useState<Sultant[]>([]);
  const [accesses, setAccesses]     = useState<AccessRow[]>([]);
  const [users, setUsers]           = useState<UserMeta[]>([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [msg, setMsg]               = useState("");

  // Formulaire ajout
  const [newUserId, setNewUserId]     = useState("");
  const [newRole, setNewRole]         = useState<"admin"|"chef_mission"|"consultant">("consultant");
  const [newSultantId, setNewSultantId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: s }, { data: a }] = await Promise.all([
      supabase.from("Sultant").select("id,Nom,Prénom").order("Nom"),
      supabase.from("UserAccess").select("id,user_id,sultant_id,role,can_read,can_write"),
    ]);
    const allSultants = (s as unknown as Sultant[]) || [];
    const allAccesses = (a || []) as AccessRow[];
    setSultants(allSultants);
    setAccesses(allAccesses);

    // Extraire la liste unique des utilisateurs avec leur rôle
    const userMap = new Map<string, UserMeta>();
    allAccesses.forEach(row => {
      if (!userMap.has(row.user_id))
        userMap.set(row.user_id, { user_id: row.user_id, role: row.role });
    });
    setUsers(Array.from(userMap.values()));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Lookup O(1) : user_id+sultant_id → AccessRow
  const accessMap = useMemo(() => {
    const m = new Map<string, AccessRow>();
    accesses.forEach(a => m.set(`${a.user_id}::${a.sultant_id}`, a));
    return m;
  }, [accesses]);

  const getAccess = (userId: string, sultantId: string) =>
    accessMap.get(`${userId}::${sultantId}`);

  // Toggle une case lecture ou écriture
  const toggle = useCallback(async (
    userId: string, sultantId: string,
    field: "can_read"|"can_write", value: boolean,
    userRole: "admin"|"chef_mission"|"consultant"
  ) => {
    if (userRole === "admin" || userRole === "consultant") return;
    const existing = accessMap.get(`${userId}::${sultantId}`);
    const updates: Record<string, boolean> = { [field]: value };
    if (field === "can_write" && value)  updates.can_read = true;
    if (field === "can_read"  && !value) updates.can_write = false;

    if (existing) {
      await supabase.from("UserAccess").update(updates).eq("id", existing.id);
    } else {
      // Créer la ligne si elle n'existe pas encore
      await supabase.from("UserAccess").insert({
        user_id: userId, sultant_id: sultantId,
        role: userRole, can_read: updates.can_read ?? true,
        can_write: updates.can_write ?? false,
      });
    }
    load();
  }, [accessMap, load]);

  // Ajouter un utilisateur
  const addUser = useCallback(async () => {
    if (!newUserId.trim()) { setMsg("⚠️ Saisis un User ID."); return; }
    setSaving(true); setMsg("");

    if (newRole === "admin") {
      const rows = sultants.map(s => ({
        user_id: newUserId.trim(), sultant_id: s.id,
        role: "admin", can_read: true, can_write: true,
      }));
      const { error } = await supabase.from("UserAccess").insert(rows);
      if (error) { setMsg(`❌ ${error.message}`); setSaving(false); return; }
    } else {
      if (!newSultantId) { setMsg("⚠️ Sélectionne le profil."); setSaving(false); return; }
      const { error } = await supabase.from("UserAccess").insert({
        user_id: newUserId.trim(), sultant_id: newSultantId,
        role: newRole, can_read: true, can_write: true,
      });
      if (error) { setMsg(`❌ ${error.message}`); setSaving(false); return; }
    }
    setMsg("✅ Utilisateur ajouté.");
    setNewUserId(""); setNewSultantId("");
    load(); setSaving(false);
  }, [newUserId, newRole, newSultantId, sultants, load]);

  // Supprimer tous les droits d'un utilisateur
  const removeUser = useCallback(async (userId: string) => {
    if (!confirm("Supprimer tous les droits de cet utilisateur ?")) return;
    await supabase.from("UserAccess").delete().eq("user_id", userId);
    load();
  }, [load]);

  const inp: React.CSSProperties = {
    padding: "0.45rem 0.7rem", border: "1px solid #ccc",
    borderRadius: 4, fontSize: "0.85rem", width: "100%",
    boxSizing: "border-box",
  };
  const label: React.CSSProperties = {
    fontSize: "0.72rem", color: "#666", marginBottom: "0.25rem", display: "block",
  };

  if (loading) return <div style={{ padding: "1rem", color: "#888" }}>Chargement...</div>;

  return (
    <div>
      <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>🔐 Gestion des accès</h2>
      <p style={{ fontSize: "0.8rem", color: "#666", marginBottom: "1.4rem" }}>
        <strong>Admin</strong> : tout coché automatiquement ·{" "}
        <strong>Chef de mission</strong> : lecture/écriture configurables par consultant ·{" "}
        <strong>Consultant</strong> : son profil uniquement, verrouillé
      </p>

      {/* ── Formulaire ajout ── */}
      <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: "1rem 1.2rem", marginBottom: "2rem", background: "#fafafa" }}>
        <div style={{ fontWeight: "bold", fontSize: "0.88rem", marginBottom: "1rem", color: NAVY }}>
          ➕ Ajouter un utilisateur
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.8rem", marginBottom: "0.8rem" }}>
          <div>
            <span style={label}>User ID Supabase</span>
            <input
              value={newUserId}
              onChange={e => setNewUserId(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              style={inp}
            />
            <span style={{ fontSize: "0.68rem", color: "#aaa" }}>
              Supabase → Authentication → Users
            </span>
          </div>
          <div>
            <span style={label}>Rôle</span>
            <select value={newRole} onChange={e => setNewRole(e.target.value as typeof newRole)} style={inp}>
              <option value="admin">👑 Admin (accès total)</option>
              <option value="chef_mission">🧑‍💼 Chef de mission</option>
              <option value="consultant">👤 Consultant</option>
            </select>
          </div>
        </div>

        {newRole !== "admin" && (
          <div style={{ marginBottom: "0.8rem", maxWidth: "50%" }}>
            <span style={label}>
              {newRole === "consultant" ? "Son profil consultant" : "Son propre profil (chef de mission)"}
            </span>
            <select value={newSultantId} onChange={e => setNewSultantId(e.target.value)} style={inp}>
              <option value="">-- Choisir --</option>
              {sultants.map(s => (
                <option key={s.id} value={s.id}>{s.Nom} {s.Prénom}</option>
              ))}
            </select>
          </div>
        )}

        <button
          onClick={addUser}
          disabled={saving}
          style={{ padding: "0.5rem 1.2rem", background: "#27ae60", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: "bold", fontSize: "0.88rem" }}
        >
          {saving ? "…" : "➕ Ajouter"}
        </button>

        {msg && (
          <div style={{ marginTop: "0.6rem", fontSize: "0.82rem", color: msg.startsWith("✅") ? "#27ae60" : "#e74c3c" }}>
            {msg}
          </div>
        )}
      </div>

      {/* ── Tableau double entrée ── */}
      {users.length === 0 ? (
        <div style={{ textAlign: "center", color: "#aaa", padding: "2rem" }}>Aucun accès configuré.</div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", fontSize: "0.8rem", width: "100%", minWidth: 500 }}>
            <thead>
              {/* Ligne 1 : entête utilisateurs */}
              <tr>
                <th rowSpan={2} style={{ ...thBase, textAlign: "left", minWidth: 130, background: NAVY, color: "white", borderRight: "2px solid #fff" }}>
                  Consultant ↓ / Utilisateur →
                </th>
                {users.map(u => {
                  const rl = ROLE_LABELS[u.role];
                  return (
                    <th key={u.user_id} colSpan={2} style={{ ...thBase, background: rl.color, color: "white", borderRight: "2px solid white", minWidth: 100 }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                        <span style={{ fontSize: "0.7rem" }}>{rl.label}</span>
                        <span style={{ fontSize: "0.65rem", opacity: 0.85, fontWeight: "normal" }}>
                          {u.user_id.slice(0, 8)}…
                        </span>
                        <button
                          onClick={() => removeUser(u.user_id)}
                          style={{ marginTop: 2, padding: "0.1rem 0.3rem", background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.4)", borderRadius: 3, color: "white", cursor: "pointer", fontSize: "0.6rem" }}
                        >
                          🗑
                        </button>
                      </div>
                    </th>
                  );
                })}
              </tr>
              {/* Ligne 2 : Lecture / Écriture par utilisateur */}
              <tr>
                {users.map(u => (
                  <React.Fragment key={u.user_id}>
                    <th style={{ ...thBase, background: "#f0f4f8", color: "#555", fontSize: "0.68rem", width: 50 }}>👁</th>
                    <th style={{ ...thBase, background: "#f0f4f8", color: "#555", fontSize: "0.68rem", width: 50, borderRight: "2px solid #e0e0e0" }}>✏️</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {sultants.map((s, si) => (
                <tr key={s.id} style={{ background: si % 2 === 0 ? "white" : "#fafafa" }}>
                  {/* Nom consultant */}
                  <td style={{ padding: "0.4rem 0.8rem", fontWeight: 500, borderRight: "2px solid #e0e0e0", borderBottom: "1px solid #eee", whiteSpace: "nowrap" }}>
                    {s.Nom} {s.Prénom}
                  </td>
                  {/* Cases par utilisateur */}
                  {users.map(u => {
                    const row = getAccess(u.user_id, s.id);
                    const locked = u.role === "admin" || u.role === "consultant";
                    const canRead  = row?.can_read  ?? false;
                    const canWrite = row?.can_write ?? false;

                    return (
                      <React.Fragment key={u.user_id}>
                        <td style={{ ...tdCenter, borderBottom: "1px solid #eee" }}>
                          <input
                            type="checkbox"
                            checked={canRead}
                            disabled={locked}
                            onChange={e => toggle(u.user_id, s.id, "can_read", e.target.checked, u.role)}
                            style={{ width: 15, height: 15, cursor: locked ? "default" : "pointer", accentColor: "#3498db" }}
                          />
                        </td>
                        <td style={{ ...tdCenter, borderRight: "2px solid #e0e0e0", borderBottom: "1px solid #eee" }}>
                          <input
                            type="checkbox"
                            checked={canWrite}
                            disabled={locked}
                            onChange={e => toggle(u.user_id, s.id, "can_write", e.target.checked, u.role)}
                            style={{ width: 15, height: 15, cursor: locked ? "default" : "pointer", accentColor: "#27ae60" }}
                          />
                        </td>
                      </React.Fragment>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Légende */}
      <div style={{ marginTop: "1rem", display: "flex", gap: "1.2rem", fontSize: "0.75rem", color: "#888" }}>
        <span>👁 Lecture = voir le planning</span>
        <span>✏️ Écriture = modifier les affectations</span>
        <span style={{ color: "#aaa" }}>Cases grisées = verrouillées (admin/consultant)</span>
      </div>
    </div>
  );
}

const thBase: React.CSSProperties = {
  padding: "0.5rem 0.4rem", textAlign: "center",
  border: "1px solid #e0e0e0", fontWeight: 600,
};
const tdCenter: React.CSSProperties = {
  padding: "0.3rem", textAlign: "center",
};
