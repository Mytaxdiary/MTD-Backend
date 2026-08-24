export const FIRM_ROLES = ['owner', 'staff'] as const;
export type FirmRole = (typeof FIRM_ROLES)[number];

export interface StaffPermissions {
  canAddClients: boolean;
  canChase: boolean;
  canViewLiabilities: boolean;
  canViewNotes: boolean;
  canManageTemplates: boolean;
  canViewSettings: boolean;
  canInviteStaff: boolean;
}

export const OWNER_PERMISSIONS: StaffPermissions = {
  canAddClients: true,
  canChase: true,
  canViewLiabilities: true,
  canViewNotes: true,
  canManageTemplates: true,
  canViewSettings: true,
  canInviteStaff: true,
};

/** Defaults for invited staff. The owner can change these at invite time. */
export const DEFAULT_STAFF_PERMISSIONS: StaffPermissions = {
  canAddClients: false,
  canChase: false,
  canViewLiabilities: false,
  canViewNotes: false,
  canManageTemplates: false,
  canViewSettings: false,
  canInviteStaff: false,
};

export function resolveFirmRole(roleName?: string | null): FirmRole {
  return roleName === 'staff' ? 'staff' : 'owner';
}

export function permissionsForRole(role: FirmRole): StaffPermissions {
  return role === 'staff' ? { ...DEFAULT_STAFF_PERMISSIONS } : { ...OWNER_PERMISSIONS };
}

export function normalizePermissions(
  raw: Partial<StaffPermissions> | null | undefined,
  role: FirmRole,
): StaffPermissions {
  const defaults = permissionsForRole(role);
  if (!raw || typeof raw !== 'object') return defaults;
  return {
    canAddClients: raw.canAddClients ?? defaults.canAddClients,
    canChase: raw.canChase ?? defaults.canChase,
    canViewLiabilities: raw.canViewLiabilities ?? defaults.canViewLiabilities,
    canViewNotes: raw.canViewNotes ?? defaults.canViewNotes,
    canManageTemplates: raw.canManageTemplates ?? defaults.canManageTemplates,
    canViewSettings: raw.canViewSettings ?? defaults.canViewSettings,
    canInviteStaff: raw.canInviteStaff ?? defaults.canInviteStaff,
  };
}

export function hasPermission(
  actor: { role?: FirmRole; permissions?: StaffPermissions },
  key: keyof StaffPermissions,
): boolean {
  if (actor.role !== 'staff') return true;
  return actor.permissions?.[key] === true;
}
