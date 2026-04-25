"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_js_1 = __importDefault(require("./app.js"));
const PORT = 3001;
const HOST = '0.0.0.0';
app_js_1.default
    .listen(PORT, HOST, () => {
    console.log(`🚀 Server running on http://${HOST}:${PORT}`);
    console.log(`📡 Network accessible - find your IP with: ipconfig (Windows) or ifconfig (Mac/Linux)`);
})
    .on('error', (err) => {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
});
