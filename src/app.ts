import express from 'express';
import cors from 'cors';

import userRoutes from './modules/user/user.routes';
import authRoutes from './modules/auth/auth.routes';
import documentRoutes from './modules/document/document.routes';
import uploadRoutes from './modules/upload/upload.routes';
import { notFound } from './middleware/notFound';
import { errorMiddleware } from './middleware/errorMiddleware';
import { ApiResponse } from './utils/ApiResponse';


import helmet from 'helmet';

const app = express();

// Debug Middleware
app.use((req, res, next) => {
  console.log(`[DEBUG] ${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// 1. Security Middleware (Helmet)
app.use(
  helmet({
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
  })
);

// 1. Core Middleware
app.use(cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));
app.use('/public', express.static('public'));
app.use(express.static('public')); // Serve assets like /admin.css from public root
app.get('/favicon.ico', (req, res) => res.status(204).end());

// 4. Health Check
app.get('/', (req, res) => {
  res.json(ApiResponse.success('HavAI Backend is running', null));
});

// Regular API Routes
const apiRouter = express.Router();
apiRouter.use('/auth', authRoutes);
apiRouter.use('/users', userRoutes);
apiRouter.use('/documents', documentRoutes);
apiRouter.use('/upload', uploadRoutes);

app.use('/api/core', apiRouter);


// 404 & Error Handling
app.use(notFound);
app.use(errorMiddleware);

export default app;
