import {
  AccessReviewStatus,
  AppointmentStatus,
  BackupOperationStatus,
  BackupOperationType,
  ConsentType,
  DiscountStatus,
  DiscountType,
  GovernanceRequestStatus,
  GovernanceRequestType,
  NotificationDeliveryStatus,
  NotificationType,
  PatientGender,
  Permission,
  PointsTransactionType,
  PrismaClient,
  ReferralEventType,
  Role,
  ScheduleSlotStatus,
  SecurityIncidentSeverity,
  SecurityIncidentStatus,
  ServiceRequestStatus,
  ServiceRequestType,
  UserStatus,
} from '@prisma/client';
import { resolvePermissions } from '../src/utils/permissions.js';
import { buildScheduleSlots } from '../src/utils/schedule.js';

const prisma = new PrismaClient();

async function main() {
  await prisma.review.deleteMany();
  await prisma.notificationDelivery.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.pushToken.deleteMany();
  await prisma.visitDetail.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.doctorUnavailability.deleteMany();
  await prisma.doctorScheduleSlot.deleteMany();
  await prisma.pointsTransaction.deleteMany();
  await prisma.patientDiscount.deleteMany();
  await prisma.referralEvent.deleteMany();
  await prisma.dataGovernanceRequest.deleteMany();
  await prisma.accessReview.deleteMany();
  await prisma.securityIncident.deleteMany();
  await prisma.documentRetentionRule.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.patientConsent.deleteMany();
  await prisma.serviceRequest.deleteMany();
  await prisma.authChallenge.deleteMany();
  await prisma.patientProfile.deleteMany();
  await prisma.doctorCredential.deleteMany();
  await prisma.doctorLocation.deleteMany();
  await prisma.doctorProfile.deleteMany();
  await prisma.backupOperation.deleteMany();
  await prisma.discount.deleteMany();
  await prisma.user.deleteMany();

  const admin = await prisma.user.create({
    data: {
      fullName: 'Medical Admin',
      phoneNumber: '+10000000001',
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
      permissions: resolvePermissions(Role.ADMIN),
      photoUrl: 'https://i.pravatar.cc/300?img=12',
    },
  });

  const operationsAdmin = await prisma.user.create({
    data: {
      fullName: 'Operations Admin',
      phoneNumber: '+10000000002',
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
      permissions: [
        Permission.DASHBOARD_VIEW,
        Permission.USER_VIEW,
        Permission.DOCTOR_VIEW,
        Permission.PATIENT_VIEW,
        Permission.REQUEST_VIEW,
        Permission.LOCATION_VIEW,
        Permission.APPOINTMENT_VIEW,
        Permission.REVIEW_VIEW,
        Permission.REPORT_VIEW,
      ],
      photoUrl: 'https://i.pravatar.cc/300?img=14',
    },
  });

  const doctorMariam = await prisma.user.create({
    data: {
      fullName: 'Dr. Mariam Nouri',
      phoneNumber: '+10000000011',
      role: Role.DOCTOR,
      status: UserStatus.ACTIVE,
      permissions: resolvePermissions(Role.DOCTOR),
      photoUrl: 'https://i.pravatar.cc/300?img=47',
      doctorProfile: {
        create: {
          referralCode: 'MED-MARIAM',
          specialty: 'General Home Care',
          bio: 'Home-visit physician focused on post-discharge follow-up, chronic care, and family-centered visits.',
          languages: ['Arabic', 'English', 'Hungarian'],
          yearsExperience: 11,
          isAvailable: true,
          serviceRadiusKm: 18,
          onboardingPoints: 120,
          averageRating: 4.8,
          reviewCount: 1,
          completedVisitCount: 14,
          workplaceName: 'Danube Home Visit Clinic',
          workplaceAddress: 'Budapest District V, Kossuth Lajos ter 8',
          workplaceLatitude: 47.505357,
          workplaceLongitude: 19.046777,
          location: {
            create: {
              city: 'Budapest',
              addressLine: 'District V, Home Visit Hub',
              latitude: 47.497913,
              longitude: 19.040236,
            },
          },
          credentials: {
            create: [
              {
                type: 'DEGREE',
                title: 'MD, Semmelweis University',
                issuer: 'Semmelweis University',
                displayOrder: 0,
              },
              {
                type: 'CERTIFICATE',
                title: 'Home Care and Community Medicine Certificate',
                issuer: 'Budapest Medical Board',
                displayOrder: 1,
              },
            ],
          },
        },
      },
    },
    include: {
      doctorProfile: true,
    },
  });

  const doctorSamer = await prisma.user.create({
    data: {
      fullName: 'Dr. Samer Halim',
      phoneNumber: '+10000000012',
      role: Role.DOCTOR,
      status: UserStatus.ACTIVE,
      permissions: resolvePermissions(Role.DOCTOR),
      photoUrl: 'https://i.pravatar.cc/300?img=52',
      doctorProfile: {
        create: {
          referralCode: 'MED-SAMER',
          specialty: 'Chronic Care Follow-up',
          bio: 'Family physician covering recurring visits, medication checks, and elderly home support.',
          languages: ['Arabic', 'English'],
          yearsExperience: 9,
          isAvailable: true,
          serviceRadiusKm: 22,
          onboardingPoints: 100,
          averageRating: 4.4,
          reviewCount: 0,
          completedVisitCount: 9,
          workplaceName: 'Hillside Mobile Care',
          workplaceAddress: 'Budapest District XI, Bartok Bela ut 12',
          workplaceLatitude: 47.481691,
          workplaceLongitude: 19.047833,
          location: {
            create: {
              city: 'Budapest',
              addressLine: 'District XI, Mobile Care Unit',
              latitude: 47.470734,
              longitude: 19.050208,
            },
          },
          credentials: {
            create: [
              {
                type: 'DEGREE',
                title: 'MD, Ain Shams University',
                issuer: 'Ain Shams University',
                displayOrder: 0,
              },
              {
                type: 'LICENSE',
                title: 'EU General Practice License',
                issuer: 'Hungarian Chamber of Physicians',
                displayOrder: 1,
              },
            ],
          },
        },
      },
    },
    include: {
      doctorProfile: true,
    },
  });

  const referralRewardDiscount = await prisma.discount.create({
    data: {
      code: 'WELCOME15',
      title: 'Referral Welcome Discount',
      description: '15% off the first completed home visit.',
      type: DiscountType.PERCENTAGE,
      value: 15,
      isReferralReward: true,
      status: DiscountStatus.ACTIVE,
    },
  });

  const pointsDiscount = await prisma.discount.create({
    data: {
      code: 'POINTS500',
      title: '5000 HUF Cashback',
      description: 'Redeem points for a flat cashback discount.',
      type: DiscountType.FIXED_AMOUNT,
      value: 5000,
      pointsCost: 250,
      status: DiscountStatus.ACTIVE,
    },
  });

  const patientLayla = await prisma.user.create({
    data: {
      fullName: 'Layla Hassan',
      phoneNumber: '+10000000021',
      role: Role.PATIENT,
      status: UserStatus.ACTIVE,
      permissions: resolvePermissions(Role.PATIENT),
      photoUrl: 'https://i.pravatar.cc/300?img=33',
      patientProfile: {
        create: {
          city: 'Budapest',
          homeAddress: 'District XIII, River Residence 14',
          latitude: 47.518173,
          longitude: 19.066124,
          dateOfBirth: new Date('1989-02-12T00:00:00.000Z'),
          gender: PatientGender.FEMALE,
          emergencyContactName: 'Youssef Hassan',
          emergencyContactPhone: '+10000000999',
          allergies: 'Penicillin',
          chronicConditions: 'Hypertension',
          currentMedications: 'Amlodipine 5mg daily',
          mobilityNotes: 'Needs elevator access for building entry',
          communicationPreferences: 'Call before arrival and use Arabic when possible',
          notes: 'Lives with two children. Home visits after 9 AM are preferred.',
          referralCodeUsed: doctorMariam.doctorProfile!.referralCode,
          referredByDoctorId: doctorMariam.doctorProfile!.id,
          primaryDoctorId: doctorMariam.doctorProfile!.id,
          availablePoints: 145,
          lifetimePoints: 145,
        },
      },
    },
    include: {
      patientProfile: true,
    },
  });

  const patientOmar = await prisma.user.create({
    data: {
      fullName: 'Omar Kareem',
      phoneNumber: '+10000000022',
      role: Role.PATIENT,
      status: UserStatus.ACTIVE,
      permissions: resolvePermissions(Role.PATIENT),
      photoUrl: 'https://i.pravatar.cc/300?img=29',
      patientProfile: {
        create: {
          city: 'Budapest',
          homeAddress: 'District II, Hillside Home 3',
          latitude: 47.529845,
          longitude: 18.999248,
          dateOfBirth: new Date('1977-09-04T00:00:00.000Z'),
          gender: PatientGender.MALE,
          emergencyContactName: 'Nadia Kareem',
          emergencyContactPhone: '+10000000888',
          chronicConditions: 'Type 2 diabetes',
          currentMedications: 'Metformin 500mg twice daily',
          communicationPreferences: 'SMS reminder on the same day',
          primaryDoctorId: doctorSamer.doctorProfile!.id,
          availablePoints: 300,
          lifetimePoints: 300,
        },
      },
    },
    include: {
      patientProfile: true,
    },
  });

  await prisma.patientConsent.createMany({
    data: [
      {
        patientProfileId: patientLayla.patientProfile!.id,
        type: ConsentType.PRIVACY_NOTICE,
        version: '2026.04',
        source: 'MOBILE_REGISTER',
      },
      {
        patientProfileId: patientLayla.patientProfile!.id,
        type: ConsentType.DATA_PROCESSING,
        version: '2026.04',
        source: 'MOBILE_REGISTER',
      },
      {
        patientProfileId: patientLayla.patientProfile!.id,
        type: ConsentType.HOME_VISIT,
        version: '2026.04',
        source: 'MOBILE_PROFILE',
      },
      {
        patientProfileId: patientLayla.patientProfile!.id,
        type: ConsentType.LOCATION_SHARING,
        version: '2026.04',
        source: 'MOBILE_PROFILE',
      },
      {
        patientProfileId: patientOmar.patientProfile!.id,
        type: ConsentType.PRIVACY_NOTICE,
        version: '2026.04',
        source: 'MOBILE_REGISTER',
      },
      {
        patientProfileId: patientOmar.patientProfile!.id,
        type: ConsentType.DATA_PROCESSING,
        version: '2026.04',
        source: 'MOBILE_REGISTER',
      },
    ],
  });

  const laylaReferralEvent = await prisma.referralEvent.create({
    data: {
      doctorId: doctorMariam.doctorProfile!.id,
      patientProfileId: patientLayla.patientProfile!.id,
      type: ReferralEventType.PATIENT_REGISTRATION,
      referralCode: doctorMariam.doctorProfile!.referralCode,
      pointsAwarded: 120,
      discountId: referralRewardDiscount.id,
      notes: 'Referral onboarding reward',
    },
  });

  await prisma.pointsTransaction.createMany({
    data: [
      {
        patientProfileId: patientLayla.patientProfile!.id,
        type: PointsTransactionType.REFERRAL_BONUS,
        points: 120,
        balanceAfter: 120,
        referralEventId: laylaReferralEvent.id,
        notes: 'Referral welcome bonus',
      },
      {
        patientProfileId: patientLayla.patientProfile!.id,
        type: PointsTransactionType.SERVICE_COMPLETION,
        points: 25,
        balanceAfter: 145,
        notes: 'Completed visit reward',
      },
      {
        patientProfileId: patientOmar.patientProfile!.id,
        type: PointsTransactionType.ADMIN_ADJUSTMENT,
        points: 300,
        balanceAfter: 300,
        notes: 'Imported loyalty balance',
      },
    ],
  });

  await prisma.patientDiscount.createMany({
    data: [
      {
        patientProfileId: patientLayla.patientProfile!.id,
        discountId: referralRewardDiscount.id,
        status: DiscountStatus.ACTIVE,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 45),
      },
      {
        patientProfileId: patientOmar.patientProfile!.id,
        discountId: pointsDiscount.id,
        status: DiscountStatus.USED,
        usedAt: new Date(),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      },
    ],
  });

  const today = new Date();
  const fromDate = `${today.getFullYear()}-${`${today.getMonth() + 1}`.padStart(2, '0')}-${`${today.getDate()}`.padStart(2, '0')}`;
  const toDateValue = new Date(today);
  toDateValue.setDate(today.getDate() + 4);
  const toDate = `${toDateValue.getFullYear()}-${`${toDateValue.getMonth() + 1}`.padStart(2, '0')}-${`${toDateValue.getDate()}`.padStart(2, '0')}`;

  const generatedSlots = buildScheduleSlots({
    fromDate,
    toDate,
    dayStartTime: '08:00',
    dayEndTime: '16:00',
    slotMinutes: 30,
    excludedWeekdays: [5, 6],
    breakWindows: [{ startTime: '12:00', endTime: '13:00' }],
  });

  await prisma.doctorScheduleSlot.createMany({
    data: generatedSlots.flatMap((slot) => [
      {
        doctorId: doctorMariam.doctorProfile!.id,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        status: ScheduleSlotStatus.AVAILABLE,
        sourceLabel: 'SEED_TEMPLATE',
      },
      {
        doctorId: doctorSamer.doctorProfile!.id,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        status: ScheduleSlotStatus.AVAILABLE,
        sourceLabel: 'SEED_TEMPLATE',
      },
    ]),
  });

  const laylaUpcomingSlot = await prisma.doctorScheduleSlot.findFirstOrThrow({
    where: {
      doctorId: doctorMariam.doctorProfile!.id,
      status: ScheduleSlotStatus.AVAILABLE,
      startsAt: {
        gte: new Date(),
      },
    },
    orderBy: { startsAt: 'asc' },
  });

  const laylaRequest = await prisma.serviceRequest.create({
    data: {
      patientProfileId: patientLayla.patientProfile!.id,
      requestedDoctorId: doctorMariam.doctorProfile!.id,
      assignedDoctorId: doctorMariam.doctorProfile!.id,
      type: ServiceRequestType.SPECIFIC_DOCTOR,
      status: ServiceRequestStatus.ACCEPTED,
      city: 'Budapest',
      serviceAddress: patientLayla.patientProfile!.homeAddress!,
      latitude: patientLayla.patientProfile!.latitude,
      longitude: patientLayla.patientProfile!.longitude,
      preferredStartAt: laylaUpcomingSlot.startsAt,
      preferredEndAt: laylaUpcomingSlot.endsAt,
      scheduledFor: laylaUpcomingSlot.startsAt,
      notes: 'Blood pressure follow-up home visit',
      issueDescription: 'Regular follow-up after medication adjustment.',
      distanceKm: 3.1,
      isWithinDoctorRange: true,
    },
  });

  const laylaAppointment = await prisma.appointment.create({
    data: {
      serviceRequestId: laylaRequest.id,
      patientProfileId: patientLayla.patientProfile!.id,
      doctorId: doctorMariam.doctorProfile!.id,
      slotId: laylaUpcomingSlot.id,
      status: AppointmentStatus.CONFIRMED,
      startsAt: laylaUpcomingSlot.startsAt,
      endsAt: laylaUpcomingSlot.endsAt,
      patientAddress: patientLayla.patientProfile!.homeAddress!,
      city: 'Budapest',
      latitude: patientLayla.patientProfile!.latitude,
      longitude: patientLayla.patientProfile!.longitude,
      notes: 'Bring home blood pressure readings.',
      createdByRole: Role.PATIENT,
      slotDurationMinutes: 30,
      bufferMinutes: 30,
    },
  });

  await prisma.doctorScheduleSlot.update({
    where: { id: laylaUpcomingSlot.id },
    data: {
      status: ScheduleSlotStatus.BOOKED,
    },
  });

  const [bufferBefore, bufferAfter] = await Promise.all([
    prisma.doctorScheduleSlot.findFirst({
      where: {
        doctorId: doctorMariam.doctorProfile!.id,
        endsAt: laylaUpcomingSlot.startsAt,
      },
      orderBy: { startsAt: 'desc' },
    }),
    prisma.doctorScheduleSlot.findFirst({
      where: {
        doctorId: doctorMariam.doctorProfile!.id,
        startsAt: laylaUpcomingSlot.endsAt,
      },
      orderBy: { startsAt: 'asc' },
    }),
  ]);

  if (bufferBefore) {
    await prisma.doctorScheduleSlot.update({
      where: { id: bufferBefore.id },
      data: {
        status: ScheduleSlotStatus.BLOCKED,
        isBuffer: true,
        blockedReason: 'Travel buffer before appointment',
        bufferForAppointmentId: laylaAppointment.id,
      },
    });
  }

  if (bufferAfter) {
    await prisma.doctorScheduleSlot.update({
      where: { id: bufferAfter.id },
      data: {
        status: ScheduleSlotStatus.BLOCKED,
        isBuffer: true,
        blockedReason: 'Travel buffer after appointment',
        bufferForAppointmentId: laylaAppointment.id,
      },
    });
  }

  const omarRequest = await prisma.serviceRequest.create({
    data: {
      patientProfileId: patientOmar.patientProfile!.id,
      assignedDoctorId: doctorSamer.doctorProfile!.id,
      type: ServiceRequestType.ANY_AVAILABLE_DOCTOR,
      status: ServiceRequestStatus.ASSIGNED,
      city: 'Budapest',
      serviceAddress: patientOmar.patientProfile!.homeAddress!,
      latitude: patientOmar.patientProfile!.latitude,
      longitude: patientOmar.patientProfile!.longitude,
      preferredStartAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
      preferredEndAt: new Date(Date.now() + 1000 * 60 * 60 * 26),
      notes: 'Post-discharge check-up requested',
      issueDescription: 'General recovery assessment after hospital discharge.',
      distanceKm: 5.2,
      isWithinDoctorRange: true,
    },
  });

  const completedAppointmentDate = new Date();
  completedAppointmentDate.setDate(completedAppointmentDate.getDate() - 3);
  completedAppointmentDate.setHours(10, 0, 0, 0);
  const completedAppointmentEnd = new Date(completedAppointmentDate);
  completedAppointmentEnd.setMinutes(completedAppointmentEnd.getMinutes() + 30);

  const completedRequest = await prisma.serviceRequest.create({
    data: {
      patientProfileId: patientLayla.patientProfile!.id,
      requestedDoctorId: doctorMariam.doctorProfile!.id,
      assignedDoctorId: doctorMariam.doctorProfile!.id,
      type: ServiceRequestType.SPECIFIC_DOCTOR,
      status: ServiceRequestStatus.COMPLETED,
      city: 'Budapest',
      serviceAddress: patientLayla.patientProfile!.homeAddress!,
      latitude: patientLayla.patientProfile!.latitude,
      longitude: patientLayla.patientProfile!.longitude,
      scheduledFor: completedAppointmentDate,
      notes: 'Completed wound care follow-up',
      issueDescription: 'Wound dressing review and medication guidance.',
      distanceKm: 3.1,
      isWithinDoctorRange: true,
    },
  });

  const completedAppointment = await prisma.appointment.create({
    data: {
      serviceRequestId: completedRequest.id,
      patientProfileId: patientLayla.patientProfile!.id,
      doctorId: doctorMariam.doctorProfile!.id,
      status: AppointmentStatus.COMPLETED,
      startsAt: completedAppointmentDate,
      endsAt: completedAppointmentEnd,
      patientAddress: patientLayla.patientProfile!.homeAddress!,
      city: 'Budapest',
      latitude: patientLayla.patientProfile!.latitude,
      longitude: patientLayla.patientProfile!.longitude,
      notes: 'Bring all current medications.',
      visitSummary: 'Reviewed dressing progress, updated medication timing, and confirmed stable vitals.',
      createdByRole: Role.PATIENT,
      slotDurationMinutes: 30,
      bufferMinutes: 30,
      completedAt: completedAppointmentEnd,
    },
  });

  await prisma.visitDetail.create({
    data: {
      appointmentId: completedAppointment.id,
      chiefComplaint: 'Follow-up after wound dressing and blood pressure review',
      symptoms: 'Mild tenderness around dressing site, no fever',
      clinicalNotes: 'Patient alert and stable. Wound dry. No discharge. Medication adherence confirmed.',
      diagnosis: 'Healing soft tissue wound with stable hypertension',
      treatmentProvided: 'Dressing changed and medication timing reinforced',
      followUpInstructions: 'Continue dressing care, monitor blood pressure daily, return if redness increases',
      followUpRecommendedAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      bloodPressureSystolic: 128,
      bloodPressureDiastolic: 82,
      heartRate: 74,
      temperatureC: 36.8,
      oxygenSaturation: 98,
      weightKg: 68.4,
      heightCm: 167,
    },
  });

  await prisma.review.create({
    data: {
      appointmentId: completedAppointment.id,
      doctorId: doctorMariam.doctorProfile!.id,
      patientProfileId: patientLayla.patientProfile!.id,
      rating: 5,
      comment: 'Very calm and professional home visit. Explained everything clearly.',
      doctorReply: 'Thank you. I am glad the visit helped and the instructions were clear.',
      doctorReplyAt: new Date(),
    },
  });

  const adminAlert = await prisma.notification.create({
    data: {
      userId: admin.id,
      type: NotificationType.ADMIN_ALERT,
      title: 'Upcoming home visit',
      body: 'Layla Hassan has a confirmed visit with Dr. Mariam Nouri.',
      data: { appointmentId: laylaAppointment.id },
    },
  });

  const doctorNotification = await prisma.notification.create({
    data: {
      userId: doctorMariam.id,
      type: NotificationType.APPOINTMENT_CONFIRMED,
      title: 'New booked appointment',
      body: 'Layla Hassan booked a confirmed home visit.',
      data: { appointmentId: laylaAppointment.id },
    },
  });

  await prisma.notification.create({
    data: {
      userId: patientLayla.id,
      type: NotificationType.APPOINTMENT_CONFIRMED,
      title: 'Appointment confirmed',
      body: 'Your appointment with Dr. Mariam Nouri is confirmed.',
      data: { appointmentId: laylaAppointment.id },
    },
  });

  await prisma.notification.create({
    data: {
      userId: doctorSamer.id,
      type: NotificationType.REQUEST_ASSIGNED,
      title: 'Request assigned',
      body: 'A general home-service request was assigned to you.',
      data: { requestId: omarRequest.id },
    },
  });

  await prisma.notificationDelivery.createMany({
    data: [
      {
        notificationId: adminAlert.id,
        token: 'ExponentPushToken[admin-seed-token]',
        platform: 'ios',
        provider: 'expo',
        status: NotificationDeliveryStatus.QUEUED,
      },
      {
        notificationId: doctorNotification.id,
        token: 'ExponentPushToken[doctor-seed-token]',
        platform: 'android',
        provider: 'expo',
        status: NotificationDeliveryStatus.FAILED,
        attemptCount: 2,
        failureReason: 'Expo push provider returned 503',
      },
    ],
  });

  const retentionRule = await prisma.documentRetentionRule.create({
    data: {
      name: 'Short-lived authentication challenges',
      description: 'Remove expired OTP challenges after 30 days.',
      appliesTo: 'AUTH_CHALLENGE',
      retainDays: 30,
      legalBasis: 'Operational security baseline',
      lastRunAt: new Date(Date.now() - 1000 * 60 * 60 * 36),
      lastRunSummary: {
        target: 'AUTH_CHALLENGE',
        candidateCount: 12,
        deletedCount: 12,
        cutoffAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
        executedAt: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
        dryRun: false,
      },
    },
  });

  const incident = await prisma.securityIncident.create({
    data: {
      title: 'Lost phone with cached patient data',
      description: 'A field device was reported missing. The session was revoked and a review was started.',
      severity: SecurityIncidentSeverity.HIGH,
      status: SecurityIncidentStatus.INVESTIGATING,
      reportedByUserId: admin.id,
      assignedToUserId: operationsAdmin.id,
      remediationNotes: 'Remote sign-out completed. Waiting for device management confirmation.',
    },
  });

  await prisma.accessReview.create({
    data: {
      subjectUserId: operationsAdmin.id,
      reviewerUserId: admin.id,
      status: AccessReviewStatus.PENDING,
      notes: 'Quarterly permission review for operations admin.',
    },
  });

  await prisma.dataGovernanceRequest.create({
    data: {
      subjectPatientProfileId: patientLayla.patientProfile!.id,
      subjectUserId: patientLayla.id,
      requestedByUserId: admin.id,
      handledByUserId: operationsAdmin.id,
      type: GovernanceRequestType.DATA_EXPORT,
      status: GovernanceRequestStatus.IN_PROGRESS,
      notes: 'Patient requested a copy of all visit history and consent records.',
    },
  });

  await prisma.backupOperation.create({
    data: {
      type: BackupOperationType.BACKUP,
      status: BackupOperationStatus.SUCCEEDED,
      provider: 'Azure Blob Storage',
      location: 'eu-central/medical-backups/2026-04-24',
      notes: 'Nightly encrypted backup completed.',
      resultSummary: {
        tables: 27,
        durationSeconds: 182,
        archiveSizeMb: 84,
      },
      startedAt: new Date(Date.now() - 1000 * 60 * 60 * 10),
      completedAt: new Date(Date.now() - 1000 * 60 * 60 * 10 + 1000 * 182),
      initiatedByUserId: admin.id,
    },
  });

  await prisma.auditLog.createMany({
    data: [
      {
        actorUserId: admin.id,
        actorRole: Role.ADMIN,
        action: 'CREATE',
        entityType: 'DocumentRetentionRule',
        entityId: retentionRule.id,
        metadata: { source: 'seed' },
      },
      {
        actorUserId: admin.id,
        actorRole: Role.ADMIN,
        action: 'UPDATE',
        entityType: 'SecurityIncident',
        entityId: incident.id,
        metadata: { source: 'seed', status: SecurityIncidentStatus.INVESTIGATING },
      },
      {
        actorUserId: doctorMariam.id,
        actorRole: Role.DOCTOR,
        action: 'COMPLETE',
        entityType: 'Appointment',
        entityId: completedAppointment.id,
        metadata: { source: 'seed' },
      },
    ],
  });

  console.log('Seed completed');
  console.log({
    admin: admin.phoneNumber,
    doctorReferralCodes: [
      doctorMariam.doctorProfile!.referralCode,
      doctorSamer.doctorProfile!.referralCode,
    ],
    patientPhones: [patientLayla.phoneNumber, patientOmar.phoneNumber],
    mockOtp: '123456',
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
