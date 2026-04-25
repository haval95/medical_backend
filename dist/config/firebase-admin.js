"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.messaging = void 0;
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const env_js_1 = require("./env.js");
let app = null;
try {
    if (!firebase_admin_1.default.apps.length) {
        const credPath = env_js_1.env.GOOGLE_APPLICATION_CREDENTIALS ? path_1.default.resolve(env_js_1.env.GOOGLE_APPLICATION_CREDENTIALS) : null;
        if (credPath && fs_1.default.existsSync(credPath)) {
            const serviceAccount = JSON.parse(fs_1.default.readFileSync(credPath, 'utf8'));
            app = firebase_admin_1.default.initializeApp({
                credential: firebase_admin_1.default.credential.cert(serviceAccount),
            });
        }
        else {
            app = firebase_admin_1.default.initializeApp({
                credential: firebase_admin_1.default.credential.applicationDefault(),
            });
        }
    }
    else {
        app = firebase_admin_1.default.app();
    }
}
catch (err) {
    console.error('Firebase admin initialization failed', err);
    app = null;
}
exports.messaging = app ? firebase_admin_1.default.messaging(app) : null;
