"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type UserRole = "admin" | "chef_mission" | "consultant" | null;

export type SultantAccess = {
  sultantId: string;
  canRead: boolean;
  canWrite: boolean;
};

export type AccessInfo = {
  role: UserRole;
  isAdmin: boolean;
  sultants: SultantAccess[];
  allowedSultantIds: string[] | null; // null = tous (admin)
  writableSultantIds: string[] | null; // null = tous (admin)
  loading: boolean;
  userId: string | null;
};

export function useAccess(): AccessInfo {
  const [info, setInfo] = useState<AccessInfo>({
    role: null,
    isAdmin: false,
    sultants: [],
    allowedSultantIds: null,
    writableSultantIds: null,
    loading: true,
    userId: null,
  });

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setInfo({ role: null, isAdmin: false, sultants: [], allowedSultantIds: [], writableSultantIds: [], loading: false, userId: null });
        return;
      }

      const { data, error } = await supabase
        .from("UserAccess")
        .select("role, can_read, can_write, sultant_id")
        .eq("user_id", user.id);
      console.log("USERACCESS RAW", JSON.stringify({ data, error, userId: user.id }));

      if (!data || data.length === 0) {
        setInfo({ role: null, isAdmin: false, sultants: [], allowedSultantIds: [], writableSultantIds: [], loading: false, userId: user.id });
        return;
      }

      const role = data[0].role as UserRole;
      const isAdmin = role === "admin";

      const sultants: SultantAccess[] = data.map(d => ({
        sultantId: d.sultant_id,
        canRead: d.can_read,
        canWrite: d.can_write,
      }));

      // Admin : null = accès total, sinon liste filtrée
      const allowedSultantIds = isAdmin ? null : sultants.filter(s => s.canRead).map(s => s.sultantId);
      const writableSultantIds = isAdmin ? null : sultants.filter(s => s.canWrite).map(s => s.sultantId);

      setInfo({ role, isAdmin, sultants, allowedSultantIds, writableSultantIds, loading: false, userId: user.id });
    };
    load();
  }, []);

  return info;
}
