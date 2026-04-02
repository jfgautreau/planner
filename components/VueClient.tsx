"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { FixedNav } from "@/components/AnnualPlanner";

type Sultant     = { id: string; Nom: string; Prénom: string };
type Mission     = { id: string; Client: string; Mission: string; Code: string; Color: string; TextColor: string };
type Affectation = {
  id: string; Date: string; Sultant: string;
  periode: "journee"|"matin"|"aprem"; copil: boolean;
  mission?: { id: string; Client: string; Mission: string; Code: string; Color: string; TextColor: string } | null;
};
type JourFerie = { date: string; nom: string };
type CongeJour = { date: string; zone_a: boolean; zone_b: boolean; zone_c: boolean };

const monthsFull = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const NAVY  = "#1a2744";
const GRAY  = "#d0d0d0";
const LS_YEAR = "planner_selected_year";
const DAY_W = 26;

function fj(v: number): string {
  if (v === 0) return "·";
  return v % 1 === 0 ? String(v) : v.toFixed(1).replace(".", ",");
}

// Coin COPIL noir
function CopilCorner() {
  return <span style={{ position:"absolute", top:0, right:0, width:0, height:0, borderStyle:"solid", borderWidth:"0 7px 7px 0", borderColor:"transparent #111 transparent transparent", zIndex:3 }} />;
}

function Sw({ bg, border }: { bg: string; border?: string }) {
  return <span style={{ display:"inline-block", width:11, height:11, background:bg, border:`1px solid ${border||"#ccc"}`, marginRight:3, verticalAlign:"middle", borderRadius:2 }} />;
}

