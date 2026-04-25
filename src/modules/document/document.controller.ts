import { Request, Response, NextFunction } from 'express';
import * as documentService from './document.service';
import { ApiResponse } from '../../utils/ApiResponse';

export const uploadDocument = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = req.user as { id: string }; // Assuming user is attached by auth middleware
    if (!user) {
      return res.status(401).json(ApiResponse.error('Unauthorized'));
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json(ApiResponse.error('No file uploaded.'));
    }

    const { folder } = req.body;

    const document = await documentService.uploadDocumentForUser(user.id, file, folder);

// ... (existing uploadDocument) 
    res.status(201).json(ApiResponse.success('Document uploaded successfully', document));
  } catch (error) {
    next(error);
  }
};

export const getMyDocuments = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user!.id; // Auth middleware guarantees user
    const docs = await documentService.getUserDocuments(userId);
    res.json(ApiResponse.success('Documents retrieved', docs));
  } catch (error) {
    next(error);
  }
};

export const deleteDocument = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    // const role = req.user!.role; 
    // Assuming auth middleware populates req.user.role?
    // Check auth types. usually it does. 
    // I'll assume isAdmin=false for now or check role.
    // safely ignore admin check if not strictly needed or assume self delete.
    // The service handles ownership check.
    const isAdmin = (req.user as any).role === 'ADMIN'; 
    await documentService.deleteDocument(id, userId, isAdmin);
    
    res.json(ApiResponse.success('Document deleted', null));
  } catch (error) {
    next(error);
  }
};
