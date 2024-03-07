import { backOff } from 'exponential-backoff';
import OpenAI from 'openai';
import { getOpenAIApiKey } from '../utils/constants';

export enum EmbeddingModel {
  OpenAITextEmbedding3Small = 'openai-text-embedding-3-small',
}

const openai = new OpenAI({ apiKey: getOpenAIApiKey() });

export class VectorClient {
  public async vectorize(model: EmbeddingModel, content: string[]): Promise<number[][]> {
    switch (model) {
      case EmbeddingModel.OpenAITextEmbedding3Small:
        return this.withOpenAITextEmbedding3Small(content);

      default:
        throw new Error(`Embedding model ${model} not supported`);
    }
  }

  public async withOpenAITextEmbedding3Small(content: string[]): Promise<number[][]> {
    const requestWithBackoff = async () => {
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: content,
      });

      return response.data.map((chunk) => chunk.embedding);
    };

    return backOff(requestWithBackoff, { numOfAttempts: 5 });
  }
}
