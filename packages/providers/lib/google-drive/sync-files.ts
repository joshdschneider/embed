import { z } from 'zod';
import { InternalProxyOptions, SyncContext } from '../types';

const FileChunkSchema = z.object({
  chunk: z.string(),
  metadata: z.any().optional(),
});

const FileSchema = z.object({
  id: z.string(),
  webview_link: z.string().optional(),
  download_link: z.string().optional(),
  name: z.string(),
  parents: z.array(z.string()),
  mime_type: z.string(),
  image_base64: z.string().optional(),
  content: z.array(FileChunkSchema).optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

type File = z.infer<typeof FileSchema>;

type GoogleDriveFile = {
  id: string;
  name: string;
  mimeType: string;
  parents: string[];
  webViewLink?: string;
  webContentLink?: string;
  createdTime: string;
  modifiedTime: string;
};

export default async function syncFiles(context: SyncContext) {
  let batchSize = 50;
  let allIds: string[] = [];
  let files: File[] = [];

  let options: InternalProxyOptions = {
    endpoint: `drive/v3/files`,
    params: {
      fields: `files(id, name, mimeType, webViewLink, webContentLink, parents, createdTime, modifiedTime), nextPageToken`,
      pageSize: batchSize.toString(),
      q: `trashed = false`,
    },
    retries: 10,
  };

  while (true) {
    const response = await context.get(options);
    const nextPageToken: string | undefined = response.data.nextPageToken;
    const googleDriveFiles: GoogleDriveFile[] = response.data.files;

    for (const googleDriveFile of googleDriveFiles) {
      allIds.push(googleDriveFile.id);
      if (
        createdOrUpdatedAfterSync(
          googleDriveFile.createdTime,
          googleDriveFile.modifiedTime,
          context.lastSyncedAt
        )
      ) {
        const fileWithInstances = await processFile(googleDriveFile, context);
        files.push(fileWithInstances);
      }
    }

    await context.batchSave(files);
    files = [];

    if (nextPageToken) {
      options.params = {
        ...(options.params as Record<string, any>),
        pageToken: nextPageToken,
      };
    } else {
      break;
    }
  }

  await context.pruneDeleted(allIds);
}

function createdOrUpdatedAfterSync(
  createdAt: string | undefined, // RFC 3339
  updatedAt: string | undefined, // RFC 3339
  lastSyncedAt: number | null // Unix (seconds)
): boolean {
  if (lastSyncedAt === null) {
    return true;
  }

  const lastSyncedAtMs = lastSyncedAt * 1000;
  const createdDate = createdAt ? new Date(createdAt) : null;
  const updatedDate = updatedAt ? new Date(updatedAt) : null;

  if (
    (createdDate !== null && createdDate.getTime() > lastSyncedAtMs) ||
    (updatedDate !== null && updatedDate.getTime() > lastSyncedAtMs)
  ) {
    return true;
  } else {
    return false;
  }
}

async function processFile(file: GoogleDriveFile, context: SyncContext): Promise<File> {
  const fileObj: File = {
    id: file.id,
    name: file.name,
    parents: file.parents,
    mime_type: file.mimeType,
    webview_link: file.webViewLink,
    download_link: file.webContentLink,
    created_at: file.createdTime,
    updated_at: file.modifiedTime,
  };

  switch (file.mimeType) {
    case 'application/vnd.google-apps.document':
    case 'application/vnd.google-apps.presentation':
      const docChunks = await processGoogleAppsFile(file, context);
      return { ...fileObj, content: docChunks.map((chunk) => ({ chunk })) };

    case 'application/pdf':
      const pdfChunks = await processPdf(file, context);
      return { ...fileObj, content: pdfChunks.map((chunk) => ({ chunk })) };

    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      const docxChunks = await processDocx(file, context);
      return { ...fileObj, content: docxChunks.map((chunk) => ({ chunk })) };

    case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
      const pptxChunks = await processPptx(file, context);
      return { ...fileObj, content: pptxChunks.map((chunk) => ({ chunk })) };

    case 'text/plain':
      const textChunks = await processText(file, context);
      return { ...fileObj, content: textChunks.map((chunk) => ({ chunk })) };

    case 'application/json':
      const jsonChunks = await processJson(file, context);
      return { ...fileObj, content: jsonChunks.map((chunk) => ({ chunk })) };

    case 'image/jpeg':
    case 'image/png':
      const base64Image = await processImage(file, context);
      return { ...fileObj, image_base64: base64Image ? base64Image : undefined };

    case 'audio/wav':
    case 'audio/mpeg':
    case 'audio/mp4':
    case 'audio/aac':
    case 'audio/wave':
    case 'audio/flac':
    case 'audio/x-m4a':
    case 'audio/ogg':
    case 'audio/opus':
    case 'audio/webm':
      const audioChunks = await processAudio(file, context);
      return { ...fileObj, content: audioChunks.map((chunk) => ({ chunk })) };

    // TODO: add rest
    case 'video/mp4':
    case 'video/webm':
      const videoChunks = await processVideo(file, context);
      return { ...fileObj, content: videoChunks.map((chunk) => ({ chunk })) };

    default:
      return fileObj;
  }
}

async function processGoogleAppsFile(
  file: GoogleDriveFile,
  context: SyncContext
): Promise<string[]> {
  try {
    const res = await context.get({
      endpoint: `drive/v3/files/${file.id}/export`,
      params: { mimeType: 'text/plain' },
      retries: 3,
    });

    const text = res.data;
    return await context.processor.processText(text);
  } catch (err) {
    await context.reportError(err);
    return [];
  }
}

async function processPdf(file: GoogleDriveFile, context: SyncContext): Promise<string[]> {
  try {
    const response = await context.get({
      endpoint: `drive/v3/files/${file.id}`,
      params: { alt: 'media' },
      retries: 3,
      responseType: 'arraybuffer',
    });

    const buffer = Buffer.from(response.data, 'binary');
    return await context.processor.processPdf(buffer);
  } catch (err) {
    await context.createActivityLog({
      level: 'warn',
      message: 'Failed to process .pdf file',
      payload: { file },
    });

    await context.reportError(err);
    return [];
  }
}

async function processDocx(file: GoogleDriveFile, context: SyncContext): Promise<string[]> {
  try {
    const response = await context.get({
      endpoint: `drive/v3/files/${file.id}`,
      params: { alt: 'media' },
      retries: 3,
      responseType: 'arraybuffer',
    });

    const buffer = Buffer.from(response.data, 'binary');
    return await context.processor.processDocx(buffer);
  } catch (err) {
    await context.createActivityLog({
      level: 'warn',
      message: 'Failed to process .docx file',
      payload: { file },
    });

    await context.reportError(err);
    return [];
  }
}

async function processPptx(file: GoogleDriveFile, context: SyncContext): Promise<string[]> {
  try {
    const response = await context.get({
      endpoint: `drive/v3/files/${file.id}`,
      params: { alt: 'media' },
      retries: 3,
      responseType: 'arraybuffer',
    });

    const buffer = Buffer.from(response.data, 'binary');
    return await context.processor.processPptx(buffer);
  } catch (err) {
    await context.createActivityLog({
      level: 'warn',
      message: 'Failed to process .pptx file',
      payload: { file },
    });

    await context.reportError(err);
    return [];
  }
}

async function processText(file: GoogleDriveFile, context: SyncContext): Promise<string[]> {
  try {
    const response = await context.get({
      endpoint: `drive/v3/files/${file.id}`,
      params: { alt: 'media' },
      retries: 3,
    });

    const text = response.data;
    return await context.processor.processText(text);
  } catch (err) {
    await context.createActivityLog({
      level: 'warn',
      message: 'Failed to process .txt file',
      payload: { file },
    });

    await context.reportError(err);
    return [];
  }
}

async function processJson(file: GoogleDriveFile, context: SyncContext): Promise<string[]> {
  try {
    const response = await context.get({
      endpoint: `drive/v3/files/${file.id}`,
      params: { alt: 'media' },
      retries: 3,
    });

    const jsonStr = JSON.stringify(response.data);
    return await context.processor.processJson(jsonStr);
  } catch (err) {
    await context.createActivityLog({
      level: 'warn',
      message: 'Failed to process .json file',
      payload: { file },
    });

    await context.reportError(err);
    return [];
  }
}

async function processImage(file: GoogleDriveFile, context: SyncContext): Promise<string | null> {
  try {
    const response = await context.get({
      endpoint: `drive/v3/files/${file.id}`,
      params: { alt: 'media' },
      retries: 3,
      responseType: 'arraybuffer',
    });

    const buffer = Buffer.from(response.data, 'binary');
    return context.processor.processImage(buffer);
  } catch (err) {
    await context.createActivityLog({
      level: 'warn',
      message: 'Failed to process image file',
      payload: { file },
    });

    await context.reportError(err);
    return null;
  }
}

async function processAudio(file: GoogleDriveFile, context: SyncContext): Promise<string[]> {
  try {
    const response = await context.get({
      endpoint: `drive/v3/files/${file.id}`,
      params: { alt: 'media' },
      retries: 3,
      responseType: 'arraybuffer',
    });

    const buffer = Buffer.from(response.data, 'binary');
    return await context.processor.processAudio(buffer);
  } catch (err) {
    await context.createActivityLog({
      level: 'warn',
      message: 'Failed to process audio file',
      payload: { file },
    });

    await context.reportError(err);
    return [];
  }
}

async function processVideo(file: GoogleDriveFile, context: SyncContext): Promise<string[]> {
  try {
    const response = await context.get({
      endpoint: `drive/v3/files/${file.id}`,
      params: { alt: 'media' },
      retries: 3,
      responseType: 'arraybuffer',
    });

    const buffer = Buffer.from(response.data, 'binary');
    return await context.processor.processVideo(buffer);
  } catch (err) {
    await context.createActivityLog({
      level: 'warn',
      message: 'Failed to process audio file',
      payload: { file },
    });

    await context.reportError(err);
    return [];
  }
}
