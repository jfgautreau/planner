// app/api/outlook-ical/route.ts
// Génère un flux iCal (.ics) des affectations d'un consultant
// Compatible Outlook, Google Calendar, Apple Calendar

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Consultant = { Nom: string; Prénom: string };

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sultantId = searchParams.get("sultant");
  const year      = searchParams.get("year") || new Date().getFullYear().toString();

  if (!sultantId) return new NextResponse("sultant param required", { status: 400 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
  );

  const [{ data: consultant }, { data: affectations }] = await Promise.all([
    supabase.from("Sultant").select("Nom,Prénom").eq("id", sultantId).single<Consultant>(),
    supabase.from("Affectation")
      .select(`Date,periode,copil,mission:Mission(Code,Client,Color),absence:Absence(code,nom)`)
      .eq("Sultant", sultantId)
      .gte("Date", `${year}-01-01`)
      .lte("Date", `${year}-12-31`),
  ]);

  if (!consultant) return new NextResponse("Consultant introuvable", { status: 404 });

  const now = new Date().toISOString().replace(/[-:]/g,"").split(".")[0]+"Z";
  const name = `${consultant.Nom} ${consultant["Prénom"]}`;

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PlannerApp//FR",
    `X-WR-CALNAME:Planner ${name} ${year}`,
    "X-WR-TIMEZONE:Europe/Paris",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  (affectations||[]).forEach((aff: any) => {
    const code  = aff.mission?.Code || aff.absence?.code || "?";
    const label = aff.mission ? `${code} — ${aff.mission.Client}` : `${code} — ${aff.absence?.nom||""}`;
    const dateStr = aff.Date.slice(0,10).replace(/-/g,""); // YYYYMMDD

    // Pour les demi-journées on crée un événement de 4h
    let dtStart = "";
    let dtEnd   = "";
    if (aff.periode === "matin") {
      dtStart = `DTSTART;TZID=Europe/Paris:${dateStr}T090000`;
      dtEnd   = `DTEND;TZID=Europe/Paris:${dateStr}T130000`;
    } else if (aff.periode === "aprem") {
      dtStart = `DTSTART;TZID=Europe/Paris:${dateStr}T140000`;
      dtEnd   = `DTEND;TZID=Europe/Paris:${dateStr}T180000`;
    } else {
      // journée entière (all-day)
      dtStart = `DTSTART;VALUE=DATE:${dateStr}`;
      const next = new Date(aff.Date.slice(0,10));
      next.setDate(next.getDate()+1);
      const nextStr = next.toISOString().slice(0,10).replace(/-/g,"");
      dtEnd = `DTEND;VALUE=DATE:${nextStr}`;
    }

    const uid = `${dateStr}-${aff.periode}-${sultantId}@plannerapp`;
    const summary = aff.copil ? `${label} ⭐ COPIL` : label;

    lines.push(
      "BEGIN:VEVENT",
      uid ? `UID:${uid}` : "",
      `DTSTAMP:${now}`,
      dtStart,
      dtEnd,
      `SUMMARY:${summary}`,
      aff.mission?.Color ? `COLOR:${aff.mission.Color}` : "",
      "END:VEVENT",
    );
  });

  lines.push("END:VCALENDAR");
  const icsContent = lines.filter(Boolean).join("\r\n");

  return new NextResponse(icsContent, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="planner-${name.replace(/\s/g,"-")}-${year}.ics"`,
      "Cache-Control": "no-cache",
    },
  });
}
