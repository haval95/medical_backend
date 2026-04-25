import { ConsentType, PatientGender } from '@prisma/client';
import { z } from 'zod';

const dateOnlySchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD format');

export const patientConsentInputSchema = z.object({
  type: z.nativeEnum(ConsentType),
  granted: z.boolean(),
  version: z.string().trim().max(40).optional(),
  source: z.string().trim().max(80).optional(),
});

export const patientRegistrationSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  referralCode: z.string().trim().min(4).max(24).optional(),
  city: z.string().trim().min(2).max(80).optional(),
  homeAddress: z.string().trim().min(4).max(200).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  dateOfBirth: dateOnlySchema.optional(),
  gender: z.nativeEnum(PatientGender).optional(),
  emergencyContactName: z.string().trim().min(2).max(120).optional(),
  emergencyContactPhone: z.string().trim().min(8).max(20).optional(),
  allergies: z.string().trim().max(1200).optional(),
  chronicConditions: z.string().trim().max(1200).optional(),
  currentMedications: z.string().trim().max(1200).optional(),
  mobilityNotes: z.string().trim().max(500).optional(),
  communicationPreferences: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(1200).optional(),
  consents: z.array(patientConsentInputSchema).max(12).optional(),
});

export const updatePatientProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  city: z.string().trim().min(2).max(80).optional(),
  homeAddress: z.string().trim().min(4).max(200).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  dateOfBirth: dateOnlySchema.optional(),
  gender: z.nativeEnum(PatientGender).optional(),
  emergencyContactName: z.string().trim().min(2).max(120).optional(),
  emergencyContactPhone: z.string().trim().min(8).max(20).optional(),
  allergies: z.string().trim().max(1200).optional(),
  chronicConditions: z.string().trim().max(1200).optional(),
  currentMedications: z.string().trim().max(1200).optional(),
  mobilityNotes: z.string().trim().max(500).optional(),
  communicationPreferences: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(1200).optional(),
  consents: z.array(patientConsentInputSchema).max(12).optional(),
});
