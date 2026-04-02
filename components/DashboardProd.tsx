"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { FixedNav } from "@/components/AnnualPlanner";

type Sultant     = { id:string; Nom:string; Prénom:string };
type Mission     = { id:string; Client:string; Mission:string; Code:string; Color:string };
type Affectation = { id:string; Date:string; Sultant:string; periode:string; mission:{ id:string; Client:string; Code:string; Color:string }|null; absence:{ id:string; code:string }|null };
type Objectif    = { sultant_id:string; annee:number; mois:number; jours:number };

const months = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
const NAVY   = "#1a2744";
const LS_YEAR = "planner_selected_year";

function fj(v: number, zero="·"): string {
  if (v===0) return zero;
  return v%1===0 ? String(v) : v.toFixed(1).replace(".",",");
}

type GroupBy = "mission"|"client"|"consultant";

function KPI({ value, label, color }: { value:string|number; label:string; color:string }) {
  return (
    <div style={{ background:color, color:"white", padding:"0.7rem 1.1rem", borderRadius:8, textAlign:"center", minWidth:100 }}>
      <div style={{ fontSize:"1.6rem", fontWeight:"bold", lineHeight:1.1 }}>{value}</div>
      <div style={{ fontSize:"0.72rem", opacity:0.85, marginTop:2 }}>{label}</div>
    </div>
  );
}

