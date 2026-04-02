"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const login = async () => {
    setLoading(true); setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError("Email ou mot de passe incorrect."); setLoading(false); return; }
    router.push("/");
  };

  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:"#f0f2f5" }}>
      <div style={{ background:"white", padding:"2.5rem", borderRadius:12, width:360, boxShadow:"0 4px 24px rgba(0,0,0,0.1)" }}>
        <h1 style={{ margin:"0 0 1.5rem", fontSize:"1.4rem", color:"#1a2744", textAlign:"center" }}>🔐 Connexion</h1>
        <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email"
          style={inp} type="email" />
        <input value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mot de passe"
          style={{...inp, marginTop:"0.75rem"}} type="password"
          onKeyDown={e=>e.key==="Enter"&&login()} />
        {error && <div style={{ color:"#e74c3c", fontSize:"0.85rem", marginTop:"0.5rem" }}>{error}</div>}
        <button onClick={login} disabled={loading}
          style={{ width:"100%", marginTop:"1.2rem", padding:"0.75rem", background:"#1a2744", color:"white", border:"none", borderRadius:6, fontWeight:"bold", cursor:"pointer", fontSize:"1rem" }}>
          {loading ? "Connexion..." : "Se connecter"}
        </button>
      </div>
    </div>
  );
}

const inp: React.CSSProperties = { width:"100%", padding:"0.6rem 0.8rem", border:"1px solid #ddd", borderRadius:6, fontSize:"0.95rem", boxSizing:"border-box" };