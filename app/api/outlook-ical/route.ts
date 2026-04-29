// app/api/outlook-ical/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Consultant = { Nom: string; Prénom: string };

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sultantId = searchParams.get("sultant");
  const year      = searchParams.get("year") || new Date().getFullYear().toString();

  if (!sultantId) return new NextResponse("sultant param required", { status: 400 });

  // Service role key : nécessaire côté serveur pour contourner le RLS
  // (l'API route ne porte pas de token utilisateur)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const [{ data: consultant }, { data: affectations }] = await Promise.all([
    supabase.from("Sultant").select("Nom,Prénom").eq("id", sultantId).single<Consultant>(),
    supabase.from("Affectation")
      .select(`Date,periode,copil,distanciel,mission:Mission(Code,Client),absence:Absence(code,nom)`)
      .eq("Sultant", sultantId)
      .gte("Date", `${year}-01-01`)
      .lte("Date", `${year}-12-31`),
  ]);

  if (!consultant) return new NextResponse("Consultant introuvable", { status: 404 });

  const now = new Date().toISOString().replace(/[-:.]/g,"").slice(0,15) + "Z";
  const name = `${consultant.Nom} ${consultant["Prénom"]}`;

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Sultime PlannerApp//FR",
    `X-WR-CALNAME:Sultime ${name} ${year}`,
    "X-WR-TIMEZONE:Europe/Paris",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    // Définition VTIMEZONE Europe/Paris (obligatoire pour Outlook)
    "BEGIN:VTIMEZONE",
    "TZID:Europe/Paris",
    "BEGIN:STANDARD",
    "DTSTART:19701025T030000",
    "RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=10",
    "TZNAME:CET",
    "TZOFFSETFROM:+0200",
    "TZOFFSETTO:+0100",
    "END:STANDARD",
    "BEGIN:DAYLIGHT",
    "DTSTART:19700329T020000",
    "RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=3",
    "TZNAME:CEST",
    "TZOFFSETFROM:+0100",
    "TZOFFSETTO:+0200",
    "END:DAYLIGHT",
    "END:VTIMEZONE",
  ];

  (affectations || []).forEach((aff: any) => {
    const code  = aff.mission?.Code || aff.absence?.code || "?";
    const client = aff.mission?.Client || aff.absence?.nom || "";
    const dateStr = aff.Date.slice(0, 10).replace(/-/g, "");

    // Construire le summary sans emojis (Outlook les gère mal)
    let summary = `${code} - ${client}`;
    if (aff.copil)      summary += " [COPIL]";
    if (aff.distanciel) summary += " [Distanciel]";

    let dtStart = "";
    let dtEnd   = "";
    if (aff.periode === "matin") {
      dtStart = `DTSTART;TZID=Europe/Paris:${dateStr}T090000`;
      dtEnd   = `DTEND;TZID=Europe/Paris:${dateStr}T130000`;
    } else if (aff.periode === "aprem") {
      dtStart = `DTSTART;TZID=Europe/Paris:${dateStr}T140000`;
      dtEnd   = `DTEND;TZID=Europe/Paris:${dateStr}T180000`;
    } else {
      dtStart = `DTSTART;VALUE=DATE:${dateStr}`;
      const next = new Date(`${aff.Date.slice(0, 10)}T12:00:00`);
      next.setDate(next.getDate() + 1);
      const nextStr = next.toISOString().slice(0, 10).replace(/-/g, "");
      dtEnd = `DTEND;VALUE=DATE:${nextStr}`;
    }

    const uid = `${dateStr}-${aff.periode}-${sultantId}@sultime-plannerapp`;

    // CATEGORIES = code mission → Outlook applique la couleur de catégorie automatiquement
    const category = aff.mission?.Code || aff.absence?.code || "";

    lines.push(
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      dtStart,
      dtEnd,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${name}\\n${summary}`,
      ...(category ? [`CATEGORIES:${category}`] : []),
      "STATUS:CONFIRMED",
      "TRANSP:OPAQUE",
      "END:VEVENT",
    );
  });

  lines.push("END:VCALENDAR");

  // Jointure avec CRLF strict (obligatoire RFC 5545)
  const icsContent = lines.join("\r\n") + "\r\n";

  return new NextResponse(icsContent, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      // Pas de Content-Disposition attachment → permet l'abonnement live
      "Cache-Control": "no-cache, no-store",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
