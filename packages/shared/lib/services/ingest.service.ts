import { CollectionProperty, SourceObject } from '@embed/providers';
import { DocxLoader } from '@langchain/community/document_loaders/fs/docx';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { PPTXLoader } from '@langchain/community/document_loaders/fs/pptx';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { backOff } from 'exponential-backoff';
import md5 from 'md5';
import { EmbeddingClient } from '../clients/embedding.client';
import { getDeepgramInstance } from '../utils/constants';
import { MultimodalEmbeddingModel, TextEmbeddingModel } from '../utils/enums';
import { countWords, deconstructObject, reconstructObject } from '../utils/helpers';
import { SourceObjectWithHash } from '../utils/types';

class IngestService {
  private embeddings: EmbeddingClient;

  constructor() {
    this.embeddings = new EmbeddingClient();
  }

  public hashSourceObjects({
    objects,
    schemaProperties,
  }: {
    objects: SourceObject[];
    schemaProperties: Record<string, CollectionProperty>;
  }): SourceObjectWithHash[] {
    if (!objects || objects.length === 0) {
      return [];
    }

    return objects.map((originalObj) => {
      const obj = { ...originalObj };

      const objWithHash: SourceObjectWithHash = {
        ...obj,
        hash: md5(JSON.stringify(obj)),
      };

      Object.entries(schemaProperties).forEach(([key, value]) => {
        if (value.type === 'nested' && value.properties && obj.hasOwnProperty(key)) {
          const nestedObjOrArray = obj[key];
          if (Array.isArray(nestedObjOrArray)) {
            objWithHash[key] = nestedObjOrArray.map((nestedObj) => {
              return { ...nestedObj, hash: md5(JSON.stringify(nestedObj)) };
            });
          } else if (nestedObjOrArray && typeof nestedObjOrArray === 'object') {
            objWithHash[key] = {
              ...nestedObjOrArray,
              hash: md5(JSON.stringify(nestedObjOrArray)),
            };
          }
        }
      });

      return objWithHash;
    });
  }

  public async vectorizeSourceObjects({
    objects,
    schemaProperties,
    textEmbeddingModel,
    multimodalEmbeddingModel,
  }: {
    objects: SourceObjectWithHash[];
    schemaProperties: Record<string, CollectionProperty>;
    textEmbeddingModel: TextEmbeddingModel;
    multimodalEmbeddingModel: MultimodalEmbeddingModel;
  }): Promise<{ objects: SourceObjectWithHash[]; wordCount: number; imageCount: number }> {
    if (!objects || objects.length === 0) {
      return { objects: [], wordCount: 0, imageCount: 0 };
    }

    const vectorizedObjects: SourceObjectWithHash[] = [];
    let wordCount = 0;
    let imageCount = 0;

    for (const obj of objects) {
      const vectorResult = await this.vectorizeObject({
        sourceObject: obj,
        schemaProperties,
        textEmbeddingModel,
        multimodalEmbeddingModel,
      });

      vectorizedObjects.push(vectorResult.object);
      wordCount += vectorResult.numWords;
      imageCount += vectorResult.numImages;
    }

    return { objects: vectorizedObjects, wordCount, imageCount };
  }

