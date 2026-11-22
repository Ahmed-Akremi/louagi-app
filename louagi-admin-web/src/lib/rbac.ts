// Ported from the mobile app's src/security/rbac.js. This gates the UI only;
// the backend enforces the same matrix per operation (assertCan). Keeping it
// here lets us hide/disable controls the current actor can't use.
export const Roles = {
  PASSENGER: "passenger",
  DRIVER: "driver",
  ADMIN: "admin",
} as const;

const matrix: Record<string, string[]> = {
  "rides:search": ["passenger", "driver", "admin"],
  "rides:book": ["passenger"],
  "rides:create": ["driver"],
  "rides:manage": ["driver", "admin"],
  "rides:cancel:any": ["admin"],
  "admin:read": ["admin"],
  "admin:verify-driver": ["admin"],
  "admin:suspend-user": ["admin"],
  "admin:refund": ["admin"],
  "admin:impersonate": ["admin"],
  "driver:earnings": ["driver"],
  "profile:self": ["passenger", "driver", "admin"],
};

export function can(role: string | undefined | null, action: string): boolean {
  if (!role) return false;
  return matrix[action]?.includes(role) ?? false;
}

export function isAdmin(role: string | undefined | null): boolean {
  return role === Roles.ADMIN;
}
