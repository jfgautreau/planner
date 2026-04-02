"use client";

import { useEffect, useState, useCallback } from "react";
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
type UserEntry = {
  user_id: string;
  role: "admin" | "chef_mission" | "consultant";
  accesses: AccessRow[];
};

const NAVY = "#1a2744";
const ROLE_LABELS = {
  admin:        { label: "👑 Admin",           color: "#e67e22" },
  chef_mission: { label: "🧑‍💼 Chef de mission", color: "#3498db" },
  consultant:   { label: "👤 Consultant",       color: "#7f8c8d" },
};

export default function UserAccessForm() {
  const [sultants, setSultants]       = useState<Sultant[]>([]);
  const [userEntries, setUserEntries] = useState<UserEntry[]>([]);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [msg, setMsg]                 = useState("");

  const [newUserId, setNewUserId]         = useState("");
  const [newRole, setNewRole]             = useState<"admin"|"chef_mission"|"consultant">("consultant");
  const [newSultantId, setNewSultantId]   = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: s }, { data: a }] = await Promise.all([
      supabase.from("Sultant").select("id,Nom,Prénom").order("Nom"),
      supabase.from("UserAccess").select("id,user_id,sultant_id,role,can_read,can_write"),
    ]);
    const allSultants = (s as unknown as Sultant[]) || [];
    const allAccesses = (a || []) as AccessRow[];
    setSultants(allSultants);
    const byUser = new Map<string, UserEntry>();
    allAccesses.forEach(row => {
      if (!byUser.has(row.user_id)) byUser.set(row.user_id, { user_id: row.user_id, role: row.role, accesses: [] });
      byUser.get(row.user_id)!.accesses.push(row);
    });
    setUserEntries(Array.from(byUser.values()));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const addUser = async () => {
    if (!newUserId.trim()) { setMsg("⚠️ Saisis un User ID."); return; }
    setSaving(true); setMsg("");
    if (newRole === "admin") {
      const rows = sultants.map(s => ({ user_id: newUserId.trim(), sultant_id: s.id, role: "admin", can_read: true, can_write: true }));
      const { error } = await supabase.from("UserAccess").insert(rows);
      if (error) { setMsg(`❌ ${error.message}`); setSaving(false); return; }
    } else {
      if (!newSultantId) { setMsg("⚠️ Sélectionne le profil consultant."); setSaving(false); return; }
      const { error } = await supabase.from("UserAccess").insert({
        user_id: newUserId.trim(), sultant_id: newSultantId,
        role: newRole, can_read: true, can_write: true,
      });
      if (error) { setMsg(`❌ ${error.message}`); setSaving(false); return; }
    }
    setMsg("✅ Utilisateur ajouté."); setNewUserId(""); setNewSultantId("");
    load(); setSaving(false);
  };

  const toggle = useCallback(async (row: AccessRow, field: "can_read"|"can_write", value: boolean) => {
    if (row.role === "consultant" || row.role === "admin") return;
    const updates: Record<string, boolean> = { [field]: value };
    if (field === "can_write" && value) updates.can_read = true;
    if (field === "can_read" && !value) updates.can_write = false;
    await supabase.from("UserAccess").update(updates).eq("id", row.id);
    load();
  }, [load]);

  const addSultantAccess = async (userId: string, sultantId: string) => {
    await supabase.from("UserAccess").insert({ user_id: userId, sultant_id: sultantId, role: "chef_mission", can_read: true, can_write: false });
    load();
  };

  const removeRow = useCallback(async (id: string) => { await supabase.from("UserAccess").delete().eq("id", id); load(); }, [load]);

  const removeUser = useCallback(async (userId: string) => {
    if (!confirm("Supprimer tous les droits de cet utilisateur ?")) return;
    await supabase.from("UserAccess").delete().eq("user_id", userId);
    load();
  }, [load]);

  const sultantName = useCallback((id: string) => { const s = sultants.find(s => s.id === id); return s ? `${s.Nom} ${s.Prénom}` : id.slice(0, 8); }, [sultants]);
  const inp: React.CSSProperties = { padding: "0.4rem 0.7rem", border: "1px solid #ccc", borderRadius: 4, fontSize: "0.85rem", width: "100%" };

  if (loading) return <div style={{ padding: "1rem", color: "#888" }}>Chargement...</div>;

  return (
    <div>
      <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>🔐 Gestion des accès</h2>
      <p style={{ fontSize: "0.8rem", color: "#666", marginBottom: "1.2rem" }}>
        <strong>Admin</strong> : tout voir/modifier · <strong>Chef de mission</strong> : droits configurables par consultant · <strong>Consultant</strong> : son profil uniquement (lecture+écriture)
      </p>

      {/* Formulaire ajout */}
      <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: "1rem", marginBottom: "1.8rem", background: "#fafafa" }}>
        <div style={{ fontWeight: "bold", fontSize: "0.9rem", marginBottom: "0.8rem", color: NAVY }}>➕ Ajouter un utilisateur</div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: "0.6rem", alignItems: "end" }}>
          <div>
            <div style={{ fontSize: "0.72rem", color: "#666", marginBottom: "0.2rem" }}>User ID Supabase</div>
            <input value={newUserId} onChange={e => setNewUserId(e.target.value)} placeholder="uuid…" style={inp} />
            <div style={{ fontSize: "0.68rem", color: "#aaa", marginTop: "0.15rem" }}>Supabase → Authentication → Users</div>
          </div>
          <div>
            <div style={{ fontSize: "0.72rem", color: "#666", marginBottom: "0.2rem" }}>Rôle</div>
            <select value={newRole} onChange={e => setNewRole(e.target.value as typeof newRole)} style={inp}>
              <option value="admin">👑 Admin</option>
              <option value="chef_mission">🧑‍💼 Chef de mission</option>
              <option value="consultant">👤 Consultant</option>
            </select>
          </div>
          {newRole !== "admin" && (
            <div>
              <div style={{ fontSize: "0.72rem", color: "#666", marginBottom: "0.2rem" }}>{newRole === "consultant" ? "Son profil" : "Son propre profil"}</div>
              <select value={newSultantId} onChange={e => setNewSultantId(e.target.value)} style={inp}>
                <option value="">-- Choisir --</option>
                {sultants.map(s => <option key={s.id} value={s.id}>{s.Nom} {s.Prénom}</option>)}
              </select>
            </div>
          )}
          <button onClick={addUser} disabled={saving} style={{ padding: "0.45rem 1rem", background: "#27ae60", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: "bold", whiteSpace: "nowrap" }}>
            {saving ? "…" : "Ajouter"}
          </button>
        </div>
        {msg && <div style={{ marginTop: "0.6rem", fontSize: "0.82rem", color: msg.startsWith("✅") ? "#27ae60" : "#e74c3c" }}>{msg}</div>}
      </div>

      {/* Tableau par utilisateur */}
      {userEntries.length === 0 && <div style={{ textAlign: "center", color: "#aaa", padding: "2rem" }}>Aucun accès configuré.</div>}
      {userEntries.map(entry => {
        const rl = ROLE_LABELS[entry.role];
        const locked = entry.role === "admin" || entry.role === "consultant";
        const unassigned = sultants.filter(s => !entry.accesses.find(a => a.sultant_id === s.id));
        return (
          <div key={entry.user_id} style={{ border: "1px solid #e0e0e0", borderRadius: 8, marginBottom: "1.2rem", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.7rem", padding: "0.6rem 1rem", background: "#f8f9fa", borderBottom: "1px solid #e0e0e0" }}>
              <span style={{ background: rl.color, color: "white", padding: "0.18rem 0.6rem", borderRadius: 10, fontSize: "0.75rem", fontWeight: "bold" }}>{rl.label}</span>
              <code style={{ fontSize: "0.78rem", color: "#555" }}>{entry.user_id.slice(0, 20)}…</code>
              <button onClick={() => removeUser(entry.user_id)} style={{ marginLeft: "auto", padding: "0.2rem 0.5rem", background: "#e74c3c", color: "white", border: "none", borderRadius: 3, cursor: "pointer", fontSize: "0.75rem" }}>🗑 Supprimer</button>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
              <thead>
                <tr style={{ background: "#f0f4f8" }}>
                  <th style={{ padding: "0.4rem 0.8rem", textAlign: "left", color: "#555", fontWeight: 600 }}>Consultant</th>
                  <th style={{ padding: "0.4rem", textAlign: "center", width: 80, color: "#555", fontWeight: 600 }}>👁 Lecture</th>
                  <th style={{ padding: "0.4rem", textAlign: "center", width: 80, color: "#555", fontWeight: 600 }}>✏️ Écriture</th>
                  {!locked && <th style={{ width: 40 }} />}
                </tr>
              </thead>
              <tbody>
                {entry.accesses.map((row, i) => (
                  <tr key={row.id} style={{ background: i % 2 === 0 ? "white" : "#fafafa", borderTop: "1px solid #eee" }}>
                    <td style={{ padding: "0.4rem 0.8rem", fontWeight: 500 }}>{sultantName(row.sultant_id)}</td>
                    <td style={{ padding: "0.4rem", textAlign: "center" }}>
                      <input type="checkbox" checked={row.can_read} disabled={locked}
                        onChange={e => toggle(row, "can_read", e.target.checked)}
                        style={{ width: 16, height: 16, cursor: locked ? "default" : "pointer" }} />
                    </td>
                    <td style={{ padding: "0.4rem", textAlign: "center" }}>
                      <input type="checkbox" checked={row.can_write} disabled={locked}
                        onChange={e => toggle(row, "can_write", e.target.checked)}
                        style={{ width: 16, height: 16, cursor: locked ? "default" : "pointer" }} />
                    </td>
                    {!locked && (
                      <td style={{ padding: "0.4rem", textAlign: "center" }}>
                        <button onClick={() => removeRow(row.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#e74c3c", fontSize: "0.9rem" }}>✕</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {entry.role === "chef_mission" && unassigned.length > 0 && (
              <div style={{ padding: "0.5rem 1rem", borderTop: "1px solid #eee", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.78rem", color: "#888" }}>+ Ajouter consultant :</span>
                <select defaultValue="" onChange={e => { if (e.target.value) { addSultantAccess(entry.user_id, e.target.value); e.target.value = ""; } }}
                  style={{ padding: "0.25rem 0.5rem", border: "1px solid #ccc", borderRadius: 4, fontSize: "0.8rem" }}>
                  <option value="">-- Choisir --</option>
                  {unassigned.map(s => <option key={s.id} value={s.id}>{s.Nom} {s.Prénom}</option>)}
                </select>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
