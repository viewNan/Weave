export const nodeTypes = ['domain', 'feature', 'system', 'logic', 'data', 'decision', 'innovation', 'pattern'] as const;
export const edgeTypes = ['contains', 'uses', 'stores_in', 'affects', 'depends_on', 'related_to', 'produces', 'inspired_by'] as const;
export type AtlasNodeType = typeof nodeTypes[number];
export type AtlasEdgeType = typeof edgeTypes[number];
export type AtlasNode = { id: string; type: AtlasNodeType; title: string; summary: string; notes: string; parentId?: string; collapsed?: boolean };
export type AtlasEdge = { id: string; from: string; to: string; type: AtlasEdgeType; label?: string };
export type AtlasLayout = { nodeId: string; x: number; y: number; width: number; height: number };
export type AtlasDocument = { nodes: AtlasNode[]; edges: AtlasEdge[]; layout: AtlasLayout[]; canvas: unknown; revision: number };
