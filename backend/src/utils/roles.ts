import { UserRole } from '@prisma/client';

export const ADMIN_ROLES: UserRole[] = [UserRole.ADMIN];
export const AREA_MANAGER_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.AREA_MANAGER];
export const AUDIT_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.AUDITOR];
export const STATS_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.AUDITOR];
