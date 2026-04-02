"use client";

import React, { useEffect, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAccess } from "@/hooks/useAccess";

type Sultant     = { id: string; Nom: string; Prénom: string };
type Mission     = { id: string; Client: string; Mission: string; Code: string; Color: string; TextColor: string };
type Absence     = { id: string; code: string; nom: string; color: string };
type Affectation = {
  id: string; Date: string; Sultant: string;
  Mission: string|null; Absence: string|null;
  periode: "journee"|"matin"|"aprem"; copil: boolean;
  mission?: Mission|null; absence?: Absence|null;
};
type JourFerie = { date: string; nom: string };
type CongeJour = { date: string; zone_a: boolean; zone_b: boolean; zone_c: boolean; nom_vacances: string };

const months    = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const quarters  = [{ label:"Q1", m:[0,1,2] },{ label:"Q2", m:[3,4,5] },{ label:"Q3", m:[6,7,8] },{ label:"Q4", m:[9,10,11] }];
const GRAY      = "#d0d0d0";
const NAVY      = "#1a2744";
const ZONE_COLORS = { A:"#ff9800", B:"#2196f3", C:"#4caf50" };
const LS_CON    = "planner_selected_consultant";
const LS_YEAR   = "planner_selected_year";

// Numéro de semaine ISO
function getWeekNum(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function CopilCorner() {
  return <span style={{ position:"absolute", top:0, right:0, width:0, height:0, borderStyle:"solid", borderWidth:"0 9px 9px 0", borderColor:"transparent #111 transparent transparent", zIndex:3, pointerEvents:"none" }} />;
}
function Sw({ bg }: { bg: string }) {
  return <span style={{ display:"inline-block", width:11, height:11, background:bg, border:"1px solid #ccc", marginRight:3, verticalAlign:"middle", borderRadius:2 }} />;
}
function getAffStyle(aff: Affectation) {
  if (aff.mission) return { bg: aff.mission.Color||"#ccc", text: aff.mission.TextColor||"#fff", code: aff.mission.Code };
  if (aff.absence) return { bg: aff.absence.color||"#ccc", text: "#fff", code: aff.absence.code };
  return { bg:"#eee", text:"#333", code:"?" };
}

// ── Navbar fixe ──────────────────────────────────────────────────────────────
export function FixedNav({ activePath }: { activePath: string }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const s = (path: string): React.CSSProperties => ({
    padding:"0.45rem 1rem", border:"none", borderRadius:4, cursor:"pointer",
    background: activePath===path ? "white" : "transparent",
    color: activePath===path ? NAVY : "rgba(255,255,255,0.8)",
    fontWeight:"bold", fontSize:"0.82rem",
  });
  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };
  const navLinks = [
    { path:"/",             label:"📆 Calendrier" },
    { path:"/client",       label:"👥 Vue Client" },
    { path:"/dashboardprod",label:"📊 TdB Prod" },
    { path:"/dashboardrh",  label:"📊 TdB RH" },
    { path:"/settings",     label:"⚙️ Paramètres" },
  ];
  return (
    <>
      <div style={{ position:"fixed", top:0, left:0, right:0, height:46, background:NAVY, display:"flex", alignItems:"center", padding:"0 1rem", gap:"0.3rem", zIndex:500, boxShadow:"0 2px 8px rgba(0,0,0,0.3)" }}>
        <span style={{ color:"white", fontWeight:"bold", fontSize:"1rem", marginRight:"0.8rem" }}>📅 Planner</span>
        {/* Desktop : liens visibles */}
        <div style={{ display:"flex", gap:"0.3rem", flex:1 }} className="nav-desktop">
          {navLinks.map(l => (
            <button key={l.path} onClick={() => router.push(l.path)} style={s(l.path)}>{l.label}</button>
          ))}
        </div>
        {/* Déconnexion desktop */}
        <button onClick={logout} className="nav-desktop" style={{ marginLeft:"auto", padding:"0.3rem 0.8rem", background:"#82B2C0", color:"white", border:"none", borderRadius:4, cursor:"pointer", fontSize:"0.78rem", fontWeight:"bold" }}>
          🚪 Déconnexion
        </button>
        {/* Hamburger mobile */}
        <button onClick={() => setMenuOpen(o => !o)} className="nav-mobile" style={{ marginLeft:"auto", background:"none", border:"none", color:"white", fontSize:"1.5rem", cursor:"pointer", padding:"0.2rem 0.4rem", lineHeight:1 }}>
          {menuOpen ? "✕" : "☰"}
        </button>
      </div>
      {/* Menu mobile déroulant */}
      {menuOpen && (
        <div className="nav-mobile" style={{ position:"fixed", top:46, left:0, right:0, background:NAVY, zIndex:499, boxShadow:"0 4px 12px rgba(0,0,0,0.3)", borderTop:"1px solid rgba(255,255,255,0.1)" }}>
          {navLinks.map(l => (
            <button key={l.path} onClick={() => { router.push(l.path); setMenuOpen(false); }} style={{
              display:"block", width:"100%", padding:"0.9rem 1.2rem", border:"none", borderBottom:"1px solid rgba(255,255,255,0.08)",
              background: activePath===l.path ? "rgba(255,255,255,0.15)" : "transparent",
              color:"white", fontWeight: activePath===l.path ? "bold" : "normal",
              cursor:"pointer", fontSize:"0.95rem", textAlign:"left",
            }}>{l.label}</button>
          ))}
          <button onClick={logout} style={{ display:"block", width:"100%", padding:"0.9rem 1.2rem", border:"none", background:"transparent", color:"#f1948a", cursor:"pointer", fontSize:"0.95rem", textAlign:"left", fontWeight:"bold" }}>
            🚪 Déconnexion
          </button>
        </div>
      )}
      <style>{`
        @media (min-width: 640px) { .nav-mobile { display: none !important; } }
        @media (max-width: 639px) { .nav-desktop { display: none !important; } }
      `}</style>
    </>
  );
}

