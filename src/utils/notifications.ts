import { NotificationDeliveryStatus, NotificationType, Prisma } from '@prisma/client';
import { prisma } from '../prisma/client.js';

export interface NotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Prisma.InputJsonValue;
}

const MAX_DELIVERY_ATTEMPTS = 3;
const DEFAULT_PROVIDER = 'expo';

const createDeliveryPayload = (
  delivery: Prisma.NotificationDeliveryGetPayload<{
    include: {
      notification: true;
    };
  }>
) => ({
  to: delivery.token,
  title: delivery.notification.title,
  body: delivery.notification.body,
  data: delivery.notification.data,
  sound: 'default',
});

const sendExpoPushBatch = async (
  deliveries: Prisma.NotificationDeliveryGetPayload<{
    include: {
      notification: true;
    };
  }>[]
) => {
  if (!deliveries.length) {
    return;
  }

  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(deliveries.map(createDeliveryPayload)),
  });

  if (!response.ok) {
    throw new Error(`Expo push provider returned ${response.status}`);
  }
};

const queueNotificationDeliveries = async (notificationId: string, userId: string) => {
  const activeTokens = await prisma.pushToken.findMany({
    where: {
      userId,
      isActive: true,
    },
    select: {
      token: true,
      platform: true,
    },
  });

  if (!activeTokens.length) {
    return [];
  }

  return Promise.all(
    activeTokens.map((entry) =>
      prisma.notificationDelivery.create({
        data: {
          notificationId,
          token: entry.token,
          platform: entry.platform,
          provider: DEFAULT_PROVIDER,
        },
      })
    )
  );
};

export const processQueuedNotificationDeliveries = async (limit = 50) => {
  const deliveries = await prisma.notificationDelivery.findMany({
    where: {
      status: {
        in: [NotificationDeliveryStatus.QUEUED, NotificationDeliveryStatus.FAILED],
      },
      attemptCount: {
        lt: MAX_DELIVERY_ATTEMPTS,
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
    take: limit,
    include: {
      notification: true,
    },
  });

  if (!deliveries.length) {
    return {
      queuedCount: 0,
      sentCount: 0,
      failedCount: 0,
    };
  }

  await Promise.all(
    deliveries.map((delivery) =>
      prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: NotificationDeliveryStatus.RUNNING,
          attemptCount: {
            increment: 1,
          },
          lastAttemptAt: new Date(),
          failureReason: null,
        },
      })
    )
  );

  const providerGroups = deliveries.reduce<
    Record<
      string,
      Prisma.NotificationDeliveryGetPayload<{
        include: {
          notification: true;
        };
      }>[]
    >
  >((groups, delivery) => {
    groups[delivery.provider] ??= [];
    groups[delivery.provider].push(delivery);
    return groups;
  }, {});

  let sentCount = 0;
  let failedCount = 0;

  for (const [provider, providerDeliveries] of Object.entries(providerGroups)) {
    try {
      if (provider !== DEFAULT_PROVIDER) {
        throw new Error(`Unsupported notification provider: ${provider}`);
      }

      await sendExpoPushBatch(providerDeliveries);

      await Promise.all(
        providerDeliveries.map((delivery) =>
          prisma.notificationDelivery.update({
            where: { id: delivery.id },
            data: {
              status: NotificationDeliveryStatus.SENT,
              deliveredAt: new Date(),
              failureReason: null,
            },
          })
        )
      );
      sentCount += providerDeliveries.length;
    } catch (error) {
      const failureReason =
        error instanceof Error ? error.message : 'Push delivery failed unexpectedly';

      await Promise.all(
        providerDeliveries.map((delivery) =>
          prisma.notificationDelivery.update({
            where: { id: delivery.id },
            data: {
              status: NotificationDeliveryStatus.FAILED,
              failureReason,
            },
          })
        )
      );
      failedCount += providerDeliveries.length;
    }
  }

  return {
    queuedCount: deliveries.length,
    sentCount,
    failedCount,
  };
};

export const getNotificationQueueOverview = async (limit = 50) => {
  const [queued, running, failed, sentToday, deliveries] = await Promise.all([
    prisma.notificationDelivery.count({
      where: {
        status: NotificationDeliveryStatus.QUEUED,
      },
    }),
    prisma.notificationDelivery.count({
      where: {
        status: NotificationDeliveryStatus.RUNNING,
      },
    }),
    prisma.notificationDelivery.count({
      where: {
        status: NotificationDeliveryStatus.FAILED,
      },
    }),
    prisma.notificationDelivery.count({
      where: {
        status: NotificationDeliveryStatus.SENT,
        deliveredAt: {
          gte: new Date(Date.now() - 1000 * 60 * 60 * 24),
        },
      },
    }),
    prisma.notificationDelivery.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      include: {
        notification: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                role: true,
              },
            },
          },
        },
      },
    }),
  ]);

  return {
    queued,
    running,
    failed,
    sentToday,
    deliveries: deliveries.map((delivery) => ({
      id: delivery.id,
      status: delivery.status,
      provider: delivery.provider,
      platform: delivery.platform,
      token: delivery.token,
      attemptCount: delivery.attemptCount,
      lastAttemptAt: delivery.lastAttemptAt,
      deliveredAt: delivery.deliveredAt,
      failureReason: delivery.failureReason,
      createdAt: delivery.createdAt,
      notification: {
        id: delivery.notification.id,
        title: delivery.notification.title,
        body: delivery.notification.body,
        type: delivery.notification.type,
        user: delivery.notification.user,
      },
    })),
  };
};

export const createNotification = async (input: NotificationInput) => {
  const notification = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      data: input.data,
    },
  });

  await queueNotificationDeliveries(notification.id, input.userId);
  await processQueuedNotificationDeliveries(20);

  return notification;
};

export const createNotifications = async (inputs: NotificationInput[]) =>
  Promise.all(inputs.map((input) => createNotification(input)));

export const registerPushToken = async (
  userId: string,
  input: { token: string; platform: string }
) =>
  prisma.pushToken.upsert({
    where: { token: input.token },
    update: {
      userId,
      platform: input.platform,
      isActive: true,
    },
    create: {
      userId,
      token: input.token,
      platform: input.platform,
      isActive: true,
    },
  });

export const listMyNotifications = async (userId: string) =>
  prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

export const markNotificationRead = async (userId: string, notificationId: string) =>
  prisma.notification.updateMany({
    where: {
      id: notificationId,
      userId,
    },
    data: {
      readAt: new Date(),
    },
  });
