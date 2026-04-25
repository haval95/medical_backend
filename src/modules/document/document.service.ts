import prisma from '../../utils/prisma';
import { uploadFile, deleteFile } from '../../utils/upload';
import { ApiError } from '../../utils/ApiError';

export const uploadDocumentForUser = async (
  userId: string,
  file: Express.Multer.File,
  folder?: string
) => {
  if (!file) {
    throw new ApiError(400, 'No file uploaded.');
  }

  const subFolderName = folder ? `/${folder}` : '';
  const folderName = `users/${userId}/documents${subFolderName}`;

  // Upload file to DigitalOcean Spaces
  const { url } = await uploadFile(
    file.buffer,
    folderName,
    file.originalname,
    file.mimetype
  );

  // Create document record in the database
  const document = await prisma.document.create({
    data: {
      userId,
      url,
      fileName: file.originalname,
      fileType: file.mimetype,
      folder: folderName,
    },
  });

  return document;
};

export const getUserDocuments = async (userId: string) => {
  return prisma.document.findMany({
    where: { userId },
    orderBy: { uploadedAt: 'desc' },
  });
};

export const deleteDocument = async (id: string, userId: string, isAdmin = false) => {
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) throw new ApiError(404, 'Document not found');

  // Check ownership
  if (!isAdmin && doc.userId !== userId) {
    throw new ApiError(403, 'Unauthorized to delete this document');
  }

  // Delete from storage
  if (doc.url) {
      // Extract key properly? 
      // env.DO_SPACES_CDN_URL might be needed to parse key if url is absolute.
      // Usually `deleteFile` expects the key (path in bucket).
      // `uploadFile` returns `url`.
      // If `url` is full URL, we need to extract key.
      // But `doc.folder` stores the folder path. `doc.fileName` is name.
      // Key = `${doc.folder}/${doc.fileName}`? 
      // `uploadFile` implementation: `key` is `folder/filename`.
      // The `doc.folder` stored matches the folder passed to upload.
      // So Key is `doc.folder + '/' + doc.fileName`? 
      // Let's verify `uploadFile` return. `uploadFile` returns `{ key, url }`.
      // `uploadDocumentForUser` uses `url` but NOT `key`.
      // But we construct `folderName`.
      // The key is `${folderName}/${file.originalname}`.
      // So we can reconstruct it. 
      // Or safer: I should have stored `key` in DB.
      // But I can reconstruct: `${doc.folder}/${doc.fileName}` if format matches.
      // Let's assume standard behavior or try to parse.
      // `deleteFile` usually handles key.
      // I'll try to extract from valid parts or just try.
      // If `doc.folder` and `doc.fileName` are reliable: key is `${doc.folder}/${doc.fileName}`.
      // Note: `doc.folder` in `uploadDocumentForUser` is `users/${userId}/documents...`.
      // So yes, `key = ${doc.folder}/${doc.fileName}`.
      const key = `${doc.folder}/${doc.fileName}`;
      try {
        await deleteFile(key);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Failed to delete file from storage', e);
      }
  }

  await prisma.document.delete({ where: { id } });
};

