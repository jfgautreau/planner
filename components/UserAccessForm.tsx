"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";

type Sultant = { id: string; Nom: string; Prénom: string };
type Mission = { id: string; Code: string; Client: string; Color: string; TextColor: string };
type AppUser = { user_id: string; email: string; role: RoleType };
type AccessRow = {
  id: string; user_id: string; sultant_id: string;
  role: RoleType; can_read: boolean; can_write: boolean;
};
type MissionAccessRow = {
  id: string; sultant_id: string; mission_id: string; can_see: boolean;
};
type RoleType = "admin" | "chef_mission" | "consultant" | "consultation";

const NAVY = "#1a2744";
const ROLES: { value: RoleType; label: string; color: string }[] = [
  { value: "admin",        label: "👑 Admin",           color: "#e67e22" },
  { value: "chef_mission", label: "🧑‍💼 Chef de mission",  color: "#3498db" },
  { value: "consultant",   label: "👤 Consultant",       color: "#7f8c8d" },
  { value: "consultation", label: "👁 Consultation",     color: "#8e44ad" },
];
const roleColor = (r: RoleType) => ROLES.find(x => x.value === r)?.color ?? "#999";

export default function UserAccessForm() {
  const [sultants, setSultants]           = useState<Sultant[]>([]);
  const [missions, setMissions]           = useState<Mission[]>([]);
  const [appUsers, setAppUsers]           = useState<AppUser[]>([]);
  const [accesses, setAccesses]           = useState<AccessRow[]>([]);
  const [missionAccesses, setMissionAccesses] = useState<MissionAccessRow[]>([]);
  const [loading, setLoading]             = useState(true);
  const [activeTab, setActiveTab]         = useState<"users"|"missions">("users");
  const [msg, setMsg]                     = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: s }, { data: m }, { data: u }, { data: a }, { data: ma }] = await Promise.all([
      supabase.from("Sultant").select("id,Nom,Prénom").order("Nom"),
      supabase.from("Mission").select("id,Code,Client,Color,TextColor").order("Client"),
      supabase.from("AppUser").select("user_id,email,role").order("email"),
      supabase.from("UserAccess").select("id,user_id,sultant_id,role,can_read,can_write"),
      supabase.from("MissionAccess").select("id,sultant_id,mission_id,can_see"),
    ]);
    setSultants((s as unknown as Sultant[]) || []);
    setMissions((m || []) as Mission[]);
    setAppUsers((u || []) as AppUser[]);
    setAccesses((a || []) as AccessRow[]);
    setMissionAccesses((ma || []) as MissionAccessRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Lookup O(1) accès utilisateurs ──
  const accessMap = useMemo(() => {
    const map = new Map<string, AccessRow>();
    accesses.forEach(a => map.set(`${a.user_id}::${a.sultant_id}`, a));
    return map;
  }, [accesses]);

  // ── Lookup O(1) accès missions ──
  const missionAccessMap = useMemo(() => {
    const map = new Map<string, MissionAccessRow>();
    missionAccesses.forEach(a => map.set(`${a.sultant_id}::${a.mission_id}`, a));
    return map;
  }, [missionAccesses]);

  // ── Changer le rôle ──
  const changeRole = useCallback(async (userId: string, newRole: RoleType) => {
    await supabase.from("AppUser").update({ role: newRole }).eq("user_id", userId);
    if (newRole === "admin") {
      const existing = accesses.filter(a => a.user_id === userId);
      const existingIds = new Set(existing.map(a => a.sultant_id));
      const toInsert = sultants
        .filter(s => !existingIds.has(s.id))
        .map(s => ({ user_id: userId, sultant_id: s.id, role: "admin", can_read: true, can_write: true }));
      if (existing.length > 0)
        await supabase.from("UserAccess").update({ role: "admin", can_read: true, can_write: true }).eq("user_id", userId);
      if (toInsert.length > 0)
        await supabase.from("UserAccess").insert(toInsert);
    } else if (newRole === "consultation") {
      await supabase.from("UserAccess").update({ role: newRole, can_write: false }).eq("user_id", userId);
    } else {
      await supabase.from("UserAccess").update({ role: newRole }).eq("user_id", userId);
    }
    load();
  }, [accesses, sultants, load]);

  // ── Toggle accès utilisateur/consultant ──
  const toggle = useCallback(async (
    userId: string, sultantId: string,
    field: "can_read"|"can_write", value: boolean, userRole: RoleType
  ) => {
    if (userRole === "admin" || userRole === "consultant") return;
    if (userRole === "consultation" && field === "can_write") return;
    const existing = accessMap.get(`${userId}::${sultantId}`);
    const updates: Record<string, boolean|string> = { [field]: value };
    if (field === "can_write" && value)  updates.can_read = true;
    if (field === "can_read"  && !value) updates.can_write = false;
    if (existing) {
      await supabase.from("UserAccess").update(updates).eq("id", existing.id);
    } else {
      await supabase.from("UserAccess").insert({
        user_id: userId, sultant_id: sultantId, role: userRole,
        can_read: updates.can_read ?? true, can_write: updates.can_write ?? false,
      });
    }
    load();
  }, [accessMap, load]);

  // ── Toggle accès consultant/mission ──
  const toggleMission = useCallback(async (sultantId: string, missionId: string, value: boolean) => {
    const existing = missionAccessMap.get(`${sultantId}::${missionId}`);
    if (existing) {
      await supabase.from("MissionAccess").update({ can_see: value }).eq("id", existing.id);
    } else {
      await supabase.from("MissionAccess").insert({ sultant_id: sultantId, mission_id: missionId, can_see: value });
    }
    load();
  }, [missionAccessMap, load]);

  // ── Tout cocher/décocher pour un consultant ──
  const toggleAllMissions = useCallback(async (sultantId: string, value: boolean) => {
    const existing = missionAccesses.filter(a => a.sultant_id === sultantId);
    const existingIds = new Set(existing.map(a => a.mission_id));
    const toInsert = missions
      .filter(m => !existingIds.has(m.id))
      .map(m => ({ sultant_id: sultantId, mission_id: m.id, can_see: value }));
    if (existing.length > 0)
      await supabase.from("MissionAccess").update({ can_see: value }).eq("sultant_id", sultantId);
    if (toInsert.length > 0)
      await supabase.from("MissionAccess").insert(toInsert);
    load();
  }, [missionAccesses, missions, load]);

  const removeUser = useCallback(async (userId: string) => {
    if (!confirm("Réinitialiser tous les droits de cet utilisateur ?")) return;
    await supabase.from("UserAccess").delete().eq("user_id", userId);
    await supabase.from("AppUser").update({ role: "consultation" }).eq("user_id", userId);
    load();
  }, [load]);

  if (loading) return <div style={{ padding: "1rem", color: "#888" }}>Chargement...</div>;

  const tabBtn = (t: "users"|"missions") => ({
    padding: "0.5rem 1.2rem", border: "none", cursor: "pointer", fontSize: "0.88rem",
    borderBottom: activeTab === t ? `3px solid ${NAVY}` : "3px solid transparent",
    marginBottom: -2, background: "none",
    fontWeight: activeTab === t ? "bold" : "normal",
    color: activeTab === t ? NAVY : "#888",
  } as React.CSSProperties);

  return (
    <div>
      <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>🔐 Gestion des accès</h2>

      {/* Légende */}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1.2rem" }}>
        {ROLES.map(r => (
          <span key={r.value} style={{ background: r.color, color: "white", padding: "0.18rem 0.6rem", borderRadius: 10, fontSize: "0.72rem", fontWeight: "bold" }}>
            {r.label}
          </span>
        ))}
        <span style={{ fontSize: "0.72rem", color: "#888", alignSelf: "center" }}>
          · 👁 lecture · ✏️ écriture · cases grisées = verrouillées
        </span>
      </div>

      {/* Onglets */}
      <div style={{ display: "flex", borderBottom: "2px solid #e0e0e0", marginBottom: "1.4rem" }}>
        <button style={tabBtn("users")} onClick={() => setActiveTab("users")}>👥 Utilisateurs → Consultants</button>
        <button style={tabBtn("missions")} onClick={() => setActiveTab("missions")}>📋 Consultants → Missions</button>
      </div>

      {msg && <div style={{ marginBottom: "0.8rem", fontSize: "0.82rem", color: msg.startsWith("✅") ? "#27ae60" : "#e74c3c" }}>{msg}</div>}

      {/* ══ TABLEAU 1 : Utilisateurs × Consultants ══ */}
      {activeTab === "users" && (
        appUsers.length === 0 ? (
          <div style={{ textAlign: "center", color: "#aaa", padding: "2rem", border: "1px dashed #ddd", borderRadius: 8 }}>
            Aucun utilisateur. Ils apparaissent automatiquement à la création de leur compte.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", fontSize: "0.8rem", width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ ...thS, textAlign: "left", minWidth: 180, background: NAVY, color: "white", position: "sticky", left: 0, zIndex: 2 }}>Utilisateur</th>
                  <th style={{ ...thS, minWidth: 150, background: NAVY, color: "white" }}>Rôle</th>
                  {sultants.map(s => (
                    <th key={s.id} colSpan={2} style={{ ...thS, background: "#34495e", color: "white", minWidth: 90, borderLeft: "2px solid rgba(255,255,255,0.2)" }}>
                      <div style={{ fontSize: "0.7rem", fontWeight: 600 }}>{s.Nom}</div>
                      <div style={{ fontSize: "0.6rem", opacity: 0.75, fontWeight: "normal" }}>{s.Prénom}</div>
                    </th>
                  ))}
                  <th style={{ ...thS, background: NAVY, width: 50 }} />
                </tr>
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
                  const isAdmin = u.role === "admin";
                  const isConsultant = u.role === "consultant";
                  const isConsultation = u.role === "consultation";
                  const locked = isAdmin || isConsultant;
                  return (
                    <tr key={u.user_id} style={{ background: ui % 2 === 0 ? "white" : "#fafafa" }}>
                      <td style={{ ...tdS, fontWeight: 500, position: "sticky", left: 0, background: ui % 2 === 0 ? "white" : "#fafafa", zIndex: 1, borderRight: "1px solid #e0e0e0" }}>
                        <div style={{ fontSize: "0.78rem" }}>{u.email || `${u.user_id.slice(0, 12)}…`}</div>
                      </td>
                      <td style={{ ...tdS }}>
                        <select
                          value={u.role}
                          onChange={e => changeRole(u.user_id, e.target.value as RoleType)}
                          style={{ padding: "0.25rem 0.4rem", border: `2px solid ${roleColor(u.role)}`, borderRadius: 4, fontSize: "0.75rem", background: "white", color: roleColor(u.role), fontWeight: "bold", cursor: "pointer", width: "100%" }}
                        >
                          {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                      </td>
                      {sultants.map(s => {
                        const row = accessMap.get(`${u.user_id}::${s.id}`);
                        const canRead  = isAdmin ? true  : (row?.can_read  ?? false);
                        const canWrite = isAdmin ? true  : (isConsultation ? false : (row?.can_write ?? false));
                        return (
                          <React.Fragment key={s.id}>
                            <td style={{ ...tdCenter, borderLeft: "2px solid #e0e0e0" }}>
                              <input type="checkbox" checked={canRead} disabled={locked}
                                onChange={e => toggle(u.user_id, s.id, "can_read", e.target.checked, u.role)}
                                style={{ width: 14, height: 14, cursor: locked ? "default" : "pointer", accentColor: "#3498db" }} />
                            </td>
                            <td style={{ ...tdCenter }}>
                              <input type="checkbox" checked={canWrite} disabled={locked || isConsultation}
                                onChange={e => toggle(u.user_id, s.id, "can_write", e.target.checked, u.role)}
                                style={{ width: 14, height: 14, cursor: (locked || isConsultation) ? "default" : "pointer", accentColor: "#27ae60" }} />
                            </td>
                          </React.Fragment>
                        );
                      })}
                      <td style={{ ...tdCenter }}>
                        <button onClick={() => removeUser(u.user_id)} title="Réinitialiser" style={{ background: "none", border: "none", cursor: "pointer", color: "#e74c3c", fontSize: "0.85rem" }}>🗑</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ══ TABLEAU 2 : Consultants × Missions ══ */}
      {activeTab === "missions" && (
        <div style={{ overflowX: "auto" }}>
          <p style={{ fontSize: "0.8rem", color: "#666", marginBottom: "1rem" }}>
            Définit quelles missions chaque consultant peut voir dans les dashboards et la vue client.
          </p>
          <table style={{ borderCollapse: "collapse", fontSize: "0.8rem", width: "100%" }}>
            <thead>
              <tr>
                <th style={{ ...thS, textAlign: "left", minWidth: 160, background: NAVY, color: "white", position: "sticky", left: 0, zIndex: 2 }}>
                  Consultant
                </th>
                <th style={{ ...thS, background: NAVY, color: "white", width: 80 }}>Tout</th>
                {missions.map(m => (
                  <th key={m.id} style={{ ...thS, background: "#34495e", color: "white", minWidth: 60, borderLeft: "1px solid rgba(255,255,255,0.15)" }}>
                    <span style={{ background: m.Color, color: m.TextColor || "#fff", padding: "0.1rem 0.4rem", borderRadius: 3, fontSize: "0.65rem", fontWeight: "bold", display: "block" }}>
                      {m.Code}
                    </span>
                    <div style={{ fontSize: "0.58rem", opacity: 0.7, marginTop: 2, fontWeight: "normal" }}>{m.Client}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sultants.map((s, si) => {
                const allChecked = missions.every(m => missionAccessMap.get(`${s.id}::${m.id}`)?.can_see ?? false);
                return (
                  <tr key={s.id} style={{ background: si % 2 === 0 ? "white" : "#fafafa" }}>
                    <td style={{ ...tdS, fontWeight: 500, position: "sticky", left: 0, background: si % 2 === 0 ? "white" : "#fafafa", zIndex: 1, borderRight: "1px solid #e0e0e0" }}>
                      {s.Nom} {s.Prénom}
                    </td>
                    {/* Case "Tout" */}
                    <td style={{ ...tdCenter }}>
                      <input type="checkbox" checked={allChecked}
                        onChange={e => toggleAllMissions(s.id, e.target.checked)}
                        style={{ width: 14, height: 14, cursor: "pointer", accentColor: NAVY }} />
                    </td>
                    {missions.map(m => {
                      const row = missionAccessMap.get(`${s.id}::${m.id}`);
                      const canSee = row?.can_see ?? false;
                      return (
                        <td key={m.id} style={{ ...tdCenter, borderLeft: "1px solid #eee" }}>
                          <input type="checkbox" checked={canSee}
                            onChange={e => toggleMission(s.id, m.id, e.target.checked)}
                            style={{ width: 14, height: 14, cursor: "pointer", accentColor: m.Color || "#3498db" }} />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const thS: React.CSSProperties = { padding: "0.45rem 0.5rem", textAlign: "center", border: "1px solid #e0e0e0", fontWeight: 600 };
const tdS: React.CSSProperties = { padding: "0.4rem 0.6rem", borderBottom: "1px solid #eee" };
const tdCenter: React.CSSProperties = { padding: "0.3rem", textAlign: "center", borderBottom: "1px solid #eee" };
