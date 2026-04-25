import { messaging } from '../config/firebase-admin.js';

export const sendOrderStatusPush = async (opts: {
  token: string;
  orderId: string;
  orderNumber?: number | null;
  status: string;
  language?: string;
}) => {
  if (!messaging) {
    console.warn('[Push] Skipping push, Firebase Admin not ready');
    return;
  }

  const { token, orderId, orderNumber, status, language = 'en' } = opts;

  // Translation Helpers
  const getTitle = (lang: string, num?: number | null) => {
    if (lang === 'ku') return num ? `داواکاری #${num}` : 'نوێکردنەوەی داواکاری';
    if (lang === 'ar') return num ? `الطلب #${num}` : 'تحديث الطلب';
    return num ? `Order #${num}` : 'Order Update';
  };

  const getStatusText = (lang: string, status: string) => {
    const map: Record<string, Record<string, string>> = {
      PENDING: { ku: 'چاوەڕوان', ar: 'قيد الانتظار' },
      ACCEPTED: { ku: 'قبوڵکرا', ar: 'مقبول' },
      PREPARING: { ku: 'ئامادە دەکرێت', ar: 'جاري التحضير' },
      READY_FOR_PICKUP: { ku: 'ئامادەیە بۆ برد', ar: 'جاهز للاستلام' },
      OUT_FOR_DELIVERY: { ku: 'لەڕێگایە', ar: 'في الطريق' },
      DELIVERED: { ku: 'گەیشت', ar: 'تم التوصيل' },
      CANCELLED: { ku: 'هاڵوەشایەوە', ar: 'ملغي' },
      DRIVER_ASSIGNED: { ku: 'شۆفێر دیاریکرا', ar: 'تم تعيين سائق' },
    };
    
    // Fallback to English/Clean status
    if (!map[status] || !map[status][lang]) {
      return status.replace(/_/g, ' ');
    }
    return map[status][lang];
  };

  const getBody = (lang: string, status: string) => {
    const statusText = getStatusText(lang, status);
    if (lang === 'ku') return `دۆخی داواکاری گۆڕدرا بۆ ${statusText}`;
    if (lang === 'ar') return `تم تغيير حالة الطلب إلى ${statusText}`;
    return `Status changed to ${statusText}`;
  };

  const title = getTitle(language, orderNumber);
  const body = getBody(language, status);

  try {
    await messaging.send({
      token,
      notification: {
        title,
        body,
      },
      data: {
        orderId,
        status,
        type: 'ORDER_STATUS',
      },
    });
  } catch (err) {
    console.error('[Push] Failed to send order status push', err);
  }
};
