import prisma from './prisma.js';
import { messaging } from '../config/firebase-admin.js';

interface AdminNotificationPayload {
  title: string;
  body: string;
  orderId?: string;
  shopId?: string;
}

export const sendAdminNotification = async (payload: AdminNotificationPayload) => {
  if (!messaging) {
    console.warn('Admin notification skipped: messaging not initialized (check GOOGLE_APPLICATION_CREDENTIALS and restart server)');
    return;
  }

  const admins = await prisma.user.findMany({
    where: { role: { in: ['ADMIN'] }, pushToken: { not: null } },
    select: { pushToken: true },
  });
  const tokens = admins.map((a) => a.pushToken!).filter(Boolean);
  if (!tokens.length) {
    console.warn('Admin notification skipped: no admin push tokens found');
    return;
  }

  const message = {
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: {
      type: 'order',
      orderId: payload.orderId ?? '',
      shopId: payload.shopId ?? '',
    },
    tokens,
  };

  try {
    await messaging.sendEachForMulticast(message);
  } catch (err) {
    console.error('Failed to send admin notification', err);
  }
};
