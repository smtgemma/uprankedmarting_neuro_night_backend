import { Request, Response } from 'express';
import { User } from '@prisma/client';
import { DashboardServices } from './dashboardStats.service';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import status from 'http-status';
import prisma from '../../utils/prisma';

const getDashboardStats = catchAsync(async (req: Request, res: Response) => {
  const result = await DashboardServices.getDashboardStats(req.user as User);

  sendResponse(res, {
    statusCode: status.OK,
    message: 'Dashboard statistics fetched successfully!',
    data: result,
  });
});

const getAgentPerformance = catchAsync(async (req: Request, res: Response) => {
  const organization = await prisma.organization.findFirst({
    where: {
      ownerId: (req.user as User).id,
    },
    select: {
      id: true,
    },
  });

  if (!organization) {
    return sendResponse(res, {
      statusCode: status.NOT_FOUND,
      message: 'Organization not found',
      data: null,
    });
  }

//   const result = await DashboardServices.getAgentPerformanceStats(organization.id);

  sendResponse(res, {
    statusCode: status.OK,
    message: 'Agent performance data fetched successfully!',
    data: null,
  });
});

const getCallTrends = catchAsync(async (req: Request, res: Response) => {
  const { days = 30 } = req.query;
  const organization = await prisma.organization.findFirst({
    where: {
      ownerId: (req.user as User).id,
    },
    select: {
      id: true,
    },
  });

  if (!organization) {
    return sendResponse(res, {
      statusCode: status.NOT_FOUND,
      message: 'Organization not found',
      data: null,
    });
  }

//   const result = await DashboardServices.getCallTrends(organization.id, Number(days));

  sendResponse(res, {
    statusCode: status.OK,
    message: 'Call trends data fetched successfully!',
    data: null,
  });
});

export const DashboardController = {
  getDashboardStats,
  getAgentPerformance,
  getCallTrends,
};