"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateSchema = void 0;
const text_splitter_1 = require("langchain/text_splitter");
const zod_1 = require("zod");
const FileSchema = zod_1.z.object({
    id: zod_1.z.string(),
    webview_link: zod_1.z.string().optional(),
    download_link: zod_1.z.string().optional(),
    name: zod_1.z.string(),
    parents: zod_1.z.array(zod_1.z.string()),
    mime_type: zod_1.z.string(),
    created_at: zod_1.z.string(),
    updated_at: zod_1.z.string(),
});
const FileChunkSchema = zod_1.z.object({
    file_id: zod_1.z.string(),
    chunk: zod_1.z.string(),
});
const FileImageSchema = zod_1.z.object({
    file_id: zod_1.z.string(),
    image: zod_1.z.string(),
});
function syncFiles(context) {
    return __awaiter(this, void 0, void 0, function* () {
        const batchSize = 100;
        const files = [];
        const fileChunks = [];
        const fileImages = [];
        const allIds = [];
        let options = {
            endpoint: `drive/v3/files`,
            params: {
                fields: `files(id, name, mimeType, webViewLink, webContentLink, parents, createdTime, modifiedTime), nextPageToken`,
                pageSize: batchSize.toString(),
                q: `trashed = false`,
            },
            retries: 10,
        };
        while (true) {
            const response = yield context.get(options);
            const nextPageToken = response.data.nextPageToken;
            const googleDriveFiles = response.data.files;
            for (const googleDriveFile of googleDriveFiles) {
                allIds.push(googleDriveFile.id);
                if (createdOrUpdatedAfterSync(googleDriveFile.createdTime, googleDriveFile.modifiedTime, context.lastSyncedAt)) {
                    const { file, chunks, image } = yield processFile(googleDriveFile, context);
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
                options.params = Object.assign(Object.assign({}, options.params), { pageToken: nextPageToken });
            }
            else {
                break;
            }
        }
        // ..
    });
}
exports.default = syncFiles;
function createdOrUpdatedAfterSync(createdAt, // RFC 3339
updatedAt, // RFC 3339
lastSyncedAt // Unix (seconds)
) {
    if (lastSyncedAt === null) {
        return false;
    }
    const lastSyncedAtMs = lastSyncedAt * 1000;
    const createdDate = createdAt ? new Date(createdAt) : null;
    const updatedDate = updatedAt ? new Date(updatedAt) : null;
    if ((createdDate !== null && createdDate.getTime() > lastSyncedAtMs) ||
        (updatedDate !== null && updatedDate.getTime() > lastSyncedAtMs)) {
        return true;
    }
    else {
        return false;
    }
}
function processFile(file, context) {
    return __awaiter(this, void 0, void 0, function* () {
        const fileObj = {
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
                const docChunks = yield processGoogleDoc(file, context);
                return { file: fileObj, chunks: docChunks, image: null };
            case 'application/pdf':
                const pdfChunks = yield processPdf(file);
                return { file: fileObj, chunks: pdfChunks, image: null };
            case 'image/jpeg':
            case 'image/png':
                const img = yield processImage(file);
                return { file: fileObj, chunks: null, image: img };
            default:
                return { file: fileObj, chunks: null, image: null };
        }
    });
}
function processGoogleDoc(file, context) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const res = yield context.get({
                endpoint: `drive/v3/files/${file.id}/export`,
                params: { mimeType: 'text/plain' },
                retries: 3,
            });
            const splitter = new text_splitter_1.RecursiveCharacterTextSplitter({
                chunkSize: 1000,
                chunkOverlap: 200,
            });
            const output = yield splitter.createDocuments([res.data]);
            return output.map((doc) => ({ file_id: file.id, chunk: doc.pageContent }));
        }
        catch (err) {
            // log error
            return null;
        }
    });
}
function processPdf(file) {
    return __awaiter(this, void 0, void 0, function* () {
        return null;
    });
}
function processImage(file) {
    return __awaiter(this, void 0, void 0, function* () {
        return null;
    });
}
function validateSchema() {
    //..
}
exports.validateSchema = validateSchema;
//# sourceMappingURL=sync-files.js.map