"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type UserRole = "admin" | "chef_mission" | "consultant" | "consultation" | null;

export type SultantAccess = {
  sultantId: string;
  canRead: boolean;
  canWrite: boolean;
};

export const ALL_MENUS = ["calendrier","planning","client","dashboardprod","dashboardrh","settings"] as const;
export type MenuKey = typeof ALL_MENUS[number];

export type AccessInfo = {
  role: UserRole;
  isAdmin: boolean;
  sultants: SultantAccess[];
  allowedSultantIds: string[] | null;
  writableSultantIds: string[] | null;
  visibleMenus: Set<MenuKey>;
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
    visibleMenus: new Set(ALL_MENUS),
    loading: true,
    userId: null,
  });

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setInfo({ role: null, isAdmin: false, sultants: [], allowedSultantIds: [], writableSultantIds: [], visibleMenus: new Set(), loading: false, userId: null });
        return;
      }

      const [{ data: appUser }, { data: accessData }, { data: menuRole }, { data: menuUser }] = await Promise.all([
        supabase.from("AppUser").select("role").eq("user_id", user.id).single(),
        supabase.from("UserAccess").select("role, can_read, can_write, sultant_id").eq("user_id", user.id),
        supabase.from("MenuAccess").select("menu, can_see").eq("target_type", "role").eq("target_id", appUser?.role ?? "consultation"),
        supabase.from("MenuAccess").select("menu, can_see").eq("target_type", "user").eq("target_id", user.id),
      ]);

      if (!appUser) {
        setInfo({ role: null, isAdmin: false, sultants: [], allowedSultantIds: [], writableSultantIds: [], visibleMenus: new Set(), loading: false, userId: user.id });
        return;
      }

      const role = appUser.role as UserRole;
      const isAdmin = role === "admin";
      const data = accessData || [];

      const sultants: SultantAccess[] = data.map((d: { sultant_id: string; can_read: boolean; can_write: boolean }) => ({
        sultantId: d.sultant_id,
        canRead: d.can_read,
        canWrite: role === "consultation" ? false : d.can_write,
      }));

      const allowedSultantIds = isAdmin ? null : sultants.filter(s => s.canRead).map(s => s.sultantId);
      const writableSultantIds = isAdmin ? null : sultants.filter(s => s.canWrite).map(s => s.sultantId);

      // Calcul des menus visibles : rôle en base, overridé par user
      const menuMap = new Map<MenuKey, boolean>();
      // 1. Valeurs par rôle
      (menuRole || []).forEach((m: { menu: string; can_see: boolean }) => {
        menuMap.set(m.menu as MenuKey, m.can_see);
      });
      // 2. Override par user (priorité)
      (menuUser || []).forEach((m: { menu: string; can_see: boolean }) => {
        menuMap.set(m.menu as MenuKey, m.can_see);
      });
      // Admin voit tout quoi qu'il arrive
      const visibleMenus = new Set<MenuKey>(
        isAdmin ? ALL_MENUS : ALL_MENUS.filter(k => menuMap.get(k) !== false)
      );

      setInfo({ role, isAdmin, sultants, allowedSultantIds, writableSultantIds, visibleMenus, loading: false, userId: user.id });
    };
    load();
  }, []);

  return info;
}
