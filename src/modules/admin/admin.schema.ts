import {
  AccessReviewStatus,
  AppointmentStatus,
  BackupOperationStatus,
  BackupOperationType,
  ConsentType,
  DiscountStatus,
  GovernanceRequestStatus,
  GovernanceRequestType,
  PatientGender,
  Permission,
  Role,
  ServiceRequestStatus,
  SecurityIncidentSeverity,
  SecurityIncidentStatus,
  UserStatus,
} from '@prisma/client';
import { z } from 'zod';

const optionalText = z.string().trim().min(1).optional();
const slotLengthSchema = z
  .number()
  .int('Slot length must be a whole number of minutes.')
  .min(10, 'Slot length must be at least 10 minutes.')
  .max(180, 'Slot length cannot be more than 180 minutes.')
  .refine(
    (value) => value % 5 === 0,
    'Slot length must use 5-minute increments, such as 10, 15, 20, 25, 30, or 60 minutes.'
  );
const bufferMinutesSchema = z
  .number()
  .int('Blocked/buffer time must be a whole number of minutes.')
  .min(0, 'Blocked/buffer time cannot be negative.')
  .max(180, 'Blocked/buffer time cannot be more than 180 minutes.')
  .refine(
    (value) => value % 5 === 0,
    'Blocked/buffer time must use 5-minute increments, such as 0, 5, 10, 15, or 30 minutes.'
  );
const paginationSchema = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
};

const doctorCredentialSchema = z.object({
  type: z.enum(['DEGREE', 'CERTIFICATE', 'LICENSE', 'OTHER']),
  title: z.string().trim().min(2).max(160),
  issuer: z.string().trim().max(160).optional(),
  awardedAt: z.string().datetime().optional(),
  documentUrl: z.string().trim().url().optional(),
  notes: z.string().trim().max(500).optional(),
});
const workingHourEntrySchema = z
  .object({
    day: z.enum([
      'MONDAY',
      'TUESDAY',
      'WEDNESDAY',
      'THURSDAY',
      'FRIDAY',
      'SATURDAY',
      'SUNDAY',
    ]),
    isActive: z.boolean(),
    startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.isActive) {
      return;
    }

    if (!value.startTime || !value.endTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Working days must include both a start and end time.',
      });
      return;
    }

    if (value.startTime >= value.endTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Working day end time must be after the start time.',
      });
    }
  });

const patientConsentSchema = z.object({
  type: z.nativeEnum(ConsentType),
  granted: z.boolean(),
  version: z.string().trim().max(40).optional(),
  source: z.string().trim().max(80).optional(),
});

export const adminListUsersSchema = z.object({
  search: z.string().trim().optional(),
  role: z.nativeEnum(Role).optional(),
  status: z.nativeEnum(UserStatus).optional(),
});

export const adminDoctorDirectorySchema = z.object({
  search: z.string().trim().optional(),
  availability: z.enum(['AVAILABLE', 'OFFLINE']).optional(),
  city: z.string().trim().min(1).max(80).optional(),
  sortBy: z.enum(['NAME', 'RATING', 'VISITS', 'RADIUS']).optional(),
  ...paginationSchema,
});

export const adminPatientDirectorySchema = z.object({
  search: z.string().trim().optional(),
  status: z.nativeEnum(UserStatus).optional(),
  gender: z.nativeEnum(PatientGender).optional(),
  city: z.string().trim().min(1).max(80).optional(),
  sortBy: z.enum(['NAME', 'POINTS', 'CITY']).optional(),
  ...paginationSchema,
});

export const adminRequestDirectorySchema = z.object({
  search: z.string().trim().optional(),
  status: z.nativeEnum(ServiceRequestStatus).optional(),
  type: z.enum(['SPECIFIC_DOCTOR', 'ANY_AVAILABLE_DOCTOR']).optional(),
  city: z.string().trim().min(1).max(80).optional(),
  sortBy: z.enum(['NEWEST', 'OLDEST', 'CITY']).optional(),
  ...paginationSchema,
});

