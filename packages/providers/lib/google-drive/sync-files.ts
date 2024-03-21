import { SyncContext } from '../types';

export default async function syncFiles(context: SyncContext) {
  // paginate through files
  // save all ids
  // process files created or edited after last_synced_at
  // for each file to process
  //    break up into chunks
  //
  //    save file with chunks in weaviate
  //    save unique file in postgres
}
