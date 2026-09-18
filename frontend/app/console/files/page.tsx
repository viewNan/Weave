import { listDocuments } from '../../../features/files/services/list-documents';
import { mockDocumentRepository } from '../../../features/files/infrastructure/mock-document-repository';
import FilesConsole from './FilesConsole';
export default async function ConsoleFilesPage() { return <FilesConsole documents={await listDocuments(mockDocumentRepository)} />; }