  private async vectorizeObject({
    sourceObject,
    schemaProperties,
    textEmbeddingModel,
    multimodalEmbeddingModel,
  }: {
    sourceObject: SourceObjectWithHash;
    schemaProperties: Record<string, CollectionProperty>;
    textEmbeddingModel: TextEmbeddingModel;
    multimodalEmbeddingModel: MultimodalEmbeddingModel;
  }): Promise<{ object: SourceObjectWithHash; numWords: number; numImages: number }> {
    const objProperties = deconstructObject(sourceObject);

    const textProperties: [string, any][] = [];
    const multimodalProperties: [string, any][] = [];

    let numWords = 0;
    let numImages = 0;

    for (const [k, v] of objProperties) {
      if (!v) {
        continue;
      }

      const path = k.split('.').shift()!;
      const property = schemaProperties[path];

      if (property && property.type === 'string') {
        if (property.vector_searchable) {
          if (property.image) {
            multimodalProperties.push([k, v]);
            numImages += 1;
          } else {
            textProperties.push([k, v]);
            numWords += countWords(v);
          }
        } else if (property.keyword_searchable) {
          numWords += countWords(v);
        }
      } else if (property && property.type === 'nested' && property.properties) {
        let nestedPath = k.split('.')[1]!;
        if (!isNaN(Number(nestedPath))) {
          nestedPath = k.split('.')[2]!;
        }

        const nestedProperty = property.properties[nestedPath];
        if (nestedProperty && nestedProperty.type === 'string') {
          if (nestedProperty.vector_searchable) {
            if (nestedProperty.image) {
              multimodalProperties.push([k, v]);
              numImages += 1;
            } else {
              textProperties.push([k, v]);
              numWords += countWords(v);
            }
          } else if (nestedProperty.keyword_searchable) {
            numWords += countWords(v);
          }
        }
      }
    }

    if (textProperties.length === 0 && multimodalProperties.length === 0) {
      return { object: sourceObject, numWords, numImages };
    }

    const textValues = textProperties.map(([k, v]) => v);
    const multimodalValues = multimodalProperties.map(([k, v]) => v);

    let textVectorsPromise;
    let multimodalVectorsPromise;

    if (textValues.length > 0) {
      textVectorsPromise = this.embeddings.embedText({
        model: textEmbeddingModel,
        text: textValues,
        purpose: 'object',
      });
    }

    if (multimodalValues.length > 0) {
      multimodalVectorsPromise = this.embeddings.embedMultimodal({
        model: multimodalEmbeddingModel,
        content: multimodalValues,
        type: 'images',
      });
    }

    const [textVectors, multimodalVectors] = await Promise.all([
      textVectorsPromise,
      multimodalVectorsPromise,
    ]);

    const textVectorProperties: [string, any][] = [];
    const multimodalVectorProperties: [string, any][] = [];

    if (textVectors) {
      textProperties.forEach(([k, v], i) => {
        textVectorProperties.push([`${k}_vector`, textVectors[i]]);
      });
    }

    if (multimodalVectors) {
      multimodalProperties.forEach(([k, v], i) => {
        multimodalVectorProperties.push([`${k}_vector`, multimodalVectors[i]]);
      });
    }

    const sourceObjectWithVectors = reconstructObject([
      ...objProperties,
      ...textVectorProperties,
      ...multimodalVectorProperties,
    ]) as SourceObjectWithHash;

    return { object: sourceObjectWithVectors, numWords, numImages };
  }

  public async processText(str: string): Promise<string[]> {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const output = await splitter.createDocuments([str]);
    return output.map((doc) => doc.pageContent);
  }

  public async processPdf(buffer: Buffer): Promise<string[]> {
    const blob = new Blob([buffer]);
    const loader = new PDFLoader(blob, { splitPages: false });
    const docs = await loader.load();
    const content = docs.map((doc) => doc.pageContent).join('\n\n');

    if (content) {
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
      });

      const output = await splitter.createDocuments([content]);
      return output.map((doc) => doc.pageContent);
    }

    return [];
  }

  public async processPptx(buffer: Buffer): Promise<string[]> {
    const blob = new Blob([buffer]);
    const loader = new PPTXLoader(blob);
    const docs = await loader.load();
    const content = docs.map((doc) => doc.pageContent).join('\n\n');

    if (content) {
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
      });

      const output = await splitter.createDocuments([content]);
      return output.map((doc) => doc.pageContent);
    }

    return [];
  }

  public async processDocx(buffer: Buffer): Promise<string[]> {
    const blob = new Blob([buffer]);
    const loader = new DocxLoader(blob);
    const docs = await loader.load();
    const content = docs.map((doc) => doc.pageContent).join('\n\n');

    if (content) {
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
      });

      const output = await splitter.createDocuments([content]);
      return output.map((doc) => doc.pageContent);
    }

    return [];
  }

  public async processJson(str: string): Promise<string[]> {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 2000,
      chunkOverlap: 400,
      separators: ['{', '['],
    });

    const output = await splitter.createDocuments([str]);
    return output.map((doc) => doc.pageContent);
  }

  public processImage(buffer: Buffer): string {
    return buffer.toString('base64');
  }

  public async processVideo(buffer: Buffer): Promise<{ chunks: string[]; duration: number }> {
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
      return { chunks: [], duration: 0 };
    }

    const duration = result.metadata.duration;
    const content = result.results.channels
      .map((ch) => ch.alternatives.map((alt) => alt.transcript).join(' '))
      .join(' ');

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
      separators: ['.', '!', '?', ','],
    });

    const output = await splitter.createDocuments([content]);
    const chunks = output.map((doc) => doc.pageContent);
    return { chunks, duration };
  }

  public async processAudio(buffer: Buffer): Promise<{ chunks: string[]; duration: number }> {
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
      return { chunks: [], duration: 0 };
    }

    const duration = result.metadata.duration;
    const content = result.results.channels
      .map((ch) => ch.alternatives.map((alt) => alt.transcript).join(' '))
      .join(' ');

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
      separators: ['.', '!', '?', ','],
    });

    const output = await splitter.createDocuments([content]);
    const chunks = output.map((doc) => doc.pageContent);
    return { chunks, duration };
  }
}

export default new IngestService();