export default function VueClient() {
  const pathname = usePathname();
  const printRef = useRef<HTMLDivElement>(null);
  const today    = new Date();

  const [year, setYear] = useState<number>(() => {
    if (typeof window !== "undefined") { const s = localStorage.getItem(LS_YEAR); return s ? parseInt(s) : today.getFullYear(); }
    return today.getFullYear();
  });
  // Mois sélectionnés (multiple)
  const [selectedMonths, setSelectedMonths] = useState<number[]>([today.getMonth()]);

  const [consultants,  setConsultants]  = useState<Sultant[]>([]);
  const [missions,     setMissions]     = useState<Mission[]>([]);
  const [affectations, setAffectations] = useState<Affectation[]>([]);
  const [joursFeries,  setJoursFeries]  = useState<JourFerie[]>([]);
  const [conges,       setConges]       = useState<CongeJour[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [generating,   setGenerating]   = useState(false);
  const [selectedMissions, setSelectedMissions] = useState<string[]>([]);

  useEffect(() => { localStorage.setItem(LS_YEAR, String(year)); }, [year]);

  // Plage de dates couvrant tous les mois sélectionnés
  const dateMin = useMemo(() => {
    if (selectedMonths.length === 0) return `${year}-01-01`;
    const mi = Math.min(...selectedMonths);
    return `${year}-${String(mi+1).padStart(2,"0")}-01`;
  }, [year, selectedMonths]);

  const dateMax = useMemo(() => {
    if (selectedMonths.length === 0) return `${year}-12-31`;
    const mi = Math.max(...selectedMonths);
    const dim = new Date(year, mi+1, 0).getDate();
    return `${year}-${String(mi+1).padStart(2,"0")}-${String(dim).padStart(2,"0")}`;
  }, [year, selectedMonths]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [{ data:s }, { data:m }, { data:a }, { data:jf }, { data:cj }] = await Promise.all([
        supabase.from("Sultant").select("*").order("Nom"),
        supabase.from("Mission").select("id,Client,Mission,Code,Color,TextColor"),
        supabase.from("Affectation")
          .select("id,Date,Sultant,periode,copil,mission:Mission(id,Client,Mission,Code,Color,TextColor)")
          .gte("Date", dateMin).lte("Date", dateMax),
        supabase.from("JourFerie").select("date,nom").gte("date", dateMin).lte("date", dateMax),
        supabase.from("CongeJour").select("date,zone_a,zone_b,zone_c").gte("date", dateMin).lte("date", dateMax),
      ]);
      setConsultants(s||[]); setMissions(m||[]);
      setAffectations((a as Affectation[])||[]);
      setJoursFeries(jf||[]); setConges(cj||[]);
      setLoading(false);
    };
    load();
  }, [dateMin, dateMax]);

  const activeMissions = useMemo(() => {
    const codes = new Set(affectations.map(a => a.mission?.Code).filter(Boolean));
    return missions.filter(m => codes.has(m.Code))
      .filter((m,i,arr) => arr.findIndex(x => x.Code===m.Code)===i)
      .sort((a,b) => a.Client.localeCompare(b.Client)||a.Code.localeCompare(b.Code));
  }, [missions, affectations]);

  const filtered = useMemo(() =>
    affectations.filter(a => {
      if (!a.mission) return false;
      if (selectedMissions.length > 0 && !selectedMissions.includes(a.mission.Code)) return false;
      return true;
    })
  , [affectations, selectedMissions]);

  const activeConsultants = useMemo(() => {
    const ids = new Set(filtered.map(a => a.Sultant));
    return consultants.filter(c => ids.has(c.id));
  }, [consultants, filtered]);

  const ferieMap = useMemo(() => { const m=new Map<string,string>(); joursFeries.forEach(j=>m.set(j.date,j.nom)); return m; }, [joursFeries]);
  const congeMap = useMemo(() => { const m=new Map<string,CongeJour>(); conges.forEach(c=>m.set(c.date,c)); return m; }, [conges]);

  const daysInMonth = (mi: number) => new Date(year, mi+1, 0).getDate();
  const ds = (mi: number, d: number) => `${year}-${String(mi+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  const isBlocked = (dateStr: string) => { const dow=new Date(`${dateStr}T12:00:00`).getDay(); return dow===0||dow===6||ferieMap.has(dateStr); };
  const getAff = (sultantId: string, dateStr: string) => filtered.find(a => a.Sultant===sultantId && a.Date.startsWith(dateStr));

  // ── Synthèse jours par consultant/mois ─────────────────────────────────────
  const synthese = useMemo(() => {
    // Mois triés dans l'ordre croissant (0=jan, 11=dec)
    const visibleMonths = [...selectedMonths].sort((a,b)=>a-b);
    const rows = activeConsultants.map(c => {
      const byMonth = visibleMonths.map(mi => {
        return filtered
          .filter(a => a.Sultant===c.id && new Date(`${a.Date}T12:00:00`).getMonth()===mi)
          .reduce((s,a) => s + (a.periode==="journee"?1:0.5), 0);
      });
      return { consultant: c, byMonth, total: byMonth.reduce((a,b)=>a+b,0) };
    }).filter(r => r.total > 0);
    const monthTotals = visibleMonths.map((_,i) => rows.reduce((s,r) => s+r.byMonth[i], 0));
    const grandTotal  = monthTotals.reduce((a,b)=>a+b,0);
    return { rows, visibleMonths, monthTotals, grandTotal };
  }, [activeConsultants, filtered, selectedMonths]);

  const toggle = (list: number[], item: number) => list.includes(item) ? list.filter(x=>x!==item) : [...list,item].sort((a,b)=>a-b);
  const toggleM = (list: string[], item: string) => list.includes(item) ? list.filter(x=>x!==item) : [...list,item];

  const monthColor = (mi: number) => [
    "#1976d2","#1565c0","#0d47a1",
    "#388e3c","#2e7d32","#1b5e20",
    "#f57c00","#e65100","#bf360c",
    "#7b1fa2","#6a1b9a","#4a148c",
  ][mi];

  const generatePDF = async () => {
    if (!printRef.current) return;
    setGenerating(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF }   = await import("jspdf");
      const canvas = await html2canvas(printRef.current, { scale:2, useCORS:true, backgroundColor:"#ffffff", logging:false });
      const imgW=canvas.width/2, imgH=canvas.height/2;
      const pageW=297, pageH=210, margin=8;
      const ratio = (pageW-margin*2)/imgW;
      const finalW=imgW*ratio, finalH=imgH*ratio;
      const pdf = new jsPDF({ orientation:"landscape", unit:"mm", format:"a4" });
      if (finalH<=pageH-margin*2) {
        pdf.addImage(canvas.toDataURL("image/png"),"PNG",margin,margin,finalW,finalH);
      } else {
        const ppH=((pageH-margin*2)/ratio)*2; let y=0,pi=0;
        while(y<canvas.height){
          if(pi>0) pdf.addPage([297,210],"landscape");
          const sh=Math.min(ppH,canvas.height-y);
          const sl=document.createElement("canvas"); sl.width=canvas.width; sl.height=sh;
          sl.getContext("2d")!.drawImage(canvas,0,y,canvas.width,sh,0,0,canvas.width,sh);
          pdf.addImage(sl.toDataURL("image/png"),"PNG",margin,margin,finalW,(sh/2)*ratio);
          y+=ppH; pi++;
        }
      }
      const label = selectedMonths.length>0 ? selectedMonths.map(m=>monthsFull[m].slice(0,3)).join("-") : "tous";
      pdf.save(`planning-client-${label}-${year}.pdf`);
    } catch(e){ console.error(e); alert("npm install jspdf html2canvas"); }
    setGenerating(false);
  };

  const navBtn: React.CSSProperties = { padding:"0.3rem 0.6rem", border:"1px solid #ccc", borderRadius:4, cursor:"pointer", background:"white", fontSize:"0.82rem" };

  if (loading) return <div style={{ paddingTop:58 }}><FixedNav activePath={pathname||"/client"}/><div style={{ padding:"2rem",textAlign:"center" }}>Chargement...</div></div>;

  return (
    <div style={{ paddingTop:58 }}>
      <FixedNav activePath={pathname||"/client"} />

      {/* ── Barre contrôles ── */}
      <div style={{ display:"flex", alignItems:"center", gap:"0.5rem", padding:"0.5rem 1.2rem", background:"#f0f4f8", borderBottom:"1px solid #ddd", flexWrap:"wrap" }}>

        {/* Année */}
        <button onClick={()=>setYear(y=>y-1)} style={navBtn}>◀</button>
        <select value={year} onChange={e=>setYear(parseInt(e.target.value))}
          style={{ padding:"0.3rem 0.5rem", borderRadius:4, border:"1px solid #ccc", fontWeight:"bold", color:NAVY, fontSize:"0.85rem" }}>
          {Array.from({length:6},(_,i)=>today.getFullYear()-1+i).map(y=><option key={y} value={y}>{y}</option>)}
        </select>
        <button onClick={()=>setYear(y=>y+1)} style={navBtn}>▶</button>

        <div style={{ width:1, height:24, background:"#ccc", margin:"0 0.2rem" }} />

        {/* Sélection mois multiples */}
        <div style={{ display:"flex", flexWrap:"wrap", gap:"0.25rem" }}>
          {monthsFull.map((m,i) => (
            <button key={i} onClick={()=>setSelectedMonths(p=>toggle(p,i))} style={{
              padding:"0.22rem 0.55rem", border:`2px solid ${monthColor(i)}`, borderRadius:4,
              backgroundColor:selectedMonths.includes(i)?monthColor(i):"white",
              color:selectedMonths.includes(i)?"white":monthColor(i),
              cursor:"pointer", fontWeight:"bold", fontSize:"0.72rem",
            }}>
              {m.slice(0,3)}
            </button>
          ))}
          <button onClick={()=>setSelectedMonths([0,1,2,3,4,5,6,7,8,9,10,11])} style={{ ...navBtn, fontSize:"0.72rem" }}>Tout</button>
          {selectedMonths.length>0 && <button onClick={()=>setSelectedMonths([])} style={{ ...navBtn, color:"#e74c3c", borderColor:"#e74c3c", fontSize:"0.72rem" }}>✕</button>}
        </div>

        <div style={{ width:1, height:24, background:"#ccc", margin:"0 0.2rem" }} />

        {/* Filtre missions */}
        <div style={{ display:"flex", flexWrap:"wrap", gap:"0.25rem", flex:1 }}>
          {activeMissions.map(m => (
            <button key={m.Code} onClick={()=>setSelectedMissions(p=>toggleM(p,m.Code))} style={{
              padding:"0.22rem 0.65rem", border:`2px solid ${m.Color}`, borderRadius:20,
              backgroundColor:selectedMissions.includes(m.Code)?m.Color:"white",
              color:selectedMissions.includes(m.Code)?(m.TextColor||"#fff"):m.Color,
              cursor:"pointer", fontWeight:"bold", fontSize:"0.72rem",
            }}>
              {m.Code}
            </button>
          ))}
          {selectedMissions.length>0 && <button onClick={()=>setSelectedMissions([])} style={{ ...navBtn, color:"#e74c3c", borderColor:"#e74c3c", fontSize:"0.72rem" }}>✕</button>}
        </div>

        <button onClick={generatePDF} disabled={generating||activeConsultants.length===0} style={{
          padding:"0.4rem 1rem", background:generating||activeConsultants.length===0?"#aaa":"#e74c3c",
          color:"white", border:"none", borderRadius:6, cursor:generating||activeConsultants.length===0?"not-allowed":"pointer",
          fontWeight:"bold", fontSize:"0.82rem", whiteSpace:"nowrap",
        }}>
          🖨️ {generating?"Génération...":"Exporter PDF"}
        </button>
      </div>

      {selectedMonths.length===0 ? (
        <div style={{ padding:"3rem", textAlign:"center", color:"#888" }}>Sélectionne au moins un mois.</div>
      ) : (
        <div ref={printRef} style={{ padding:"1rem 1.2rem", background:"white" }}>

          {/* ── PARTIE HAUTE : synthèse dashboard ── */}
          {synthese.rows.length > 0 && (
            <div style={{ marginBottom:"1.5rem" }}>
              <h3 style={{ margin:"0 0 0.6rem", fontSize:"0.9rem", color:NAVY }}>
                Synthèse — {selectedMissions.length>0?selectedMissions.join(", "):"toutes missions"} — {year}
              </h3>
              <div style={{ overflowX:"auto" }}>
                <table style={{ borderCollapse:"collapse", fontSize:"0.78rem", minWidth:400 }}>
                  <thead>
                    <tr style={{ backgroundColor:NAVY, color:"white" }}>
                      <th style={{ padding:"0.4rem 0.8rem", textAlign:"left", minWidth:130 }}>Consultant</th>
                      {synthese.visibleMonths.map(mi => (
                        <th key={mi} style={{ padding:"0.4rem 0.4rem", textAlign:"center", minWidth:44, background:monthColor(mi), fontSize:"0.72rem" }}>
                          {monthsFull[mi].slice(0,3)}
                        </th>
                      ))}
                      <th style={{ padding:"0.4rem 0.5rem", textAlign:"center", minWidth:52, borderLeft:"2px solid rgba(255,255,255,0.3)" }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {synthese.rows.map((row,i) => (
                      <tr key={row.consultant.id} style={{ backgroundColor:i%2===0?"#f9f9f9":"white" }}>
                        <td style={{ padding:"0.35rem 0.8rem", fontWeight:500, color:NAVY }}>{row.consultant.Nom} {row.consultant.Prénom}</td>
                        {row.byMonth.map((v,j) => (
                          <td key={j} style={{ padding:"0.35rem 0.4rem", textAlign:"center", color:v===0?"#ddd":"#000", fontWeight:v>0?"600":"normal" }}>{fj(v)}</td>
                        ))}
                        <td style={{ padding:"0.35rem 0.5rem", textAlign:"center", fontWeight:"bold", borderLeft:"2px solid #eee", background:"#eef2ff" }}>{fj(row.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ backgroundColor:NAVY, color:"white", fontWeight:"bold" }}>
                      <td style={{ padding:"0.4rem 0.8rem" }}>TOTAL</td>
                      {synthese.monthTotals.map((t,i) => (
                        <td key={i} style={{ padding:"0.4rem 0.4rem", textAlign:"center", fontSize:"0.75rem" }}>{fj(t)}</td>
                      ))}
                      <td style={{ padding:"0.4rem 0.5rem", textAlign:"center", borderLeft:"2px solid rgba(255,255,255,0.3)" }}>{fj(synthese.grandTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ── Légende ── */}
          <div style={{ display:"flex", gap:"1rem", fontSize:"0.7rem", flexWrap:"wrap", alignItems:"center", marginBottom:"1rem", padding:"0.4rem 0.8rem", background:"#f8f9fa", borderRadius:6 }}>
            <span style={{ fontWeight:"bold", color:NAVY }}>Légende :</span>
            {activeMissions.filter(m=>selectedMissions.length===0||selectedMissions.includes(m.Code)).map(m=>(
              <span key={m.Code} style={{ display:"flex", alignItems:"center", gap:3 }}>
                <span style={{ display:"inline-block", width:16, height:10, background:m.Color, borderRadius:2 }} />
                <span style={{ color:"#555" }}>{m.Code} — {m.Mission} ({m.Client})</span>
              </span>
            ))}
            <span style={{ display:"flex", alignItems:"center", gap:3 }}><Sw bg={GRAY}/>WE/Férié</span>
            <span style={{ display:"flex", alignItems:"center", gap:3 }}>
              <span style={{ display:"inline-flex", gap:1 }}>
                <span style={{ width:6,height:10,background:"#ff9800",borderRadius:"1px 0 0 1px" }}/>
                <span style={{ width:6,height:10,background:"#2196f3" }}/>
                <span style={{ width:6,height:10,background:"#4caf50",borderRadius:"0 1px 1px 0" }}/>
              </span>
              <span style={{ color:"#555" }}>Congés A/B/C</span>
            </span>
            <span style={{ display:"flex", alignItems:"center", gap:3 }}>
              <span style={{ display:"inline-block", width:14, height:10, background:"#ddd", position:"relative", overflow:"hidden" }}>
                <CopilCorner />
              </span>
              <span style={{ color:"#555" }}>COPIL</span>
            </span>
          </div>

          {/* ── PARTIE BASSE : calendriers mensuels ── */}
          {activeConsultants.length===0 ? (
            <div style={{ padding:"2rem", textAlign:"center", color:"#888" }}>Aucune affectation sur cette période.</div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:"1.2rem" }}>
              {synthese.visibleMonths.map(mi => {
                const dim     = daysInMonth(mi);
                const mColor  = monthColor(mi);
                const hasZoneA = Array.from({length:dim},(_,d)=>congeMap.get(ds(mi,d+1))?.zone_a).some(Boolean);
                const hasZoneB = Array.from({length:dim},(_,d)=>congeMap.get(ds(mi,d+1))?.zone_b).some(Boolean);
                const hasZoneC = Array.from({length:dim},(_,d)=>congeMap.get(ds(mi,d+1))?.zone_c).some(Boolean);

                return (
                  <div key={mi}>
                    <table style={{ borderCollapse:"collapse", fontSize:"0.7rem" }}>
                      <colgroup>
                        <col style={{ width:130 }} />
                        {Array.from({length:dim},(_,d)=><col key={d} style={{ width:DAY_W }} />)}
                      </colgroup>
                      <thead>
                        {/* Titre mois — fond gris neutre */}
                        <tr>
                          <th style={{ background:"#37474f", color:"white", border:"1px solid #333", padding:"3px 8px", textAlign:"left", fontSize:"0.72rem" }}>
                            Consultant
                          </th>
                          <th colSpan={dim} style={{ background:"#546e7a", color:"white", textAlign:"center", border:"1px solid #333", padding:"4px", fontSize:"0.82rem", fontWeight:"bold", letterSpacing:"0.05em" }}>
                            {monthsFull[mi]} {year}
                          </th>
                        </tr>
                        {/* Jours */}
                        <tr>
                          <th style={{ background:"#37474f", color:"#b0bec5", border:"1px solid #333", padding:"2px 8px", fontSize:"0.58rem" }}></th>
                          {Array.from({length:dim},(_,d)=>{
                            const dateStr=ds(mi,d+1);
                            const dow=new Date(`${dateStr}T12:00:00`).getDay();
                            const blocked=dow===0||dow===6||ferieMap.has(dateStr);
                            const dayLabel=["Di","Lu","Ma","Me","Je","Ve","Sa"][dow];
                            return (
                              <th key={d} title={ferieMap.get(dateStr)||""} style={{
                                background:blocked?"#c0c0c0":"#eceff1",
                                color:blocked?"#888":"#546e7a",
                                border:"1px solid #ddd", padding:"1px 0",
                                textAlign:"center", fontSize:"0.52rem",
                                fontWeight:dow===1?"bold":"normal", minWidth:DAY_W,
                              }}>
                                <div style={{ fontWeight:"bold" }}>{d+1}</div>
                                <div style={{ fontSize:"0.45rem", opacity:0.75 }}>{dayLabel}</div>
                              </th>
                            );
                          })}
                        </tr>
                        {/* Barres congés — hauteur réduite, sans label */}
                        {hasZoneA && (
                          <tr style={{ height:3 }}>
                            <td style={{ background:"#fafafa", border:"1px solid #eee", padding:0 }} />
                            {Array.from({length:dim},(_,d)=>{
                              const active=congeMap.get(ds(mi,d+1))?.zone_a;
                              return <td key={d} style={{ padding:0, border:"1px solid #eee", background:active?"#ff9800":"white", height:3 }} />;
                            })}
                          </tr>
                        )}
                        {hasZoneB && (
                          <tr style={{ height:3 }}>
                            <td style={{ background:"#fafafa", border:"1px solid #eee", padding:0 }} />
                            {Array.from({length:dim},(_,d)=>{
                              const active=congeMap.get(ds(mi,d+1))?.zone_b;
                              return <td key={d} style={{ padding:0, border:"1px solid #eee", background:active?"#2196f3":"white", height:3 }} />;
                            })}
                          </tr>
                        )}
                        {hasZoneC && (
                          <tr style={{ height:3 }}>
                            <td style={{ background:"#fafafa", border:"1px solid #eee", padding:0 }} />
                            {Array.from({length:dim},(_,d)=>{
                              const active=congeMap.get(ds(mi,d+1))?.zone_c;
                              return <td key={d} style={{ padding:0, border:"1px solid #eee", background:active?"#4caf50":"white", height:3 }} />;
                            })}
                          </tr>
                        )}
                      </thead>
                      <tbody>
                        {activeConsultants.map((c,ci)=>(
                          <tr key={c.id} style={{ height:28, background:ci%2===0?"#f9f9f9":"white" }}>
                            <td style={{ border:"1px solid #ddd", padding:"0 8px", fontWeight:"bold", color:NAVY, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", background:ci%2===0?"#f0f4f8":"#e8edf2", fontSize:"0.72rem" }}>
                              {c.Nom} {c.Prénom}
                            </td>
                            {Array.from({length:dim},(_,d)=>{
                              const dateStr=ds(mi,d+1);
                              const blocked=isBlocked(dateStr);
                              const aff=getAff(c.id,dateStr);
                              const ferie=ferieMap.get(dateStr);
                              const bg=blocked?GRAY:(aff?.mission?.Color||"white");
                              return (
                                <td key={d} title={ferie||(aff?.mission?`${aff.mission.Code} — ${aff.mission.Mission}`:"")} style={{
                                  border:"1px solid #ddd", padding:0, background:bg,
                                  position:"relative", height:28, textAlign:"center", verticalAlign:"middle", overflow:"hidden",
                                }}>
                                  {!blocked&&aff&&aff.periode!=="journee"&&(
                                    <div style={{ position:"absolute", inset:0, display:"flex" }}>
                                      <div style={{ flex:1, background:aff.periode==="matin"?(aff.mission?.Color||"#eee"):"white", borderRight:"1px solid rgba(0,0,0,0.08)" }} />
                                      <div style={{ flex:1, background:aff.periode==="aprem"?(aff.mission?.Color||"#eee"):"white" }} />
                                    </div>
                                  )}
                                  {aff?.copil&&<CopilCorner />}
                                  {!blocked&&aff?.mission&&(
                                    <span style={{ position:"relative", zIndex:1, fontSize:"0.58rem", fontWeight:"bold", color:aff.mission.TextColor||"#fff" }}>
                                      {aff.mission.Code}
                                    </span>
                                  )}
                                  {ferie&&(
                                    <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                                      <span style={{ fontSize:"0.38rem", color:"#555", textAlign:"center", lineHeight:1.1, padding:"0 1px" }}>{ferie}</span>
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
