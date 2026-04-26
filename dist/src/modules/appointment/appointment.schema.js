import { AppointmentStatus, Role } from '@prisma/client';
import { z } from 'zod';
export const visitDetailSchema = z.object({
    chiefComplaint: z.string().trim().max(500).optional(),
    symptoms: z.string().trim().max(1500).optional(),
    clinicalNotes: z.string().trim().max(3000).optional(),
    diagnosis: z.string().trim().max(1500).optional(),
    treatmentProvided: z.string().trim().max(2000).optional(),
    followUpInstructions: z.string().trim().max(1500).optional(),
    followUpRecommendedAt: z.string().datetime().optional(),
    bloodPressureSystolic: z.number().int().min(40).max(300).optional(),
    bloodPressureDiastolic: z.number().int().min(20).max(200).optional(),
    heartRate: z.number().int().min(20).max(260).optional(),
    temperatureC: z.number().min(30).max(45).optional(),
    oxygenSaturation: z.number().int().min(40).max(100).optional(),
    weightKg: z.number().min(1).max(500).optional(),
    heightCm: z.number().min(20).max(260).optional(),
});
export const createAppointmentSchema = z
    .object({
    doctorId: z.string().trim().min(10),
    patientProfileId: z.string().trim().min(10).optional(),
    slotId: z.string().trim().min(10).optional(),
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().optional(),
    serviceRequestId: z.string().trim().min(10).optional(),
    patientAddress: z.string().trim().min(4).max(240),
    city: z.string().trim().min(2).max(80),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    notes: z.string().trim().max(1200).optional(),
})
    .superRefine((value, ctx) => {
    if (!value.slotId && !(value.startsAt && value.endsAt)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Either a schedule slot or manual start and end times are required',
        });
    }
});
export const listAppointmentsSchema = z.object({
    doctorId: z.string().trim().min(10).optional(),
    patientProfileId: z.string().trim().min(10).optional(),
    status: z.nativeEnum(AppointmentStatus).optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
});
export const updateAppointmentStatusSchema = z.object({
    status: z.nativeEnum(AppointmentStatus),
});
export const appointmentCancellationRequestSchema = z.object({
    reason: z.string().trim().min(3).max(500),
});
export const rescheduleAppointmentSchema = z
    .object({
    slotId: z.string().trim().min(10).optional(),
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().optional(),
    patientAddress: z.string().trim().min(4).max(240).optional(),
    city: z.string().trim().min(2).max(80).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    notes: z.string().trim().max(1200).optional(),
})
    .superRefine((value, ctx) => {
    if (!value.slotId && !(value.startsAt && value.endsAt)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Either a schedule slot or manual start and end times are required',
        });
    }
});
export const appointmentCancellationDecisionSchema = z.object({
    approve: z.boolean(),
    resolutionNote: z.string().trim().min(3).max(500),
});
export const completeAppointmentSchema = z.object({
    visitSummary: z.string().trim().min(10).max(5000).optional(),
    visitDetails: visitDetailSchema.optional(),
});
export const createAdminAppointmentSchema = createAppointmentSchema.safeExtend({
    createdByRole: z.nativeEnum(Role).optional(),
});
