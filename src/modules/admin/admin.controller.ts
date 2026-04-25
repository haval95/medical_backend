import type { Request, Response } from 'express';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  adjustPointsSchema,
  adminDoctorDirectorySchema,
  adminListAppointmentsSchema,
  adminPatientDirectorySchema,
  adminRequestDirectorySchema,
  adminReviewDirectorySchema,
  adminListUsersSchema,
  adminReportFiltersSchema,
  adminReportTableSchema,
  auditLogListSchema,
  createAccessReviewSchema,
  createAdminUserSchema,
  createBackupOperationSchema,
  createDataGovernanceRequestSchema,
  createDiscountSchema,
  createRetentionRuleSchema,
  createSecurityIncidentSchema,
  processDataGovernanceRequestSchema,
  processNotificationQueueSchema,
  runRetentionRuleSchema,
  uploadAdminDoctorPhotoSchema,
  updateAdminDoctorSchema,
  updateAdminPatientSchema,
  updateAdminUserSchema,
  updateAccessReviewSchema,
  updateBackupOperationSchema,
  updateDiscountSchema,
  updateSecurityIncidentSchema,
} from './admin.schema.js';
import {
  adjustAdminPoints,
  createAccessReview,
  createAdminAppointment,
  createAdminDiscount,
  createAdminDoctorScheduleTemplate,
  createAdminDoctorUnavailability,
  createAdminManagedUser,
  createBackupOperation,
  createDataGovernanceRequest,
  createRetentionRule,
  createSecurityIncident,
  getAdminAppointmentById,
  getAdminComplianceOverview,
  getAdminDashboard,
  getAdminDoctorById,
  getAdminDoctorSlots,
  getAdminLocationOverview,
  getAdminNotificationQueue,
  getAdminPatientById,
  getAdminReportOverview,
  getAdminReportTable,
  getAdminRequestById,
  getAdminReviewById,
  getAdminRequests,
  getPermissionCatalog,
  listAdminAppointmentDirectory,
  listAdminDoctorDirectory,
  listAccessReviews,
  listAdminAppointments,
  listAdminDiscounts,
  listAdminDoctors,
  listAdminPatientDirectory,
  listAdminPatients,
  listAdminReferrals,
  listAdminRequestDirectory,
  listAdminReviewDirectory,
  listAdminReviews,
  listAdminUsers,
  listAuditLogs,
  listBackupOperations,
  listDataGovernanceRequests,
  moderateAdminReview,
  listRetentionRules,
  listSecurityIncidents,
  processAdminNotificationQueue,
  processDataGovernanceRequest,
  runRetentionRule,
  updateAdminDiscount,
  updateAdminDoctor,
  updateAdminManagedUser,
  updateAdminPatient,
  updateAccessReview,
  updateBackupOperation,
  updateSecurityIncident,
  uploadAdminDoctorPhoto,
} from './admin.service.js';
import {
  createDoctorUnavailabilitySchema,
  createScheduleTemplateSchema,
} from '../doctor/doctor.schema.js';
import { moderateReviewSchema } from '../review/review.schema.js';
import { createAppointmentSchema } from '../appointment/appointment.schema.js';

export const dashboard = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAdminDashboard();
  res.json(ApiResponse.success('Admin dashboard retrieved successfully', data));
});

export const users = asyncHandler(async (req: Request, res: Response) => {
  const filters = adminListUsersSchema.parse(req.query);
  const data = await listAdminUsers(filters);
  res.json(ApiResponse.success('Admin users retrieved successfully', data));
});

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const payload = createAdminUserSchema.parse(req.body);
  const data = await createAdminManagedUser(payload);
  res.status(201).json(ApiResponse.success('User created successfully', data));
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const payload = updateAdminUserSchema.parse(req.body);
  const data = await updateAdminManagedUser(req.params.userId, payload);
  res.json(ApiResponse.success('User updated successfully', data));
});

export const requests = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAdminRequests();
  res.json(ApiResponse.success('Admin requests retrieved successfully', data));
});

export const requestDirectory = asyncHandler(async (req: Request, res: Response) => {
  const filters = adminRequestDirectorySchema.parse(req.query);
  const data = await listAdminRequestDirectory(filters);
  res.json(ApiResponse.success('Admin request directory retrieved successfully', data));
});

