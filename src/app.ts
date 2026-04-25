import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { ApiResponse } from './utils/ApiResponse.js';
import { apiRateLimit } from './middleware/rateLimit.js';
import { errorMiddleware } from './middleware/errorMiddleware.js';
import { notFound } from './middleware/notFound.js';
import authRoutes from './modules/auth/auth.routes.js';
import userRoutes from './modules/user/user.routes.js';
import doctorRoutes from './modules/doctor/doctor.routes.js';
import patientRoutes from './modules/patient/patient.routes.js';
import referralRoutes from './modules/referral/referral.routes.js';
import requestRoutes from './modules/request/request.routes.js';
import discountRoutes from './modules/discount/discount.routes.js';
import pointsRoutes from './modules/points/points.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
import appointmentRoutes from './modules/appointment/appointment.routes.js';
import reviewRoutes from './modules/review/review.routes.js';
import notificationRoutes from './modules/notification/notification.routes.js';
import { runWithRequestContext } from './utils/requestContext.js';

const app = express();

app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);
app.use(cors());
app.use((req, _res, next) => {
  runWithRequestContext(
    {
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? undefined,
    },
    next
  );
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => {
  res.json(ApiResponse.success('Medical backend is healthy', { ok: true }));
});

const apiRouter = express.Router();

apiRouter.use(apiRateLimit);
apiRouter.use('/auth', authRoutes);
apiRouter.use('/users', userRoutes);
apiRouter.use('/doctors', doctorRoutes);
apiRouter.use('/patients', patientRoutes);
apiRouter.use('/referrals', referralRoutes);
apiRouter.use('/requests', requestRoutes);
apiRouter.use('/discounts', discountRoutes);
apiRouter.use('/points', pointsRoutes);
apiRouter.use('/appointments', appointmentRoutes);
apiRouter.use('/reviews', reviewRoutes);
apiRouter.use('/notifications', notificationRoutes);
apiRouter.use('/admin', adminRoutes);

app.use('/api/core', apiRouter);

app.use(notFound);
app.use(errorMiddleware);

export default app;