// ── Modale de premier clic : choisir mission (1 clic = validé) ───────────────
type QuickPickProps = {
  date: string; missions: Mission[]; absences: Absence[];
  defaultPeriode: "journee"|"matin"|"aprem";
  onPick: (id: string, type: "mission"|"absence", periode: "journee"|"matin"|"aprem") => void;
  onClose: () => void;
};
function QuickPick({ date, missions, absences, defaultPeriode, onPick, onClose }: QuickPickProps) {
  const [periode, setPeriode] = useState<"journee"|"matin"|"aprem">(defaultPeriode);
  const label = new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR",{ weekday:"long", day:"numeric", month:"long" });
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:600 }}
      onClick={e => { if (e.target===e.currentTarget) onClose(); }}>
      <div style={{ background:"white", borderRadius:12, padding:"1.2rem", minWidth:320, maxWidth:"92vw", boxShadow:"0 8px 32px rgba(0,0,0,0.2)", maxHeight:"88vh", overflowY:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"0.8rem" }}>
          <h3 style={{ margin:0, fontSize:"0.9rem", textTransform:"capitalize", color:NAVY }}>{label}</h3>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", fontSize:"1.2rem", color:"#aaa" }}>✕</button>
        </div>

        {/* Choix période */}
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

        {/* Missions — 1 clic = validé */}
        <div style={{ fontSize:"0.65rem", color:"#aaa", fontWeight:"bold", textTransform:"uppercase", marginBottom:"0.3rem" }}>Missions</div>
        <div style={{ display:"flex", flexDirection:"column", gap:"0.22rem", marginBottom:"0.6rem" }}>
          {missions.map(m => (
            <button key={m.id} onClick={() => { onPick(m.id, "mission", periode); onClose(); }} style={{
              background:m.Color, color:m.TextColor||"#fff",
              border:`2px solid ${m.Color}`, borderRadius:4,
              padding:"0.3rem 0.6rem", cursor:"pointer", fontWeight:"bold",
              fontSize:"0.75rem", textAlign:"left", display:"flex", alignItems:"center", gap:6,
            }}>
              <span style={{ display:"inline-block", width:9, height:9, borderRadius:2, background:m.TextColor||"#fff", opacity:0.6, flexShrink:0 }} />
              {m.Code} — {m.Client}
            </button>
          ))}
        </div>

        <div style={{ fontSize:"0.65rem", color:"#aaa", fontWeight:"bold", textTransform:"uppercase", marginBottom:"0.3rem" }}>Absences</div>
        <div style={{ display:"flex", flexDirection:"column", gap:"0.22rem" }}>
          {absences.map(a => (
            <button key={a.id} onClick={() => { onPick(a.id, "absence", periode); onClose(); }} style={{
              background:a.color, color:"#fff",
              border:`2px solid ${a.color}`, borderRadius:4,
              padding:"0.3rem 0.6rem", cursor:"pointer", fontWeight:"bold",
              fontSize:"0.75rem", textAlign:"left", display:"flex", alignItems:"center", gap:6,
            }}>
              <span style={{ display:"inline-block", width:9, height:9, borderRadius:2, background:"rgba(255,255,255,0.5)", flexShrink:0 }} />
              {a.code} — {a.nom}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Modale d'options (2e clic sur case déjà affectée) ────────────────────────
type OptionsModalProps = {
  date: string; affectations: Affectation[];
  missions: Mission[]; absences: Absence[];
  onClose: () => void;
  onChangeAff: (id: string, type: "mission"|"absence", periode: "journee"|"matin"|"aprem", existingId: string) => void;
  onDelete: (id: string) => void;
  onCopil: (aff: Affectation) => void;
  onAddSlot: (periode: "journee"|"matin"|"aprem") => void;
};
function OptionsModal({ date, affectations, missions, absences, onClose, onChangeAff, onDelete, onCopil, onAddSlot }: OptionsModalProps) {
  const affs    = affectations.filter(a => a.Date.startsWith(date));
  const journee = affs.find(a => a.periode==="journee");
  const matin   = affs.find(a => a.periode==="matin");
  const aprem   = affs.find(a => a.periode==="aprem");
  const label   = new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR",{ weekday:"long", day:"numeric", month:"long" });
  const [editingAff, setEditingAff] = useState<Affectation|null>(null);
  const [editPeriode, setEditPeriode] = useState<"journee"|"matin"|"aprem">("journee");

  if (editingAff) {
    // Sous-vue : changer la mission de cette affectation
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
                padding:"0.3rem 0.6rem", cursor:"pointer", fontWeight:"bold", fontSize:"0.75rem",
                textAlign:"left", display:"flex", alignItems:"center", gap:6,
              }}>
                <span style={{ display:"inline-block", width:9, height:9, borderRadius:2, background:"rgba(255,255,255,0.5)", flexShrink:0 }} />
                {o.label}
              </button>
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
          <h3 style={{ margin:0, fontSize:"0.9rem", textTransform:"capitalize", color:NAVY }}>{label}</h3>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", fontSize:"1.2rem", color:"#aaa" }}>✕</button>
        </div>

        {/* Affectations existantes */}
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
                <button onClick={() => { onCopil(aff); }} style={{ ...optBtn("#e67e22"), background:aff.copil?"#e67e22":"white", color:aff.copil?"white":"#e67e22" }}>
                  ★ COPIL {aff.copil?"✓":""}
                </button>
                <button onClick={() => { onDelete(aff.id); onClose(); }} style={optBtn("#e74c3c")}>🗑 Supprimer</button>
              </div>
            </div>
          );
        })}

        {/* Ajouter un créneau supplémentaire */}
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
const optBtn = (color: string): React.CSSProperties => ({
  padding:"0.25rem 0.6rem", border:`2px solid ${color}`, borderRadius:4,
  background:"white", color, cursor:"pointer", fontWeight:"bold", fontSize:"0.72rem",
});


