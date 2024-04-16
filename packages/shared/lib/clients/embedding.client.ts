import { InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { EmbedInputType } from 'cohere-ai/api';
import { backOff } from 'exponential-backoff';
import {
  getBedrock,
  getCohere,
  getGoogleCloud,
  getMistralApiKey,
  getOpenai,
} from '../utils/constants';
import { MultimodalEmbeddingModel, TextEmbeddingModel } from '../utils/enums';

export type EmbeddingPurpose = 'query' | 'object';

export type ContentType = 'text' | 'images';

export class EmbeddingClient {
  public async embedText({
    model,
    purpose,
    text,
  }: {
    model: TextEmbeddingModel;
    purpose: EmbeddingPurpose;
    text: string[];
  }): Promise<number[][]> {
    switch (model) {
      case TextEmbeddingModel.OpenaiTextEmbedding3Small:
      case TextEmbeddingModel.OpenaiTextEmbedding3Large:
      case TextEmbeddingModel.OpenaiTextEmbeddingAda:
        return this.withOpenai(model, text);

      case TextEmbeddingModel.CohereEmbedEnglish3:
      case TextEmbeddingModel.CohereEmbedEnglishLight3:
      case TextEmbeddingModel.CohereEmbedMultilingual3:
      case TextEmbeddingModel.CohereEmbedMultilingualLight3:
        return this.withCohere(model, purpose, text);

      case TextEmbeddingModel.AmazonTitanTextG1:
        return this.withBedrockText(model, text);

      case TextEmbeddingModel.GoogleVertexTextEmbeddingGecko003:
        return this.withVertexText(model, purpose, text);

      case TextEmbeddingModel.MistralEmbed:
        return this.withMistral(model, text);

      default:
        throw new Error(`Text embedding model ${model} not supported`);
    }
  }

  public async embedMultimodal({
    model,
    content,
    type,
  }: {
    model: MultimodalEmbeddingModel;
    content: string[];
    type: ContentType;
  }): Promise<number[][]> {
    switch (model) {
      case MultimodalEmbeddingModel.AmazonTitanMultimodalG1:
        return this.withBedrockMultimodal(model, content, type);

      case MultimodalEmbeddingModel.GoogleVertexMultimodalEmbedding001:
        return this.withVertexMultimodal(model, content, type);

      default:
        throw new Error(`Multimodal embedding model ${model} not supported`);
    }
  }

  private async withOpenai(model: TextEmbeddingModel, text: string[]): Promise<number[][]> {
    const openai = getOpenai();

    const requestWithBackoff = async () => {
      const response = await openai.embeddings.create({
        model: model.replace('openai-', ''),
        input: text,
      });

      return response.data.map((chunk) => chunk.embedding);
    };

    return backOff(requestWithBackoff, { numOfAttempts: 5 });
  }

  private async withCohere(model: TextEmbeddingModel, purpose: EmbeddingPurpose, text: string[]) {
    const cohere = getCohere();

    const requestWithBackoff = async () => {
      const response = await cohere.embed({
        texts: text,
        model: model.replace('cohere-', ''),
        inputType: purpose === 'query' ? EmbedInputType.SearchQuery : EmbedInputType.SearchDocument,
      });

      if (response.responseType === 'embeddings_floats') {
        return response.embeddings;
      } else {
        throw new Error('Invalid Cohere response type');
      }
    };

    return backOff(requestWithBackoff, { numOfAttempts: 5 });
  }

  private async withMistral(model: TextEmbeddingModel, text: string[]) {
    const url = 'https://api.mistral.ai/v1/embeddings';
    const apiKey = getMistralApiKey();

    const requestWithBackoff = async () => {
      const options: RequestInit = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model, input: text }),
      };

      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(response.statusText);
      }

      const jsonRes = (await response.json()) as {
        id: string;
        data: { embedding: number[]; index: number }[];
      };

      return jsonRes.data.sort((a, b) => a.index - b.index).map((obj) => obj.embedding);
    };

    return backOff(requestWithBackoff, { numOfAttempts: 5 });
  }

  private async withBedrockText(model: TextEmbeddingModel, text: string[]): Promise<number[][]> {
    const bedrock = getBedrock();

    const embeddingPromises = text.map(async (chunk) => {
      const input = {
        modelId: model,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({ inputText: chunk }),
      };

      const command = new InvokeModelCommand(input);
      const response = await bedrock.send(command);
      const rawRes = response.body;
      const jsonString = new TextDecoder().decode(rawRes);
      const parsedResponse = JSON.parse(jsonString) as {
        embedding: number[];
      };

      return parsedResponse.embedding;
    });

    const embeddings = await Promise.all(embeddingPromises);
    return embeddings;
  }

  private async withBedrockMultimodal(
    model: MultimodalEmbeddingModel,
    content: string[],
    type: ContentType
  ): Promise<number[][]> {
    const bedrock = getBedrock();

    const embeddingPromises = content.map(async (chunk) => {
      const body =
        type === 'text'
          ? JSON.stringify({ inputText: chunk })
          : JSON.stringify({ inputImage: chunk });

      const input = {
        modelId: model,
        contentType: 'application/json',
        accept: 'application/json',
        body,
      };

      const command = new InvokeModelCommand(input);
      const response = await bedrock.send(command);
      const rawRes = response.body;
      const jsonString = new TextDecoder().decode(rawRes);
      const parsedResponse = JSON.parse(jsonString) as {
        embedding: number[];
      };

      return parsedResponse.embedding;
    });

    const embeddings = await Promise.all(embeddingPromises);
    return embeddings;
  }

  private async withVertexText(
    model: TextEmbeddingModel,
    purpose: EmbeddingPurpose,
    text: string[]
  ): Promise<number[][]> {
    const { accessToken, projectId, region } = await getGoogleCloud();

    const baseUrl = `https://${region}-aiplatform.googleapis.com/v1`;
    const path = `/projects/${projectId}/locations/${region}/publishers/google/models/${model}:predict`;

    const requestWithBackoff = async () => {
      const options: RequestInit = {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instances: text.map((t) => ({
            task_type: purpose === 'query' ? 'RETRIEVAL_QUERY' : 'RETRIEVAL_DOCUMENT',
            content: t,
          })),
        }),
      };

      const response = await fetch(baseUrl + path, options);
      if (!response.ok) {
        throw new Error(response.statusText);
      }

      const jsonRes = (await response.json()) as {
        predictions: Array<{ embeddings: { values: number[] } }>;
      };

      return jsonRes.predictions.map((pred) => pred.embeddings.values);
    };

    return backOff(requestWithBackoff, { numOfAttempts: 5 });
  }

  private async withVertexMultimodal(
    model: MultimodalEmbeddingModel,
    content: string[],
    type: ContentType
  ): Promise<number[][]> {
    const { accessToken, projectId, region } = await getGoogleCloud();

    const baseUrl = `https://${region}-aiplatform.googleapis.com/v1`;
    const path = `/projects/${projectId}/locations/${region}/publishers/google/models/${model}:predict`;

    const embeddingPromises = content.map(async (chunk) => {
      const body =
        type === 'text'
          ? JSON.stringify({ instances: [{ text: chunk }] })
          : JSON.stringify({ instances: [{ image: { bytesBase64Encoded: chunk } }] });

      const options: RequestInit = {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body,
      };

      const response = await fetch(baseUrl + path, options);
      if (!response.ok) {
        throw new Error(response.statusText);
      }

      const jsonRes = await response.json();
      const prediction = jsonRes.predictions[0];

      if (type === 'text') {
        return prediction.textEmbedding as number[];
      } else {
        return prediction.imageEmbedding as number[];
      }
    });

    const embeddings = await Promise.all(embeddingPromises);
    return embeddings;
  }
}