export const requestById = asyncHandler(async (req: Request, res: Response) => {
  const data = await getAdminRequestById(req.params.requestId);
  res.json(ApiResponse.success('Admin request retrieved successfully', data));
});

export const doctors = asyncHandler(async (_req: Request, res: Response) => {
  const data = await listAdminDoctors();
  res.json(ApiResponse.success('Admin doctors retrieved successfully', data));
});

export const doctorDirectory = asyncHandler(async (req: Request, res: Response) => {
  const filters = adminDoctorDirectorySchema.parse(req.query);
  const data = await listAdminDoctorDirectory(filters);
  res.json(ApiResponse.success('Admin doctor directory retrieved successfully', data));
});

export const doctorById = asyncHandler(async (req: Request, res: Response) => {
  const data = await getAdminDoctorById(req.params.doctorId);
  res.json(ApiResponse.success('Admin doctor retrieved successfully', data));
});

export const updateDoctor = asyncHandler(async (req: Request, res: Response) => {
  const payload = updateAdminDoctorSchema.parse(req.body);
  const data = await updateAdminDoctor(req.params.doctorId, payload);
  res.json(ApiResponse.success('Doctor updated successfully', data));
});

export const uploadDoctorPhoto = asyncHandler(async (req: Request, res: Response) => {
  const payload = uploadAdminDoctorPhotoSchema.parse(req.body);
  const data = await uploadAdminDoctorPhoto(payload);
  res.status(201).json(ApiResponse.success('Doctor profile photo uploaded successfully', data));
});

export const doctorSlots = asyncHandler(async (req: Request, res: Response) => {
  const filters = adminListAppointmentsSchema.parse(req.query);
  const data = await getAdminDoctorSlots(req.params.doctorId, filters.from, filters.to);
  res.json(ApiResponse.success('Doctor slots retrieved successfully', data));
});

export const createDoctorScheduleTemplate = asyncHandler(async (req: Request, res: Response) => {
  const payload = createScheduleTemplateSchema.parse(req.body);
  const data = await createAdminDoctorScheduleTemplate(req.params.doctorId, payload);
  res
    .status(201)
    .json(ApiResponse.success('Doctor schedule applied successfully', data));
});

export const createDoctorUnavailability = asyncHandler(async (req: Request, res: Response) => {
  const payload = createDoctorUnavailabilitySchema.parse(req.body);
  const data = await createAdminDoctorUnavailability(req.params.doctorId, payload);
  res.status(201).json(ApiResponse.success('Doctor unavailability created successfully', data));
});

export const patients = asyncHandler(async (_req: Request, res: Response) => {
  const data = await listAdminPatients();
  res.json(ApiResponse.success('Admin patients retrieved successfully', data));
});

export const patientDirectory = asyncHandler(async (req: Request, res: Response) => {
  const filters = adminPatientDirectorySchema.parse(req.query);
  const data = await listAdminPatientDirectory(filters);
  res.json(ApiResponse.success('Admin patient directory retrieved successfully', data));
});

export const patientById = asyncHandler(async (req: Request, res: Response) => {
  const data = await getAdminPatientById(req.params.patientId);
  res.json(ApiResponse.success('Admin patient retrieved successfully', data));
});

export const updatePatient = asyncHandler(async (req: Request, res: Response) => {
  const payload = updateAdminPatientSchema.parse(req.body);
  const data = await updateAdminPatient(req.params.patientId, payload);
  res.json(ApiResponse.success('Patient updated successfully', data));
});

export const referrals = asyncHandler(async (_req: Request, res: Response) => {
  const data = await listAdminReferrals();
  res.json(ApiResponse.success('Admin referrals retrieved successfully', data));
});

export const discounts = asyncHandler(async (_req: Request, res: Response) => {
  const data = await listAdminDiscounts();
  res.json(ApiResponse.success('Admin discounts retrieved successfully', data));
});

export const createDiscount = asyncHandler(async (req: Request, res: Response) => {
  const payload = createDiscountSchema.parse(req.body);
  const data = await createAdminDiscount(payload);
  res.status(201).json(ApiResponse.success('Discount created successfully', data));
});

