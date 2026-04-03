"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type UserRole = "admin" | "chef_mission" | "consultant" | "consultation" | null;

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

      // Récupérer le rôle depuis AppUser et les accès depuis UserAccess
      const [{ data: appUser }, { data: accessData }] = await Promise.all([
        supabase.from("AppUser").select("role").eq("user_id", user.id).single(),
        supabase.from("UserAccess").select("role, can_read, can_write, sultant_id").eq("user_id", user.id),
      ]);

      if (!appUser) {
        setInfo({ role: null, isAdmin: false, sultants: [], allowedSultantIds: [], writableSultantIds: [], loading: false, userId: user.id });
        return;
      }

      const role = appUser.role as UserRole;
      const isAdmin = role === "admin";
      const data = accessData || [];

      const sultants: SultantAccess[] = data.map((d: { sultant_id: string; can_read: boolean; can_write: boolean }) => ({
        sultantId: d.sultant_id,
        canRead: d.can_read,
        canWrite: role === "consultation" ? false : d.can_write, // consultation = jamais d'écriture
      }));

      const allowedSultantIds = isAdmin ? null : sultants.filter(s => s.canRead).map(s => s.sultantId);
      const writableSultantIds = isAdmin ? null : sultants.filter(s => s.canWrite).map(s => s.sultantId);

      setInfo({ role, isAdmin, sultants, allowedSultantIds, writableSultantIds, loading: false, userId: user.id });
    };
    load();
  }, []);

  return info;
}
