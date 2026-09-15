import FilesWorkspace from "../../features/files/components/FilesWorkspace";
import { mockDocumentRepository } from "../../features/files/infrastructure/mock-document-repository";
import { listDocuments } from "../../features/files/services/list-documents";

export default async function FilesPage() {
  const documents = await listDocuments(mockDocumentRepository);

  return <FilesWorkspace documents={documents} />;
}
