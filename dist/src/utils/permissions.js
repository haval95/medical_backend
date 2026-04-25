import { Permission } from '@prisma/client';
export const rolePermissionDefaults = {
    ADMIN: [
        Permission.DASHBOARD_VIEW,
        Permission.USER_VIEW,
        Permission.USER_CREATE,
        Permission.USER_UPDATE,
        Permission.USER_ASSIGN_PERMISSIONS,
        Permission.DOCTOR_VIEW,
        Permission.DOCTOR_CREATE,
        Permission.DOCTOR_UPDATE,
        Permission.DOCTOR_SCHEDULE_MANAGE,
        Permission.PATIENT_VIEW,
        Permission.PATIENT_CREATE,
        Permission.PATIENT_UPDATE,
        Permission.REFERRAL_VIEW,
        Permission.REFERRAL_MANAGE,
        Permission.REQUEST_VIEW,
        Permission.REQUEST_ASSIGN,
        Permission.REQUEST_UPDATE,
        Permission.APPOINTMENT_VIEW,
        Permission.APPOINTMENT_MANAGE,
        Permission.REVIEW_VIEW,
        Permission.REVIEW_MODERATE,
        Permission.DISCOUNT_VIEW,
        Permission.DISCOUNT_MANAGE,
        Permission.POINTS_VIEW,
        Permission.POINTS_ADJUST,
        Permission.LOCATION_VIEW,
        Permission.NOTIFICATION_VIEW,
        Permission.NOTIFICATION_MANAGE,
        Permission.REPORT_VIEW,
        Permission.REPORT_EXPORT,
        Permission.ADMIN_MANAGE,
    ],
    DOCTOR: [
        Permission.DOCTOR_VIEW,
        Permission.REQUEST_VIEW,
        Permission.REQUEST_UPDATE,
        Permission.REFERRAL_VIEW,
        Permission.APPOINTMENT_VIEW,
        Permission.REVIEW_VIEW,
        Permission.NOTIFICATION_VIEW,
    ],
    PATIENT: [
        Permission.PATIENT_VIEW,
        Permission.REQUEST_VIEW,
        Permission.DISCOUNT_VIEW,
        Permission.POINTS_VIEW,
        Permission.REFERRAL_VIEW,
        Permission.APPOINTMENT_VIEW,
        Permission.REVIEW_VIEW,
        Permission.NOTIFICATION_VIEW,
    ],
};
export const resolvePermissions = (role, customPermissions) => {
    if (!customPermissions?.length) {
        return rolePermissionDefaults[role];
    }
    return [...new Set(customPermissions)];
};
export const hasPermission = (userPermissions, requiredPermissions) => requiredPermissions.every((permission) => userPermissions.includes(permission));
