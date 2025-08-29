import { Request, Response } from 'express';
import { CompanyDocServices } from './companyDoc.service';
import catchAsync from '../../utils/catchAsync';
import status from 'http-status';
import sendResponse from '../../utils/sendResponse';

const createCompanyDoc = catchAsync(async (req: Request, res: Response) => {
  const result = await CompanyDocServices.createCompanyDoc(req);
  
  sendResponse(res, {
    statusCode: status.CREATED,
    message: 'Company document uploaded successfully!',
    data: result,
  });
});

const getAllCompanyDocs = catchAsync(async (req: Request, res: Response) => {
  const result = await CompanyDocServices.getAllCompanyDocs(req.query);
  
  sendResponse(res, {
    statusCode: status.OK,
    message: 'Company documents fetched successfully!',
    meta: result.meta,
    data: result.data,
  });
});

const getSingleCompanyDoc = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await CompanyDocServices.getSingleCompanyDoc(id);
  
  sendResponse(res, {
    statusCode: status.OK,
    message: 'Company document fetched successfully!',
    data: result,
  });
});

const getCompanyDocsByCompany = catchAsync(async (req: Request, res: Response) => {
  const { organizationId } = req.params;
  const result = await CompanyDocServices.getCompanyDocsByCompany(organizationId, req.query);
  
  sendResponse(res, {
    statusCode: status.OK,
    message: 'Company documents fetched successfully!',
    meta: result.meta,
    data: result.data,
  });
});

const getCompanyDocsByType = catchAsync(async (req: Request, res: Response) => {
  const { docFor } = req.params;
  const result = await CompanyDocServices.getCompanyDocsByType(docFor as any, req.query);
  
  sendResponse(res, {
    statusCode: status.OK,
    message: 'Company documents fetched successfully!',
    meta: result.meta,
    data: result.data,
  });
});

const updateCompanyDoc = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await CompanyDocServices.updateCompanyDoc(id, req);
  
  sendResponse(res, {
    statusCode: status.OK,
    message: 'Company document updated successfully!',
    data: result,
  });
});

const deleteCompanyDoc = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await CompanyDocServices.deleteCompanyDoc(id);
  
  sendResponse(res, {
    statusCode: status.OK,
    message: 'Company document deleted successfully!',
    data: result,
  });
});

export const CompanyDocController = {
  createCompanyDoc,
  getAllCompanyDocs,
  getSingleCompanyDoc,
  getCompanyDocsByCompany,
  getCompanyDocsByType,
  updateCompanyDoc,
  deleteCompanyDoc,
};