// src/app/modules/dashboard/dashboard.routes.ts
import express from 'express';
import auth from '../../middlewares/auth';
import { UserRole } from '@prisma/client';
import { DashboardController } from './dashboardStats.controller';

const router = express.Router();

router.get(
  '/stats',
  auth(UserRole.organization_admin),
  DashboardController.getDashboardStats
);

router.get(
  '/admin-dashboard-stats',
  auth(UserRole.super_admin),
  DashboardController.getAdminDashboardStats
);

router.get(
  '/agent-performance',
  auth(UserRole.organization_admin, UserRole.super_admin),
  DashboardController.getAgentPerformance
);

router.get(
  '/call-trends',
  auth(UserRole.organization_admin, UserRole.super_admin),
  DashboardController.getCallTrends
);

export const DashboardStatsRoutes = router;