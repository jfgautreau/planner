"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

// L'API publique des jours fériés français (aucune clé requise)
const API_URL = "https://etalab-jours-feries.make.sh";

type JourFerieAPI = Record<string, string>; // { "2025-01-01": "1er janvier", ... }

export default function SyncJoursFeries() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [years, setYears] = useState<number[]>([new Date().getFullYear()]);

  const addYear = (year: number) => {
    if (!years.includes(year)) setYears(prev => [...prev, year].sort());
  };

  const removeYear = (year: number) => {
    setYears(prev => prev.filter(y => y !== year));
  };

  const sync = async () => {
    if (years.length === 0) {
      setMessage("Sélectionne au moins une année.");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setMessage("Récupération des jours fériés...");

    try {
      const allJours: { date: string; nom: string }[] = [];

      for (const year of years) {
        const res = await fetch(`${API_URL}/${year}`);
        if (!res.ok) throw new Error(`Erreur API pour l'année ${year} : ${res.statusText}`);
        const data: JourFerieAPI = await res.json();

        for (const [date, nom] of Object.entries(data)) {
          allJours.push({ date, nom });
        }
      }

      setMessage(`${allJours.length} jours fériés récupérés. Synchronisation en base...`);

      // Upsert : insert ou update si la date existe déjà
      const { error } = await supabase
        .from("JourFerie")
        .upsert(
          allJours.map(j => ({ date: j.date, nom: j.nom, updated_at: new Date().toISOString() })),
          { onConflict: "date" }
        );

      if (error) throw new Error(error.message);

      setStatus("success");
      setMessage(`✅ ${allJours.length} jours fériés synchronisés avec succès.`);
    } catch (err: unknown) {
      setStatus("error");
      setMessage(`❌ Erreur : ${err instanceof Error ? err.message : "Inconnue"}`);
    }
  };

  const currentYear = new Date().getFullYear();
  const availableYears = Array.from({ length: 6 }, (_, i) => currentYear - 1 + i); // année-1 à année+4

  return (
    <div style={{ padding: "2rem", maxWidth: "500px", margin: "0 auto" }}>
      <h2 style={{ marginBottom: "1rem" }}>Synchronisation des jours fériés</h2>
      <p style={{ fontSize: "0.85rem", color: "#555", marginBottom: "1.5rem" }}>
        Source : <a href="https://etalab-jours-feries.make.sh" target="_blank" rel="noreferrer">API Étalab (data.gouv.fr)</a>
        {" "}— Mise à jour automatique en base Supabase.
      </p>

      {/* Sélection des années */}
      <div style={{ marginBottom: "1rem" }}>
        <p style={{ fontWeight: "bold", marginBottom: "0.5rem" }}>Années à synchroniser :</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.75rem" }}>
          {availableYears.map(y => (
            <button
              key={y}
              onClick={() => years.includes(y) ? removeYear(y) : addYear(y)}
              style={{
                padding: "0.4rem 0.8rem",
                borderRadius: "4px",
                border: "2px solid #3498db",
                backgroundColor: years.includes(y) ? "#3498db" : "white",
                color: years.includes(y) ? "white" : "#3498db",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              {y}
            </button>
          ))}
        </div>
        <p style={{ fontSize: "0.8rem", color: "#888" }}>
          Années sélectionnées : {years.length > 0 ? years.join(", ") : "aucune"}
        </p>
      </div>

      {/* Bouton de synchro */}
      <button
        onClick={sync}
        disabled={status === "loading"}
        style={{
          padding: "0.75rem 1.5rem",
          backgroundColor: status === "loading" ? "#aaa" : "#2ecc71",
          color: "white",
          border: "none",
          borderRadius: "6px",
          cursor: status === "loading" ? "not-allowed" : "pointer",
          fontWeight: "bold",
          fontSize: "1rem",
          width: "100%",
        }}
      >
        {status === "loading" ? "Synchronisation..." : "🔄 Synchroniser"}
      </button>

      {/* Message de statut */}
      {message && (
        <div style={{
          marginTop: "1rem",
          padding: "0.75rem",
          borderRadius: "6px",
          backgroundColor: status === "success" ? "#eafaf1" : status === "error" ? "#fdecea" : "#eaf4fb",
          color: status === "success" ? "#1e8449" : status === "error" ? "#c0392b" : "#1a5276",
          fontSize: "0.9rem",
        }}>
          {message}
        </div>
      )}
    </div>
  );
}
