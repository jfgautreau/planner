"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Sultant = { id: string; Nom: string; Prénom: string };
type AuthUser = { id: string; email: string };
type AccessRow = {
  id: string;
  user_id: string;
  sultant_id: string | null;
  role: "admin" | "manager" | "consultant";
  can_edit: boolean;
};

const ROLE_LABELS = { admin: "👑 Admin", manager: "🧑‍💼 Manager", consultant: "👤 Consultant" };
const NAVY = "#1a2744";

export default function UserAccessForm() {
  const [users, setUsers]         = useState<AuthUser[]>([]);
  const [sultants, setSultants]   = useState<Sultant[]>([]);
  const [accesses, setAccesses]   = useState<AccessRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [msg, setMsg]             = useState("");

  // Formulaire ajout
  const [selUser, setSelUser]       = useState("");
  const [selSultant, setSelSultant] = useState("");
  const [selRole, setSelRole]       = useState<"admin"|"manager"|"consultant">("consultant");
  const [selEdit, setSelEdit]       = useState(false);
  const [saving, setSaving]         = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: s }, { data: a }] = await Promise.all([
      supabase.from("Sultant").select("id,Nom,Prénom").order("Nom"),
      supabase.from("UserAccess").select("id,user_id,sultant_id,role,can_edit"),
    ]);
    setSultants(s || []);
    setAccesses((a || []) as AccessRow[]);

    // Charger les emails via la fonction admin (nécessite service role)
    // On affiche les user_id si pas d'emails disponibles
    const userIds = [...new Set((a || []).map((r: AccessRow) => r.user_id))];
    setUsers(userIds.map(id => ({ id, email: id.slice(0, 8) + "..." })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!selUser) { setMsg("⚠️ Sélectionne un utilisateur."); return; }
    if (selRole !== "admin" && !selSultant) { setMsg("⚠️ Sélectionne un consultant pour ce rôle."); return; }
    setSaving(true); setMsg("");
    const { error } = await supabase.from("UserAccess").insert({
      user_id: selUser,
      sultant_id: selRole === "admin" ? null : selSultant,
      role: selRole,
      can_edit: selRole === "admin" ? true : selEdit,
    });
    if (error) { setMsg(`❌ ${error.message}`); }
    else { setMsg("✅ Droit ajouté."); setSelUser(""); setSelSultant(""); setSelEdit(false); load(); }
    setSaving(false);
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer ce droit ?")) return;
    await supabase.from("UserAccess").delete().eq("id", id);
    setMsg("✅ Supprimé.");
    load();
  };

  const toggleEdit = async (row: AccessRow) => {
    await supabase.from("UserAccess").update({ can_edit: !row.can_edit }).eq("id", row.id);
    load();
  };

  const sultantLabel = (id: string | null) => {
    if (!id) return <span style={{ color: "#888", fontStyle: "italic" }}>Tous</span>;
    const s = sultants.find(s => s.id === id);
    return s ? `${s.Nom} ${s.Prénom}` : id.slice(0, 8);
  };

  const inp: React.CSSProperties = { padding: "0.4rem 0.7rem", border: "1px solid #ccc", borderRadius: 4, fontSize: "0.88rem", width: "100%" };
  const btnStyle = (bg: string): React.CSSProperties => ({ padding: "0.4rem 0.9rem", background: bg, color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: "bold", fontSize: "0.85rem" });

  if (loading) return <div>Chargement...</div>;

  return (
    <div>
      <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>🔐 Gestion des accès utilisateurs</h2>
      <p style={{ fontSize: "0.82rem", color: "#666", marginBottom: "1.2rem" }}>
        Associe chaque utilisateur Supabase à un ou plusieurs consultants avec un rôle et des droits de modification.
      </p>

      {/* Formulaire ajout */}
      <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: "1rem", marginBottom: "1.5rem", background: "#fafafa" }}>
        <div style={{ fontWeight: "bold", fontSize: "0.9rem", marginBottom: "0.8rem", color: NAVY }}>➕ Ajouter un droit</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem", marginBottom: "0.6rem" }}>
          <div>
            <div style={{ fontSize: "0.75rem", color: "#666", marginBottom: "0.2rem" }}>User ID (Supabase Auth)</div>
            <input
              value={selUser}
              onChange={e => setSelUser(e.target.value)}
              placeholder="uuid de l'utilisateur"
              style={inp}
            />
            <div style={{ fontSize: "0.7rem", color: "#aaa", marginTop: "0.2rem" }}>
              Trouvable dans Supabase → Authentication → Users
            </div>
          </div>
          <div>
            <div style={{ fontSize: "0.75rem", color: "#666", marginBottom: "0.2rem" }}>Rôle</div>
            <select value={selRole} onChange={e => setSelRole(e.target.value as "admin"|"manager"|"consultant")} style={inp}>
              <option value="admin">👑 Admin (voit et modifie tout)</option>
              <option value="manager">🧑‍💼 Manager (voit plusieurs consultants)</option>
              <option value="consultant">👤 Consultant (voit son propre profil)</option>
            </select>
          </div>
        </div>

        {selRole !== "admin" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem", marginBottom: "0.6rem" }}>
            <div>
              <div style={{ fontSize: "0.75rem", color: "#666", marginBottom: "0.2rem" }}>Consultant associé</div>
              <select value={selSultant} onChange={e => setSelSultant(e.target.value)} style={inp}>
                <option value="">-- Choisir --</option>
                {sultants.map(s => <option key={s.id} value={s.id}>{s.Nom} {s.Prénom}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", paddingTop: "1.4rem" }}>
              <input type="checkbox" id="can_edit" checked={selEdit} onChange={e => setSelEdit(e.target.checked)} style={{ width: 16, height: 16 }} />
              <label htmlFor="can_edit" style={{ fontSize: "0.88rem", cursor: "pointer" }}>Peut modifier les affectations</label>
            </div>
          </div>
        )}

        <button onClick={add} disabled={saving} style={btnStyle("#27ae60")}>
          {saving ? "..." : "➕ Ajouter"}
        </button>
        {msg && <div style={{ marginTop: "0.6rem", fontSize: "0.83rem", color: msg.startsWith("✅") ? "#27ae60" : "#e74c3c" }}>{msg}</div>}
      </div>

      {/* Tableau des droits */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.83rem" }}>
        <thead>
          <tr style={{ background: NAVY, color: "white" }}>
            <th style={th}>User ID</th>
            <th style={th}>Consultant</th>
            <th style={th}>Rôle</th>
            <th style={th}>Modif.</th>
            <th style={th}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {accesses.length === 0 && (
            <tr><td colSpan={5} style={{ textAlign: "center", padding: "1rem", color: "#aaa" }}>Aucun droit configuré.</td></tr>
          )}
          {accesses.map((row, i) => (
            <tr key={row.id} style={{ background: i % 2 === 0 ? "#f9f9f9" : "white" }}>
              <td style={td}><code style={{ fontSize: "0.75rem", color: "#555" }}>{row.user_id.slice(0, 12)}…</code></td>
              <td style={td}>{sultantLabel(row.sultant_id)}</td>
              <td style={td}>
                <span style={{ background: row.role === "admin" ? "#f39c12" : row.role === "manager" ? "#3498db" : "#95a5a6", color: "white", padding: "0.15rem 0.5rem", borderRadius: 10, fontSize: "0.75rem", fontWeight: "bold" }}>
                  {ROLE_LABELS[row.role]}
                </span>
              </td>
              <td style={{ ...td, textAlign: "center" }}>
                <input type="checkbox" checked={row.can_edit} onChange={() => toggleEdit(row)} disabled={row.role === "admin"} />
              </td>
              <td style={td}>
                <button onClick={() => remove(row.id)} style={{ padding: "0.2rem 0.5rem", background: "#e74c3c", color: "white", border: "none", borderRadius: 3, cursor: "pointer", fontSize: "0.78rem" }}>🗑</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const th: React.CSSProperties = { padding: "0.5rem 0.8rem", textAlign: "left" };
const td: React.CSSProperties = { padding: "0.4rem 0.8rem", borderBottom: "1px solid #eee" };
