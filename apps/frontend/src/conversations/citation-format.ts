import type { Citation, DocumentItem } from '@/api/types';

export function formatCitationLabel(
  citation: Citation,
  documentsMap?: Map<string, DocumentItem> | Record<string, DocumentItem>,
): string {
  let docTitle: string | undefined;

  if (documentsMap instanceof Map) {
    docTitle = documentsMap.get(citation.documentId)?.title;
  } else if (documentsMap) {
    docTitle = documentsMap[citation.documentId]?.title;
  }

  const title = docTitle || `Doc ${citation.documentId.slice(-6)}`;
  return `${title} (pág. ${citation.page})`;
}
