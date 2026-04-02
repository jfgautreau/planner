"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type UserRole = "admin" | "manager" | "consultant" | null;

export type AccessInfo = {
  role: UserRole;
  canEdit: boolean;
  allowedSultantIds: string[] | null; // null = tous (admin)
  loading: boolean;
  userId: string | null;
};

export function useAccess(): AccessInfo {
  const [info, setInfo] = useState<AccessInfo>({
    role: null,
    canEdit: false,
    allowedSultantIds: null,
    loading: true,
    userId: null,
  });

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setInfo({ role: null, canEdit: false, allowedSultantIds: [], loading: false, userId: null });
        return;
      }

      const { data } = await supabase
        .from("UserAccess")
        .select("role, can_edit, sultant_id")
        .eq("user_id", user.id);

      if (!data || data.length === 0) {
        // Aucun droit configuré → accès refusé
        setInfo({ role: null, canEdit: false, allowedSultantIds: [], loading: false, userId: user.id });
        return;
      }

      // Si au moins une entrée est admin → accès total
      const adminEntry = data.find(d => d.role === "admin");
      if (adminEntry) {
        setInfo({ role: "admin", canEdit: true, allowedSultantIds: null, loading: false, userId: user.id });
        return;
      }

      // Manager ou consultant : liste des sultant_id autorisés
      const role = data[0].role as UserRole;
      const canEdit = data.some(d => d.can_edit);
      const allowedSultantIds = data
        .map(d => d.sultant_id)
        .filter((id): id is string => !!id);

      setInfo({ role, canEdit, allowedSultantIds, loading: false, userId: user.id });
    };

    load();
  }, []);

  return info;
}
