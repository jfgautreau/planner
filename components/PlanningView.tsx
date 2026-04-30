"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAccess } from "@/hooks/useAccess";
import { FixedNav } from "@/components/AnnualPlanner";
import { BottomPanel } from "@/components/AnnualPlanner";

type Sultant     = { id: string; Nom: string; Prénom: string };
type Mission     = { id: string; Client: string; Mission: string; Code: string; Color: string; TextColor: string };
type Absence     = { id: string; code: string; nom: string; color: string };
type Affectation = {
  id: string; Date: string; Sultant: string;
  Mission: string|null; Absence: string|null;
  periode: "journee"|"matin"|"aprem"; copil: boolean; distanciel: boolean;
  mission?: Mission|null; absence?: Absence|null;
};
type JourFerie  = { date: string; nom: string };
type CongeJour  = { date: string; zone_a: boolean; zone_b: boolean; zone_c: boolean };

const NAVY = "#1a2744";
const GRAY = "#d0d0d0";
const LS_YEAR = "planner_selected_year";
const months = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const monthsShort = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];

function getAffStyle(aff: Affectation) {
  if (aff.mission) return { bg: aff.mission.Color||"#ccc", text: aff.mission.TextColor||"#fff", code: aff.mission.Code };
  if (aff.absence) return { bg: aff.absence.color||"#ccc", text: "#fff", code: aff.absence.code };
  return { bg:"#eee", text:"#333", code:"?" };
}

