"use client";

import React, { useEffect, useState, useCallback, useMemo, memo, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAccess, type MenuKey } from "@/hooks/useAccess";

type Sultant     = { id: string; Nom: string; Prénom: string };
type Mission     = { id: string; Client: string; Mission: string; Code: string; Color: string; TextColor: string };
type Absence     = { id: string; code: string; nom: string; color: string };
type Affectation = {
  id: string; Date: string; Sultant: string;
  Mission: string|null; Absence: string|null;
  periode: "journee"|"matin"|"aprem"; copil: boolean; distanciel: boolean; confirmed: boolean; created_at?: string;
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
function DistancielCorner() {
  return <span style={{ position:"absolute", top:0, left:0, width:0, height:0, borderStyle:"solid", borderWidth:"9px 9px 0 0", borderColor:"#2980b9 transparent transparent transparent", zIndex:3, pointerEvents:"none" }} />;
}
function Sw({ bg }: { bg: string }) {
  return <span style={{ display:"inline-block", width:11, height:11, background:bg, border:"1px solid #ccc", marginRight:3, verticalAlign:"middle", borderRadius:2 }} />;
}
export function getAffStyle(aff: Affectation) {
  if (aff.mission) return { bg: aff.mission.Color||"#ccc", text: aff.mission.TextColor||"#fff", code: aff.mission.Code };
  if (aff.absence) return { bg: aff.absence.color||"#ccc", text: "#fff", code: aff.absence.code };
  return { bg:"#eee", text:"#333", code:"?" };
}

// ── Navbar fixe ──────────────────────────────────────────────────────────────
export function FixedNav({ activePath, role, visibleMenus, selectedCon, year, onExportPdf }: { activePath: string; role?: string; visibleMenus?: Set<string>; selectedCon?: string; year?: number; onExportPdf?: () => void }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const s = (path: string): React.CSSProperties => ({
    padding:"0.45rem 1rem", border:"none", borderRadius:4, cursor:"pointer",
    background: activePath===path ? "white" : "transparent",
    color: activePath===path ? NAVY : "rgba(255,255,255,0.8)",
    fontWeight:"bold", fontSize:"0.82rem",
  });
  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    router.push("/login");
  }, [router]);

  const ALL_LINKS: { path: string; label: string; menu: MenuKey }[] = [
    { path:"/",             label:"📆 Calendrier", menu:"calendrier"    },
    { path:"/planning",     label:"▦ Planning",    menu:"planning"      },
    { path:"/client",       label:"👥 Vue Client", menu:"client"        },
    { path:"/dashboardprod",label:"📊 TdB Prod",   menu:"dashboardprod" },
    { path:"/dashboardrh",  label:"📊 TdB RH",     menu:"dashboardrh"   },
    { path:"/settings",     label:"⚙️ Paramètres", menu:"settings"      },
  ];

  // Filtrer selon visibleMenus passé en prop
  const navLinks = visibleMenus
    ? ALL_LINKS.filter(l => visibleMenus.has(l.menu))
    : ALL_LINKS;
  return (
    <>
      <div style={{ position:"fixed", top:0, left:0, right:0, height:46, background:NAVY, display:"flex", alignItems:"center", padding:"0 1rem", gap:"0.3rem", zIndex:500, boxShadow:"0 2px 8px rgba(0,0,0,0.3)" }}>
        <span style={{ display:"flex", alignItems:"center", gap:"0.4rem", marginRight:"0.8rem" }}>
        <img src="/favicon.ico" alt="logo" style={{ width:22, height:22, borderRadius:3 }} />
        <span style={{ color:"white", fontWeight:"bold", fontSize:"1rem" }}>Sultime</span>
      </span>
        {/* Desktop : liens visibles */}
        <div style={{ display:"flex", gap:"0.3rem", flex:1 }} className="nav-desktop">
          {navLinks.map(l => (
            <button key={l.path} onClick={() => router.push(l.path)} style={s(l.path)}>{l.label}</button>
          ))}
        </div>
        {/* Bouton iCal desktop */}
        {selectedCon && (
          <a
            href={`/api/outlook-ical?sultant=${selectedCon}&year=${year ?? new Date().getFullYear()}`}
            download
            className="nav-desktop"
            style={{ marginLeft:"auto", padding:"0.3rem 0.8rem", background:"#27ae60", color:"white", border:"none", borderRadius:4, cursor:"pointer", fontSize:"0.78rem", fontWeight:"bold", textDecoration:"none", display:"inline-flex", alignItems:"center", gap:"0.3rem" }}
          >
            📅 Export ICS
          </a>
        )}
        {/* Bouton PDF desktop */}
        {onExportPdf && (
          <button
            onClick={onExportPdf}
            className="nav-desktop"
            style={{ marginLeft: selectedCon ? "0.5rem" : "auto", padding:"0.3rem 0.8rem", background:"#e74c3c", color:"white", border:"none", borderRadius:4, cursor:"pointer", fontSize:"0.78rem", fontWeight:"bold", display:"inline-flex", alignItems:"center", gap:"0.3rem" }}
          >
            📄 Export PDF
          </button>
        )}
        {/* Déconnexion desktop */}
        <button onClick={logout} className="nav-desktop" style={{ marginLeft: (selectedCon || onExportPdf) ? "0.5rem" : "auto", padding:"0.3rem 0.8rem", background:"#82B2C0", color:"white", border:"none", borderRadius:4, cursor:"pointer", fontSize:"0.78rem", fontWeight:"bold" }}>
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

// ── Bandeau bas fixe 2 lignes ──────────────────────────────────────────────────
type PanelProps = {
  date: string; sultantName: string;
  affectations: Affectation[];
  missions: Mission[]; absences: Absence[];
  canEdit: boolean;
  clipboard: Affectation[] | null;
  onPick: (id: string, type: "mission"|"absence", periode: "journee"|"matin"|"aprem") => void;
  onChangeAff: (id: string, type: "mission"|"absence", periode: "journee"|"matin"|"aprem", existingId: string) => void;
  onDelete: (id: string) => void;
  onCopil: (aff: Affectation) => void;
  onDistanciel: (aff: Affectation) => void;
  onConfirm: (aff: Affectation) => void;
  canConfirm: boolean;
  onAddSlot: (periode: "journee"|"matin"|"aprem") => void;
  onCopy: () => void;
  onPaste: () => void;
  onClose: () => void;
  autoSelect?: boolean;
};

export const PANEL_HEIGHT = 100;

export function BottomPanel({ date, sultantName, affectations, missions, absences, canEdit, clipboard, onPick, onChangeAff, onDelete, onCopil, onDistanciel, onConfirm, canConfirm, onCopy, onPaste, onClose, autoSelect }: PanelProps) {

  const [periode, setPeriode]             = useState<"journee"|"matin"|"aprem">("journee");
  const [selectedAffId, setSelectedAffId] = useState<string|null>(null);

  const affs    = affectations.filter(a => date ? a.Date.startsWith(date) : false);
  const journee = affs.find(a => a.periode === "journee");
  const matin   = affs.find(a => a.periode === "matin");
  const aprem   = affs.find(a => a.periode === "aprem");
  const label   = date ? new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR", { weekday:"long", day:"numeric", month:"long" }) : "";
  // Auto-sélectionner si 1 seule aff (pas besoin de cliquer)
  const selectedAff = affs.find(a => a.id === selectedAffId) ?? (affs.length === 1 ? affs[0] : null);
  const isConfirmed = selectedAff?.confirmed ?? false;

  // Reset quand on change de date
  useEffect(() => {
    setPeriode("journee");
    // Si plusieurs affs → sélectionner la 1ère explicitement
    // Si 1 seule aff → auto-géré par selectedAff (pas besoin de stocker)
    const dayAffs = affectations.filter(a => date ? a.Date.startsWith(date) : false);
    setSelectedAffId(dayAffs.length > 1 ? dayAffs[0].id : null);
  }, [date, autoSelect]);

  // Touche Del = supprimer l'aff sélectionnée
  const selRef = React.useRef<Affectation|null>(null);
  selRef.current = selectedAff;
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Delete" && selRef.current && canEdit) {
        onDelete(selRef.current.id);
        setSelectedAffId(null);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [canEdit, onDelete]);

  const btn = (color: string, active: boolean): React.CSSProperties => ({
    padding:"0.28rem 0.65rem", border:`1.5px solid ${color}`,
    borderRadius:4, background: active ? color : "white",
    color: active ? "white" : color,
    cursor:"pointer", fontWeight:"bold", fontSize:"0.76rem", flexShrink:0,
  });
  const col: React.CSSProperties = {
    display:"flex", flexDirection:"column", gap:"0.28rem", justifyContent:"center",
    padding:"0.3rem 0.7rem", borderRight:"1px solid #e0e0e0", flexShrink:0,
  };

  // Helper : changer la période d'une aff existante
  const doChangePeriode = (aff: Affectation, p: "journee"|"matin"|"aprem") => {
    // Vérifier qu'aucune autre aff n'occupe déjà ce créneau
    const conflit = affs.some(a => a.id !== aff.id && (a.periode === p || a.periode === "journee"));
    const conflitJournee = p === "journee" && affs.some(a => a.id !== aff.id);
    if (conflit || conflitJournee) return;
    const isMission = !!(aff.Mission || aff.mission?.id);
    const itemId = isMission ? (aff.mission?.id ?? aff.Mission ?? "") : (aff.absence?.id ?? aff.Absence ?? "");
    const type: "mission"|"absence" = isMission ? "mission" : "absence";
    onChangeAff(itemId, type, p, aff.id);
  };

  if (!date) return (
    <div style={{ position:"fixed", bottom:0, left:0, right:0, zIndex:600, background:"white", borderTop:"2px solid #1a2744", height: PANEL_HEIGHT, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <span style={{ color:"#aaa", fontSize:"0.8rem" }}>Cliquez sur un jour pour le modifier</span>
    </div>
  );

  // Peut-on affecter sur la période courante ?
  const periodeBloquee = !!journee || affs.some(a => a.periode === periode);

  return (
    <div style={{ position:"fixed", bottom:0, left:0, right:0, zIndex:600, background:"white", borderTop:"2px solid #1a2744", boxShadow:"0 -4px 16px rgba(0,0,0,0.12)", height: PANEL_HEIGHT }}>

      {/* Titre */}
      <div style={{ display:"flex", alignItems:"center", padding:"0.1rem 0.8rem", background:"#1a2744", color:"white", height:18 }}>
        <span style={{ fontWeight:"bold", fontSize:"0.78rem", textTransform:"capitalize" }}>{label}</span>
        {sultantName && <span style={{ fontSize:"0.7rem", opacity:0.65, marginLeft:"0.5rem" }}>— {sultantName}</span>}
        <button onClick={onClose} style={{ marginLeft:"auto", background:"none", border:"none", color:"rgba(255,255,255,0.6)", cursor:"pointer", fontSize:"1rem", lineHeight:1 }}>✕</button>
      </div>

      <div style={{ display:"flex", height: PANEL_HEIGHT - 18, alignItems:"stretch" }}>

        {/* COL 1 : Période
            Sans sélection : choisit la période pour la prochaine affectation
            Avec sélection : change la période de l'aff sélectionnée */}
        <div style={{ ...col, minWidth:100 }}>
          <button onClick={() => {
            if (selectedAff && !isConfirmed) { doChangePeriode(selectedAff, "journee"); }
            else if (!selectedAff)           { setPeriode("journee"); }
          }} style={{ ...btn("#1a2744", selectedAff ? selectedAff.periode === "journee" : periode === "journee"), opacity: isConfirmed ? 0.4 : 1 }}
            disabled={isConfirmed && !!selectedAff}>
            Journée
          </button>
          <div style={{ display:"flex", gap:"0.25rem" }}>
            {(["matin", "aprem"] as const).map(p => (
              <button key={p} onClick={() => {
                if (selectedAff && !isConfirmed) { doChangePeriode(selectedAff, p); }
                else if (!selectedAff)           { setPeriode(p); }
              }} style={{ ...btn("#1a2744", selectedAff ? selectedAff.periode === p : periode === p), opacity: isConfirmed ? 0.4 : 1 }}
                disabled={isConfirmed && !!selectedAff}>
                {p === "matin" ? "Matin" : "A-midi"}
              </button>
            ))}
          </div>
        </div>

        {/* COL 2 : COPIL + Distanciel + Confirmé (sur l'aff sélectionnée) */}
        {canEdit && (
          <div style={col}>
            <button onClick={() => { if (selectedAff && !isConfirmed) onCopil(selectedAff); }}
              style={{ ...btn("#e67e22", !!selectedAff?.copil), opacity: isConfirmed ? 0.4 : 1 }}
              disabled={isConfirmed && !!selectedAff}>★ COPIL</button>
            <button onClick={() => { if (selectedAff && !isConfirmed) onDistanciel(selectedAff); }}
              style={{ ...btn("#2980b9", !!selectedAff?.distanciel), opacity: isConfirmed ? 0.4 : 1 }}
              disabled={isConfirmed && !!selectedAff}>⊟ Dist.</button>
          </div>
        )}
        {canConfirm && selectedAff && (
          <div style={col}>
            <button onClick={() => onConfirm(selectedAff)}
              style={btn("#27ae60", isConfirmed)}>
              {isConfirmed ? "🔒 Confirmé" : "🔓 Confirmer"}
            </button>
          </div>
        )}

        {/* COL 3 : Missions + Absences
            Règles :
            1. Mission COLORÉE (déjà affectée) → clic = sélectionner (2ème clic = désélectionner)
            2. Mission BLANCHE + aff sélectionnée → clic = remplacer la mission de l'aff sélectionnée
            3. Mission BLANCHE + rien sélectionné + période libre → clic = nouvelle affectation */}
        <div style={{ display:"flex", flexDirection:"column", gap:"0.28rem", justifyContent:"center", padding:"0.3rem 0.7rem", borderRight:"1px solid #e0e0e0", flex:1, overflow:"hidden" }}>
          <div style={{ display:"flex", gap:"0.25rem", overflowX:"auto" }}>
            {missions.map(m => {
              const affM   = affs.find(a => (a.mission?.id ?? a.Mission) === m.id);
              const active = !!affM;
              const isSel  = active && selectedAff?.id === affM!.id;
              return (
                <button key={m.id} onClick={() => {
                  if (!canEdit) return;
                  if (active) {
                    // Règle 1 : sélectionner / désélectionner
                    setSelectedAffId(isSel ? null : affM!.id);
                  } else if (selectedAff && !isConfirmed) {
                    // Règle 2 : remplacer la mission (bloqué si confirmé)
                    onChangeAff(m.id, "mission", selectedAff.periode, selectedAff.id);
                    setSelectedAffId(null);
                  } else if (!selectedAff && !periodeBloquee) {
                    // Règle 3 : nouvelle affectation
                    onPick(m.id, "mission", periode);
                  }
                }} style={{
                  background: active ? m.Color : "white",
                  color: active ? (m.TextColor||"#fff") : m.Color,
                  border: `${isSel ? 2.5 : 1.5}px solid ${m.Color}`,
                  borderRadius:4, padding:"0.28rem 0.55rem", cursor:"pointer",
                  fontWeight:"bold", fontSize:"0.76rem", flexShrink:0,
                  opacity: (!active && !selectedAff && periodeBloquee) ? 0.4 : 1,
                }}>{m.Code}</button>
              );
            })}
          </div>
          <div style={{ display:"flex", gap:"0.25rem", overflowX:"auto" }}>
            {absences.map(a => {
              const affA   = affs.find(af => (af.absence?.id ?? af.Absence) === a.id);
              const active = !!affA;
              const isSel  = active && selectedAff?.id === affA!.id;
              return (
                <button key={a.id} onClick={() => {
                  if (!canEdit) return;
                  if (active) {
                    setSelectedAffId(isSel ? null : affA!.id);
                  } else if (selectedAff && !isConfirmed) {
                    onChangeAff(a.id, "absence", selectedAff.periode, selectedAff.id);
                    setSelectedAffId(null);
                  } else if (!selectedAff && !periodeBloquee) {
                    onPick(a.id, "absence", periode);
                  }
                }} style={{
                  background: active ? a.color : "white",
                  color: active ? "#fff" : a.color,
                  border: `${isSel ? 2.5 : 1.5}px solid ${a.color}`,
                  borderRadius:4, padding:"0.28rem 0.55rem", cursor:"pointer",
                  fontWeight:"bold", fontSize:"0.76rem", flexShrink:0,
                  opacity: (!active && !selectedAff && periodeBloquee) ? 0.4 : 1,
                }}>{a.code}</button>
              );
            })}
          </div>
        </div>

        {/* COL historique */}
        {affs.length > 0 && (
          <div style={{ ...col, fontSize:"0.62rem", color:"#888", minWidth:90, gap:"0.15rem" }}>
            {affs.map(aff => {
              const st = getAffStyle(aff);
              const d = aff.created_at ? new Date(aff.created_at).toLocaleDateString("fr-FR", { day:"2-digit", month:"2-digit", year:"2-digit" }) : "—";
              return (
                <div key={aff.id} style={{ display:"flex", alignItems:"center", gap:"0.3rem" }}>
                  <span style={{ background:st.bg, color:st.text, padding:"0.05rem 0.3rem", borderRadius:3, fontWeight:"bold", fontSize:"0.62rem", flexShrink:0 }}>{st.code}</span>
                  <span style={{ fontSize:"0.6rem", color:"#aaa" }}>{aff.periode==="journee"?"J":aff.periode==="matin"?"M":"A"}</span>
                  <span style={{ fontSize:"0.6rem" }}>↗ {d}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* COL 4 : Copier / Coller + Supprimer */}
        {canEdit && (
          <div style={{ ...col, borderRight:"none", flexDirection:"row", alignItems:"center", gap:"0.4rem" }}>
            <div style={{ display:"flex", flexDirection:"column", gap:"0.28rem" }}>
              <button onClick={onCopy} style={btn("#f39c12", false)}>📋 Copier</button>
              <button onClick={onPaste} style={btn("#27ae60", !!clipboard)}>📌 Coller</button>
            </div>
            <button
              onClick={() => { if (selectedAff && !isConfirmed) { onDelete(selectedAff.id); setSelectedAffId(null); } }}
              style={{ ...btn("#e74c3c", false), opacity: isConfirmed ? 0.3 : 1 }}
              disabled={isConfirmed}
              title={isConfirmed ? "Confirmé — suppression bloquée" : "Supprimer (Del)"}>🗑 Suppr</button>
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
  selectedCon: string; canEdit: boolean; canRead: boolean; todayStr: string;
  onFirstClick: (ds: string, hasAffs: boolean, clickedOnAff?: boolean) => void;
};

function MobileCalView({ year, affectations, joursFeries, conges, selectedCon, canEdit, canRead, todayStr, onFirstClick }: MobileCalViewProps) {
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth());
  const dim = (mi: number) => new Date(year, mi + 1, 0).getDate();
  const ds  = (mi: number, d: number) => `${year}-${String(mi+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  const affMap = useMemo(() => {
    const m = new Map<string, Affectation[]>();
    affectations.forEach(a => {
      const key = a.Date.slice(0, 10);
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(a);
    });
    return m;
  }, [affectations]);
  const getAffs = (s: string) => affMap.get(s) ?? [];
  const jfMap   = useMemo(() => { const m = new Map<string,JourFerie>(); joursFeries.forEach(j => m.set(j.date, j)); return m; }, [joursFeries]);
  const getJF   = (s: string) => jfMap.get(s);
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
          const isToday = dateStr === todayStr;
          const zA = conge?.zone_a || false;
          const zB = conge?.zone_b || false;
          const zC = conge?.zone_c || false;
          const hasZone = zA || zB || zC;

          let bg = "white";
          if (blocked) bg = "#e8e8e8";

          return (
            <div
              key={dayNum}
              onClick={() => { if (!blocked && selectedCon && canRead) onFirstClick(dateStr, hasAffs); }}
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
  selectedCon: string; canEdit: boolean; canRead: boolean; todayStr: string; panelOpen: boolean; selectedDate: string|null;
  onFirstClick: (ds: string, hasAffs: boolean, clickedOnAff?: boolean) => void;
  onMoveAff?: (fromDate: string, toDate: string) => void;
  containerRef?: React.RefObject<HTMLDivElement | null>;
};

function CalView({ year, affectations, joursFeries, conges, selectedCon, canEdit, canRead, todayStr, panelOpen, selectedDate, onFirstClick, onMoveAff, containerRef }: CalViewProps) {
  const [dragFrom, setDragFrom] = useState<string|null>(null);
  const dim = (mi: number) => new Date(year, mi+1, 0).getDate();
  const ds  = (mi: number, d: number) => `${year}-${String(mi+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  const affMap = useMemo(() => {
    const m = new Map<string, Affectation[]>();
    affectations.forEach(a => {
      const key = a.Date.slice(0, 10);
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(a);
    });
    return m;
  }, [affectations]);
  const getAffs = (s: string) => affMap.get(s) ?? [];
  const jfMap   = useMemo(() => { const m = new Map<string,JourFerie>(); joursFeries.forEach(j => m.set(j.date, j)); return m; }, [joursFeries]);
  const getJF   = (s: string) => jfMap.get(s);

  // Map date → CongeJour pour lookup O(1)
  const congeMap = React.useMemo(() => {
    const m = new Map<string, CongeJour>();
    conges.forEach(c => m.set(c.date, c));
    return m;
  }, [conges]);

  const getConge = (dateStr: string) => congeMap.get(dateStr);

  return (
    <div ref={containerRef} style={{ width:"100%", height:"100%", overflowX:"auto", overflowY:"hidden" }}>
      <table style={{ borderCollapse:"collapse", fontSize:"0.67rem", width:"100%", height:"100%", tableLayout:"fixed" }}>
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
            <tr key={dayNum}>
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
                    const isToday    = dateStr === todayStr;
                    const isSelected = dateStr === selectedDate;
                    const isMonday   = dow === 1;
                    const isSunday   = dow === 0;
                    const journee = affs.find(a => a.periode==="journee");
                    const matin   = affs.find(a => a.periode==="matin");
                    const aprem   = affs.find(a => a.periode==="aprem");
                    const hasAffs = affs.length > 0;
                    const jStyle  = journee ? getAffStyle(journee) : null;

                    return (
                      <React.Fragment key={mi}>
                        {/* Numéro du jour */}
                        <td style={{ textAlign:"center", background:isToday?"#111":"#eceff1", border:"1px solid #ddd", borderTop: isMonday?"2px solid #9e9e9e":"1px solid #ddd", borderBottom: isSunday?"2px solid #9e9e9e":undefined, color:isToday?"white":"#546e7a", fontSize:"0.58rem", padding:0, fontWeight:"bold" }}>
                          {dayNum}
                        </td>

                        {/* Numéro de semaine */}
                        <td style={{ textAlign:"center", background:"#e8ecf0", border:"1px solid #ddd", borderTop: isMonday?"2px solid #9e9e9e":undefined, borderBottom: isSunday?"2px solid #9e9e9e":undefined, color:"#555", fontSize:"0.56rem", padding:0, fontWeight:showWeek?"bold":"normal" }}>
                          {showWeek && weekNum ? `S${weekNum}` : ""}
                        </td>

                        {/* Libellé jour */}
                        <td style={{ background:isToday?"#111":blocked?"#c8c8c8":"#f0f4f8", border:"1px solid #ddd", borderTop: isMonday?"2px solid #9e9e9e":undefined, borderBottom: isSunday?"2px solid #9e9e9e":undefined, textAlign:"center", color:isToday?"white":blocked?"#999":"#445", fontSize:"0.6rem", padding:0 }}>
                          {label}
                        </td>

                        {/* Zones A/B/C — 3 bandes verticales */}
                        <td style={{ border:"1px solid #ddd", borderTop: isMonday?"2px solid #9e9e9e":undefined, borderBottom: isSunday?"2px solid #9e9e9e":undefined, padding:0, overflow:"hidden" }}>
                          <div style={{ display:"flex", height:"100%", width:"100%" }}>
                            <div style={{ flex:1, background:zA?ZONE_COLORS.A:"white" }} title={zA?"Zone A":""} />
                            <div style={{ flex:1, background:zB?ZONE_COLORS.B:"white" }} title={zB?"Zone B":""} />
                            <div style={{ flex:1, background:zC?ZONE_COLORS.C:"white" }} title={zC?"Zone C":""} />
                          </div>
                        </td>

                        {/* Cellule mission — display:flex direct sur td */}
                        <td
                          title={ferie?.nom||(zA||zB||zC?`Zone ${zA?"A":""} ${zB?"B":""} ${zC?"C":""}`.trim():undefined)}
                          style={{ background:blocked?GRAY:"white", border:"1px solid #ddd", padding:0, position:"relative", overflow:"hidden" }}
                          draggable={!blocked && hasAffs && canEdit && !affs.some(a => a.confirmed)}
                          onDragStart={() => { setDragFrom(dateStr); if (selectedCon && canRead) onFirstClick(dateStr, true, true); }}
                          onDragOver={e => { if (dragFrom && dragFrom !== dateStr && !blocked) e.preventDefault(); }}
                          onDrop={e => { e.preventDefault(); if (dragFrom && dragFrom !== dateStr && onMoveAff) { onMoveAff(dragFrom, dateStr); setDragFrom(null); } }}
                          onClick={() => { if (!blocked && selectedCon && canRead && !journee && !matin && !aprem) onFirstClick(dateStr, false, false); }}
                        >
                          {!blocked && journee && (
                            <div onClick={e => { e.stopPropagation(); if (selectedCon && canRead) onFirstClick(dateStr, true, true); }}
                              style={{ position:"absolute", inset:0, background:jStyle!.bg, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
                              {journee.copil && <CopilCorner />}
                              {journee.distanciel && <DistancielCorner />}
                              <span style={{ color:jStyle!.text, fontWeight:"bold", fontSize:"0.58rem" }}>{jStyle!.code}{journee.confirmed ? " 🔒" : ""}</span>
                            </div>
                          )}
                          {!blocked && !journee && (
                            <div style={{ position:"absolute", inset:0, display:"flex" }}>
                              {(() => { const s=matin?getAffStyle(matin):null; return (
                                <div onClick={e => { e.stopPropagation(); if (selectedCon && canRead) onFirstClick(dateStr, !!matin, !!matin); }}
                                  style={{ flex:1, minWidth:0, background:s?.bg||"transparent", display:"flex", alignItems:"center", justifyContent:"center", position:"relative", borderRight:"1px solid rgba(0,0,0,0.1)", cursor:selectedCon?"pointer":"default" }}>
                                  {matin?.copil && <CopilCorner />}
                                  {matin?.distanciel && <DistancielCorner />}
                                  {matin&&s&&<span style={{ color:s.text, fontWeight:"bold", fontSize:"0.5rem" }}>{s.code}{matin.confirmed ? " 🔒" : ""}</span>}
                                </div>
                              );})()}
                              {(() => { const s=aprem?getAffStyle(aprem):null; return (
                                <div onClick={e => { e.stopPropagation(); if (selectedCon && canRead) onFirstClick(dateStr, !!aprem, !!aprem); }}
                                  style={{ flex:1, minWidth:0, background:s?.bg||"transparent", display:"flex", alignItems:"center", justifyContent:"center", position:"relative", cursor:selectedCon?"pointer":"default" }}>
                                  {aprem?.copil && <CopilCorner />}
                                  {aprem?.distanciel && <DistancielCorner />}
                                  {aprem&&s&&<span style={{ color:s.text, fontWeight:"bold", fontSize:"0.5rem" }}>{s.code}{aprem.confirmed ? " 🔒" : ""}</span>}
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

const subBtn: React.CSSProperties = { padding:"0.3rem 0.6rem", border:"1px solid #ccc", borderRadius:4, cursor:"pointer", background:"white", fontSize:"0.82rem" };

// ── Composant principal ───────────────────────────────────────────────────────
export default function AnnualPlanner() {
  const pathname = usePathname();
  const isMobile = useIsMobile();

  const access = useAccess();
  const [consultants, setConsultants]   = useState<Sultant[]>([]);
  const [selectedCon, setSelectedCon]   = useState<string>("");
  // canEdit : vrai si admin, ou si writableSultantIds est null (admin),
  // ou si le consultant sélectionné est dans la liste des modifiables
  // Peut voir : admin, ou sultant_id dans la liste lisible, ou liste null (admin)
  const canReadSelected = !access.loading && selectedCon !== "" && (
    access.allowedSultantIds === null ||
    access.allowedSultantIds.includes(selectedCon)
  );
  // Peut modifier : admin, ou sultant_id dans la liste modifiable, ou liste null (admin)
  const canEditSelected = !access.loading && selectedCon !== "" && (
    access.writableSultantIds === null ||
    (access.writableSultantIds?.includes(selectedCon) ?? false)
  );
  const [affectations, setAffectations] = useState<Affectation[]>([]);
  const [missions, setMissions]         = useState<Mission[]>([]);
  const [absences, setAbsences]         = useState<Absence[]>([]);
  const [joursFeries, setJoursFeries]   = useState<JourFerie[]>([]);
  const [conges, setConges] = useState<CongeJour[]>([]);
  const [year, setYear] = useState<number>(() => new Date().getFullYear());

  const [panelDate, setPanelDate]         = useState<string|null>(null);
  const [panelAutoSelect, setPanelAutoSelect] = useState(false);
  const [addPeriode, setAddPeriode]   = useState<"journee"|"matin"|"aprem">("journee");
  const [clipboard, setClipboard]     = useState<Affectation[]|null>(null);
  const [todayStr, setTodayStr] = useState("");
  const [todayYear, setTodayYear] = useState(0);
  const calRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const update = () => {
      const d = new Date();
      setTodayStr(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`);
      setTodayYear(d.getFullYear());
    };
    update();
    // Mettre à jour au focus de la fenêtre (retour sur l'onglet)
    window.addEventListener("focus", update);
    // Aussi à minuit
    const now = new Date();
    const msToMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()+1).getTime() - now.getTime();
    const t = setTimeout(() => { update(); }, msToMidnight);
    return () => { window.removeEventListener("focus", update); clearTimeout(t); };
  }, []);

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
    Promise.all([
      supabase.from("Sultant").select("*"),
      supabase.from("Mission").select("*"),
      supabase.from("Absence").select("*"),
    ]).then(([{ data: s }, { data: m }, { data: ab }]) => {
      const all = s || [];
      setConsultants(access.allowedSultantIds === null
        ? all
        : all.filter(su => access.allowedSultantIds!.includes(su.id))
      );
      setMissions(m || []);
      setAbsences(ab || []);
    });
  }, [access.loading, access.allowedSultantIds]);

  useEffect(() => {
    Promise.all([
      supabase.from("JourFerie").select("date,nom").gte("date",`${year}-01-01`).lte("date",`${year}-12-31`),
      supabase.from("CongeJour").select("date,zone_a,zone_b,zone_c,nom_vacances").gte("date",`${year}-01-01`).lte("date",`${year}-12-31`),
    ]).then(([{ data: jf }, { data: cg }]) => {
      setJoursFeries(jf || []);
      setConges((cg || []) as CongeJour[]);
    });
  }, [year]);

  useEffect(() => {
    if (!selectedCon) return;
    supabase.from("Affectation")
      .select(`id,Date,Mission,Absence,Sultant,periode,copil,distanciel,confirmed,created_at,mission:Mission(id,Code,Color,TextColor,Client,Mission),absence:Absence(id,code,nom,color)`)
      .eq("Sultant", selectedCon).gte("Date",`${year}-01-01`).lte("Date",`${year}-12-31`)
      .then(({ data }) => setAffectations((data as unknown as Affectation[])||[]));
  }, [selectedCon, year]);

  const handleDayClick = useCallback((ds: string, hasAffs: boolean, clickedOnAff?: boolean) => {
    setPanelDate(ds);
    // Auto-sélectionner seulement si on a cliqué sur une partie occupée
    setPanelAutoSelect(clickedOnAff ?? hasAffs);
  }, []);

  const saveAff = useCallback(async (
    itemId: string, type: "mission"|"absence",
    periode: "journee"|"matin"|"aprem", existingId?: string
  ) => {
    if (!panelDate || !selectedCon || !canEditSelected) return;
    const payload = type==="mission" ? { Mission:itemId, Absence:null } : { Absence:itemId, Mission:null };
    if (existingId) {
      const updatePayload = { ...payload, periode };
      const { error } = await supabase.from("Affectation").update(updatePayload).eq("id",existingId);
      if (error) return;
      setAffectations(prev => prev.map(a => {
        if (a.id!==existingId) return a;
        return { ...a, ...updatePayload, mission:type==="mission"?missions.find(m=>m.id===itemId)||null:null, absence:type==="absence"?absences.find(ab=>ab.id===itemId)||null:null };
      }));
    } else {
      const { data, error } = await supabase.from("Affectation")
        .insert({ Date:panelDate, Sultant:selectedCon, periode, copil:false, distanciel:false, confirmed:false, ...payload })
        .select(`id,Date,Mission,Absence,Sultant,periode,copil,distanciel,confirmed,created_at,mission:Mission(id,Code,Color,TextColor,Client,Mission),absence:Absence(id,code,nom,color)`)
        .single();
      if (error) return;
      setAffectations(prev => [...prev, data as unknown as Affectation]);
    }
  }, [panelDate, selectedCon, canEditSelected, missions, absences]);

  const moveAff = useCallback(async (fromDate: string, toDate: string) => {
    if (!selectedCon || !canEditSelected) return;
    const fromAffs = affectations.filter(a => a.Date.startsWith(fromDate) && a.Sultant === selectedCon);
    if (fromAffs.length === 0) return;
    if (fromAffs.some(a => a.confirmed)) return; // bloqué si au moins une aff confirmée
    for (const aff of fromAffs) {
      await supabase.from("Affectation").update({ Date: toDate }).eq("id", aff.id);
      setAffectations(prev => prev.map(a => a.id === aff.id ? {...a, Date: toDate} : a));
    }
  }, [selectedCon, canEditSelected, affectations]);

  const deleteAff = useCallback(async (id: string) => {
    await supabase.from("Affectation").delete().eq("id",id);
    setAffectations(prev => prev.filter(a => a.id!==id));
  }, []);

  const toggleCopil = useCallback(async (aff: Affectation) => {
    await supabase.from("Affectation").update({ copil:!aff.copil }).eq("id",aff.id);
    setAffectations(prev => prev.map(a => a.id===aff.id?{...a,copil:!aff.copil}:a));
  }, []);

  const copyDay = useCallback(() => {
    if (!panelDate) return;
    const affs = affectations.filter(a => a.Date.startsWith(panelDate));
    if (affs.length > 0) setClipboard(affs);
  }, [panelDate, affectations]);

  const pasteDay = useCallback(async () => {
    if (!panelDate || !selectedCon || !clipboard || !canEditSelected) return;
    for (const aff of clipboard) {
      const payload = aff.mission ? { Mission: aff.mission.id ?? aff.Mission, Absence: null } : { Absence: aff.absence?.id ?? aff.Absence, Mission: null };
      const { data, error } = await supabase.from("Affectation")
        .insert({ Date:panelDate, Sultant:selectedCon, periode:aff.periode, copil:aff.copil, distanciel:aff.distanciel, confirmed:false, ...payload })
        .select(`id,Date,Mission,Absence,Sultant,periode,copil,distanciel,confirmed,created_at,mission:Mission(id,Code,Color,TextColor,Client,Mission),absence:Absence(id,code,nom,color)`)
        .single();
      if (!error && data) setAffectations(prev => [...prev, data as unknown as Affectation]);
    }
  }, [panelDate, selectedCon, clipboard, canEditSelected, affectations]);


  // Keyboard shortcut Ctrl+C / Ctrl+V
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!panelDate) return;
      if (e.ctrlKey && e.key === "c") { copyDay(); }
      if (e.ctrlKey && e.key === "v") { pasteDay(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [panelDate, copyDay, pasteDay]);

  const toggleDistanciel = useCallback(async (aff: Affectation) => {
    await supabase.from("Affectation").update({ distanciel:!aff.distanciel }).eq("id",aff.id);
    setAffectations(prev => prev.map(a => a.id===aff.id?{...a,distanciel:!aff.distanciel}:a));
  }, []);

  const toggleConfirmed = useCallback(async (aff: Affectation) => {
    await supabase.from("Affectation").update({ confirmed:!aff.confirmed }).eq("id",aff.id);
    setAffectations(prev => prev.map(a => a.id===aff.id?{...a,confirmed:!aff.confirmed}:a));
  }, []);

  const exportPdf = useCallback(async () => {
    const el = calRef.current;
    if (!el) return;
    const { default: html2canvas } = await import("html2canvas");
    const { default: jsPDF } = await import("jspdf");
    // Expand overflow to capture full scrollable width
    const prevOX = el.style.overflowX;
    const prevOY = el.style.overflowY;
    el.style.overflowX = "visible";
    el.style.overflowY = "visible";
    const canvas = await html2canvas(el, {
      scale: 1.5,
      useCORS: true,
      scrollX: 0,
      scrollY: 0,
      width: el.scrollWidth,
      height: el.scrollHeight,
      windowWidth: el.scrollWidth,
    });
    el.style.overflowX = prevOX;
    el.style.overflowY = prevOY;
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "landscape", unit: "px", format: [canvas.width / 1.5, canvas.height / 1.5] });
    pdf.addImage(imgData, "PNG", 0, 0, canvas.width / 1.5, canvas.height / 1.5);
    const con = consultants.find(c => c.id === selectedCon);
    const name = con ? `${con.Nom}_${con.Prénom}` : "planning";
    pdf.save(`${name}_${year}.pdf`);
  }, [selectedCon, year, consultants]);

  return (
    <div style={{ paddingTop:46, paddingBottom:100, background:"white", height:"100vh", display:"flex", flexDirection:"column", overflow:"hidden", boxSizing:"border-box" }}>
      <FixedNav activePath={pathname||"/"} role={access.role ?? undefined} visibleMenus={access.visibleMenus} selectedCon={selectedCon} year={year} onExportPdf={selectedCon ? exportPdf : undefined} />
      <div style={{ display:"flex", alignItems:"center", gap:"0.5rem", padding:"0.28rem 0.8rem", background:"#f0f4f8", borderBottom:"1px solid #ddd", flexWrap:"wrap" }}>
        {!isMobile && <>
          <button onClick={() => setYear(y=>y-1)} style={subBtn}>◀</button>
          <span style={{ fontWeight:"bold", minWidth:42, textAlign:"center", fontSize:"0.9rem" }}>{year}</span>
          <button onClick={() => setYear(y=>y+1)} style={subBtn}>▶</button>
          {year!==todayYear && <button onClick={() => setYear(todayYear)} style={{ padding:"0.3rem 0.7rem", background:"#f39c12", color:"white", border:"none", borderRadius:4, cursor:"pointer", fontWeight:"bold", fontSize:"0.82rem" }}>Aujourd&apos;hui</button>}
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
            <span style={{ display:"inline-flex", alignItems:"center", gap:3 }}>
              <span style={{ display:"inline-block", width:13, height:13, background:"#eee", border:"1px solid #ccc", position:"relative", overflow:"hidden", verticalAlign:"middle" }}><DistancielCorner /></span> Distanciel
            </span>
          </div>
        )}
      </div>

      <div style={{ flex:1, overflow:"hidden", minHeight:0 }}>
        {isMobile
          ? <MobileCalView year={year} affectations={affectations} joursFeries={joursFeries} conges={conges} selectedCon={selectedCon} canEdit={canEditSelected} canRead={canReadSelected} todayStr={todayStr} onFirstClick={handleDayClick} />
          : <CalView year={year} affectations={affectations} joursFeries={joursFeries} conges={conges} selectedCon={selectedCon} canEdit={canEditSelected} canRead={canReadSelected} todayStr={todayStr} panelOpen={!!panelDate} selectedDate={panelDate} onFirstClick={handleDayClick} onMoveAff={moveAff} containerRef={calRef} />
        }
      </div>

      {/* Bandeau bas — toujours visible */}
      <BottomPanel
          date={panelDate ?? ""}
          autoSelect={panelAutoSelect}
          sultantName={panelDate && consultants.find(c=>c.id===selectedCon) ? `${consultants.find(c=>c.id===selectedCon)!.Nom} ${consultants.find(c=>c.id===selectedCon)!.Prénom}` : ""}
          affectations={affectations}
          missions={missions} absences={absences}
          canEdit={canEditSelected}
          clipboard={clipboard}
          onPick={(id, type, periode) => saveAff(id, type, periode)}
          onChangeAff={(id, type, periode, existingId) => saveAff(id, type, periode, existingId)}
          onDelete={deleteAff}
          onCopil={toggleCopil}
          onDistanciel={toggleDistanciel}
          onConfirm={toggleConfirmed}
          canConfirm={access.role === "admin" || access.role === "chef_mission" || access.role === "consultant"}
          onAddSlot={(periode) => setAddPeriode(periode)}
          onCopy={copyDay}
          onPaste={pasteDay}
          onClose={() => setPanelDate(null)}
        />
    </div>
  );
}
