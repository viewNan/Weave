import type { DocumentSummary } from "../../../domain/document";
import type { DocumentRepository } from "../repositories/document-repository";

const documents: DocumentSummary[] = [
  { id: "1", name: "Personal Knowledge & Agent Platform.md", type: "Markdown", project: "Personal AI", version: 3, updated: "Today, 14:32", size: "42 KB", status: "Ready" },
  { id: "2", name: "Research notes — cosmic rays.pdf", type: "PDF", project: "Research", version: 2, updated: "Yesterday", size: "2.4 MB", status: "Ready" },
  { id: "3", name: "Job hunting tracker.xlsx", type: "Excel", project: "Job Hunting", version: 1, updated: "Aug 28", size: "18 KB", status: "Ready" },
  { id: "4", name: "Japanese practice.docx", type: "Word", project: "Japanese Practice", version: 4, updated: "Aug 26", size: "96 KB", status: "Ready" },
];

export const mockDocumentRepository: DocumentRepository = {
  async listDocuments() {
    return documents;
  },
};
