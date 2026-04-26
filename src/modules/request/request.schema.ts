import { ServiceRequestStatus, ServiceRequestType } from '@prisma/client';
import { z } from 'zod';

export const createRequestSchema = z
  .object({
    type: z.nativeEnum(ServiceRequestType),
    requestedDoctorId: z.string().trim().min(10).optional(),
    serviceAddress: z.string().trim().min(4).max(200),
    city: z.string().trim().min(2).max(80),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    preferredStartAt: z.string().datetime().optional(),
    preferredEndAt: z.string().datetime().optional(),
    scheduledFor: z.string().datetime().optional(),
    notes: z.string().trim().max(500).optional(),
    issueDescription: z.string().trim().max(1200).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.type === ServiceRequestType.SPECIFIC_DOCTOR && !value.requestedDoctorId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['requestedDoctorId'],
        message: 'A doctor must be selected for a specific-doctor request',
      });
    }

    if (value.preferredStartAt && value.preferredEndAt) {
      const start = new Date(value.preferredStartAt);
      const end = new Date(value.preferredEndAt);

      if (start >= end) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['preferredEndAt'],
          message: 'Preferred end time must be after the preferred start time',
        });
      }
    }
  });

export const updateRequestStatusSchema = z.object({
  status: z.nativeEnum(ServiceRequestStatus),
});

export const assignRequestSchema = z.object({
  doctorId: z.string().trim().min(10),
});

export const rejectRequestSchema = z.object({
  reason: z.string().trim().min(3).max(500).optional(),
});