export const updateDiscount = asyncHandler(async (req: Request, res: Response) => {
  const payload = updateDiscountSchema.parse(req.body);
  const data = await updateAdminDiscount(req.params.discountId, payload);
  res.json(ApiResponse.success('Discount updated successfully', data));
});

export const adjustPoints = asyncHandler(async (req: Request, res: Response) => {
  const payload = adjustPointsSchema.parse(req.body);
  const data = await adjustAdminPoints(payload.patientProfileId, payload.points, payload.notes);
  res.json(ApiResponse.success('Patient points adjusted successfully', data));
});

export const permissions = asyncHandler(async (_req: Request, res: Response) => {
  const data = getPermissionCatalog();
  res.json(ApiResponse.success('Permission catalog retrieved successfully', data));
});

export const locations = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAdminLocationOverview();
  res.json(ApiResponse.success('Admin location overview retrieved successfully', data));
});

export const appointments = asyncHandler(async (req: Request, res: Response) => {
  const filters = adminListAppointmentsSchema.parse(req.query);
  const data = await listAdminAppointments(filters);
  res.json(ApiResponse.success('Admin appointments retrieved successfully', data));
});

export const appointmentDirectory = asyncHandler(async (req: Request, res: Response) => {
  const filters = adminListAppointmentsSchema.parse(req.query);
  const data = await listAdminAppointmentDirectory(filters);
  res.json(ApiResponse.success('Admin appointment directory retrieved successfully', data));
});

export const appointmentById = asyncHandler(async (req: Request, res: Response) => {
  const data = await getAdminAppointmentById(req.params.appointmentId);
  res.json(ApiResponse.success('Admin appointment retrieved successfully', data));
});

export const createAppointment = asyncHandler(async (req: Request, res: Response) => {
  const payload = createAppointmentSchema.parse(req.body);
  const data = await createAdminAppointment(req.user!.id, payload);
  res.status(201).json(ApiResponse.success('Admin appointment created successfully', data));
});

export const reviews = asyncHandler(async (_req: Request, res: Response) => {
  const data = await listAdminReviews();
  res.json(ApiResponse.success('Admin reviews retrieved successfully', data));
});

export const reviewDirectory = asyncHandler(async (req: Request, res: Response) => {
  const filters = adminReviewDirectorySchema.parse(req.query);
  const data = await listAdminReviewDirectory(filters);
  res.json(ApiResponse.success('Admin review directory retrieved successfully', data));
});

export const reviewById = asyncHandler(async (req: Request, res: Response) => {
  const data = await getAdminReviewById(req.params.reviewId);
  res.json(ApiResponse.success('Admin review retrieved successfully', data));
});

export const moderateReview = asyncHandler(async (req: Request, res: Response) => {
  const payload = moderateReviewSchema.parse(req.body);
  const data = await moderateAdminReview(req.params.reviewId, payload);
  res.json(ApiResponse.success('Review moderation updated successfully', data));
});

export const reports = asyncHandler(async (req: Request, res: Response) => {
  const filters = adminReportFiltersSchema.parse(req.query);
  const data = await getAdminReportOverview(filters);
  res.json(ApiResponse.success('Admin report overview generated successfully', data));
});

export const reportTable = asyncHandler(async (req: Request, res: Response) => {
  const filters = adminReportTableSchema.parse(req.query);
  const data = await getAdminReportTable(filters);
  res.json(ApiResponse.success('Admin report table generated successfully', data));
});

export const complianceOverview = asyncHandler(async (_req: Request, res: Response) => {
  const data = await getAdminComplianceOverview();
  res.json(ApiResponse.success('Compliance overview retrieved successfully', data));
});

export const auditLogs = asyncHandler(async (req: Request, res: Response) => {
  const filters = auditLogListSchema.parse(req.query);
  const data = await listAuditLogs(filters);
  res.json(ApiResponse.success('Audit logs retrieved successfully', data));
});

export const retentionRules = asyncHandler(async (_req: Request, res: Response) => {
  const data = await listRetentionRules();
  res.json(ApiResponse.success('Retention rules retrieved successfully', data));
});

export const createRetentionRuleRecord = asyncHandler(async (req: Request, res: Response) => {
  const payload = createRetentionRuleSchema.parse(req.body);
  const data = await createRetentionRule(payload);
  res.status(201).json(ApiResponse.success('Retention rule created successfully', data));
});

