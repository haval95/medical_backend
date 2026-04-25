import prisma from './prisma.js';
import { messaging } from '../config/firebase-admin.js';

export const sendAdminNotification = async (payload) => {
  console.log('AdminNotify invoked', { hasMessaging: Boolean(messaging) });
  if (!messaging) {
    console.warn('Admin notification skipped: messaging not initialized (check GOOGLE_APPLICATION_CREDENTIALS and restart server)');
    return;
  }

  const admins = await prisma.user.findMany({
    where: { role: { in: ['ADMIN'] }, pushToken: { not: null } },
    select: { pushToken: true },
  });
  const tokens = admins.map((a) => a.pushToken).filter(Boolean);
  if (!tokens.length) {
    console.warn('Admin notification skipped: no admin push tokens found');
    return;
  }

  console.log('Admin notification payload', {
    tokens: tokens.length,
    orderId: payload.orderId,
    shopId: payload.shopId,
    title: payload.title,
  });

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
    const res = await messaging.sendEachForMulticast(message);
    console.log(
      `Admin notification sent to ${tokens.length} tokens. Success: ${res.successCount}, Fail: ${res.failureCount}`
    );
    if (res.failureCount && res.responses) {
      const errors = res.responses
        .map((r, idx) => (!r.success ? { idx, error: r.error?.message } : null))
        .filter(Boolean);
      if (errors.length) {
        console.warn('Admin notification failures', errors);
      }
    }
  } catch (err) {
    console.error('Failed to send admin notification', err);
  }
};
