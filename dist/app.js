"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const user_routes_js_1 = __importDefault(require("./modules/user/user.routes.js"));
const auth_routes_js_1 = __importDefault(require("./modules/auth/auth.routes.js"));
const notFound_js_1 = require("./middleware/notFound.js");
const errorMiddleware_js_1 = require("./middleware/errorMiddleware.js");
const ApiResponse_js_1 = require("./utils/ApiResponse.js");
const helmet_1 = __importDefault(require("helmet"));
const app = (0, express_1.default)();
// Debug Middleware
app.use((req, res, next) => {
    console.log(`[DEBUG] ${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});
// 1. Security Middleware (Helmet)
app.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://unpkg.com'], // unpkg for leaflet
            imgSrc: ["'self'", 'data:', 'https:', 'blob:'], // Allow all https images for CDN compatibility
            fontSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'", 'https:'],
        },
    },
    crossOriginEmbedderPolicy: false, // Often needed for AdminJS/complex apps
}));
// 1. Core Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use('/uploads', express_1.default.static('uploads'));
app.use('/public', express_1.default.static('public'));
app.use(express_1.default.static('public')); // Serve assets like /admin.css from public root
app.get('/favicon.ico', (req, res) => res.status(204).end());
// 4. Health Check
app.get('/', (req, res) => {
    res.json(ApiResponse_js_1.ApiResponse.success('HavAI Backend is running', null));
});
// Regular API Routes
app.use('/auth', auth_routes_js_1.default);
app.use('/users', user_routes_js_1.default);
// 404 & Error Handling
app.use(notFound_js_1.notFound);
app.use(errorMiddleware_js_1.errorMiddleware);
exports.default = app;
