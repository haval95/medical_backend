import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { env } from './env.js';

let app = null;

try {
  if (!admin.apps.length) {
    const credPath = env.GOOGLE_APPLICATION_CREDENTIALS ? path.resolve(env.GOOGLE_APPLICATION_CREDENTIALS) : null;
    if (credPath && fs.existsSync(credPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(credPath, 'utf8'));
      app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } else {
      app = admin.initializeApp({
        credential: admin.credential.applicationDefault(),
      });
    }
  } else {
    app = admin.app();
  }
} catch (err) {
  console.error('Firebase admin initialization failed', err);
  app = null;
}

export const messaging = app ? admin.messaging(app) : null;