export const runRetentionRuleRecord = asyncHandler(async (req: Request, res: Response) => {
  const payload = runRetentionRuleSchema.parse(req.body ?? {});
  const data = await runRetentionRule(req.params.ruleId, payload);
  res.json(ApiResponse.success('Retention rule executed successfully', data));
});

export const securityIncidents = asyncHandler(async (_req: Request, res: Response) => {
  const data = await listSecurityIncidents();
  res.json(ApiResponse.success('Security incidents retrieved successfully', data));
});

export const createSecurityIncidentRecord = asyncHandler(async (req: Request, res: Response) => {
  const payload = createSecurityIncidentSchema.parse(req.body);
  const data = await createSecurityIncident(req.user!.id, payload);
  res.status(201).json(ApiResponse.success('Security incident created successfully', data));
});

export const updateSecurityIncidentRecord = asyncHandler(async (req: Request, res: Response) => {
  const payload = updateSecurityIncidentSchema.parse(req.body);
  const data = await updateSecurityIncident(req.params.incidentId, payload);
  res.json(ApiResponse.success('Security incident updated successfully', data));
});

export const accessReviews = asyncHandler(async (_req: Request, res: Response) => {
  const data = await listAccessReviews();
  res.json(ApiResponse.success('Access reviews retrieved successfully', data));
});

export const createAccessReviewRecord = asyncHandler(async (req: Request, res: Response) => {
  const payload = createAccessReviewSchema.parse(req.body);
  const data = await createAccessReview(req.user!.id, payload);
  res.status(201).json(ApiResponse.success('Access review created successfully', data));
});

export const updateAccessReviewRecord = asyncHandler(async (req: Request, res: Response) => {
  const payload = updateAccessReviewSchema.parse(req.body);
  const data = await updateAccessReview(req.params.reviewId, req.user!.id, payload);
  res.json(ApiResponse.success('Access review updated successfully', data));
});

export const dataGovernanceRequests = asyncHandler(async (_req: Request, res: Response) => {
  const data = await listDataGovernanceRequests();
  res.json(ApiResponse.success('Data governance requests retrieved successfully', data));
});

export const createDataGovernanceRequestRecord = asyncHandler(
  async (req: Request, res: Response) => {
    const payload = createDataGovernanceRequestSchema.parse(req.body);
    const data = await createDataGovernanceRequest(req.user!.id, payload);
    res
      .status(201)
      .json(ApiResponse.success('Data governance request created successfully', data));
  }
);

export const processDataGovernanceRequestRecord = asyncHandler(
  async (req: Request, res: Response) => {
    const payload = processDataGovernanceRequestSchema.parse(req.body);
    const data = await processDataGovernanceRequest(req.params.requestId, req.user!.id, payload);
    res.json(ApiResponse.success('Data governance request updated successfully', data));
  }
);

export const backupOperations = asyncHandler(async (_req: Request, res: Response) => {
  const data = await listBackupOperations();
  res.json(ApiResponse.success('Backup operations retrieved successfully', data));
});

export const createBackupOperationRecord = asyncHandler(async (req: Request, res: Response) => {
  const payload = createBackupOperationSchema.parse(req.body);
  const data = await createBackupOperation(req.user!.id, payload);
  res.status(201).json(ApiResponse.success('Backup operation created successfully', data));
});

export const updateBackupOperationRecord = asyncHandler(async (req: Request, res: Response) => {
  const payload = updateBackupOperationSchema.parse(req.body);
  const data = await updateBackupOperation(req.params.operationId, payload);
  res.json(ApiResponse.success('Backup operation updated successfully', data));
});

export const notificationQueue = asyncHandler(async (req: Request, res: Response) => {
  const payload = processNotificationQueueSchema.parse({
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });
  const data = await getAdminNotificationQueue(payload.limit);
  res.json(ApiResponse.success('Notification queue retrieved successfully', data));
});

export const processNotificationQueueRecord = asyncHandler(
  async (req: Request, res: Response) => {
    const payload = processNotificationQueueSchema.parse(req.body ?? {});
    const data = await processAdminNotificationQueue(payload.limit);
    res.json(ApiResponse.success('Notification queue processed successfully', data));
  }
);