// ── Modale affectation rapide ─────────────────────────────────────────────────
function QuickPick({ date, sultantName, missions, absences, defaultPeriode, onPick, onClose }: {
  date: string; sultantName: string;
  missions: Mission[]; absences: Absence[];
  defaultPeriode: "journee"|"matin"|"aprem";
  onPick: (id: string, type: "mission"|"absence", periode: "journee"|"matin"|"aprem") => void;
  onClose: () => void;
}) {
  const [periode, setPeriode] = useState<"journee"|"matin"|"aprem">(defaultPeriode);
  const label = new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR", { weekday:"long", day:"numeric", month:"long" });
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:600 }}
      onClick={e => { if (e.target===e.currentTarget) onClose(); }}>
      <div style={{ background:"white", borderRadius:12, padding:"1.2rem", minWidth:320, maxWidth:"92vw", boxShadow:"0 8px 32px rgba(0,0,0,0.2)", maxHeight:"88vh", overflowY:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"0.5rem" }}>
          <div>
            <h3 style={{ margin:0, fontSize:"0.9rem", textTransform:"capitalize", color:NAVY }}>{label}</h3>
            <div style={{ fontSize:"0.75rem", color:"#888", marginTop:2 }}>{sultantName}</div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", fontSize:"1.2rem", color:"#aaa" }}>✕</button>
        </div>
        <div style={{ display:"flex", gap:"0.4rem", marginBottom:"0.8rem" }}>
          {(["journee","matin","aprem"] as const).map(p => (
            <button key={p} onClick={() => setPeriode(p)} style={{
              flex:1, padding:"0.35rem 0", border:`2px solid ${periode===p?NAVY:"#ccc"}`,
              borderRadius:4, background:periode===p?NAVY:"white",
              color:periode===p?"white":"#555", fontWeight:"bold", cursor:"pointer", fontSize:"0.75rem",
            }}>
              {p==="journee"?"Journée":p==="matin"?"Matin":"Après-midi"}
            </button>
          ))}
        </div>
        <div style={{ fontSize:"0.65rem", color:"#aaa", fontWeight:"bold", textTransform:"uppercase", marginBottom:"0.3rem" }}>Missions</div>
        <div style={{ display:"flex", flexDirection:"column", gap:"0.22rem", marginBottom:"0.6rem" }}>
          {missions.map(m => (
            <button key={m.id} onClick={() => { onPick(m.id, "mission", periode); onClose(); }} style={{
              background:m.Color, color:m.TextColor||"#fff", border:`2px solid ${m.Color}`,
              borderRadius:4, padding:"0.3rem 0.6rem", cursor:"pointer", fontWeight:"bold",
              fontSize:"0.75rem", textAlign:"left",
            }}>
              {m.Code} — {m.Client}
            </button>
          ))}
        </div>
        <div style={{ fontSize:"0.65rem", color:"#aaa", fontWeight:"bold", textTransform:"uppercase", marginBottom:"0.3rem" }}>Absences</div>
        <div style={{ display:"flex", flexDirection:"column", gap:"0.22rem" }}>
          {absences.map(a => (
            <button key={a.id} onClick={() => { onPick(a.id, "absence", periode); onClose(); }} style={{
              background:a.color, color:"#fff", border:`2px solid ${a.color}`,
              borderRadius:4, padding:"0.3rem 0.6rem", cursor:"pointer", fontWeight:"bold", fontSize:"0.75rem", textAlign:"left",
            }}>
              {a.code} — {a.nom}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Modale options (2e clic) ──────────────────────────────────────────────────
function OptionsModal({ date, sultantName, sultantId, affectations, missions, absences, onClose, onChangeAff, onDelete, onCopil, onAddSlot }: {
  date: string; sultantName: string; sultantId: string;
  affectations: Affectation[]; missions: Mission[]; absences: Absence[];
  onClose: () => void;
  onChangeAff: (id: string, type: "mission"|"absence", periode: "journee"|"matin"|"aprem", existingId: string) => void;
  onDelete: (id: string) => void;
  onCopil: (aff: Affectation) => void;
  onAddSlot: (periode: "journee"|"matin"|"aprem") => void;
}) {
  const affs    = affectations.filter(a => a.Date.startsWith(date) && a.Sultant === sultantId);
  const journee = affs.find(a => a.periode==="journee");
  const matin   = affs.find(a => a.periode==="matin");
  const aprem   = affs.find(a => a.periode==="aprem");
  const label   = new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR", { weekday:"long", day:"numeric", month:"long" });
  const [editingAff, setEditingAff] = useState<Affectation|null>(null);
  const optBtn = (color: string): React.CSSProperties => ({
    padding:"0.25rem 0.6rem", border:`2px solid ${color}`, borderRadius:4,
    background:"white", color, cursor:"pointer", fontWeight:"bold", fontSize:"0.72rem",
  });
  if (editingAff) {
    const allOpts = [
      ...missions.map(m => ({ id:m.id, label:`${m.Code} — ${m.Client}`, color:m.Color, textColor:m.TextColor||"#fff", type:"mission" as const })),
      ...absences.map(a => ({ id:a.id, label:`${a.code} — ${a.nom}`, color:a.color, textColor:"#fff", type:"absence" as const })),
    ];
    return (
      <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:600 }}
        onClick={e => { if (e.target===e.currentTarget) { setEditingAff(null); onClose(); } }}>
        <div style={{ background:"white", borderRadius:12, padding:"1.2rem", minWidth:300, maxWidth:"92vw", boxShadow:"0 8px 32px rgba(0,0,0,0.2)", maxHeight:"88vh", overflowY:"auto" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"0.8rem" }}>
            <h3 style={{ margin:0, fontSize:"0.9rem", color:NAVY }}>Changer — {editingAff.periode}</h3>
            <button onClick={() => setEditingAff(null)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:"1.2rem", color:"#aaa" }}>←</button>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:"0.22rem" }}>
            {allOpts.map(o => (
              <button key={o.id} onClick={() => { onChangeAff(o.id, o.type, editingAff.periode, editingAff.id); setEditingAff(null); onClose(); }} style={{
                background:o.color, color:o.textColor, border:`2px solid ${o.color}`, borderRadius:4,
                padding:"0.3rem 0.6rem", cursor:"pointer", fontWeight:"bold", fontSize:"0.75rem", textAlign:"left",
              }}>{o.label}</button>
            ))}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:600 }}
      onClick={e => { if (e.target===e.currentTarget) onClose(); }}>
      <div style={{ background:"white", borderRadius:12, padding:"1.2rem", minWidth:300, maxWidth:"92vw", boxShadow:"0 8px 32px rgba(0,0,0,0.2)", maxHeight:"88vh", overflowY:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"0.8rem" }}>
          <div>
            <h3 style={{ margin:0, fontSize:"0.9rem", textTransform:"capitalize", color:NAVY }}>{label}</h3>
            <div style={{ fontSize:"0.75rem", color:"#888" }}>{sultantName}</div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", fontSize:"1.2rem", color:"#aaa" }}>✕</button>
        </div>
        {affs.map(aff => {
          const st = getAffStyle(aff);
          return (
            <div key={aff.id} style={{ border:"1px solid #eee", borderRadius:8, padding:"0.6rem", marginBottom:"0.5rem" }}>
              <div style={{ display:"flex", alignItems:"center", gap:"0.5rem", marginBottom:"0.4rem" }}>
                <span style={{ background:st.bg, color:st.text, padding:"0.15rem 0.5rem", borderRadius:3, fontWeight:"bold", fontSize:"0.8rem" }}>{st.code}</span>
                <span style={{ fontSize:"0.75rem", color:"#888" }}>{aff.periode==="journee"?"Journée":aff.periode==="matin"?"Matin":"Après-midi"}</span>
              </div>
              <div style={{ display:"flex", gap:"0.4rem", flexWrap:"wrap" }}>
                <button onClick={() => setEditingAff(aff)} style={optBtn("#3498db")}>✏️ Changer</button>
                <button onClick={() => onCopil(aff)} style={{ ...optBtn("#e67e22"), background:aff.copil?"#e67e22":"white", color:aff.copil?"white":"#e67e22" }}>★ COPIL {aff.copil?"✓":""}</button>
                <button onClick={() => { onDelete(aff.id); onClose(); }} style={optBtn("#e74c3c")}>🗑 Supprimer</button>
              </div>
            </div>
          );
        })}
        {!journee && (!matin || !aprem) && (
          <div style={{ borderTop:"1px solid #eee", paddingTop:"0.6rem", marginTop:"0.2rem" }}>
            <div style={{ fontSize:"0.72rem", color:"#aaa", marginBottom:"0.4rem" }}>Ajouter un créneau :</div>
            <div style={{ display:"flex", gap:"0.4rem" }}>
              {!matin  && <button onClick={() => { onAddSlot("matin");   onClose(); }} style={optBtn(NAVY)}>+ Matin</button>}
              {!aprem  && <button onClick={() => { onAddSlot("aprem");   onClose(); }} style={optBtn(NAVY)}>+ Après-midi</button>}
              {!matin && !aprem && <button onClick={() => { onAddSlot("journee"); onClose(); }} style={optBtn(NAVY)}>+ Journée</button>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function PlanningView() {
  const pathname = usePathname();
  const access   = useAccess();

  const [year, setYear] = useState<number>(() => new Date().getFullYear());
  const [month, setMonth] = useState<number>(() => new Date().getMonth());

  const [consultants, setConsultants] = useState<Sultant[]>([]);
  const [missions, setMissions]       = useState<Mission[]>([]);
  const [absences, setAbsences]       = useState<Absence[]>([]);
  const [affectations, setAffectations] = useState<Affectation[]>([]);
  const [joursFeries, setJoursFeries] = useState<JourFerie[]>([]);
  const [conges, setConges]           = useState<CongeJour[]>([]);
  const [loading, setLoading]         = useState(true);
  const todayStr = useMemo(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }, []);

  // Clipboard
  const [clipboard, setClipboard]       = useState<Affectation[]|null>(null);

  // Drag
  const [dragMission, setDragMission] = useState<Mission|null>(null);
  const [dragAbsence, setDragAbsence] = useState<Absence|null>(null);
  const [dragOver, setDragOver]       = useState<{sultantId:string; date:string}|null>(null);

  // Bandeau
  const [panel, setPanel] = useState<{date:string; sultantId:string}|null>(null);

  useEffect(() => { localStorage.setItem(LS_YEAR, String(year)); }, [year]);

  // Chargement initial
  useEffect(() => {
    if (access.loading) return;
    Promise.all([
      supabase.from("Sultant").select("*"),
      supabase.from("Mission").select("*"),
      supabase.from("Absence").select("*"),
    ]).then(([{ data: s }, { data: m }, { data: ab }]) => {
      const all = s || [];
      setConsultants(access.allowedSultantIds === null ? all : all.filter(c => access.allowedSultantIds!.includes(c.id)));
      setMissions(m || []);
      setAbsences(ab || []);
      setLoading(false);
    });
  }, [access.loading, access.allowedSultantIds]);

  // Chargement mois courant
  useEffect(() => {
    const dateMin = `${year}-${String(month+1).padStart(2,"0")}-01`;
    const lastDay = new Date(year, month+1, 0).getDate();
    const dateMax = `${year}-${String(month+1).padStart(2,"0")}-${String(lastDay).padStart(2,"0")}`;
    Promise.all([
      supabase.from("JourFerie").select("date,nom").gte("date", dateMin).lte("date", dateMax),
      supabase.from("CongeJour").select("date,zone_a,zone_b,zone_c").gte("date", dateMin).lte("date", dateMax),
      supabase.from("Affectation")
        .select("id,Date,Mission,Absence,Sultant,periode,copil,mission:Mission(id,Code,Color,TextColor,Client,Mission),absence:Absence(id,code,nom,color)")
        .gte("Date", dateMin).lte("Date", dateMax),
    ]).then(([{ data: jf }, { data: cg }, { data: af }]) => {
      setJoursFeries((jf || []) as JourFerie[]);
      setConges((cg || []) as CongeJour[]);
      setAffectations((af as unknown as Affectation[]) || []);
    });
  }, [year, month]);

  // Jours du mois
  const days = useMemo(() => {
    const nb = new Date(year, month+1, 0).getDate();
    return Array.from({ length: nb }, (_, i) => {
      const d = i + 1;
      const ds = `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
      const dow = new Date(`${ds}T12:00:00`).getDay();
      const ferie = joursFeries.find(j => j.date === ds);
      return { d, ds, dow, ferie, blocked: dow===0 || dow===6 || !!ferie };
    });
  }, [year, month, joursFeries, todayStr]);

  // Lookup affectations O(1)
  const affMap = useMemo(() => {
    const m = new Map<string, Affectation[]>();
    affectations.forEach(a => {
      const key = `${a.Sultant}::${a.Date.slice(0,10)}`;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(a);
    });
    return m;
  }, [affectations]);

  const getAffs = (sultantId: string, ds: string) => affMap.get(`${sultantId}::${ds}`) ?? [];

  const copyDay = useCallback(() => {
    if (!panel) return;
    const affs = affectations.filter(a => a.Date.startsWith(panel.date) && a.Sultant === panel.sultantId);
    if (affs.length > 0) setClipboard(affs);
  }, [panel, affectations]);

  // canWrite pour un consultant
  const canWrite = useCallback((sultantId: string) =>
    access.isAdmin || access.writableSultantIds === null || (access.writableSultantIds?.includes(sultantId) ?? false),
  [access]);

  const pasteDay = useCallback(async () => {
    if (!panel || !clipboard) return;
    for (const aff of clipboard) {
      const cw = canWrite(panel.sultantId);
      if (!cw) continue;
      const payload = aff.mission ? { Mission: aff.mission.id ?? aff.Mission, Absence: null } : { Absence: aff.absence?.id ?? aff.Absence, Mission: null };
      const { data, error } = await supabase.from("Affectation")
        .insert({ Date:panel.date, Sultant:panel.sultantId, periode:aff.periode, copil:aff.copil, distanciel:aff.distanciel, ...payload })
        .select("id,Date,Mission,Absence,Sultant,periode,copil,distanciel,mission:Mission(id,Code,Color,TextColor,Client,Mission),absence:Absence(id,code,nom,color)")
        .single();
      if (!error && data) setAffectations(prev => [...prev, data as unknown as Affectation]);
    }
  }, [panel, clipboard, canWrite, affectations]);

  // Sauvegarder une affectation
  const saveAff = useCallback(async (
    sultantId: string, date: string,
    itemId: string, type: "mission"|"absence",
    periode: "journee"|"matin"|"aprem", existingId?: string
  ) => {
    if (!canWrite(sultantId)) return;
    const payload = type==="mission" ? { Mission:itemId, Absence:null } : { Absence:itemId, Mission:null };
    if (existingId) {
      const { error } = await supabase.from("Affectation").update(payload).eq("id", existingId);
      if (error) return;
      setAffectations(prev => prev.map(a => {
        if (a.id !== existingId) return a;
        return { ...a, ...payload,
          mission: type==="mission" ? missions.find(m => m.id===itemId)||null : null,
          absence: type==="absence" ? absences.find(ab => ab.id===itemId)||null : null };
      }));
    } else {
      const { data, error } = await supabase.from("Affectation")
        .insert({ Date:date, Sultant:sultantId, periode, copil:false, ...payload })
        .select("id,Date,Mission,Absence,Sultant,periode,copil,mission:Mission(id,Code,Color,TextColor,Client,Mission),absence:Absence(id,code,nom,color)")
        .single();
      if (error) return;
      setAffectations(prev => [...prev, data as unknown as Affectation]);
    }
  }, [canWrite, missions, absences]);

  const deleteAff = useCallback(async (id: string) => {
    await supabase.from("Affectation").delete().eq("id", id);
    setAffectations(prev => prev.filter(a => a.id !== id));
  }, []);

  const toggleCopil = useCallback(async (aff: Affectation) => {
    await supabase.from("Affectation").update({ copil: !aff.copil }).eq("id", aff.id);
    setAffectations(prev => prev.map(a => a.id===aff.id ? {...a, copil:!aff.copil} : a));
  }, []);

  // Drop d'une mission sur une cellule
  const handleDrop = useCallback(async (sultantId: string, ds: string) => {
    if (!canWrite(sultantId)) return;
    const affs = affMap.get(`${sultantId}::${ds}`) ?? [];
    const hasJournee = affs.some(a => a.periode==="journee");
    if (hasJournee) return; // déjà occupé
    const id   = dragMission?.id ?? dragAbsence?.id;
    const type = dragMission ? "mission" : "absence";
    if (!id) return;
    await saveAff(sultantId, ds, id, type, "journee");
    setDragMission(null); setDragAbsence(null); setDragOver(null);
  }, [canWrite, affMap, dragMission, dragAbsence, saveAff]);

  // todayStr déjà défini via useMemo
  const navBtn: React.CSSProperties = { padding:"0.3rem 0.6rem", border:"1px solid #ccc", borderRadius:4, cursor:"pointer", background:"white", fontSize:"0.82rem" };

  const DOW_LABELS = ["Di","Lu","Ma","Me","Je","Ve","Sa"];

  if (loading && !access.loading) return (
    <div style={{ paddingTop:58 }}>
      <FixedNav activePath={pathname||"/planning"} role={access.role ?? undefined} />
      <div style={{ padding:"2rem", textAlign:"center", color:"#888" }}>Chargement...</div>
    </div>
  );

  return (
    <div style={{ paddingTop:58, minHeight:"100vh", background:"white", paddingBottom: panel ? 180 : 0 }}>
      <FixedNav activePath={pathname||"/planning"} role={access.role ?? undefined} />

      {/* ── Barre de contrôles ── */}
      <div style={{ display:"flex", alignItems:"center", gap:"0.5rem", padding:"0.5rem 0.8rem", background:"#f0f4f8", borderBottom:"1px solid #ddd", flexWrap:"wrap" }}>
        <button onClick={() => setYear(y => y-1)} style={navBtn}>◀◀</button>
        <button onClick={() => setMonth(m => { if (m===0) { setYear(y=>y-1); return 11; } return m-1; })} style={navBtn}>◀</button>
        <span style={{ fontWeight:"bold", minWidth:140, textAlign:"center", fontSize:"0.95rem" }}>
          {months[month]} {year}
        </span>
        <button onClick={() => setMonth(m => { if (m===11) { setYear(y=>y+1); return 0; } return m+1; })} style={navBtn}>▶</button>
        <button onClick={() => setYear(y => y+1)} style={navBtn}>▶▶</button>
        <button onClick={() => { const now = new Date(); setYear(now.getFullYear()); setMonth(now.getMonth()); }}
          style={{ padding:"0.3rem 0.7rem", background:"#f39c12", color:"white", border:"none", borderRadius:4, cursor:"pointer", fontWeight:"bold", fontSize:"0.82rem", marginLeft:"0.3rem" }}>
          Aujourd&apos;hui
        </button>

        {/* Palette drag & drop */}
        {(access.isAdmin || access.writableSultantIds === null || (access.writableSultantIds?.length ?? 0) > 0) && (
          <div style={{ display:"flex", gap:"0.3rem", flexWrap:"wrap", marginLeft:"auto", alignItems:"center" }}>
            <span style={{ fontSize:"0.7rem", color:"#888" }}>Glisser :</span>
            {missions.map(m => (
              <div key={m.id}
                draggable
                onDragStart={() => { setDragMission(m); setDragAbsence(null); }}
                onDragEnd={() => { setDragMission(null); setDragOver(null); }}
                style={{ background:m.Color, color:m.TextColor||"#fff", padding:"0.15rem 0.5rem", borderRadius:4, fontSize:"0.7rem", fontWeight:"bold", cursor:"grab", userSelect:"none" }}>
                {m.Code}
              </div>
            ))}
            {absences.map(a => (
              <div key={a.id}
                draggable
                onDragStart={() => { setDragAbsence(a); setDragMission(null); }}
                onDragEnd={() => { setDragAbsence(null); setDragOver(null); }}
                style={{ background:a.color, color:"#fff", padding:"0.15rem 0.5rem", borderRadius:4, fontSize:"0.7rem", fontWeight:"bold", cursor:"grab", userSelect:"none" }}>
                {a.code}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Tableau ── */}
      <div style={{ overflowX:"auto", padding:"0.5rem 0.5rem 1rem" }}>
        <table style={{ borderCollapse:"collapse", fontSize:"0.75rem", width:"100%", tableLayout:"fixed" }}>
          <colgroup>
            <col style={{ width:130 }} />
            {days.map(day => <col key={day.ds} style={{ width: day.blocked ? 28 : 52 }} />)}
          </colgroup>
          <thead>
            {/* Ligne numéros de jour */}
            <tr>
              <th style={{ background:NAVY, color:"white", padding:"0.3rem 0.5rem", textAlign:"left", position:"sticky", left:0, zIndex:3, fontSize:"0.75rem" }}>
                Consultant
              </th>
              {days.map(day => {
                const isToday = day.ds === todayStr;
                return (
                  <th key={day.ds} style={{
                    textAlign:"center", padding:"0.2rem 0",
                    background: isToday ? "#111" : day.blocked ? "#c8c8c8" : day.dow===5 ? "#e8f4e8" : "#f0f4f8",
                    color: isToday ? "white" : day.blocked ? "#888" : "#333",
                    fontWeight: isToday ? "bold" : "normal",
                    border:"1px solid #ddd", fontSize:"0.65rem",
                  }}>
                    <div style={{ fontWeight:"bold" }}>{day.d}</div>
                    <div style={{ fontSize:"0.58rem", opacity:0.8 }}>{DOW_LABELS[day.dow]}</div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {consultants.map((sultant, si) => (
              <tr key={sultant.id} style={{ background: si%2===0 ? "white" : "#fafafa" }}>
                {/* Nom consultant */}
                <td style={{
                  padding:"0.3rem 0.6rem", fontWeight:600, fontSize:"0.78rem",
                  borderBottom:"1px solid #eee", borderRight:"2px solid #ddd",
                  position:"sticky", left:0, background: si%2===0 ? "white" : "#fafafa",
                  zIndex:1, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
                }}>
                  {sultant.Nom} {sultant.Prénom}
                </td>

                {/* Cellules jours */}
                {days.map(day => {
                  const affs    = getAffs(sultant.id, day.ds);
                  const hasAffs = affs.length > 0;
                  const journee = affs.find(a => a.periode==="journee");
                  const matin   = affs.find(a => a.periode==="matin");
                  const aprem   = affs.find(a => a.periode==="aprem");
                  const isToday = day.ds === todayStr;
                  const canEdit = canWrite(sultant.id);
                  const isDragTarget = dragOver?.sultantId===sultant.id && dragOver?.date===day.ds;

                  let bg = "transparent";
                  if (day.blocked) bg = GRAY;
                  else if (journee) bg = getAffStyle(journee).bg;
                  else if (isDragTarget) bg = "#e8f4e8";

                  return (
                    <td key={day.ds}
                      onClick={() => {
                        if (day.blocked || !canEdit) return;
                        setPanel({ date:day.ds, sultantId:sultant.id });
                      }}
                      onDragOver={e => { if (!day.blocked && canEdit) { e.preventDefault(); setDragOver({sultantId:sultant.id, date:day.ds}); } }}
                      onDragLeave={() => setDragOver(null)}
                      onDrop={e => { e.preventDefault(); handleDrop(sultant.id, day.ds); }}
                      style={{
                        height:32, padding:0, position:"relative",
                        background: bg,
                        border: isToday ? "2px solid #111" : isDragTarget ? "2px dashed #27ae60" : "1px solid #eee",
                        cursor: canEdit && !day.blocked ? "pointer" : "default",
                        overflow:"hidden",
                      }}
                    >
                      {/* Fériés */}
                      {day.ferie && (
                        <div style={{ fontSize:"0.4rem", color:"#666", textAlign:"center", lineHeight:1.1, padding:"1px 2px", position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                          {day.ferie.nom.slice(0,8)}
                        </div>
                      )}
                      {/* Journée entière */}
                      {!day.blocked && journee && (() => {
                        const st = getAffStyle(journee);
                        return (
                          <div style={{ position:"absolute", inset:0, background:st.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
                            {journee.copil && <span style={{ position:"absolute", top:0, right:0, width:0, height:0, borderStyle:"solid", borderWidth:"0 7px 7px 0", borderColor:`transparent #111 transparent transparent` }} />}
                            <span style={{ color:st.text, fontWeight:"bold", fontSize:"0.62rem" }}>{st.code}</span>
                          </div>
                        );
                      })()}
                      {/* Demi-journées */}
                      {!day.blocked && !journee && (matin||aprem) && (
                        <div style={{ position:"absolute", inset:0, display:"flex" }}>
                          {(() => { const st = matin ? getAffStyle(matin) : null; return (
                            <div style={{ flex:1, background:st?.bg||"#eee", display:"flex", alignItems:"center", justifyContent:"center", borderRight:"1px solid rgba(255,255,255,0.5)", position:"relative" }}>
                              {matin?.copil && <span style={{ position:"absolute", top:0, right:0, width:0, height:0, borderStyle:"solid", borderWidth:"0 5px 5px 0", borderColor:`transparent #111 transparent transparent` }} />}
                              {matin && st && <span style={{ color:st.text, fontWeight:"bold", fontSize:"0.52rem" }}>{st.code}</span>}
                            </div>
                          );})()}
                          {(() => { const st = aprem ? getAffStyle(aprem) : null; return (
                            <div style={{ flex:1, background:st?.bg||"#eee", display:"flex", alignItems:"center", justifyContent:"center", position:"relative" }}>
                              {aprem?.copil && <span style={{ position:"absolute", top:0, right:0, width:0, height:0, borderStyle:"solid", borderWidth:"0 5px 5px 0", borderColor:`transparent #111 transparent transparent` }} />}
                              {aprem && st && <span style={{ color:st.text, fontWeight:"bold", fontSize:"0.52rem" }}>{st.code}</span>}
                            </div>
                          );})()}
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

      {/* Bandeau bas */}
      {panel && (
        <BottomPanel
          date={panel.date}
          sultantName={consultants.find(c=>c.id===panel.sultantId) ? `${consultants.find(c=>c.id===panel.sultantId)!.Nom} ${consultants.find(c=>c.id===panel.sultantId)!.Prénom}` : ""}
          affectations={affectations.filter(a => a.Sultant === panel.sultantId)}
          missions={missions} absences={absences}
          canEdit={canWrite(panel.sultantId)}
          clipboard={clipboard}
          onPick={(id, type, periode) => saveAff(panel.sultantId, panel.date, id, type, periode)}
          onChangeAff={(id, type, periode, existingId) => saveAff(panel.sultantId, panel.date, id, type, periode, existingId)}
          onDelete={deleteAff}
          onCopil={toggleCopil}
          onDistanciel={async (aff) => {
            await supabase.from("Affectation").update({ distanciel:!aff.distanciel }).eq("id",aff.id);
            setAffectations(prev => prev.map(a => a.id===aff.id?{...a,distanciel:!aff.distanciel}:a));
          }}
          onAddSlot={() => {}}
          onCopy={copyDay}
          onPaste={pasteDay}
          onClose={() => setPanel(null)}
        />
      )}
    </div>
  );
}
