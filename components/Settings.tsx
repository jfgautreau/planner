"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { FixedNav } from "@/components/AnnualPlanner";
import SyncAdmin      from "@/components/SyncAdmin";
import ConsultantForm from "@/components/ConsultantForm";
import MissionForm    from "@/components/MissionForm";
import ObjectifForm   from "@/components/ObjectifForm";
import UserAccessForm from "@/components/UserAccessForm";

type Tab = "sync"|"consultants"|"missions"|"objectifs"|"acces";

export default function Settings() {
  const pathname = usePathname();
  const [tab, setTab] = useState<Tab>("sync");

  return (
    <div style={{ paddingTop:58 }}>
      <FixedNav activePath={pathname||"/settings"} />

      <div style={{ padding:"1.5rem", maxWidth:860, margin:"0 auto" }}>
        <h1 style={{ marginTop:0, marginBottom:"1.2rem", fontSize:"1.3rem", color:"#1a2744" }}>⚙️ Paramètres</h1>

        {/* Onglets */}
        <div style={{ display:"flex", borderBottom:"2px solid #e0e0e0", marginBottom:"1.5rem" }}>
          {([
            ["sync",        "🔄 Synchronisation"],
            ["consultants", "👤 Consultants"],
            ["missions",    "📋 Missions"],
            ["objectifs",   "🎯 Objectifs"],
            ["acces",       "🔐 Accès"],
          ] as [Tab,string][]).map(([t,label])=>(
            <button key={t} onClick={()=>setTab(t)} style={{
              padding:"0.55rem 1.2rem", border:"none",
              borderBottom: tab===t ? "3px solid #1a2744" : "3px solid transparent",
              marginBottom:-2, background:"none",
              fontWeight: tab===t ? "bold" : "normal",
              color: tab===t ? "#1a2744" : "#888",
              cursor:"pointer", fontSize:"0.88rem",
            }}>{label}</button>
          ))}
        </div>

        {tab==="sync"        && <SyncAdmin />}
        {tab==="consultants" && <ConsultantForm />}
        {tab==="missions"    && <MissionForm />}
        {tab==="objectifs"   && <ObjectifForm />}
        {tab==="acces"       && <UserAccessForm />}
      </div>
    </div>
  );
}