export default function DashboardProd() {
  const pathname = usePathname();
  const [year, setYear] = useState<number>(() => {
    if (typeof window!=="undefined") { const s=localStorage.getItem(LS_YEAR); return s?parseInt(s):new Date().getFullYear(); }
    return new Date().getFullYear();
  });
  const [consultants, setConsultants] = useState<Sultant[]>([]);
  const [missions, setMissions]       = useState<Mission[]>([]);
  const [affectations, setAffectations] = useState<Affectation[]>([]);
  const [objectifs, setObjectifs]     = useState<Objectif[]>([]);
  const [loading, setLoading]         = useState(true);
  const [selCon, setSelCon]           = useState<string[]>([]);
  const [selClient, setSelClient]     = useState<string[]>([]);
  const [selMission, setSelMission]   = useState<string[]>([]);
  const [groupBy, setGroupBy]         = useState<GroupBy>("mission");

  useEffect(()=>{ localStorage.setItem(LS_YEAR,String(year)); },[year]);

  useEffect(()=>{
    const load = async ()=>{
      setLoading(true);
      const [{ data:s },{ data:m },{ data:a },{ data:o }] = await Promise.all([
        supabase.from("Sultant").select("*"),
        supabase.from("Mission").select("*"),
        supabase.from("Affectation").select("id,Date,Sultant,periode,mission:Mission(id,Client,Code,Color),absence:Absence(id,code)").gte("Date",`${year}-01-01`).lte("Date",`${year}-12-31`),
        supabase.from("Objectif").select("sultant_id,annee,mois,jours").eq("annee",year),
      ]);
      setConsultants(s||[]); setMissions(m||[]);
      setAffectations((a as unknown as Affectation[])||[]); setObjectifs(o||[]);
      setLoading(false);
    };
    load();
  },[year]);

  const clients = useMemo(()=>Array.from(new Set(missions.map(m=>m.Client))).sort(),[missions]);
  const missionCodes = useMemo(()=>missions.filter((m,i,arr)=>arr.findIndex(x=>x.Code===m.Code)===i).sort((a,b)=>a.Code.localeCompare(b.Code)),[missions]);
  const toggle = useCallback(<T,>(l:T[], x:T)=>l.includes(x)?l.filter(i=>i!==x):[...l,x], []);

  const filteredMissions = useMemo(()=>affectations.filter(a=>{
    if (!a.mission) return false;
    if (selCon.length>0 && !selCon.includes(a.Sultant)) return false;
    if (selClient.length>0 && !selClient.includes(a.mission?.Client??"")) return false;
    if (selMission.length>0 && !selMission.includes(a.mission?.Code??"")) return false;
    return true;
  }),[affectations,selCon,selClient,selMission]);

  const rows = useMemo(()=>{
    const map = new Map<string,{ label:string; color?:string; byMonth:Map<number,number> }>();
    filteredMissions.forEach(a=>{
      const mi=new Date(`${a.Date}T12:00:00`).getMonth();
      let key="",label="",color:string|undefined;
      if (groupBy==="mission")     { key=label=a.mission?.Code??"—"; color=a.mission?.Color; }
      else if (groupBy==="client") { key=label=a.mission?.Client??"—"; }
      else { const c=consultants.find(c=>c.id===a.Sultant); key=a.Sultant; label=c?`${c.Nom} ${c.Prénom}`:"—"; }
      if (!map.has(key)) map.set(key,{ label,color,byMonth:new Map() });
      const row=map.get(key)!;
      row.byMonth.set(mi,(row.byMonth.get(mi)??0)+(a.periode==="journee"?1:0.5));
    });
    return Array.from(map.entries()).map(([key,val])=>({key,...val})).sort((a,b)=>a.label.localeCompare(b.label));
  },[filteredMissions,groupBy,consultants]);

  const objByMonth = useMemo(()=>months.map((_,mi)=>{
    const cons=selCon.length>0?selCon:consultants.map(c=>c.id);
    return objectifs.filter(o=>o.mois===mi+1&&cons.includes(o.sultant_id)).reduce((s,o)=>s+o.jours,0);
  }),[objectifs,selCon,consultants]);

  const realByMonth = useMemo(()=>months.map((_,mi)=>
    filteredMissions.filter(a=>new Date(`${a.Date}T12:00:00`).getMonth()===mi).reduce((s,a)=>s+(a.periode==="journee"?1:0.5),0)
  ),[filteredMissions]);

  const grandReal=realByMonth.reduce((a,b)=>a+b,0);
  const grandObj=objByMonth.reduce((a,b)=>a+b,0);

  const navBtn:React.CSSProperties={ padding:"0.28rem 0.6rem", border:"1px solid #ccc", borderRadius:4, cursor:"pointer", background:"white", fontSize:"0.82rem" };
  const segBtn=(active:boolean):React.CSSProperties=>({ padding:"0.38rem 0.9rem", border:`2px solid ${NAVY}`, borderRadius:4, backgroundColor:active?NAVY:"white", color:active?"white":NAVY, cursor:"pointer", fontWeight:"bold", fontSize:"0.82rem" });
  const pill=(active:boolean,color="#3498db"):React.CSSProperties=>({ padding:"0.22rem 0.65rem", border:`1.5px solid ${color}`, borderRadius:20, backgroundColor:active?color:"white", color:active?"white":color, cursor:"pointer", fontSize:"0.76rem", fontWeight:500 });

  if (loading) return <div style={{ paddingTop:58 }}><FixedNav activePath={pathname||"/dashboard"}/><div style={{ padding:"2rem",textAlign:"center" }}>Chargement...</div></div>;

  return (
    <div style={{ paddingTop:58 }}>
      <FixedNav activePath={pathname||"/dashboard"} />
      <div style={{ padding:"1.2rem 1.5rem", maxWidth:1300, margin:"0 auto" }}>

        <div style={{ display:"flex", alignItems:"center", gap:"0.7rem", marginBottom:"1.2rem", flexWrap:"wrap" }}>
          <h1 style={{ margin:0, fontSize:"1.3rem", color:NAVY }}>📊 Dashboard Production {year}</h1>
          <div style={{ display:"flex", alignItems:"center", gap:"0.4rem", marginLeft:"auto" }}>
            <button onClick={()=>setYear(y=>y-1)} style={navBtn}>◀</button>
            <span style={{ fontWeight:"bold", minWidth:44, textAlign:"center" }}>{year}</span>
            <button onClick={()=>setYear(y=>y+1)} style={navBtn}>▶</button>
          </div>
        </div>

        {/* Segment */}
        <div style={{ marginBottom:"1rem" }}>
          <div style={{ fontSize:"0.72rem", fontWeight:"bold", color:"#888", textTransform:"uppercase", marginBottom:"0.35rem" }}>Regrouper par</div>
          <div style={{ display:"flex", gap:"0.4rem" }}>
            {(["mission","client","consultant"] as GroupBy[]).map(g=>(
              <button key={g} onClick={()=>setGroupBy(g)} style={segBtn(groupBy===g)}>
                {g==="mission"?"📋 Mission":g==="client"?"🏢 Client":"👤 Consultant"}
              </button>
            ))}
          </div>
        </div>

        {/* Filtres */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"1rem", marginBottom:"1.2rem", padding:"0.8rem 1rem", background:"#f8f9fa", borderRadius:8 }}>
          <div>
            <div style={{ fontSize:"0.72rem", fontWeight:"bold", color:"#888", textTransform:"uppercase", marginBottom:"0.35rem" }}>Consultants {selCon.length>0&&<button onClick={()=>setSelCon([])} style={{ marginLeft:6, fontSize:"0.68rem", color:"#e74c3c", background:"none", border:"none", cursor:"pointer" }}>✕</button>}</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:"0.3rem" }}>{consultants.map(c=><button key={c.id} onClick={()=>setSelCon(p=>toggle(p,c.id))} style={pill(selCon.includes(c.id))}>{c.Nom} {c.Prénom}</button>)}</div>
          </div>
          <div>
            <div style={{ fontSize:"0.72rem", fontWeight:"bold", color:"#888", textTransform:"uppercase", marginBottom:"0.35rem" }}>Clients {selClient.length>0&&<button onClick={()=>setSelClient([])} style={{ marginLeft:6, fontSize:"0.68rem", color:"#e74c3c", background:"none", border:"none", cursor:"pointer" }}>✕</button>}</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:"0.3rem" }}>{clients.map(c=><button key={c} onClick={()=>setSelClient(p=>toggle(p,c))} style={pill(selClient.includes(c),"#8e44ad")}>{c}</button>)}</div>
          </div>
          <div>
            <div style={{ fontSize:"0.72rem", fontWeight:"bold", color:"#888", textTransform:"uppercase", marginBottom:"0.35rem" }}>Missions {selMission.length>0&&<button onClick={()=>setSelMission([])} style={{ marginLeft:6, fontSize:"0.68rem", color:"#e74c3c", background:"none", border:"none", cursor:"pointer" }}>✕</button>}</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:"0.3rem" }}>{missionCodes.map(m=><button key={m.Code} onClick={()=>setSelMission(p=>toggle(p,m.Code))} style={{ padding:"0.22rem 0.65rem", border:`1.5px solid ${m.Color}`, borderRadius:20, backgroundColor:selMission.includes(m.Code)?m.Color:"white", color:selMission.includes(m.Code)?"white":m.Color, cursor:"pointer", fontSize:"0.76rem", fontWeight:500 }}>{m.Code}</button>)}</div>
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display:"flex", gap:"1rem", marginBottom:"1.2rem", flexWrap:"wrap" }}>
          <KPI value={fj(grandReal,String(grandReal))} label="jours réalisés" color={NAVY} />
          <KPI value={grandObj>0?fj(grandObj,String(grandObj)):"—"} label="jours prévus" color="#27ae60" />
          {grandObj>0&&<KPI value={Math.round(grandReal/grandObj*100)+"%"} label="taux réalisation" color={grandReal>=grandObj?"#27ae60":"#e67e22"} />}
          <KPI value={rows.length} label={groupBy==="mission"?"missions":groupBy==="client"?"clients":"consultants"} color="#7f8c8d" />
        </div>

        {/* Tableau */}
        {rows.length===0 ? <div style={{ textAlign:"center", color:"#888", padding:"2rem" }}>Aucune donnée.</div> : (
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"0.8rem" }}>
              <thead>
                <tr style={{ backgroundColor:NAVY, color:"white" }}>
                  <th style={{ padding:"0.5rem 0.8rem", textAlign:"left", minWidth:140 }}>{groupBy==="mission"?"Mission":groupBy==="client"?"Client":"Consultant"}</th>
                  {months.map((m,i)=><th key={i} style={{ padding:"0.4rem 0.2rem", textAlign:"center", minWidth:38, fontSize:"0.72rem" }}>{m}</th>)}
                  <th style={{ padding:"0.4rem 0.5rem", textAlign:"center", minWidth:52, borderLeft:"2px solid rgba(255,255,255,0.2)" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row,i)=>{
                  const total=Array.from(row.byMonth.values()).reduce((a,b)=>a+b,0);
                  return (
                    <tr key={row.key} style={{ backgroundColor:i%2===0?"#f9f9f9":"white" }}>
                      <td style={{ padding:"0.4rem 0.8rem", fontWeight:500 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:"0.4rem" }}>
                          {row.color&&<span style={{ display:"inline-block", width:10, height:10, borderRadius:2, backgroundColor:row.color }} />}
                          {row.label}
                        </div>
                      </td>
                      {months.map((_,mi)=>{ const v=row.byMonth.get(mi)??0; return <td key={mi} style={{ padding:"0.4rem 0.2rem", textAlign:"center", color:v===0?"#ddd":"#000", fontWeight:v>0?"600":"normal", fontSize:"0.78rem" }}>{fj(v)}</td>; })}
                      <td style={{ padding:"0.4rem 0.5rem", textAlign:"center", fontWeight:"bold", borderLeft:"2px solid #eee", backgroundColor:row.color?`${row.color}18`:"#eef2ff" }}>{fj(total)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ backgroundColor:"#34495e", color:"white", fontWeight:"bold" }}>
                  <td style={{ padding:"0.5rem 0.8rem" }}>✅ Réalisé</td>
                  {realByMonth.map((v,i)=><td key={i} style={{ padding:"0.4rem 0.2rem", textAlign:"center", fontSize:"0.78rem" }}>{fj(v)}</td>)}
                  <td style={{ padding:"0.4rem 0.5rem", textAlign:"center", borderLeft:"2px solid rgba(255,255,255,0.2)" }}>{fj(grandReal)}</td>
                </tr>
                <tr style={{ backgroundColor:"#27ae60", color:"white", fontWeight:"bold" }}>
                  <td style={{ padding:"0.5rem 0.8rem" }}>🎯 Prévu</td>
                  {objByMonth.map((v,i)=><td key={i} style={{ padding:"0.4rem 0.2rem", textAlign:"center", fontSize:"0.78rem" }}>{v>0?fj(v):"·"}</td>)}
                  <td style={{ padding:"0.4rem 0.5rem", textAlign:"center", borderLeft:"2px solid rgba(255,255,255,0.2)" }}>{grandObj>0?fj(grandObj):"—"}</td>
                </tr>
                {grandObj>0&&(
                  <tr style={{ backgroundColor:NAVY, color:"white", fontWeight:"bold" }}>
                    <td style={{ padding:"0.5rem 0.8rem" }}>📊 Écart</td>
                    {realByMonth.map((v,i)=>{ const e=v-(objByMonth[i]??0); const h=(objByMonth[i]??0)>0; return <td key={i} style={{ padding:"0.4rem 0.2rem", textAlign:"center", fontSize:"0.75rem", color:h?(e>=0?"#7dcea0":"#f1948a"):"rgba(255,255,255,0.3)" }}>{h?(e>=0?`+${fj(e)}`:fj(e)):"·"}</td>; })}
                    <td style={{ padding:"0.4rem 0.5rem", textAlign:"center", borderLeft:"2px solid rgba(255,255,255,0.2)", color:(grandReal-grandObj)>=0?"#7dcea0":"#f1948a" }}>{(grandReal-grandObj)>=0?`+${fj(grandReal-grandObj)}`:fj(grandReal-grandObj)}</td>
                  </tr>
                )}
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
