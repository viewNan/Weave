import type { DocumentSummary } from "../../../domain/document";
import type { DocumentRepository } from "../repositories/document-repository";

export function listDocuments(
  repository: DocumentRepository,
): Promise<DocumentSummary[]> {
  return repository.listDocuments();
}