export const createAdminUserSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phoneNumber: z.string().trim().min(8).max(20),
  role: z.nativeEnum(Role),
  permissions: z.array(z.nativeEnum(Permission)).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  photoUrl: z.string().trim().url().optional(),
  doctorProfile: z
    .object({
      referralCode: z.string().trim().min(4).max(24).toUpperCase().optional(),
      specialty: optionalText,
      bio: z.string().trim().max(1200).optional(),
      yearsExperience: z.number().int().min(0).max(60).optional(),
      languages: z.array(z.string().trim().min(2).max(40)).max(12).optional(),
      serviceRadiusKm: z.number().int().min(1).max(150).optional(),
      defaultSlotMinutes: slotLengthSchema.optional(),
      defaultBufferMinutes: bufferMinutesSchema.optional(),
      generalWorkingHours: z.array(workingHourEntrySchema).length(7).optional(),
      isAvailable: z.boolean().optional(),
      onboardingPoints: z.number().int().min(0).max(5000).optional(),
      workplaceName: z.string().trim().max(120).optional(),
      workplaceAddress: z.string().trim().max(240).optional(),
      workplaceLatitude: z.number().min(-90).max(90).optional(),
      workplaceLongitude: z.number().min(-180).max(180).optional(),
      credentials: z.array(doctorCredentialSchema).max(24).optional(),
      location: z
        .object({
          city: z.string().trim().min(2).max(80),
          addressLine: z.string().trim().min(4).max(200),
          latitude: z.number().min(-90).max(90).optional(),
          longitude: z.number().min(-180).max(180).optional(),
          notes: z.string().trim().max(200).optional(),
        })
        .optional(),
    })
    .optional(),
  patientProfile: z
    .object({
      city: optionalText,
      homeAddress: optionalText,
      latitude: z.number().min(-90).max(90).optional(),
      longitude: z.number().min(-180).max(180).optional(),
      dateOfBirth: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      gender: z.nativeEnum(PatientGender).optional(),
      emergencyContactName: z.string().trim().max(120).optional(),
      emergencyContactPhone: z.string().trim().min(8).max(20).optional(),
      allergies: z.string().trim().max(1200).optional(),
      chronicConditions: z.string().trim().max(1200).optional(),
      currentMedications: z.string().trim().max(1200).optional(),
      mobilityNotes: z.string().trim().max(500).optional(),
      communicationPreferences: z.string().trim().max(500).optional(),
      notes: z.string().trim().max(1200).optional(),
      referralCodeUsed: z.string().trim().min(4).max(24).toUpperCase().optional(),
      availablePoints: z.number().int().min(0).max(500000).optional(),
      lifetimePoints: z.number().int().min(0).max(500000).optional(),
      consents: z.array(patientConsentSchema).max(12).optional(),
    })
    .optional(),
});

export const updateAdminUserSchema = createAdminUserSchema.partial();

export const updateAdminDoctorSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  photoUrl: z.string().trim().url().nullable().optional(),
  specialty: z.string().trim().max(120).nullable().optional(),
  bio: z.string().trim().max(1200).nullable().optional(),
  yearsExperience: z.number().int().min(0).max(60).optional(),
  languages: z.array(z.string().trim().min(2).max(40)).max(12).optional(),
  serviceRadiusKm: z.number().int().min(1).max(150).optional(),
  defaultSlotMinutes: slotLengthSchema.optional(),
  defaultBufferMinutes: bufferMinutesSchema.optional(),
  generalWorkingHours: z.array(workingHourEntrySchema).length(7).optional(),
  isAvailable: z.boolean().optional(),
  workplaceName: z.string().trim().max(120).nullable().optional(),
  workplaceAddress: z.string().trim().max(240).nullable().optional(),
  workplaceLatitude: z.number().min(-90).max(90).nullable().optional(),
  workplaceLongitude: z.number().min(-180).max(180).nullable().optional(),
  credentials: z.array(doctorCredentialSchema).max(24).optional(),
  location: z
    .object({
      city: z.string().trim().min(2).max(80),
      addressLine: z.string().trim().min(4).max(200),
      latitude: z.number().min(-90).max(90).optional(),
      longitude: z.number().min(-180).max(180).optional(),
      notes: z.string().trim().max(200).optional(),
    })
    .optional(),
});

export const uploadAdminDoctorPhotoSchema = z.object({
  fileName: z.string().trim().min(1).max(160),
  mimeType: z.string().trim().min(3).max(120),
  contentBase64: z.string().trim().min(20),
});

export const createOnboardingStepSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().min(8).max(400),
  imageUrl: z.string().trim().url(),
  sortOrder: z.number().int().min(0).max(999).optional(),
  isActive: z.boolean().optional(),
});

export const updateOnboardingStepSchema = createOnboardingStepSchema.partial();

export const uploadOnboardingImageSchema = z.object({
  fileName: z.string().trim().min(1).max(160),
  mimeType: z.string().trim().min(3).max(120),
  contentBase64: z.string().trim().min(20),
});

export const updateAdminPatientSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  city: z.string().trim().min(2).max(80).optional(),
  homeAddress: z.string().trim().min(4).max(200).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  dateOfBirth: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  gender: z.nativeEnum(PatientGender).optional(),
  emergencyContactName: z.string().trim().max(120).optional(),
  emergencyContactPhone: z.string().trim().min(8).max(20).optional(),
  allergies: z.string().trim().max(1200).optional(),
  chronicConditions: z.string().trim().max(1200).optional(),
  currentMedications: z.string().trim().max(1200).optional(),
  mobilityNotes: z.string().trim().max(500).optional(),
  communicationPreferences: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(1200).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  consents: z.array(patientConsentSchema).max(12).optional(),
});

