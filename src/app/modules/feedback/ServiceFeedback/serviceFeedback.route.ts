import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { ServiceFeedbackController } from './serviceFeedback.controller';
import auth from '../../../middlewares/auth';
import validateRequest from '../../../middlewares/validateRequest';
import { ServiceFeedbackValidation } from './serviceFeedback.validation';

const router = Router();

// Prefix: /api/v1/service-feedback
router.post(
  '/',
  auth(UserRole.organization_admin), // Assuming organization_admin can submit feedback
  validateRequest(ServiceFeedbackValidation.createServiceFeedbackValidation),
  ServiceFeedbackController.createServiceFeedback
);

router.get('/', auth(UserRole.super_admin),ServiceFeedbackController.getAllServiceFeedbacks);

router.get(
  '/:id',
  ServiceFeedbackController.getSingleServiceFeedback
);

router.patch(
  '/:id',
  auth(UserRole.organization_admin), // Assuming organization_admin can update feedback
  validateRequest(ServiceFeedbackValidation.updateServiceFeedbackValidation),
  ServiceFeedbackController.updateServiceFeedback
);

router.delete(
  '/:id',
  auth(UserRole.organization_admin, UserRole.super_admin), // Only admins can delete
  ServiceFeedbackController.deleteServiceFeedback
);

router.get(
  '/get-my-feedbacks',
  auth(UserRole.organization_admin), // Assuming organization_admin can view their feedbacks
  ServiceFeedbackController.getServiceFeedbacksByClient
);

router.get(
  '/rating/:rating',
  ServiceFeedbackController.getServiceFeedbacksByRating
);

export const ServiceFeedbackRoutes = router;