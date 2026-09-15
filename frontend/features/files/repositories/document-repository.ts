import type { DocumentSummary } from "../../../domain/document";

export interface DocumentRepository {
  listDocuments(): Promise<DocumentSummary[]>;
}
