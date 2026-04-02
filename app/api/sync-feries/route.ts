// app/api/sync-feries/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// API officielle data.gouv.fr - jours fériés France métropolitaine
const FERIES_API = "https://calendrier.api.gouv.fr/jours-feries/metropole";

export async function POST(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Variables Supabase manquantes" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { years } = await req.json();
    if (!years || years.length === 0) {
      return NextResponse.json({ error: "Aucune année fournie" }, { status: 400 });
    }

    const all: { date: string; nom: string }[] = [];

    for (const year of years) {
      const url = `${FERIES_API}/${year}.json`;
      console.log(`Fetching: ${url}`);
      const res = await fetch(url, {
        headers: { "Accept": "application/json" },
        // désactiver le cache Next.js
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Erreur HTTP ${res.status} pour l'année ${year}`);
      // Réponse : { "2026-01-01": "1er janvier", ... }
      const data: Record<string, string> = await res.json();
      for (const [date, nom] of Object.entries(data)) {
        all.push({ date, nom });
      }
    }

    if (all.length === 0) throw new Error("Aucun jour férié retourné par l'API");

    const { error } = await supabase
      .from("JourFerie")
      .upsert(
        all.map(j => ({ date: j.date, nom: j.nom, updated_at: new Date().toISOString() })),
        { onConflict: "date" }
      );

    if (error) throw new Error(`Erreur Supabase : ${error.message}`);

    return NextResponse.json({ success: true, count: all.length });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erreur inconnue";
    console.error("sync-feries error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