export const createDiscountSchema = z.object({
  code: z.string().trim().min(4).max(24).toUpperCase(),
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(250).optional(),
  type: z.enum(['PERCENTAGE', 'FIXED_AMOUNT']),
  value: z.number().int().positive(),
  pointsCost: z.number().int().positive().optional(),
  isReferralReward: z.boolean().optional(),
  status: z.nativeEnum(DiscountStatus).optional(),
});

export const updateDiscountSchema = createDiscountSchema.partial();

export const adjustPointsSchema = z.object({
  patientProfileId: z.string().trim().min(10),
  points: z.number().int().min(-100000).max(100000).refine((value) => value !== 0),
  notes: z.string().trim().min(3).max(200),
});

export const adminListAppointmentsSchema = z.object({
  search: z.string().trim().optional(),
  doctorId: z.string().trim().min(10).optional(),
  patientProfileId: z.string().trim().min(10).optional(),
  status: z.nativeEnum(AppointmentStatus).optional(),
  city: z.string().trim().min(1).max(80).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  sortBy: z.enum(['UPCOMING', 'RECENT', 'CITY']).optional(),
  ...paginationSchema,
});

export const adminReviewDirectorySchema = z.object({
  search: z.string().trim().optional(),
  visibility: z.enum(['VISIBLE', 'HIDDEN']).optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  sortBy: z.enum(['RECENT', 'RATING']).optional(),
  ...paginationSchema,
});

export const adminReportFiltersSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  doctorId: z.string().trim().min(10).optional(),
  doctorSearch: z.string().trim().min(1).max(120).optional(),
  patientProfileId: z.string().trim().min(10).optional(),
  patientSearch: z.string().trim().min(1).max(120).optional(),
  city: z.string().trim().min(2).max(80).optional(),
});

export const adminReportTableSchema = adminReportFiltersSchema.extend({
  tab: z.enum([
    'appointmentRows',
    'topDoctors',
    'cityDemand',
    'appointmentStatus',
    'requestStatus',
  ]),
  ...paginationSchema,
});

export const auditLogListSchema = z.object({
  entityType: z.string().trim().optional(),
  actorUserId: z.string().trim().min(10).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export const createRetentionRuleSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  appliesTo: z.string().trim().min(2).max(80),
  retainDays: z.number().int().min(1).max(3650),
  legalBasis: z.string().trim().max(200).optional(),
  isActive: z.boolean().optional(),
});

export const createSecurityIncidentSchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(10).max(4000),
  severity: z.nativeEnum(SecurityIncidentSeverity),
  status: z.nativeEnum(SecurityIncidentStatus).optional(),
  assignedToUserId: z.string().trim().min(10).optional(),
  occurredAt: z.string().datetime().optional(),
  remediationNotes: z.string().trim().max(4000).optional(),
});

export const updateSecurityIncidentSchema = z.object({
  status: z.nativeEnum(SecurityIncidentStatus).optional(),
  assignedToUserId: z.string().trim().min(10).nullable().optional(),
  remediationNotes: z.string().trim().max(4000).nullable().optional(),
});

export const createAccessReviewSchema = z.object({
  subjectUserId: z.string().trim().min(10),
  reviewerUserId: z.string().trim().min(10).optional(),
  status: z.nativeEnum(AccessReviewStatus).optional(),
  notes: z.string().trim().max(2000).optional(),
  reviewedAt: z.string().datetime().optional(),
});

export const updateAccessReviewSchema = z.object({
  reviewerUserId: z.string().trim().min(10).nullable().optional(),
  status: z.nativeEnum(AccessReviewStatus).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  reviewedAt: z.string().datetime().optional(),
});

export const createDataGovernanceRequestSchema = z.object({
  subjectPatientProfileId: z.string().trim().min(10).optional(),
  subjectUserId: z.string().trim().min(10).optional(),
  type: z.nativeEnum(GovernanceRequestType),
  status: z.nativeEnum(GovernanceRequestStatus).optional(),
  handledByUserId: z.string().trim().min(10).optional(),
  notes: z.string().trim().max(2000).optional(),
  completedAt: z.string().datetime().optional(),
});

export const processDataGovernanceRequestSchema = z.object({
  status: z.nativeEnum(GovernanceRequestStatus).optional(),
  handledByUserId: z.string().trim().min(10).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  executeAction: z.boolean().optional(),
});

export const createBackupOperationSchema = z.object({
  type: z.nativeEnum(BackupOperationType),
  status: z.nativeEnum(BackupOperationStatus).optional(),
  provider: z.string().trim().max(120).optional(),
  location: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(2000).optional(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
});

export const updateBackupOperationSchema = z.object({
  status: z.nativeEnum(BackupOperationStatus).optional(),
  provider: z.string().trim().max(120).optional(),
  location: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  errorMessage: z.string().trim().max(2000).nullable().optional(),
  resultSummary: z.record(z.string(), z.any()).optional(),
  completedAt: z.string().datetime().optional(),
});

export const runRetentionRuleSchema = z.object({
  dryRun: z.boolean().optional(),
});

export const processNotificationQueueSchema = z.object({
  limit: z.number().int().min(1).max(200).optional(),
});
