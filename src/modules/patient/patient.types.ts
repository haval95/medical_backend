import { z } from 'zod';
import { patientRegistrationSchema } from './patient.schema.js';

export type PatientRegistrationInput = z.infer<typeof patientRegistrationSchema> & {
  phoneNumber: string;
};
