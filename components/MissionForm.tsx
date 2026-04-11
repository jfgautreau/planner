"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Mission = { id: string; Client: string; Mission: string; Code: string; Color: string; TextColor: string; Adresse: string; km: number };

const PRESET_COLORS = [
  "#fca5a5", // red
  "#fb7185", // rose (plus distinct que rose-300)
  "#f472b6", // pink
  "#a78bfa", // violet
  "#818cf8", // indigo
  "#60a5fa", // blue
  "#38bdf8", // sky
  "#22d3ee", // cyan
  "#2dd4bf", // teal
  "#4ade80", // green
  "#facc15"  // yellow
];

export default function MissionForm() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [client, setClient]     = useState("");
  const [mission, setMission]   = useState("");
  const [code, setCode]         = useState("");
  const [color, setColor]       = useState(PRESET_COLORS[0]);
  const [textColor, setTextColor] = useState<"#ffffff"|"#000000">("#ffffff");
  const [adresse, setAdresse]   = useState("");
  const [km, setKm]             = useState<number>(0);
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState("");
  const [editId, setEditId]     = useState<string|null>(null);

  const load = async () => { const { data } = await supabase.from("Mission").select("*").order("Client"); setMissions(data||[]); };
  useEffect(()=>{ load(); },[]);

  const save = async () => {
    if (!client.trim()||!mission.trim()||!code.trim()) { setMsg("⚠️ Tous les champs sont requis."); return; }
    setSaving(true); setMsg("");
    const payload = { Client:client.trim(), Mission:mission.trim(), Code:code.trim().toUpperCase(), Color:color, TextColor:textColor, Adresse:adresse.trim(), km:km||0 };
    if (editId) {
      const { error } = await supabase.from("Mission").update(payload).eq("id",editId);
      if (error) { setMsg(`❌ ${error.message}`); } else { setMsg("✅ Modifiée."); reset(); load(); }
    } else {
      const { error } = await supabase.from("Mission").insert(payload);
      if (error) { setMsg(`❌ ${error.message}`); } else { setMsg("✅ Ajoutée."); reset(); load(); }
    }
    setSaving(false);
  };
  const reset = () => { setEditId(null); setClient(""); setMission(""); setCode(""); setColor(PRESET_COLORS[0]); setTextColor("#ffffff"); setAdresse(""); setKm(0); };
  const startEdit = (m: Mission) => { setEditId(m.id); setClient(m.Client); setMission(m.Mission); setCode(m.Code); setColor(m.Color); setTextColor((m.TextColor||"#ffffff") as "#ffffff"|"#000000"); setAdresse(m.Adresse||''); setKm(m.km||0); setMsg(""); };
  const remove = async (id: string) => {
    if (!confirm("Supprimer ?")) return;
    const { error } = await supabase.from("Mission").delete().eq("id",id);
    if (error) { setMsg(`❌ ${error.message}`); } else { setMsg("✅ Supprimée."); load(); }
  };

  return (
    <div>
      <h2 style={{ marginTop:0, fontSize:"1.1rem" }}>📋 {editId?"Modifier":"Ajouter"} une mission</h2>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 90px", gap:"0.5rem", marginBottom:"0.6rem" }}>
        <input value={client} onChange={e=>setClient(e.target.value)} placeholder="Client" style={inp} />
        <input value={mission} onChange={e=>setMission(e.target.value)} placeholder="Nom mission" style={inp} />
        <input value={code} onChange={e=>setCode(e.target.value)} placeholder="Code" style={inp} maxLength={6} />
      </div>

      {/* Adresse et km */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 120px", gap:"0.5rem", marginBottom:"0.6rem" }}>
        <div>
          <div style={{ fontSize:"0.78rem", color:"#666", marginBottom:"0.2rem" }}>Adresse du client</div>
          <input value={adresse} onChange={e=>setAdresse(e.target.value)} placeholder="Adresse complète..." style={inp} />
        </div>
        <div>
          <div style={{ fontSize:"0.78rem", color:"#666", marginBottom:"0.2rem" }}>Km aller-retour</div>
          <input type="number" min={0} value={km} onChange={e=>setKm(parseInt(e.target.value)||0)} style={inp} />
        </div>
      </div>

      {/* Couleur fond */}
      <div style={{ marginBottom:"0.6rem" }}>
        <div style={{ fontSize:"0.8rem", color:"#666", marginBottom:"0.25rem" }}>Couleur de fond :</div>
        <div style={{ display:"flex", gap:"0.35rem", flexWrap:"wrap", alignItems:"center" }}>
          {PRESET_COLORS.map(c=>(
            <div key={c} onClick={()=>setColor(c)} style={{ width:26, height:26, borderRadius:4, backgroundColor:c, cursor:"pointer", border:color===c?"3px solid #2c3e50":"2px solid transparent" }} />
          ))}
          <input type="color" value={color} onChange={e=>setColor(e.target.value)} style={{ width:30, height:26, border:"none", cursor:"pointer", borderRadius:4 }} />
        </div>
      </div>

      {/* Couleur texte */}
      <div style={{ marginBottom:"0.8rem" }}>
        <div style={{ fontSize:"0.8rem", color:"#666", marginBottom:"0.25rem" }}>Couleur du texte :</div>
        <div style={{ display:"flex", gap:"0.5rem", alignItems:"center" }}>
          {([["#ffffff","Blanc"],["#000000","Noir"]] as const).map(([v,l])=>(
            <button key={v} onClick={()=>setTextColor(v)} style={{ padding:"0.3rem 0.8rem", border:`2px solid ${textColor===v?"#2c3e50":"#ccc"}`, borderRadius:4, background:v, color:v==="#ffffff"?"#333":"#fff", fontWeight:"bold", cursor:"pointer", fontSize:"0.8rem" }}>
              {l}
            </button>
          ))}
          {/* Aperçu */}
          <span style={{ background:color, color:textColor, padding:"0.25rem 0.7rem", borderRadius:4, fontWeight:"bold", fontSize:"0.85rem", marginLeft:"0.5rem" }}>
            {code||"CODE"}
          </span>
        </div>
      </div>

      <div style={{ display:"flex", gap:"0.5rem", marginBottom:"0.75rem" }}>
        <button onClick={save} disabled={saving} style={btn("#27ae60")}>{saving?"...":editId?"💾 Modifier":"➕ Ajouter"}</button>
        {editId&&<button onClick={reset} style={btn("#95a5a6")}>Annuler</button>}
      </div>
      {msg&&<div style={{ marginBottom:"0.6rem", fontSize:"0.83rem", color:msg.startsWith("✅")?"#27ae60":"#e74c3c" }}>{msg}</div>}

      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"0.83rem" }}>
        <thead><tr style={{ background:"#2c3e50", color:"white" }}>
          <th style={th}>Client</th><th style={th}>Mission</th><th style={th}>Code</th><th style={th}>Adresse</th><th style={th}>Km A/R</th><th style={th}>Aperçu</th><th style={th}>Actions</th>
        </tr></thead>
        <tbody>
          {missions.map((m,i)=>(
            <tr key={m.id} style={{ background:i%2===0?"#f9f9f9":"white" }}>
              <td style={td}>{m.Client}</td>
              <td style={td}>{m.Mission}</td>
              <td style={td}>{m.Code}</td>
              <td style={{ ...td, fontSize:"0.78rem", color:"#666", maxWidth:180, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{m.Adresse||"—"}</td>
              <td style={{ ...td, textAlign:"center", fontWeight:500 }}>{m.km>0?`${m.km} km`:"—"}</td>
              <td style={td}><span style={{ background:m.Color, color:m.TextColor||"#fff", padding:"0.15rem 0.5rem", borderRadius:3, fontWeight:"bold", fontSize:"0.8rem" }}>{m.Code}</span></td>
              <td style={td}>
                <button onClick={()=>startEdit(m)} style={{ ...bs, background:"#3498db" }}>✏️</button>
                <button onClick={()=>remove(m.id)} style={{ ...bs, background:"#e74c3c", marginLeft:4 }}>🗑</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const inp:React.CSSProperties={ padding:"0.4rem 0.7rem", border:"1px solid #ccc", borderRadius:4, fontSize:"0.88rem", width:"100%" };
const btn=(bg:string):React.CSSProperties=>({ padding:"0.4rem 0.9rem", background:bg, color:"white", border:"none", borderRadius:4, cursor:"pointer", fontWeight:"bold" });
const bs:React.CSSProperties={ padding:"0.2rem 0.5rem", color:"white", border:"none", borderRadius:3, cursor:"pointer", fontSize:"0.8rem" };
const th:React.CSSProperties={ padding:"0.45rem 0.8rem", textAlign:"left" };
const td:React.CSSProperties={ padding:"0.4rem 0.8rem", borderBottom:"1px solid #eee" };
