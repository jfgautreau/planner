"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { FixedNav } from "@/components/AnnualPlanner";

type Sultant     = { id:string; Nom:string; Prénom:string };
type Absence     = { id:string; code:string; nom:string; color:string };
type Affectation = { id:string; Date:string; Sultant:string; periode:string; absence:{ id:string; code:string; nom:string; color:string }|null };
type Compteur    = { sultant_id:string; annee:number; code:string; initial:number; acquisition:number };

const months    = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
const monthsFull= ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const NAVY      = "#1a2744";
const LS_YEAR   = "planner_selected_year";
// Codes avec compteur de solde
const CODES_COMPTEUR = ["RTT","CA"];

function fj(v: number, zero="·"): string {
  if (v===0) return zero;
  if (v%1===0) return String(v);
  // 2 décimales si nécessaire (ex: 2.08), 1 sinon (ex: 0.5)
  const s2 = v.toFixed(2).replace(".",",");
  const s1 = v.toFixed(1).replace(".",",");
  return s2.endsWith("0") ? s1 : s2;
}

export default function DashboardRH() {
  const pathname = usePathname();
  const [year, setYear] = useState<number>(() => {
    if (typeof window!=="undefined") { const s=localStorage.getItem(LS_YEAR); return s?parseInt(s):new Date().getFullYear(); }
    return new Date().getFullYear();
  });
  const [consultants, setConsultants] = useState<Sultant[]>([]);
  const [absences, setAbsences]       = useState<Absence[]>([]);
  const [affectations, setAffectations] = useState<Affectation[]>([]);
  const [compteurs, setCompteurs]     = useState<Compteur[]>([]);
  const [loading, setLoading]         = useState(true);
  const [selCon, setSelCon] = useState<string>("");  // sélection unique

  // Edition compteurs
  const [editingCompteurs, setEditingCompteurs] = useState<Record<string,number>>({});
  const [savingCompteurs, setSavingCompteurs]   = useState(false);
  const [compteurMsg, setCompteurMsg]           = useState("");

  useEffect(()=>{ localStorage.setItem(LS_YEAR,String(year)); },[year]);

  useEffect(()=>{
    const load = async ()=>{
      setLoading(true);
      const [{ data:s },{ data:ab },{ data:a },{ data:c }] = await Promise.all([
        supabase.from("Sultant").select("*").order("Nom"),
        supabase.from("Absence").select("*"),
        supabase.from("Affectation")
          .select("id,Date,Sultant,periode,absence:Absence(id,code,nom,color)")
          .gte("Date",`${year}-01-01`).lte("Date",`${year}-12-31`),
        supabase.from("CompteurConge").select("sultant_id,annee,code,initial,acquisition").eq("annee",year),
      ]);
      setConsultants(s||[]); setAbsences(ab||[]);
      setAffectations((a as unknown as Affectation[])||[]); setCompteurs(c||[]);
      setLoading(false);
    };
    load();
  },[year]);

  const toggle = useCallback(<T,>(l:T[], x:T)=>l.includes(x)?l.filter(i=>i!==x):[...l,x], []);

  const filteredAll = useMemo(()=>affectations.filter(a=>{
    if (!a.absence) return false;
    if (selCon && selCon !== a.Sultant) return false;
    return true;
  }),[affectations,selCon]);

  const activeConsultants = useMemo(()=>{
    const activeConsultants = selCon ? consultants.filter(c=>c.id===selCon) : consultants;
    return consultants.filter(c=>filteredAll.some(a=>a.Sultant===c.id));
  },[consultants,filteredAll,selCon]);

  // Synthèse absences par motif x mois
  const absenceSynth = useMemo(()=>{
    const map = new Map<string,{ label:string; color:string; code:string; byMonth:Map<number,number> }>();
    filteredAll.forEach(a=>{
      if (!a.absence) return;
      const mi=new Date(`${a.Date}T12:00:00`).getMonth();
      const key=a.absence.code;
      if (!map.has(key)) map.set(key,{ label:`${a.absence.code} — ${a.absence.nom}`, color:a.absence.color, code:a.absence.code, byMonth:new Map() });
      const row=map.get(key)!;
      row.byMonth.set(mi,(row.byMonth.get(mi)??0)+(a.periode==="journee"?1:0.5));
    });
    return Array.from(map.entries()).map(([key,val])=>({key,...val})).sort((a,b)=>a.key.localeCompare(b.key));
  },[filteredAll]);

  // Bilan compteurs par consultant et par mois cumulatif
  const bilansCompteurs = useMemo(()=>{
    return activeConsultants.map(c=>{
      return CODES_COMPTEUR.map(code=>{
        const compteur   = compteurs.find(ct=>ct.sultant_id===c.id && ct.code===code);
        const soldeInit  = compteur?.initial ?? 0;
        const acqMois    = compteur?.acquisition ?? 0; // jours acquis par mois

        // Jours pris par mois
        const byMonth = months.map((_,mi)=>
          affectations.filter(a=>
            a.Sultant===c.id && a.absence?.code===code &&
            new Date(`${a.Date}T12:00:00`).getMonth()===mi
          ).reduce((s,a)=>s+(a.periode==="journee"?1:0.5),0)
        );

        // Solde mois par mois : initial + cumul acquisitions - cumul prises
        const soldeMois: number[] = [];
        let cumulPris = 0;
        for (let mi=0; mi<12; mi++) {
          cumulPris += byMonth[mi];
          const acqCumul = acqMois * (mi+1); // acquisitions cumulées jusqu'à ce mois
          soldeMois.push(soldeInit + acqCumul - cumulPris);
        }
        const totalPris    = byMonth.reduce((a,b)=>a+b,0);
        const totalAcquis  = acqMois * 12;
        const soldeActuel  = soldeInit + totalAcquis - totalPris;

        return { code, soldeInit, acqMois, byMonth, soldeMois, totalPris, totalAcquis, soldeActuel };
      });
    });
  },[activeConsultants, affectations, compteurs]);

  // Helpers pour les inputs (initial + acquisition séparés)
  const getCompteurKey = (sultantId:string, code:string, field:string) => `${sultantId}::${code}::${field}`;
  const getCompteurValue = (sultantId:string, code:string, field:"initial"|"acquisition") => {
    const key = getCompteurKey(sultantId, code, field);
    if (key in editingCompteurs) return editingCompteurs[key];
    const ct = compteurs.find(c=>c.sultant_id===sultantId&&c.code===code);
    return field==="initial" ? (ct?.initial??0) : (ct?.acquisition??0);
  };
  const setCompteurValue = (sultantId:string, code:string, field:"initial"|"acquisition", val:number) => {
    setEditingCompteurs(prev=>({ ...prev, [getCompteurKey(sultantId,code,field)]:val }));
  };

  const saveCompteurs = async () => {
    setSavingCompteurs(true); setCompteurMsg("");
    try {
      const rows = Object.entries(editingCompteurs).map(([key,val])=>{
        const [sultant_id, code, field] = key.split("::");
        // On regroupe initial + acquisition ensemble
        const existing = compteurs.find(c=>c.sultant_id===sultant_id&&c.code===code);
        return {
          sultant_id, annee:year, code,
          initial:     field==="initial"     ? val : (existing?.initial??0),
          acquisition: field==="acquisition" ? val : (existing?.acquisition??0),
        };
      });
      // Dédoublonner par sultant_id+code (garder le dernier)
      const dedup = new Map<string,typeof rows[0]>();
      rows.forEach(r=>dedup.set(`${r.sultant_id}::${r.code}`,r));
      const unique = Array.from(dedup.values());
      if (unique.length===0) { setSavingCompteurs(false); setCompteurMsg("Aucune modification."); return; }
      const { error } = await supabase.from("CompteurConge").upsert(unique,{ onConflict:"sultant_id,annee,code" });
      if (error) throw error;
      const { data:c } = await supabase.from("CompteurConge").select("sultant_id,annee,code,initial,acquisition").eq("annee",year);
      setCompteurs(c||[]); setEditingCompteurs({});
      setCompteurMsg("✅ Compteurs enregistrés.");
    } catch(e:unknown) { setCompteurMsg(`❌ ${e instanceof Error?e.message:"Erreur"}`); }
    setSavingCompteurs(false);
  };

  const navBtn:React.CSSProperties={ padding:"0.28rem 0.6rem", border:"1px solid #ccc", borderRadius:4, cursor:"pointer", background:"white", fontSize:"0.82rem" };
  const pill=(active:boolean,color="#3498db"):React.CSSProperties=>({ padding:"0.22rem 0.65rem", border:`1.5px solid ${color}`, borderRadius:20, backgroundColor:active?color:"white", color:active?"white":color, cursor:"pointer", fontSize:"0.76rem", fontWeight:500 });

  if (loading) return <div style={{ paddingTop:58 }}><FixedNav activePath={pathname||"/dashboardrh"}/><div style={{ padding:"2rem",textAlign:"center" }}>Chargement...</div></div>;

  const currentMonth = new Date().getFullYear()===year ? new Date().getMonth() : 11;

  return (
    <div style={{ paddingTop:58 }}>
      <FixedNav activePath={pathname||"/dashboardrh"} />
      <div style={{ padding:"1.2rem 1.5rem", maxWidth:1300, margin:"0 auto" }}>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", gap:"0.7rem", marginBottom:"1.2rem", flexWrap:"wrap" }}>
          <h1 style={{ margin:0, fontSize:"1.3rem", color:NAVY }}>👥 Dashboard RH {year}</h1>
          <div style={{ display:"flex", alignItems:"center", gap:"0.4rem", marginLeft:"auto" }}>
            <button onClick={()=>setYear(y=>y-1)} style={navBtn}>◀</button>
            <span style={{ fontWeight:"bold", minWidth:44, textAlign:"center" }}>{year}</span>
            <button onClick={()=>setYear(y=>y+1)} style={navBtn}>▶</button>
          </div>
        </div>

        {/* Filtre consultant — sélection unique */}
        <div style={{ marginBottom:"1.2rem", padding:"0.8rem 1rem", background:"#f8f9fa", borderRadius:8 }}>
          <div style={{ fontSize:"0.72rem", fontWeight:"bold", color:"#888", textTransform:"uppercase", marginBottom:"0.35rem" }}>
            Consultant
          </div>
          <div style={{ display:"flex", gap:"0.5rem", alignItems:"center" }}>
            <select value={selCon} onChange={e=>setSelCon(e.target.value)}
              style={{ padding:"0.35rem 0.8rem", borderRadius:4, border:"1px solid #ccc", fontSize:"0.85rem", minWidth:220 }}>
              <option value="">— Tous les consultants —</option>
              {consultants.map(c=><option key={c.id} value={c.id}>{c.Nom} {c.Prénom}</option>)}
            </select>
            {selCon && <button onClick={()=>setSelCon("")} style={{ padding:"0.3rem 0.6rem", border:"1px solid #e74c3c", borderRadius:4, background:"white", color:"#e74c3c", cursor:"pointer", fontSize:"0.78rem" }}>✕ Tous</button>}
          </div>
        </div>

        {/* Tableau synthèse absences */}
        {absenceSynth.length===0 ? (
          <div style={{ textAlign:"center", color:"#888", padding:"2rem" }}>Aucune absence enregistrée pour cette période.</div>
        ) : (
          <div style={{ marginBottom:"2rem" }}>
            <h2 style={{ fontSize:"1rem", color:NAVY, marginBottom:"0.7rem" }}>🏖 Synthèse des absences</h2>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"0.8rem" }}>
                <thead>
                  <tr style={{ backgroundColor:"#546e7a", color:"white" }}>
                    <th style={{ padding:"0.5rem 0.8rem", textAlign:"left", minWidth:160 }}>Motif</th>
                    {months.map((m,i)=><th key={i} style={{ padding:"0.4rem 0.2rem", textAlign:"center", minWidth:38, fontSize:"0.72rem" }}>{m}</th>)}
                    <th style={{ padding:"0.4rem 0.5rem", textAlign:"center", minWidth:52, borderLeft:"2px solid rgba(255,255,255,0.2)" }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {absenceSynth.map((row,i)=>{
                    const total=Array.from(row.byMonth.values()).reduce((a,b)=>a+b,0);
                    return (
                      <tr key={row.key} style={{ backgroundColor:i%2===0?"#f9f9f9":"white" }}>
                        <td style={{ padding:"0.4rem 0.8rem", fontWeight:500 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                            <span style={{ display:"inline-block", width:10, height:10, borderRadius:2, backgroundColor:row.color }} />
                            {row.label}
                          </div>
                        </td>
                        {months.map((_,mi)=>{ const v=row.byMonth.get(mi)??0; return <td key={mi} style={{ padding:"0.4rem 0.2rem", textAlign:"center", color:v===0?"#ddd":"#000", fontWeight:v>0?"600":"normal", fontSize:"0.78rem" }}>{fj(v)}</td>; })}
                        <td style={{ padding:"0.4rem 0.5rem", textAlign:"center", fontWeight:"bold", borderLeft:"2px solid #eee", backgroundColor:`${row.color}18` }}>{fj(total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor:"#546e7a", color:"white", fontWeight:"bold" }}>
                    <td style={{ padding:"0.5rem 0.8rem" }}>TOTAL</td>
                    {months.map((_,mi)=>{ const t=absenceSynth.reduce((s,r)=>s+(r.byMonth.get(mi)??0),0); return <td key={mi} style={{ padding:"0.4rem 0.2rem", textAlign:"center", fontSize:"0.78rem" }}>{fj(t)}</td>; })}
                    <td style={{ padding:"0.4rem 0.5rem", textAlign:"center", borderLeft:"2px solid rgba(255,255,255,0.2)" }}>{fj(absenceSynth.reduce((s,r)=>s+Array.from(r.byMonth.values()).reduce((a,b)=>a+b,0),0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Bilan compteurs RTT / CA */}
        <div>
          <div style={{ marginBottom:"0.7rem" }}>
            <h2 style={{ fontSize:"1rem", color:NAVY, margin:0 }}>🗓 Compteurs RTT & CA</h2>
            <p style={{ fontSize:"0.78rem", color:"#888", marginTop:"0.3rem", marginBottom:0 }}>
              Saisissez le solde initial (jours au 1er janvier {year}) et l'acquisition mensuelle. Le solde affiché chaque mois = initial + acquisitions cumulées − jours pris.
            </p>
          </div>

          {activeConsultants.map((c,ci)=>(
            <div key={c.id} style={{ marginBottom:"1.5rem" }}>
              <div style={{ fontWeight:"bold", color:NAVY, fontSize:"0.9rem", marginBottom:"0.5rem" }}>
                👤 {c.Nom} {c.Prénom}
              </div>
              <div style={{ overflowX:"auto" }}>
                <table style={{ borderCollapse:"collapse", fontSize:"0.78rem", width:"100%" }}>
                  <thead>
                    <tr style={{ backgroundColor:NAVY, color:"white" }}>
                      <th style={{ padding:"0.4rem 0.8rem", textAlign:"left", minWidth:80 }}>Code</th>
                      <th style={{ padding:"0.4rem 0.6rem", textAlign:"center", minWidth:75, background:"#1a3a5c" }}>Solde init.</th>
                      <th style={{ padding:"0.4rem 0.6rem", textAlign:"center", minWidth:75, background:"#1a3a5c" }}>Acq./mois</th>
                      <th style={{ padding:"0.4rem 0.6rem", textAlign:"center", minWidth:60, background:"#2c3e50" }}></th>
                      {months.map((m,i)=><th key={i} style={{ padding:"0.4rem 0.2rem", textAlign:"center", minWidth:42, fontSize:"0.7rem", background:i<=currentMonth?"#1a2744":"#37474f" }}>{m}</th>)}
                      <th style={{ padding:"0.4rem 0.5rem", textAlign:"center", minWidth:55, borderLeft:"2px solid rgba(255,255,255,0.2)" }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bilansCompteurs[ci]?.map((b,bi)=>{
                      const hasAbsences = absences.some(a=>a.code===b.code);
                      if (!hasAbsences && b.soldeInit===0 && b.totalPris===0) return null;
                      const ab = absences.find(a=>a.code===b.code);
                      const labelCell = (
                        <td rowSpan={3} style={{ padding:"0.4rem 0.8rem", fontWeight:"bold", verticalAlign:"middle", borderRight:"1px solid #eee" }}>
                          <span style={{ display:"inline-flex", alignItems:"center", gap:5 }}>
                            <span style={{ display:"inline-block", width:9, height:9, borderRadius:2, backgroundColor:ab?.color||"#ccc" }} />
                            {b.code}
                          </span>
                        </td>
                      );
                      const initCell = (field: "initial"|"acquisition") => (
                        <td rowSpan={3} style={{ padding:"0.3rem 0.4rem", textAlign:"center", verticalAlign:"middle", borderRight:"1px solid #eee" }}>
                          <input type="number" min={0} max={field==="initial"?50:5} step={field==="initial"?0.5:0.01}
                            value={getCompteurValue(c.id, b.code, field)}
                            onChange={e=>setCompteurValue(c.id, b.code, field, parseFloat(e.target.value)||0)}
                            style={{ width:52, padding:"0.2rem 0.3rem", border:`1px solid ${field==="initial"?"#ccc":"#2980b9"}`, borderRadius:4, textAlign:"center", fontSize:"0.78rem", background:field==="acquisition"?"#eaf4fb":"white" }}
                          />
                        </td>
                      );
                      return (
                        <React.Fragment key={b.code}>
                          {/* Ligne 1 : Acquisitions */}
                          <tr style={{ backgroundColor:"#f0faf0" }}>
                            {labelCell}
                            {initCell("initial")}
                            {initCell("acquisition")}
                            <td style={{ padding:"0.2rem 0.5rem", fontSize:"0.68rem", color:"#27ae60", fontWeight:"bold", whiteSpace:"nowrap", background:"#f0faf0" }}>Acquis</td>
                            {b.soldeMois.map((_,mi)=>{
                              const acq = b.acqMois;
                              const isCurrentMonth = mi===currentMonth && new Date().getFullYear()===year;
                              return (
                                <td key={mi} style={{ padding:"0.25rem 0.2rem", textAlign:"center", fontSize:"0.7rem",
                                  color:acq>0?"#27ae60":"#ddd", fontWeight:500,
                                  backgroundColor:isCurrentMonth?"#e8f8e8":mi>currentMonth&&new Date().getFullYear()===year?"#f8faf8":"#f0faf0",
                                  borderLeft:isCurrentMonth?"2px solid #f39c12":"",
                                  opacity:mi>currentMonth&&new Date().getFullYear()===year?0.45:1,
                                }}>
                                  {acq>0?`+${fj(acq)}`:"·"}
                                </td>
                              );
                            })}
                            <td style={{ padding:"0.25rem 0.5rem", textAlign:"center", fontSize:"0.7rem", color:"#27ae60", fontWeight:"bold", borderLeft:"2px solid #eee", backgroundColor:"#f0faf0" }}>
                              {b.acqMois>0?`+${fj(b.totalAcquis)}`:"·"}
                            </td>
                          </tr>
                          {/* Ligne 2 : Prises */}
                          <tr style={{ backgroundColor:"#fff5f5" }}>
                            <td style={{ padding:"0.2rem 0.5rem", fontSize:"0.68rem", color:"#e74c3c", fontWeight:"bold", whiteSpace:"nowrap", background:"#fff5f5" }}>Pris</td>
                            {b.byMonth.map((pris,mi)=>{
                              const isCurrentMonth = mi===currentMonth && new Date().getFullYear()===year;
                              return (
                                <td key={mi} style={{ padding:"0.25rem 0.2rem", textAlign:"center", fontSize:"0.7rem",
                                  color:pris>0?"#e74c3c":"#ddd", fontWeight:pris>0?"600":"normal",
                                  backgroundColor:isCurrentMonth?"#fde8e8":mi>currentMonth&&new Date().getFullYear()===year?"#fdf8f8":"#fff5f5",
                                  borderLeft:isCurrentMonth?"2px solid #f39c12":"",
                                  opacity:mi>currentMonth&&new Date().getFullYear()===year?0.45:1,
                                }}>
                                  {pris>0?`-${fj(pris)}`:"·"}
                                </td>
                              );
                            })}
                            <td style={{ padding:"0.25rem 0.5rem", textAlign:"center", fontSize:"0.7rem", color:b.totalPris>0?"#e74c3c":"#ddd", fontWeight:"bold", borderLeft:"2px solid #eee", backgroundColor:"#fff5f5" }}>
                              {b.totalPris>0?`-${fj(b.totalPris)}`:"·"}
                            </td>
                          </tr>
                          {/* Ligne 3 : Solde restant */}
                          <tr style={{ backgroundColor:"white", borderBottom:"3px solid #ccc" }}>
                            <td style={{ padding:"0.2rem 0.5rem", fontSize:"0.68rem", color:NAVY, fontWeight:"bold", whiteSpace:"nowrap", borderBottom:"3px solid #ccc" }}>Solde</td>
                            {b.soldeMois.map((solde,mi)=>{
                              const isCurrentMonth = mi===currentMonth && new Date().getFullYear()===year;
                              const isFutur = mi>currentMonth && new Date().getFullYear()===year;
                              const color = solde>=0?"#27ae60":"#e67e22";
                              return (
                                <td key={mi} style={{ padding:"0.3rem 0.2rem", textAlign:"center", fontSize:"0.78rem",
                                  fontWeight:"bold", color,
                                  backgroundColor:isCurrentMonth?"#fff8e1":undefined,
                                  borderLeft:isCurrentMonth?"2px solid #f39c12":"",
                                  borderRight:isCurrentMonth?"2px solid #f39c12":"",
                                  borderBottom:"3px solid #ccc",
                                  opacity:isFutur?0.5:1,
                                }}>
                                  {fj(solde,"0")}
                                </td>
                              );
                            })}
                            <td style={{ padding:"0.3rem 0.5rem", textAlign:"center", fontWeight:"bold", borderLeft:"2px solid #eee", borderBottom:"3px solid #ccc",
                              color:b.soldeActuel>=0?"#27ae60":"#e67e22", fontSize:"0.9rem",
                            }}>
                              {fj(b.soldeActuel,"0")}
                            </td>
                          </tr>
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {/* Bouton enregistrer + légende sous les tableaux */}
          <div style={{ display:"flex", alignItems:"center", gap:"1rem", marginTop:"1rem", flexWrap:"wrap" }}>
            <button onClick={saveCompteurs} disabled={savingCompteurs||Object.keys(editingCompteurs).length===0} style={{
              padding:"0.4rem 1.1rem", background:Object.keys(editingCompteurs).length>0?"#27ae60":"#aaa",
              color:"white", border:"none", borderRadius:5, cursor:Object.keys(editingCompteurs).length>0?"pointer":"not-allowed", fontWeight:"bold", fontSize:"0.85rem",
            }}>
              {savingCompteurs?"⏳ Enregistrement...":"💾 Enregistrer les soldes"}
            </button>
            {compteurMsg && <span style={{ fontSize:"0.82rem", color:compteurMsg.startsWith("✅")?"#27ae60":"#e74c3c" }}>{compteurMsg}</span>}
            <div style={{ display:"flex", gap:"1.2rem", fontSize:"0.72rem", marginLeft:"auto" }}>
              <span style={{ color:"#27ae60", fontWeight:500 }}>● Positif</span>
              <span style={{ color:"#e67e22", fontWeight:500 }}>● Négatif</span>
              <span style={{ color:"#888" }}>Mois grisés = futurs (prévisionnel)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
