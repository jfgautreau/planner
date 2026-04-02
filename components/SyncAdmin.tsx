"use client";
// Ce composant est maintenant embarqué dans Settings — plus besoin de header ni de padding global
import { useState } from "react";

type Status = "idle" | "loading" | "success" | "error";

export default function SyncAdmin() {
  const currentYear = new Date().getFullYear();
  const availableYears = Array.from({ length: 7 }, (_, i) => currentYear - 3 + i); // 3 ans en arrière + 3 en avant

  const [feriesYears, setFeriesYears] = useState<number[]>([currentYear]);
  const [feriesStatus, setFeriesStatus] = useState<Status>("idle");
  const [feriesMsg, setFeriesMsg] = useState("");

  const [congesYears, setCongesYears] = useState<number[]>([currentYear]);
  const [congesStatus, setCongesStatus] = useState<Status>("idle");
  const [congesMsg, setCongesMsg] = useState("");

  const toggleYear = (list: number[], setList: (v: number[]) => void, y: number) =>
    setList(list.includes(y) ? list.filter(x => x !== y) : [...list, y].sort());

  const syncFeries = async () => {
    if (!feriesYears.length) { setFeriesMsg("Sélectionne au moins une année."); setFeriesStatus("error"); return; }
    setFeriesStatus("loading"); setFeriesMsg("Récupération en cours...");
    try {
      const res = await fetch("/api/sync-feries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ years: feriesYears }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setFeriesStatus("success"); setFeriesMsg(`✅ ${json.count} jours fériés synchronisés.`);
    } catch (e: unknown) { setFeriesStatus("error"); setFeriesMsg(`❌ ${e instanceof Error ? e.message : "Erreur"}`); }
  };

  const syncConges = async () => {
    if (!congesYears.length) { setCongesMsg("Sélectionne au moins une année."); setCongesStatus("error"); return; }
    setCongesStatus("loading"); setCongesMsg("Récupération en cours...");
    try {
      const res = await fetch("/api/sync-conges", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ years: congesYears }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setCongesStatus("success"); setCongesMsg(`✅ ${json.count} périodes synchronisées.`);
    } catch (e: unknown) { setCongesStatus("error"); setCongesMsg(`❌ ${e instanceof Error ? e.message : "Erreur"}`); }
  };

  const yearBtn = (active: boolean): React.CSSProperties => ({
    padding: "0.3rem 0.7rem", border: "2px solid #3498db", borderRadius: 4,
    backgroundColor: active ? "#3498db" : "white", color: active ? "white" : "#3498db",
    cursor: "pointer", fontWeight: "bold", fontSize: "0.85rem",
  });
  const syncBtn = (color: string, disabled: boolean): React.CSSProperties => ({
    padding: "0.6rem 1.2rem", backgroundColor: disabled ? "#aaa" : color,
    color: "white", border: "none", borderRadius: 6, cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: "bold", width: "100%",
  });
  const box = (status: Status, msg: string) => msg ? (
    <div style={{ marginTop: "0.6rem", padding: "0.5rem 0.8rem", borderRadius: 5, fontSize: "0.83rem",
      backgroundColor: status==="success"?"#eafaf1": status==="error"?"#fdecea":"#eaf4fb",
      color: status==="success"?"#1e8449": status==="error"?"#c0392b":"#1a5276" }}>{msg}</div>
  ) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>

      <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: "1.2rem" }}>
        <h3 style={{ marginTop: 0, fontSize: "1rem" }}>🗓 Jours fériés</h3>
        <p style={{ fontSize: "0.78rem", color: "#666", marginBottom: "0.7rem" }}>Source : <a href="https://calendrier.api.gouv.fr" target="_blank" rel="noreferrer">calendrier.api.gouv.fr</a> → table <code>JourFerie</code></p>
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.7rem" }}>
          {availableYears.map(y => <button key={y} onClick={() => toggleYear(feriesYears, setFeriesYears, y)} style={yearBtn(feriesYears.includes(y))}>{y}</button>)}
        </div>
        <button onClick={syncFeries} disabled={feriesStatus==="loading"} style={syncBtn("#2ecc71", feriesStatus==="loading")}>
          {feriesStatus==="loading" ? "⏳ En cours..." : "🔄 Synchroniser"}
        </button>
        {box(feriesStatus, feriesMsg)}
      </section>

      <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: "1.2rem" }}>
        <h3 style={{ marginTop: 0, fontSize: "1rem" }}>🏫 Vacances scolaires (Zones A, B, C)</h3>
        <p style={{ fontSize: "0.78rem", color: "#666", marginBottom: "0.7rem" }}>Source : <a href="https://data.education.gouv.fr/explore/dataset/fr-en-calendrier-scolaire/" target="_blank" rel="noreferrer">data.education.gouv.fr</a> → table <code>CongeZone</code></p>
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.7rem" }}>
          {availableYears.map(y => <button key={y} onClick={() => toggleYear(congesYears, setCongesYears, y)} style={yearBtn(congesYears.includes(y))}>{y}</button>)}
        </div>
        <button onClick={syncConges} disabled={congesStatus==="loading"} style={syncBtn("#3498db", congesStatus==="loading")}>
          {congesStatus==="loading" ? "⏳ En cours..." : "🔄 Synchroniser"}
        </button>
        {box(congesStatus, congesMsg)}
      </section>
    </div>
  );
}
