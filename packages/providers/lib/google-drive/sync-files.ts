import { backOff } from 'exponential-backoff';
import { DocxLoader } from 'langchain/document_loaders/fs/docx';
import { PDFLoader } from 'langchain/document_loaders/fs/pdf';
import { PPTXLoader } from 'langchain/document_loaders/fs/pptx';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { z } from 'zod';
import { InternalProxyOptions, SyncContext, SyncRunType } from '../types';
import { getDeepgramInstance } from '../utils';

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

const FileImageBase64Schema = z.object({
  file_id: z.string(),
  image_base64: z.string(),
});

type FileImageBase64 = z.infer<typeof FileImageBase64Schema>;

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
  let batchSize = 100;
  let allIds: string[] = [];
  let files: File[] = [];
  let fileChunks: FileChunk[] = [];
  let fileImages: FileImageBase64[] = [];

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
        context.syncRunType === SyncRunType.Initial ||
        context.syncRunType === SyncRunType.Full ||
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

    await context.batchSave<File>(files);
    files = [];

    await context.batchSave<FileChunk>(fileChunks, {
      metadata_collection_key: 'file_chunk',
    });
    fileChunks = [];

    await context.batchSave<FileImageBase64>(fileImages, {
      metadata_collection_key: 'file_image_base64',
    });
    fileImages = [];

    if (nextPageToken) {
      options.params = {
        ...(options.params as Record<string, any>),
        pageToken: nextPageToken,
      };
    } else {
      break;
    }
  }

  await context.updateDeleted(allIds);
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
  image: FileImageBase64 | null;
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
    case 'application/vnd.google-apps.presentation':
      const docChunks = await processGoogleAppsFile(file, context);
      return { file: fileObj, chunks: docChunks, image: null };

    case 'application/pdf':
      const pdfChunks = await processPdf(file, context);
      return { file: fileObj, chunks: pdfChunks, image: null };

    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      const docxChunks = await processDocx(file, context);
      return { file: fileObj, chunks: docxChunks, image: null };

    case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
      const pptxChunks = await processPptx(file, context);
      return { file: fileObj, chunks: pptxChunks, image: null };

    case 'text/plain':
      const textChunks = await processText(file, context);
      return { file: fileObj, chunks: textChunks, image: null };

    case 'application/json':
      const jsonChunks = await processJson(file, context);
      return { file: fileObj, chunks: jsonChunks, image: null };

    case 'image/jpeg':
    case 'image/png':
      const img = await processImage(file, context);
      return { file: fileObj, chunks: null, image: img };

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
      return { file: fileObj, chunks: audioChunks, image: null };

    default:
      return { file: fileObj, chunks: null, image: null };
  }
}

async function processGoogleAppsFile(
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
      responseType: 'arraybuffer',
    });

    const blob = new Blob([response.data]);
    const loader = new PDFLoader(blob, { splitPages: false });
    const docs = await loader.load();
    const content = docs.map((doc) => doc.pageContent).join('\n\n');

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

async function processDocx(
  file: GoogleDriveFile,
  context: SyncContext
): Promise<FileChunk[] | null> {
  try {
    const response = await context.get({
      endpoint: `drive/v3/files/${file.id}`,
      params: { alt: 'media' },
      retries: 3,
      responseType: 'arraybuffer',
    });

    const blob = new Blob([response.data]);
    const loader = new DocxLoader(blob);
    const docs = await loader.load();
    const content = docs.map((doc) => doc.pageContent).join('\n\n');

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

async function processPptx(
  file: GoogleDriveFile,
  context: SyncContext
): Promise<FileChunk[] | null> {
  try {
    const response = await context.get({
      endpoint: `drive/v3/files/${file.id}`,
      params: { alt: 'media' },
      retries: 3,
      responseType: 'arraybuffer',
    });

    const blob = new Blob([response.data]);
    const loader = new PPTXLoader(blob);
    const docs = await loader.load();
    const content = docs.map((doc) => doc.pageContent).join('\n\n');

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

async function processText(
  file: GoogleDriveFile,
  context: SyncContext
): Promise<FileChunk[] | null> {
  try {
    const response = await context.get({
      endpoint: `drive/v3/files/${file.id}`,
      params: { alt: 'media' },
      retries: 3,
    });

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const output = await splitter.createDocuments([response.data]);
    return output.map((doc) => ({
      file_id: file.id,
      chunk: doc.pageContent,
    }));
  } catch (err) {
    await context.reportError(err);
    return null;
  }
}

async function processJson(
  file: GoogleDriveFile,
  context: SyncContext
): Promise<FileChunk[] | null> {
  try {
    const response = await context.get({
      endpoint: `drive/v3/files/${file.id}`,
      params: { alt: 'media' },
      retries: 3,
      responseType: 'json',
    });

    const jsonString = JSON.stringify(response.data);
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 2000,
      chunkOverlap: 400,
      separators: ['{', '['],
    });

    const output = await splitter.createDocuments([jsonString]);
    return output.map((doc) => ({
      file_id: file.id,
      chunk: doc.pageContent,
    }));
  } catch (err) {
    await context.reportError(err);
    return null;
  }
}

async function processImage(
  file: GoogleDriveFile,
  context: SyncContext
): Promise<FileImageBase64 | null> {
  try {
    if (!context.multimodalEnabled) {
      return null;
    }

    const response = await context.get({
      endpoint: `drive/v3/files/${file.id}`,
      params: { alt: 'media' },
      retries: 3,
      responseType: 'arraybuffer',
    });

    const base64 = Buffer.from(response.data, 'binary').toString('base64');

    return { file_id: file.id, image_base64: base64 };
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
    if (!context.multimodalEnabled) {
      return null;
    }

    const response = await context.get({
      endpoint: `drive/v3/files/${file.id}`,
      params: { alt: 'media' },
      retries: 3,
      responseType: 'arraybuffer',
    });

    const buffer = Buffer.from(response.data, 'binary');
    const deepgram = getDeepgramInstance();

    const { result, error } = await backOff(
      () => {
        return deepgram.listen.prerecorded.transcribeFile(buffer, {
          model: 'nova-2',
          punctuate: true,
        });
      },
      { numOfAttempts: 3 }
    );

    if (error) {
      return null;
    }

    const content = result.results.channels
      .map((ch) => ch.alternatives.map((alt) => alt.transcript).join(' '))
      .join(' ');

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
      separators: ['.', '!', '?', ','],
    });

    const output = await splitter.createDocuments([content]);
    return output.map((doc) => ({
      file_id: file.id,
      chunk: doc.pageContent,
    }));
  } catch (err) {
    await context.reportError(err);
    return null;
  }
}
