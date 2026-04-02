"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Sultant  = { id:string; Nom:string; Prénom:string };
type Objectif = { sultant_id:string; annee:number; mois:number; jours:number };

const months = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];

export default function ObjectifForm() {
  const currentYear = new Date().getFullYear();
  const [year, setYear]           = useState(currentYear);
  const [consultants, setConsultants] = useState<Sultant[]>([]);
  const [selCon, setSelCon]       = useState<string>("");
  const [objectifs, setObjectifs] = useState<Record<number,number>>({});
  const [saving, setSaving]       = useState(false);
  const [msg, setMsg]             = useState("");

  useEffect(()=>{
    supabase.from("Sultant").select("*").order("Nom").then(({ data })=>setConsultants(data||[]));
  },[]);

  useEffect(()=>{
    if (!selCon) return;
    supabase.from("Objectif").select("mois,jours").eq("sultant_id",selCon).eq("annee",year)
      .then(({ data })=>{
        const map:Record<number,number> = {};
        (data||[]).forEach((o:Objectif)=>{ map[o.mois]=o.jours; });
        setObjectifs(map);
      });
  },[selCon,year]);

  const save = async () => {
    if (!selCon) { setMsg("Sélectionne un consultant."); return; }
    setSaving(true); setMsg("");
    const rows = months.map((_,i)=>({ sultant_id:selCon, annee:year, mois:i+1, jours:objectifs[i+1]??0 }));
    const { error } = await supabase.from("Objectif").upsert(rows,{ onConflict:"sultant_id,annee,mois" });
    setSaving(false);
    if (error) { setMsg(`❌ ${error.message}`); } else { setMsg("✅ Objectifs enregistrés."); }
  };

  const navBtn:React.CSSProperties = { padding:"0.3rem 0.6rem", border:"1px solid #ccc", borderRadius:4, cursor:"pointer", background:"white" };

  return (
    <div>
      <h2 style={{ marginTop:0, fontSize:"1.1rem" }}>🎯 Objectifs mensuels (jours)</h2>
      <p style={{ fontSize:"0.82rem", color:"#666", marginBottom:"1rem" }}>
        Saisir le nombre de jours facturables attendus par mois pour chaque consultant.
      </p>

      {/* Sélection consultant + année */}
      <div style={{ display:"flex", gap:"0.6rem", alignItems:"center", marginBottom:"1.2rem", flexWrap:"wrap" }}>
        <select value={selCon} onChange={e=>setSelCon(e.target.value)}
          style={{ padding:"0.4rem 0.7rem", borderRadius:4, border:"1px solid #ccc", fontSize:"0.88rem" }}>
          <option value="">-- Consultant --</option>
          {consultants.map(c=><option key={c.id} value={c.id}>{c.Nom} {c.Prénom}</option>)}
        </select>
        <button onClick={()=>setYear(y=>y-1)} style={navBtn}>◀</button>
        <span style={{ fontWeight:"bold", minWidth:44, textAlign:"center" }}>{year}</span>
        <button onClick={()=>setYear(y=>y+1)} style={navBtn}>▶</button>
      </div>

      {/* Grille 12 mois */}
      {selCon && (
        <>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:"0.6rem", marginBottom:"1rem" }}>
            {months.map((m,i)=>(
              <div key={i} style={{ border:"1px solid #ddd", borderRadius:6, padding:"0.6rem", background:"#fafafa" }}>
                <div style={{ fontSize:"0.75rem", fontWeight:"bold", color:"#555", marginBottom:"0.3rem", textAlign:"center" }}>{m}</div>
                <input
                  type="number" min={0} max={31} step={0.5}
                  value={objectifs[i+1]??0}
                  onChange={e=>setObjectifs(prev=>({ ...prev,[i+1]:parseFloat(e.target.value)||0 }))}
                  style={{ width:"100%", padding:"0.3rem", border:"1px solid #ccc", borderRadius:4, textAlign:"center", fontSize:"0.9rem", fontWeight:"bold" }}
                />
              </div>
            ))}
          </div>

          <div style={{ display:"flex", alignItems:"center", gap:"1rem" }}>
            <button onClick={save} disabled={saving}
              style={{ padding:"0.5rem 1.2rem", background:"#27ae60", color:"white", border:"none", borderRadius:6, cursor:"pointer", fontWeight:"bold" }}>
              {saving?"⏳ Enregistrement...":"💾 Enregistrer"}
            </button>
            <span style={{ fontSize:"0.82rem", color:"#666" }}>
              Total annuel : <strong>{Object.values(objectifs).reduce((a,b)=>a+b,0)}</strong> jours
            </span>
          </div>
          {msg && <div style={{ marginTop:"0.6rem", fontSize:"0.83rem", color:msg.startsWith("✅")?"#27ae60":"#e74c3c" }}>{msg}</div>}
        </>
      )}
    </div>
  );
}
