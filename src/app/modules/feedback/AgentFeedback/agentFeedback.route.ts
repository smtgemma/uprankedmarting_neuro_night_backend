import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { AgentFeedbackController } from './agentFeedback.controller';
import auth from '../../../middlewares/auth';
import validateRequest from '../../../middlewares/validateRequest';
import { AgentFeedbackValidation } from './agentFeedback.validation';

const router = Router();

// Prefix: /api/v1/agent-feedback
router.post(
  '/create-agent-feedback/:agentUserId',
  auth(UserRole.organization_admin),
  validateRequest(AgentFeedbackValidation.createAgentFeedbackValidation),
  AgentFeedbackController.createAgentFeedback
);

router.get('/',auth(UserRole.super_admin), AgentFeedbackController.getAllAgentFeedbacks);

router.get(
  '/:id',
  AgentFeedbackController.getSingleAgentFeedback
);

router.patch(
  '/:id',
  auth(UserRole.organization_admin),
  validateRequest(AgentFeedbackValidation.updateAgentFeedbackValidation),
  AgentFeedbackController.updateAgentFeedback
);

router.delete(
  '/:id',
  auth(UserRole.organization_admin, UserRole.super_admin),
  AgentFeedbackController.deleteAgentFeedback
);

router.get(
  '/get-my-agents-feedback',
  auth(UserRole.organization_admin),
  AgentFeedbackController.getAgentFeedbacksByClient
);

router.get(
  '/rating/:rating',
  AgentFeedbackController.getAgentFeedbacksByRating
);

export const AgentFeedbackRoutes = router;