// ── Hook mobile ───────────────────────────────────────────────────────────────
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

// ── Vue mobile : grille mois compacte ────────────────────────────────────────
type MobileCalViewProps = {
  year: number; affectations: Affectation[];
  joursFeries: JourFerie[]; conges: CongeJour[];
  selectedCon: string; canEdit: boolean;
  onFirstClick: (ds: string, hasAffs: boolean) => void;
};

function MobileCalView({ year, affectations, joursFeries, conges, selectedCon, canEdit, onFirstClick }: MobileCalViewProps) {
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth());
  const dim = (mi: number) => new Date(year, mi + 1, 0).getDate();
  const ds  = (mi: number, d: number) => `${year}-${String(mi+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  const getAffs = (s: string) => affectations.filter(a => a.Date.startsWith(s));
  const getJF   = (s: string) => joursFeries.find(j => j.date === s);
  const congeMap = React.useMemo(() => { const m = new Map<string,CongeJour>(); conges.forEach(c => m.set(c.date, c)); return m; }, [conges]);

  const mi = currentMonth;
  const firstDow = new Date(`${ds(mi,1)}T12:00:00`).getDay(); // 0=dim
  const startOffset = firstDow === 0 ? 6 : firstDow - 1; // lundi en premier
  const days = Array.from({ length: dim(mi) }, (_, i) => i + 1);

  const navBtn: React.CSSProperties = { padding:"0.4rem 0.8rem", border:"none", background:"transparent", fontSize:"1.2rem", cursor:"pointer", color:NAVY };

  return (
    <div style={{ padding:"0 0.5rem 1rem" }}>
      {/* Sélecteur de mois */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"0.8rem", padding:"0.3rem 0" }}>
        <button onClick={() => setCurrentMonth(m => m === 0 ? 11 : m - 1)} style={navBtn}>◀</button>
        <span style={{ fontWeight:"bold", fontSize:"1.1rem", color:NAVY }}>{months[mi]} {year}</span>
        <button onClick={() => setCurrentMonth(m => m === 11 ? 0 : m + 1)} style={navBtn}>▶</button>
      </div>

      {/* En-têtes jours de la semaine */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2, marginBottom:2 }}>
        {["L","M","M","J","V","S","D"].map((d,i) => (
          <div key={i} style={{ textAlign:"center", fontSize:"0.72rem", fontWeight:"bold", color:i>=5?"#e74c3c":"#555", padding:"0.2rem 0" }}>{d}</div>
        ))}
      </div>

      {/* Grille jours */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:2 }}>
        {/* Cases vides avant le 1er */}
        {Array.from({ length: startOffset }, (_,i) => (
          <div key={`e${i}`} />
        ))}

        {days.map(dayNum => {
          const dateStr = ds(mi, dayNum);
          const dow     = new Date(`${dateStr}T12:00:00`).getDay();
          const isWeekend = dow === 0 || dow === 6;
          const ferie   = getJF(dateStr);
          const conge   = congeMap.get(dateStr);
          const blocked = isWeekend || !!ferie;
          const affs    = getAffs(dateStr);
          const hasAffs = affs.length > 0;
          const journee = affs.find(a => a.periode === "journee");
          const matin   = affs.find(a => a.periode === "matin");
          const aprem   = affs.find(a => a.periode === "aprem");
          const today   = new Date().toISOString().slice(0,10);
          const isToday = dateStr === today;
          const zA = conge?.zone_a || false;
          const zB = conge?.zone_b || false;
          const zC = conge?.zone_c || false;
          const hasZone = zA || zB || zC;

          let bg = "white";
          if (blocked) bg = "#e8e8e8";

          return (
            <div
              key={dayNum}
              onClick={() => { if (!blocked && selectedCon && canEdit) onFirstClick(dateStr, hasAffs); }}
              style={{
                borderRadius:6,
                border: isToday ? `2px solid ${NAVY}` : "1px solid #e0e0e0",
                background: bg,
                minHeight:52,
                cursor: selectedCon && !blocked ? "pointer" : "default",
                overflow:"hidden",
                position:"relative",
                display:"flex",
                flexDirection:"column",
              }}
            >
              {/* Numéro du jour */}
              <div style={{
                fontSize:"0.7rem", fontWeight: isToday ? "bold" : "normal",
                color: blocked ? "#aaa" : isToday ? NAVY : "#333",
                padding:"2px 4px",
                lineHeight:1,
              }}>{dayNum}</div>

              {/* Indicateur zones vacances (bande colorée fine en haut) */}
              {hasZone && !blocked && (
                <div style={{ display:"flex", height:3, position:"absolute", top:0, left:0, right:0 }}>
                  {zA && <div style={{ flex:1, background:ZONE_COLORS.A }} />}
                  {zB && <div style={{ flex:1, background:ZONE_COLORS.B }} />}
                  {zC && <div style={{ flex:1, background:ZONE_COLORS.C }} />}
                </div>
              )}

              {/* Jour férié */}
              {ferie && (
                <div style={{ fontSize:"0.48rem", color:"#888", padding:"0 3px", lineHeight:1.2, flex:1 }}>
                  {ferie.nom.slice(0,12)}
                </div>
              )}

              {/* Affectation journée entière */}
              {!blocked && journee && (() => {
                const st = getAffStyle(journee);
                return (
                  <div style={{ flex:1, background:st.bg, display:"flex", alignItems:"center", justifyContent:"center", position:"relative", margin:"1px", borderRadius:4 }}>
                    {journee.copil && <CopilCorner />}
                    <span style={{ color:st.text, fontWeight:"bold", fontSize:"0.65rem" }}>{st.code}</span>
                  </div>
                );
              })()}

              {/* Demi-journées */}
              {!blocked && !journee && (matin || aprem) && (
                <div style={{ display:"flex", flex:1, margin:"1px", gap:1 }}>
                  {(() => { const st = matin ? getAffStyle(matin) : null; return (
                    <div style={{ flex:1, background:st?.bg||"#f0f0f0", borderRadius:3, display:"flex", alignItems:"center", justifyContent:"center", position:"relative" }}>
                      {matin?.copil && <CopilCorner />}
                      {matin && st && <span style={{ color:st.text, fontWeight:"bold", fontSize:"0.55rem" }}>{st.code}</span>}
                    </div>
                  );})()}
                  {(() => { const st = aprem ? getAffStyle(aprem) : null; return (
                    <div style={{ flex:1, background:st?.bg||"#f0f0f0", borderRadius:3, display:"flex", alignItems:"center", justifyContent:"center", position:"relative" }}>
                      {aprem?.copil && <CopilCorner />}
                      {aprem && st && <span style={{ color:st.text, fontWeight:"bold", fontSize:"0.55rem" }}>{st.code}</span>}
                    </div>
                  );})()}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── CalView ──────────────────────────────────────────────────────────────────
type CalViewProps = {
  year: number; affectations: Affectation[];
  joursFeries: JourFerie[]; conges: CongeJour[];
  selectedCon: string; canEdit: boolean;
  onFirstClick: (ds: string, hasAffs: boolean) => void;
};

function CalView({ year, affectations, joursFeries, conges, selectedCon, canEdit, onFirstClick }: CalViewProps) {
  const dim = (mi: number) => new Date(year, mi+1, 0).getDate();
  const ds  = (mi: number, d: number) => `${year}-${String(mi+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  const getAffs = (s: string) => affectations.filter(a => a.Date.startsWith(s));
  const getJF   = (s: string) => joursFeries.find(j => j.date===s);

  // Map date → CongeJour pour lookup O(1)
  const congeMap = React.useMemo(() => {
    const m = new Map<string, CongeJour>();
    conges.forEach(c => m.set(c.date, c));
    return m;
  }, [conges]);

  const getConge = (dateStr: string) => congeMap.get(dateStr);

  return (
    <div style={{ overflowX:"auto", width:"100%" }}>
      <table style={{ borderCollapse:"collapse", fontSize:"0.67rem", width:"100%", tableLayout:"fixed" }}>
        <colgroup>
          {quarters.map(q => (
            <React.Fragment key={q.label}>
              {q.m.map(mi => (
                <React.Fragment key={mi}>
                  <col style={{ width:18 }} />{/* numéro jour */}
                  <col style={{ width:22 }} />{/* numéro semaine */}
                  <col style={{ width:20 }} />{/* libellé jour */}
                  <col style={{ width:16 }} />{/* zones A/B/C */}
                  <col />{/* mission */}
                </React.Fragment>
              ))}
            </React.Fragment>
          ))}
        </colgroup>
        <thead>
          {/* Trimestres */}
          <tr>
            {quarters.map((q, qi) => {
              const qColors = [
                { bg:"#1565c0", text:"white" },
                { bg:"#2e7d32", text:"white" },
                { bg:"#e65100", text:"white" },
                { bg:"#4a148c", text:"white" },
              ];
              return (
                <th key={q.label} colSpan={q.m.length*5} style={{
                  background: qColors[qi].bg, color: qColors[qi].text,
                  textAlign:"center", border:"1px solid #222",
                  padding:"4px", fontSize:"0.78rem", fontWeight:"bold", letterSpacing:"0.1em",
                }}>{q.label}</th>
              );
            })}
          </tr>
          <tr>
            {quarters.map((q, qi) => {
              const mColors = [
                ["#1976d2","#1565c0","#0d47a1"],
                ["#388e3c","#2e7d32","#1b5e20"],
                ["#f57c00","#e65100","#bf360c"],
                ["#7b1fa2","#6a1b9a","#4a148c"],
              ];
              return (
                <React.Fragment key={q.label}>
                  {q.m.map((mi, i) => (
                    <React.Fragment key={mi}>
                      <th style={{ background:"#eceff1", color:"#78909c", border:"1px solid #ddd", fontSize:"0.52rem", textAlign:"center", fontWeight:"normal" }}>#</th>
                      <th style={{ background:"#37474f", color:"#b0bec5", border:"1px solid #222", fontSize:"0.52rem", textAlign:"center", fontWeight:"normal" }}>S</th>
                      <th colSpan={3} style={{ background: mColors[qi][i], color:"white", textAlign:"center", border:"1px solid #222", padding:"3px", fontSize:"0.72rem", fontWeight:"bold" }}>
                        {months[mi]}
                      </th>
                    </React.Fragment>
                  ))}
                </React.Fragment>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length:31 }, (_,i) => i+1).map(dayNum => (
            <tr key={dayNum} style={{ height:26 }}>
              {quarters.map(q => (
                <React.Fragment key={q.label}>
                  {q.m.map(mi => {
                    // Semaine : calculée pour chaque mois individuellement
                    const weekDate = dayNum <= dim(mi) ? new Date(`${ds(mi, dayNum)}T12:00:00`) : null;
                    const weekNum  = weekDate ? getWeekNum(weekDate) : null;
                    const showWeek = weekDate ? (weekDate.getDay()===1 || dayNum===1) : false;

                    if (dayNum > dim(mi)) return (
                      <React.Fragment key={mi}>
                        <td style={{ background:"#f0f0f0", border:"1px solid #eee" }} />
                        <td style={{ background:"#f0f0f0", border:"1px solid #eee" }} />
                        <td style={{ background:"#f0f0f0", border:"1px solid #eee" }} />
                        <td style={{ background:"#f0f0f0", border:"1px solid #eee" }} />
                        <td style={{ background:"#f0f0f0", border:"1px solid #eee" }} />
                      </React.Fragment>
                    );

                    const dateStr = ds(mi, dayNum);
                    const dow     = new Date(`${dateStr}T12:00:00`).getDay();
                    const label   = ["di","lu","ma","me","je","ve","sa"][dow];
                    const affs    = getAffs(dateStr);
                    const ferie   = getJF(dateStr);
                    const conge   = getConge(dateStr);
                    const zA = conge?.zone_a || false;
                    const zB = conge?.zone_b || false;
                    const zC = conge?.zone_c || false;
                    const blocked = dow===0 || dow===6 || !!ferie;
                    const journee = affs.find(a => a.periode==="journee");
                    const matin   = affs.find(a => a.periode==="matin");
                    const aprem   = affs.find(a => a.periode==="aprem");
                    const hasAffs = affs.length > 0;
                    const jStyle  = journee ? getAffStyle(journee) : null;

                    return (
                      <React.Fragment key={mi}>
                        {/* Numéro du jour */}
                        <td style={{ textAlign:"center", background:"#eceff1", border:"1px solid #ddd", color:"#546e7a", fontSize:"0.58rem", padding:0, fontWeight:"bold" }}>
                          {dayNum}
                        </td>

                        {/* Numéro de semaine */}
                        <td style={{ textAlign:"center", background:"#e8ecf0", border:"1px solid #ddd", color:"#555", fontSize:"0.56rem", padding:0, fontWeight:showWeek?"bold":"normal" }}>
                          {showWeek && weekNum ? `S${weekNum}` : ""}
                        </td>

                        {/* Libellé jour */}
                        <td style={{ background:blocked?"#c8c8c8":"#f0f4f8", border:"1px solid #ddd", textAlign:"center", color:blocked?"#999":"#445", fontSize:"0.6rem", padding:0 }}>
                          {label}
                        </td>

                        {/* Zones A/B/C — 3 bandes verticales */}
                        <td style={{ border:"1px solid #ddd", padding:0, overflow:"hidden", height:"26px" }}>
                          <div style={{ display:"flex", height:"26px", width:"100%" }}>
                            <div style={{ flex:1, background:zA?ZONE_COLORS.A:"white" }} title={zA?"Zone A":""} />
                            <div style={{ flex:1, background:zB?ZONE_COLORS.B:"white" }} title={zB?"Zone B":""} />
                            <div style={{ flex:1, background:zC?ZONE_COLORS.C:"white" }} title={zC?"Zone C":""} />
                          </div>
                        </td>

                        {/* Cellule mission */}
                        <td
                          onClick={() => { if (!blocked && selectedCon && canEdit) onFirstClick(dateStr, hasAffs); }}
                          title={ferie?.nom||(zA||zB||zC?`Zone ${zA?"A":""} ${zB?"B":""} ${zC?"C":""}`.trim():undefined)}
                          style={{ background:blocked?GRAY:(jStyle?.bg||"white"), border:"1px solid #ddd", cursor:selectedCon&&!blocked?"pointer":"default", padding:0, position:"relative", overflow:"hidden" }}
                        >
                          {ferie && (
                            <div style={{ fontSize:"0.4rem", color:"#555", textAlign:"center", padding:"1px 2px", lineHeight:1.1, position:"relative", zIndex:1 }}>
                              {ferie.nom}
                            </div>
                          )}
                          {!blocked && journee && jStyle && (
                            <div style={{ position:"absolute", inset:0, background:jStyle.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
                              {journee.copil && <CopilCorner />}
                              <span style={{ color:jStyle.text, fontWeight:"bold", fontSize:"0.58rem" }}>{jStyle.code}</span>
                            </div>
                          )}
                          {!blocked && !journee && (matin||aprem) && (
                            <div style={{ position:"absolute", inset:0, display:"flex" }}>
                              {(() => { const s=matin?getAffStyle(matin):null; return (
                                <div style={{ flex:1, background:s?.bg||"#e8e8e8", display:"flex", alignItems:"center", justifyContent:"center", position:"relative", borderRight:"1px solid rgba(255,255,255,0.5)" }}>
                                  {matin?.copil && <CopilCorner />}
                                  {matin&&s&&<span style={{ color:s.text, fontWeight:"bold", fontSize:"0.5rem" }}>{s.code}</span>}
                                </div>
                              );})()}
                              {(() => { const s=aprem?getAffStyle(aprem):null; return (
                                <div style={{ flex:1, background:s?.bg||"#e8e8e8", display:"flex", alignItems:"center", justifyContent:"center", position:"relative" }}>
                                  {aprem?.copil && <CopilCorner />}
                                  {aprem&&s&&<span style={{ color:s.text, fontWeight:"bold", fontSize:"0.5rem" }}>{s.code}</span>}
                                </div>
                              );})()}
                            </div>
                          )}
                        </td>
                      </React.Fragment>
                    );
                  })}
                </React.Fragment>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function AnnualPlanner() {
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const access = useAccess();
  const [consultants, setConsultants]   = useState<Sultant[]>([]);
  const [selectedCon, setSelectedCon]   = useState<string>("");
  // canEdit : vrai si admin, ou si writableSultantIds est null (admin),
  // ou si le consultant sélectionné est dans la liste des modifiables
  const canEditSelected = !access.loading && (
    access.isAdmin ||
    access.writableSultantIds === null ||
    (selectedCon !== "" && (access.writableSultantIds?.includes(selectedCon) ?? false))
  );
  const [affectations, setAffectations] = useState<Affectation[]>([]);
  const [missions, setMissions]         = useState<Mission[]>([]);
  const [absences, setAbsences]         = useState<Absence[]>([]);
  const [joursFeries, setJoursFeries]   = useState<JourFerie[]>([]);
  const [conges, setConges] = useState<CongeJour[]>([]);
  const [year, setYear] = useState<number>(() => {
    if (typeof window !== "undefined") { const s = localStorage.getItem(LS_YEAR); return s?parseInt(s):new Date().getFullYear(); }
    return new Date().getFullYear();
  });

  // Modale active : "quick" = premier clic (pas d'aff), "options" = 2e clic (aff existante), "add" = ajouter créneau
  const [modalDate, setModalDate]   = useState<string|null>(null);
  const [modalMode, setModalMode]   = useState<"quick"|"options"|"add">("quick");
  const [addPeriode, setAddPeriode] = useState<"journee"|"matin"|"aprem">("journee");
  const today = new Date().getFullYear();

  useEffect(() => {
    if (access.loading) return;
    if (access.role === "consultant" && access.allowedSultantIds?.length === 1) {
      setSelectedCon(access.allowedSultantIds[0]);
    } else {
      const s = localStorage.getItem(LS_CON);
      if (s) setSelectedCon(s);
    }
  }, [access.loading, access.role, access.allowedSultantIds]);
  useEffect(() => { if (selectedCon) localStorage.setItem(LS_CON, selectedCon); }, [selectedCon]);
  useEffect(() => { localStorage.setItem(LS_YEAR, String(year)); }, [year]);

  useEffect(() => {
    supabase.from("Sultant").select("*").then(({ data }) => {
      const all = data || [];
      if (access.allowedSultantIds === null) {
        setConsultants(all);
      } else {
        setConsultants(all.filter(s => access.allowedSultantIds!.includes(s.id)));
      }
    });
    supabase.from("Mission").select("*").then(({ data }) => setMissions(data||[]));
    supabase.from("Absence").select("*").then(({ data }) => setAbsences(data||[]));
  }, []);

  useEffect(() => {
    supabase.from("JourFerie").select("date,nom")
      .gte("date",`${year}-01-01`).lte("date",`${year}-12-31`)
      .then(({ data }) => setJoursFeries(data||[]));
    supabase.from("CongeJour").select("date,zone_a,zone_b,zone_c,nom_vacances")
      .gte("date",`${year}-01-01`).lte("date",`${year}-12-31`)
      .then(({ data, error }) => {
        if (error) { console.error("CongeJour error:", error); return; }
        console.log(`CongeJour ${year}: ${data?.length} jours`);
        setConges((data||[]) as CongeJour[]);
      });
  }, [year]);

  useEffect(() => {
    if (!selectedCon) return;
    supabase.from("Affectation")
      .select(`id,Date,Mission,Absence,Sultant,periode,copil,mission:Mission(id,Code,Color,TextColor,Client,Mission),absence:Absence(id,code,nom,color)`)
      .eq("Sultant", selectedCon).gte("Date",`${year}-01-01`).lte("Date",`${year}-12-31`)
      .then(({ data }) => setAffectations((data as unknown as Affectation[])||[]));
  }, [selectedCon, year]);

  const handleDayClick = useCallback((ds: string, hasAffs: boolean) => {
    setModalDate(ds);
    setModalMode(hasAffs ? "options" : "quick");
  }, []);

  const saveAff = useCallback(async (
    itemId: string, type: "mission"|"absence",
    periode: "journee"|"matin"|"aprem", existingId?: string
  ) => {
    if (!modalDate || !selectedCon) return;
    const payload = type==="mission" ? { Mission:itemId, Absence:null } : { Absence:itemId, Mission:null };
    if (existingId) {
      const { error } = await supabase.from("Affectation").update(payload).eq("id",existingId);
      if (error) return;
      setAffectations(prev => prev.map(a => {
        if (a.id!==existingId) return a;
        return { ...a, ...payload, mission:type==="mission"?missions.find(m=>m.id===itemId)||null:null, absence:type==="absence"?absences.find(ab=>ab.id===itemId)||null:null };
      }));
    } else {
      const { data, error } = await supabase.from("Affectation")
        .insert({ Date:modalDate, Sultant:selectedCon, periode, copil:false, ...payload })
        .select(`id,Date,Mission,Absence,Sultant,periode,copil,mission:Mission(id,Code,Color,TextColor,Client,Mission),absence:Absence(id,code,nom,color)`)
        .single();
      if (error) return;
      setAffectations(prev => [...prev, data as unknown as Affectation]);
    }
  }, [modalDate, selectedCon, missions, absences]);

  const deleteAff = useCallback(async (id: string) => {
    await supabase.from("Affectation").delete().eq("id",id);
    setAffectations(prev => prev.filter(a => a.id!==id));
  }, []);

  const toggleCopil = useCallback(async (aff: Affectation) => {
    await supabase.from("Affectation").update({ copil:!aff.copil }).eq("id",aff.id);
    setAffectations(prev => prev.map(a => a.id===aff.id?{...a,copil:!aff.copil}:a));
  }, []);

  const subBtn: React.CSSProperties = { padding:"0.3rem 0.6rem", border:"1px solid #ccc", borderRadius:4, cursor:"pointer", background:"white", fontSize:"0.82rem" };

  return (
    <div style={{ paddingTop:58, minHeight:"100vh", background:"white" }}>
      <FixedNav activePath={pathname||"/"} />
      <div style={{ display:"flex", alignItems:"center", gap:"0.5rem", padding:"0.5rem 0.8rem", background:"#f0f4f8", borderBottom:"1px solid #ddd", flexWrap:"wrap" }}>
        {!isMobile && <>
          <button onClick={() => setYear(y=>y-1)} style={subBtn}>◀</button>
          <span style={{ fontWeight:"bold", minWidth:42, textAlign:"center", fontSize:"0.9rem" }}>{year}</span>
          <button onClick={() => setYear(y=>y+1)} style={subBtn}>▶</button>
          {year!==today && <button onClick={() => setYear(today)} style={{ padding:"0.3rem 0.7rem", background:"#f39c12", color:"white", border:"none", borderRadius:4, cursor:"pointer", fontWeight:"bold", fontSize:"0.82rem" }}>Aujourd&apos;hui</button>}
        </>}
        <select value={selectedCon} onChange={e=>setSelectedCon(e.target.value)} disabled={access.role==="consultant"} style={{ padding:"0.3rem 0.6rem", borderRadius:4, border:"1px solid #ccc", fontSize:"0.83rem", flex: isMobile ? 1 : "unset", opacity: access.role==="consultant" ? 0.7 : 1 }}>
          <option value="">-- Consultant --</option>
          {consultants.map(c => <option key={c.id} value={c.id}>{c.Nom} {c.Prénom}</option>)}
        </select>
        {!isMobile && (
          <div style={{ display:"flex", flexWrap:"wrap", gap:"0.6rem", marginLeft:"auto", fontSize:"0.7rem", alignItems:"center" }}>
            <span><Sw bg={GRAY}/>WE/Férié</span>
            {(["A","B","C"] as const).map(z=><span key={z}><Sw bg={ZONE_COLORS[z]}/>Zone {z}</span>)}
            <span style={{ display:"inline-flex", alignItems:"center", gap:3 }}>
              <span style={{ display:"inline-block", width:13, height:13, background:"#eee", border:"1px solid #ccc", position:"relative", overflow:"hidden", verticalAlign:"middle" }}><CopilCorner /></span> COPIL
            </span>
          </div>
        )}
      </div>

      <div style={{ padding: isMobile ? "0.4rem 0.2rem" : "0.8rem 1rem" }}>
        {isMobile
          ? <MobileCalView year={year} affectations={affectations} joursFeries={joursFeries} conges={conges} selectedCon={selectedCon} canEdit={canEditSelected} onFirstClick={handleDayClick} />
          : <CalView year={year} affectations={affectations} joursFeries={joursFeries} conges={conges} selectedCon={selectedCon} canEdit={canEditSelected} onFirstClick={handleDayClick} />
        }
      </div>

      {/* Modale 1er clic : choisir mission */}
      {modalDate && modalMode==="quick" && (
        <QuickPick
          date={modalDate} missions={missions} absences={absences} defaultPeriode="journee"
          onPick={(id, type, periode) => saveAff(id, type, periode)}
          onClose={() => setModalDate(null)}
        />
      )}

      {/* Modale 2e clic : options */}
      {modalDate && modalMode==="options" && (
        <OptionsModal
          date={modalDate} affectations={affectations} missions={missions} absences={absences}
          onClose={() => setModalDate(null)}
          onChangeAff={(id, type, periode, existingId) => saveAff(id, type, periode, existingId)}
          onDelete={deleteAff}
          onCopil={toggleCopil}
          onAddSlot={(periode) => { setAddPeriode(periode); setModalMode("quick"); }}
        />
      )}

      {/* Modale ajout créneau supplémentaire */}
      {modalDate && modalMode==="add" && (
        <QuickPick
          date={modalDate} missions={missions} absences={absences} defaultPeriode={addPeriode}
          onPick={(id, type, periode) => saveAff(id, type, periode)}
          onClose={() => setModalDate(null)}
        />
      )}
    </div>
  );
}
