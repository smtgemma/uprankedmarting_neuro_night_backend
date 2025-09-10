import express from 'express';
import { ClientManagementController } from './clientManagement.controller';
import auth from '../../middlewares/auth';
import { UserRole } from '@prisma/client';

const router = express.Router();

router.get(
  '/',
  auth(UserRole.super_admin), // Only super admin can access this
  ClientManagementController.getAllOrganizationAdmins
);

export const ClientManagementRoutes = router;