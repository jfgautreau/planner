// app/api/sync-conges/route.ts
// Source : https://www.data.gouv.fr/api/1/datasets/r/c3781037-dffb-4789-9af9-15a955336771
// Format CSV : date,vacances_zone_a,vacances_zone_b,vacances_zone_c,nom_vacances

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const CSV_URL = "https://www.data.gouv.fr/api/1/datasets/r/c3781037-dffb-4789-9af9-15a955336771";

export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Variables Supabase manquantes" }, { status: 500 });
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { years } = await req.json();
    if (!years || years.length === 0) {
      return NextResponse.json({ error: "Aucune année fournie" }, { status: 400 });
    }

    const res = await fetch(CSV_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`Erreur téléchargement : ${res.status} ${res.statusText}`);

    const csvText = await res.text();
    const lines   = csvText.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) throw new Error("CSV vide");

    // Nettoyer les headers : supprimer espaces, BOM, guillemets
    const rawHeaders = lines[0].split(",").map(h => h.trim().replace(/^["']|["']$/g, "").toLowerCase());
    console.log("Headers bruts:", rawHeaders);

    // Trouver les index par position dans le header nettoyé
    // Format attendu : date, vacances_zone_a, vacances_zone_b, vacances_zone_c, nom_vacances
    let iDate = -1, iZoneA = -1, iZoneB = -1, iZoneC = -1, iNom = -1;
    rawHeaders.forEach((h, i) => {
      const clean = h.replace(/\s+/g, "_");
      if (clean === "date")                                          iDate  = i;
      else if (clean.includes("zone_a") || clean === "vacances_zone_a") iZoneA = i;
      else if (clean.includes("zone_b") || clean === "vacances_zone_b") iZoneB = i;
      else if (clean.includes("zone_c") || clean === "vacances_zone_c") iZoneC = i;
      else if (clean.includes("nom"))                                iNom   = i;
    });

    console.log("Index colonnes:", { iDate, iZoneA, iZoneB, iZoneC, iNom });

    if (iDate === -1 || iZoneA === -1) {
      throw new Error(`Colonnes non trouvées. Headers: [${rawHeaders.join(" | ")}]`);
    }

    const yearSet = new Set(years.map(String));
    const rows: { date: string; zone_a: boolean; zone_b: boolean; zone_c: boolean; nom_vacances: string }[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",");
      const date = cols[iDate]?.trim().replace(/^["']|["']$/g, "");
      if (!date || !date.match(/^\d{4}-\d{2}-\d{2}$/)) continue;
      if (!yearSet.has(date.slice(0, 4))) continue;

      const zA = cols[iZoneA]?.trim().toLowerCase() === "true";
      const zB = iZoneB >= 0 ? cols[iZoneB]?.trim().toLowerCase() === "true" : false;
      const zC = iZoneC >= 0 ? cols[iZoneC]?.trim().toLowerCase() === "true" : false;
      const nom = iNom >= 0 ? (cols[iNom]?.trim().replace(/^["']|["']$/g, "") || "") : "";

      if (!zA && !zB && !zC) continue;

      rows.push({ date, zone_a: zA, zone_b: zB, zone_c: zC, nom_vacances: nom });
    }

    if (rows.length === 0) {
      throw new Error(`Aucun jour de congé trouvé pour ${years.join(", ")}. Le CSV contient ${lines.length} lignes.`);
    }

    // Upsert par batch de 500
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase.from("CongeJour").upsert(rows.slice(i, i + 500), { onConflict: "date" });
      if (error) throw new Error(`Erreur Supabase : ${error.message}`);
    }

    return NextResponse.json({ success: true, count: rows.length });

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erreur inconnue";
    console.error("sync-conges error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
