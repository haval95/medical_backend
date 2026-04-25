"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const zod_1 = require("zod");
dotenv_1.default.config();
const envSchema = zod_1.z.object({
    DATABASE_URL: zod_1.z.string().url(),
    PORT: zod_1.z.string().default('3000'),
    JWT_SECRET: zod_1.z.string().min(10),
    ADMIN_COOKIE_SECRET: zod_1.z.string().min(10),
    SESSION_SECRET: zod_1.z.string().min(10),
    DO_SPACES_ENDPOINT: zod_1.z.string().url(),
    DO_SPACES_REGION: zod_1.z.string(),
    DO_SPACES_BUCKET: zod_1.z.string(),
    DO_SPACES_ACCESS_KEY: zod_1.z.string(),
    DO_SPACES_SECRET_KEY: zod_1.z.string(),
    DO_SPACES_CDN_URL: zod_1.z.string().url(),
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test']).default('development'),
    GOOGLE_APPLICATION_CREDENTIALS: zod_1.z.string().optional(),
    FCM_SENDER_ID: zod_1.z.string().optional(),
});
let env;
try {
    exports.env = env = envSchema.parse(process.env);
}
catch (error) {
    if (error instanceof zod_1.z.ZodError) {
        console.error('❌ Environment variable validation failed:');
        error.issues.forEach((err) => {
            console.error(`  - ${err.path.join('.')}: ${err.message}`);
        });
        console.error('\n💡 Please check your .env file and ensure all required variables are set.');
        process.exit(1);
    }
    throw error;
}
