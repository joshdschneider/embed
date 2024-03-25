import axios from 'axios';
import { PDFLoader } from 'langchain/document_loaders/fs/pdf';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { z } from 'zod';
import { InternalProxyOptions, SyncContext } from '../types';

const FileSchema = z.object({
  id: z.string(),
  webview_link: z.string().optional(),
  download_link: z.string().optional(),
  name: z.string(),
  parents: z.array(z.string()),
  mime_type: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

type File = z.infer<typeof FileSchema>;

const FileChunkSchema = z.object({
  file_id: z.string(),
  chunk: z.string(),
});

type FileChunk = z.infer<typeof FileChunkSchema>;

const FileImageSchema = z.object({
  file_id: z.string(),
  image: z.string(),
});

type FileImage = z.infer<typeof FileImageSchema>;

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
  const batchSize = 100;
  const files = [];
  const fileChunks = [];
  const fileImages = [];
  const allIds = [];

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
        const { file, chunks, image } = await processFile(googleDriveFile, context);

        files.push(file);
        if (chunks && chunks.length > 0) {
          fileChunks.push(...chunks);
        }

        if (image) {
          fileImages.push(image);
        }
      }
    }

    if (nextPageToken) {
      options.params = {
        ...(options.params as Record<string, any>),
        pageToken: nextPageToken,
      };
    } else {
      break;
    }
  }

  // ..
}

function createdOrUpdatedAfterSync(
  createdAt: string | undefined, // RFC 3339
  updatedAt: string | undefined, // RFC 3339
  lastSyncedAt: number | null // Unix (seconds)
): boolean {
  if (lastSyncedAt === null) {
    return false;
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

type ProcessFileResponse = {
  file: File;
  chunks: FileChunk[] | null;
  image: FileImage | null;
};

async function processFile(
  file: GoogleDriveFile,
  context: SyncContext
): Promise<ProcessFileResponse> {
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
      const docChunks = await processGoogleDoc(file, context);
      return { file: fileObj, chunks: docChunks, image: null };

    case 'application/pdf':
      const pdfChunks = await processPdf(file, context);
      return { file: fileObj, chunks: pdfChunks, image: null };

    case 'image/jpeg':
    case 'image/png':
      const img = await processImage(file, context);
      return { file: fileObj, chunks: null, image: img };

    default:
      return { file: fileObj, chunks: null, image: null };
  }
}

async function processGoogleDoc(
  file: GoogleDriveFile,
  context: SyncContext
): Promise<FileChunk[] | null> {
  try {
    const res = await context.get({
      endpoint: `drive/v3/files/${file.id}/export`,
      params: { mimeType: 'text/plain' },
      retries: 3,
    });

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const output = await splitter.createDocuments([res.data]);

    return output.map((doc) => ({
      file_id: file.id,
      chunk: doc.pageContent,
    }));
  } catch (err) {
    await context.reportError(err);
    return null;
  }
}

async function processPdf(
  file: GoogleDriveFile,
  context: SyncContext
): Promise<FileChunk[] | null> {
  try {
    const response = await context.get({
      endpoint: `drive/v3/files/${file.id}`,
      params: { alt: 'media' },
      retries: 3,
    });

    const blob = new Blob([response.data]);
    const loader = new PDFLoader(blob, { splitPages: false });
    const docs = await loader.load();
    const content = docs[0]?.pageContent;

    if (content) {
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
      });

      const output = await splitter.createDocuments([content]);
      return output.map((doc) => ({
        file_id: file.id,
        chunk: doc.pageContent,
      }));
    }

    return null;
  } catch (err) {
    await context.reportError(err);
    return null;
  }
}

async function processImage(
  file: GoogleDriveFile,
  context: SyncContext
): Promise<FileImage | null> {
  try {
    if (!context.multimodalEnabled || !file.webContentLink) {
      return null;
    }

    const response = await axios.get(file.webContentLink, {
      responseType: 'arraybuffer',
    });

    const base64 = Buffer.from(response.data, 'binary').toString('base64');

    return { file_id: file.id, image: base64 };
  } catch (err) {
    await context.reportError(err);
    return null;
  }
}

async function processAudio(
  file: GoogleDriveFile,
  context: SyncContext
): Promise<FileChunk[] | null> {
  try {
    if (!context.multimodalEnabled || !file.webContentLink) {
      return null;
    }

    return null;
  } catch (err) {
    await context.reportError(err);
    return null;
  }
}
