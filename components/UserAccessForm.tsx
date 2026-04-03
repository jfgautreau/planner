"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";

type Sultant = { id: string; Nom: string; Prénom: string };
type AppUser = { user_id: string; email: string; role: RoleType };
type AccessRow = {
  id: string;
  user_id: string;
  sultant_id: string;
  role: RoleType;
  can_read: boolean;
  can_write: boolean;
};
type RoleType = "admin" | "chef_mission" | "consultant" | "consultation";

const NAVY = "#1a2744";
const ROLES: { value: RoleType; label: string; color: string }[] = [
  { value: "admin",        label: "👑 Admin",           color: "#e67e22" },
  { value: "chef_mission", label: "🧑‍💼 Chef de mission",  color: "#3498db" },
  { value: "consultant",   label: "👤 Consultant",       color: "#7f8c8d" },
  { value: "consultation", label: "👁 Consultation",     color: "#8e44ad" },
];
const roleLabel = (r: RoleType) => ROLES.find(x => x.value === r)?.label ?? r;
const roleColor = (r: RoleType) => ROLES.find(x => x.value === r)?.color ?? "#999";

export default function UserAccessForm() {
  const [sultants, setSultants] = useState<Sultant[]>([]);
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);
  const [accesses, setAccesses] = useState<AccessRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [msg, setMsg]           = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: s }, { data: u }, { data: a }] = await Promise.all([
      supabase.from("Sultant").select("id,Nom,Prénom").order("Nom"),
      supabase.from("AppUser").select("user_id,email,role").order("email"),
      supabase.from("UserAccess").select("id,user_id,sultant_id,role,can_read,can_write"),
    ]);
    setSultants((s as unknown as Sultant[]) || []);
    setAppUsers((u || []) as AppUser[]);
    setAccesses((a || []) as AccessRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Lookup O(1)
  const accessMap = useMemo(() => {
    const m = new Map<string, AccessRow>();
    accesses.forEach(a => m.set(`${a.user_id}::${a.sultant_id}`, a));
    return m;
  }, [accesses]);

  const getAccess = (userId: string, sultantId: string) =>
    accessMap.get(`${userId}::${sultantId}`);

  // Changer le rôle d'un utilisateur
  const changeRole = useCallback(async (userId: string, newRole: RoleType) => {
    await supabase.from("AppUser").update({ role: newRole }).eq("user_id", userId);

    if (newRole === "admin") {
      // Admin : donner accès total à tous les consultants
      const existing = accesses.filter(a => a.user_id === userId);
      const existingIds = new Set(existing.map(a => a.sultant_id));
      const toInsert = sultants
        .filter(s => !existingIds.has(s.id))
        .map(s => ({ user_id: userId, sultant_id: s.id, role: "admin", can_read: true, can_write: true }));
      // Mettre à jour les existants
      if (existing.length > 0)
        await supabase.from("UserAccess").update({ role: "admin", can_read: true, can_write: true }).eq("user_id", userId);
      if (toInsert.length > 0)
        await supabase.from("UserAccess").insert(toInsert);
    } else if (newRole === "consultant") {
      // Consultant : lecture+écriture sur son propre profil uniquement → on garde l'existant, juste changer le rôle
      await supabase.from("UserAccess").update({ role: newRole }).eq("user_id", userId);
    } else if (newRole === "consultation") {
      // Consultation : lecture seule partout → mettre can_write à false
      await supabase.from("UserAccess").update({ role: newRole, can_write: false }).eq("user_id", userId);
    } else {
      await supabase.from("UserAccess").update({ role: newRole }).eq("user_id", userId);
    }
    load();
  }, [accesses, sultants, load]);

  // Toggle lecture/écriture
  const toggle = useCallback(async (
    userId: string, sultantId: string,
    field: "can_read" | "can_write", value: boolean,
    userRole: RoleType
  ) => {
    if (userRole === "admin" || userRole === "consultant") return;
    if (userRole === "consultation" && field === "can_write") return; // lecture seule forcée

    const existing = accessMap.get(`${userId}::${sultantId}`);
    const updates: Record<string, boolean | string> = { [field]: value };
    if (field === "can_write" && value)  updates.can_read = true;
    if (field === "can_read"  && !value) updates.can_write = false;

    if (existing) {
      await supabase.from("UserAccess").update(updates).eq("id", existing.id);
    } else {
      await supabase.from("UserAccess").insert({
        user_id: userId, sultant_id: sultantId, role: userRole,
        can_read: updates.can_read as boolean ?? true,
        can_write: updates.can_write as boolean ?? false,
      });
    }
    load();
  }, [accessMap, load]);

  // Supprimer tous les droits d'un utilisateur
  const removeUser = useCallback(async (userId: string) => {
    if (!confirm("Réinitialiser tous les droits de cet utilisateur ?")) return;
    await supabase.from("UserAccess").delete().eq("user_id", userId);
    await supabase.from("AppUser").update({ role: "consultation" }).eq("user_id", userId);
    load();
  }, [load]);

  if (loading) return <div style={{ padding: "1rem", color: "#888" }}>Chargement...</div>;

  return (
    <div>
      <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>🔐 Gestion des accès</h2>

      {/* Légende des rôles */}
      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginBottom: "1.2rem" }}>
        {ROLES.map(r => (
          <span key={r.value} style={{ background: r.color, color: "white", padding: "0.2rem 0.7rem", borderRadius: 10, fontSize: "0.72rem", fontWeight: "bold" }}>
            {r.label}
          </span>
        ))}
        <span style={{ fontSize: "0.72rem", color: "#888", alignSelf: "center", marginLeft: "0.4rem" }}>
          · 👁 = lecture seule · ✏️ = lecture + écriture · cases grisées = verrouillées
        </span>
      </div>

      {appUsers.length === 0 ? (
        <div style={{ textAlign: "center", color: "#aaa", padding: "2rem", border: "1px dashed #ddd", borderRadius: 8 }}>
          Aucun utilisateur trouvé. Les utilisateurs apparaissent automatiquement à la création de leur compte.
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", fontSize: "0.8rem", width: "100%" }}>
            <thead>
              <tr>
                {/* Colonne utilisateur */}
                <th style={{ ...thS, textAlign: "left", minWidth: 200, background: NAVY, color: "white", position: "sticky", left: 0, zIndex: 2 }}>
                  Utilisateur
                </th>
                <th style={{ ...thS, textAlign: "left", minWidth: 160, background: NAVY, color: "white" }}>
                  Rôle
                </th>
                {/* Une paire de colonnes par consultant */}
                {sultants.map(s => (
                  <th key={s.id} colSpan={2} style={{ ...thS, background: "#34495e", color: "white", minWidth: 90, borderLeft: "2px solid rgba(255,255,255,0.2)" }}>
                    <div style={{ fontSize: "0.72rem", fontWeight: 600 }}>{s.Nom}</div>
                    <div style={{ fontSize: "0.62rem", opacity: 0.75, fontWeight: "normal" }}>{s.Prénom}</div>
                  </th>
                ))}
                <th style={{ ...thS, background: NAVY, width: 60 }} />
              </tr>
              {/* Sous-entêtes L / E */}
              <tr style={{ background: "#f0f4f8" }}>
                <th style={{ ...thS, background: "#f0f4f8", position: "sticky", left: 0, zIndex: 2 }} />
                <th style={{ ...thS, background: "#f0f4f8" }} />
                {sultants.map(s => (
                  <React.Fragment key={s.id}>
                    <th style={{ ...thS, fontSize: "0.65rem", color: "#3498db", width: 44, borderLeft: "2px solid #e0e0e0" }}>👁</th>
                    <th style={{ ...thS, fontSize: "0.65rem", color: "#27ae60", width: 44 }}>✏️</th>
                  </React.Fragment>
                ))}
                <th style={{ background: "#f0f4f8" }} />
              </tr>
            </thead>
            <tbody>
              {appUsers.map((u, ui) => {
                const isAdmin    = u.role === "admin";
                const isConsultant = u.role === "consultant";
                const isConsultation = u.role === "consultation";
                // Verrouillé = admin (tout auto) ou consultant (son profil géré ailleurs)
                const locked = isAdmin || isConsultant;

                return (
                  <tr key={u.user_id} style={{ background: ui % 2 === 0 ? "white" : "#fafafa" }}>
                    {/* Email */}
                    <td style={{ ...tdS, fontWeight: 500, position: "sticky", left: 0, background: ui % 2 === 0 ? "white" : "#fafafa", zIndex: 1, borderRight: "1px solid #e0e0e0" }}>
                      <div style={{ fontSize: "0.78rem" }}>{u.email || `${u.user_id.slice(0, 12)}…`}</div>
                    </td>
                    {/* Sélecteur de rôle */}
                    <td style={{ ...tdS }}>
                      <select
                        value={u.role}
                        onChange={e => changeRole(u.user_id, e.target.value as RoleType)}
                        style={{ padding: "0.25rem 0.4rem", border: `2px solid ${roleColor(u.role)}`, borderRadius: 4, fontSize: "0.75rem", background: "white", color: roleColor(u.role), fontWeight: "bold", cursor: "pointer", width: "100%" }}
                      >
                        {ROLES.map(r => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    </td>
                    {/* Cases par consultant */}
                    {sultants.map(s => {
                      const row = getAccess(u.user_id, s.id);
                      const canRead  = isAdmin ? true  : (row?.can_read  ?? false);
                      const canWrite = isAdmin ? true  : (isConsultation ? false : (row?.can_write ?? false));
                      const readLocked  = locked;
                      const writeLocked = locked || isConsultation;

                      return (
                        <React.Fragment key={s.id}>
                          <td style={{ ...tdCenter, borderLeft: "2px solid #e0e0e0" }}>
                            <input
                              type="checkbox"
                              checked={canRead}
                              disabled={readLocked}
                              onChange={e => toggle(u.user_id, s.id, "can_read", e.target.checked, u.role)}
                              style={{ width: 14, height: 14, cursor: readLocked ? "default" : "pointer", accentColor: "#3498db" }}
                            />
                          </td>
                          <td style={{ ...tdCenter }}>
                            <input
                              type="checkbox"
                              checked={canWrite}
                              disabled={writeLocked}
                              onChange={e => toggle(u.user_id, s.id, "can_write", e.target.checked, u.role)}
                              style={{ width: 14, height: 14, cursor: writeLocked ? "default" : "pointer", accentColor: "#27ae60" }}
                            />
                          </td>
                        </React.Fragment>
                      );
                    })}
                    {/* Bouton reset */}
                    <td style={{ ...tdCenter }}>
                      <button
                        onClick={() => removeUser(u.user_id)}
                        title="Réinitialiser les droits"
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#e74c3c", fontSize: "0.85rem" }}
                      >🗑</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {msg && (
        <div style={{ marginTop: "0.8rem", fontSize: "0.82rem", color: msg.startsWith("✅") ? "#27ae60" : "#e74c3c" }}>
          {msg}
        </div>
      )}
    </div>
  );
}

const thS: React.CSSProperties = {
  padding: "0.45rem 0.5rem", textAlign: "center",
  border: "1px solid #e0e0e0", fontWeight: 600,
};
const tdS: React.CSSProperties = {
  padding: "0.4rem 0.6rem", borderBottom: "1px solid #eee",
};
const tdCenter: React.CSSProperties = {
  padding: "0.3rem", textAlign: "center", borderBottom: "1px solid #eee",
};
