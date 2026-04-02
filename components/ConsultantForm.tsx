"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Sultant = { id: string; Nom: string; Prénom: string };

export default function ConsultantForm() {
  const [consultants, setConsultants] = useState<Sultant[]>([]);
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [editId, setEditId] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase.from("Sultant").select("*").order("Nom");
    setConsultants(data || []);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!nom.trim() || !prenom.trim()) { setMsg("⚠️ Nom et prénom requis."); return; }
    setSaving(true); setMsg("");
    if (editId) {
      const { error } = await supabase.from("Sultant").update({ Nom: nom.trim(), Prénom: prenom.trim() }).eq("id", editId);
      if (error) { setMsg(`❌ ${error.message}`); } else { setMsg("✅ Consultant modifié."); setEditId(null); setNom(""); setPrenom(""); load(); }
    } else {
      const { error } = await supabase.from("Sultant").insert({ Nom: nom.trim(), Prénom: prenom.trim() });
      if (error) { setMsg(`❌ ${error.message}`); } else { setMsg("✅ Consultant ajouté."); setNom(""); setPrenom(""); load(); }
    }
    setSaving(false);
  };

  const startEdit = (c: Sultant) => { setEditId(c.id); setNom(c.Nom); setPrenom(c.Prénom); setMsg(""); };
  const cancelEdit = () => { setEditId(null); setNom(""); setPrenom(""); setMsg(""); };

  const remove = async (id: string) => {
    if (!confirm("Supprimer ce consultant ?")) return;
    const { error } = await supabase.from("Sultant").delete().eq("id", id);
    if (error) { setMsg(`❌ ${error.message}`); } else { setMsg("✅ Supprimé."); load(); }
  };

  return (
    <div>
      <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>👤 {editId ? "Modifier" : "Ajouter"} un consultant</h2>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
        <input value={nom} onChange={e => setNom(e.target.value)} placeholder="Nom" style={inputStyle} />
        <input value={prenom} onChange={e => setPrenom(e.target.value)} placeholder="Prénom" style={inputStyle} />
        <button onClick={save} disabled={saving} style={btnStyle("#27ae60")}>{saving ? "..." : editId ? "💾 Modifier" : "➕ Ajouter"}</button>
        {editId && <button onClick={cancelEdit} style={btnStyle("#95a5a6")}>Annuler</button>}
      </div>
      {msg && <div style={{ marginBottom: "0.75rem", fontSize: "0.85rem", color: msg.startsWith("✅") ? "#27ae60" : "#e74c3c" }}>{msg}</div>}

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
        <thead>
          <tr style={{ background: "#2c3e50", color: "white" }}>
            <th style={th}>Nom</th><th style={th}>Prénom</th><th style={th}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {consultants.map((c, i) => (
            <tr key={c.id} style={{ background: i % 2 === 0 ? "#f9f9f9" : "white" }}>
              <td style={td}>{c.Nom}</td>
              <td style={td}>{c.Prénom}</td>
              <td style={td}>
                <button onClick={() => startEdit(c)} style={{ ...btnSmall, background: "#3498db" }}>✏️</button>
                <button onClick={() => remove(c.id)} style={{ ...btnSmall, background: "#e74c3c", marginLeft: 4 }}>🗑</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const inputStyle: React.CSSProperties = { padding: "0.4rem 0.7rem", border: "1px solid #ccc", borderRadius: 4, fontSize: "0.9rem", minWidth: 120 };
const btnStyle = (bg: string): React.CSSProperties => ({ padding: "0.4rem 0.9rem", background: bg, color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontWeight: "bold" });
const btnSmall: React.CSSProperties = { padding: "0.2rem 0.5rem", color: "white", border: "none", borderRadius: 3, cursor: "pointer", fontSize: "0.8rem" };
const th: React.CSSProperties = { padding: "0.5rem 0.8rem", textAlign: "left" };
const td: React.CSSProperties = { padding: "0.4rem 0.8rem", borderBottom: "1px solid #eee" };
