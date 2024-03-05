export enum TextEmbeddingModel {
  TextEmbedding3Small = 'text-embedding-3-small',
}

export class VectorClient {
  public async vectorize(model: string, content: string[]): Promise<number[][]> {
    return [[123], [124]];
  }
}
