import { z } from 'zod';

const optionalString = z.string().trim().min(1).optional();
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

export const updateDoctorLocationSchema = z.object({
  city: z.string().trim().min(2).max(80),
  addressLine: z.string().trim().min(4).max(200),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  notes: z.string().trim().max(200).optional(),
});

export const updateDoctorProfileSchema = z.object({
  fullName: optionalString,
  photoUrl: z.string().trim().url().nullable().optional(),
  specialty: z.string().trim().max(120).nullable().optional(),
  bio: z.string().trim().max(1200).nullable().optional(),
  yearsExperience: z.number().int().min(0).max(60).optional(),
  consultationFee: z.number().int().min(0).max(500000).optional(),
  languages: z.array(z.string().trim().min(2).max(40)).max(12).optional(),
  serviceRadiusKm: z.number().int().min(1).max(200).optional(),
  defaultSlotMinutes: slotLengthSchema.optional(),
  defaultBufferMinutes: bufferMinutesSchema.optional(),
  generalWorkingHours: z.array(workingHourEntrySchema).length(7).optional(),
  isAvailable: z.boolean().optional(),
  workplaceName: z.string().trim().max(120).nullable().optional(),
  workplaceAddress: z.string().trim().max(240).nullable().optional(),
  workplaceLatitude: z.number().min(-90).max(90).nullable().optional(),
  workplaceLongitude: z.number().min(-180).max(180).nullable().optional(),
  credentials: z
    .array(
      z.object({
        type: z.enum(['DEGREE', 'CERTIFICATE', 'LICENSE', 'OTHER']),
        title: z.string().trim().min(2).max(160),
        issuer: z.string().trim().max(160).optional(),
        awardedAt: z.string().datetime().optional(),
        documentUrl: z.string().trim().url().optional(),
        notes: z.string().trim().max(500).optional(),
      })
    )
    .max(24)
    .optional(),
});

export const updateDoctorAvailabilitySchema = z.object({
  isAvailable: z.boolean(),
});

export const listDoctorSlotsSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export const createScheduleTemplateSchema = z.object({
  fromDate: z.string().date(),
  toDate: z.string().date(),
  dayStartTime: z.string().regex(/^\d{2}:\d{2}$/),
  dayEndTime: z.string().regex(/^\d{2}:\d{2}$/),
  slotMinutes: slotLengthSchema.optional(),
  excludedWeekdays: z.array(z.number().int().min(0).max(6)).optional(),
  excludedDates: z.array(z.string().date()).optional(),
  breakWindows: z
    .array(
      z.object({
        startTime: z.string().regex(/^\d{2}:\d{2}$/),
        endTime: z.string().regex(/^\d{2}:\d{2}$/),
      })
    )
    .optional(),
  sourceLabel: z.string().trim().max(60).optional(),
});

export const createDoctorUnavailabilitySchema = z.object({
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  reason: z.string().trim().max(240).optional(),
});

export const createDoctorScheduleSlotSchema = z.object({
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  sourceLabel: z.string().trim().max(60).optional(),
});

export const updateDoctorScheduleSlotSchema = z
  .object({
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().optional(),
    blockedReason: z.string().trim().max(240).nullable().optional(),
    status: z.enum(['AVAILABLE', 'UNAVAILABLE']).optional(),
  })
  .superRefine((value, ctx) => {
    if (!Object.keys(value).length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one slot field must be provided',
      });
    }
  });
