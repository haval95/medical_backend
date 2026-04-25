"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendAdminNotification = void 0;
const prisma_js_1 = __importDefault(require("./prisma.js"));
const firebase_admin_js_1 = require("../config/firebase-admin.js");
const sendAdminNotification = async (payload) => {
    if (!firebase_admin_js_1.messaging) {
        console.warn('Admin notification skipped: messaging not initialized (check GOOGLE_APPLICATION_CREDENTIALS and restart server)');
        return;
    }
    const admins = await prisma_js_1.default.user.findMany({
        where: { role: { in: ['ADMIN'] }, pushToken: { not: null } },
        select: { pushToken: true },
    });
    const tokens = admins.map((a) => a.pushToken).filter(Boolean);
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
        await firebase_admin_js_1.messaging.sendEachForMulticast(message);
    }
    catch (err) {
        console.error('Failed to send admin notification', err);
    }
};
exports.sendAdminNotification = sendAdminNotification;
