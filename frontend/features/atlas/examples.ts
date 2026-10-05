import type { AtlasDocument, AtlasNode, AtlasNodeType } from './model';

type Item = [id: string, type: AtlasNodeType, title: string, summary: string, parentId?: string];

function example(items: Item[]): AtlasDocument {
  const nodes: AtlasNode[] = items.map(([id, type, title, summary, parentId]) => ({
    id, type, title, summary, notes: '', ...(parentId ? { parentId } : {}),
    ...(items.some(item => item[4] === id) ? { collapsed: parentId !== undefined } : {}),
  }));
  const children = new Map<string, string[]>();
  for (const node of nodes) if (node.parentId) children.set(node.parentId, [...(children.get(node.parentId) || []), node.id]);
  const roots = nodes.filter(node => !node.parentId);
  const positions = new Map<string, { x: number; y: number }>();
  function place(id: string, depth: number, y: number) {
    positions.set(id, { x: 80 + depth * 330, y });
    (children.get(id) || []).forEach((child, index, list) => place(child, depth + 1, y + (index - (list.length - 1) / 2) * 175));
  }
  roots.forEach((node, index) => place(node.id, 0, 420 + index * 900));
  return {
    nodes,
    edges: nodes.filter(node => node.parentId).map(node => ({
      id: `edge-${node.id}`, from: node.parentId!, to: node.id, type: 'contains',
    })),
    layout: nodes.map(node => ({ nodeId: node.id, ...positions.get(node.id)!, width: 240, height: 115 })),
    canvas: null, revision: 0,
  };
}

export const atlasExamples = [
  {
    title: 'Activity Roulette',
    summary: '从活动池、选择逻辑到疲劳反馈的自适应转盘设计。',
    tags: ['Study', 'Design'],
    document: example([
      ['roulette', 'feature', 'Activity Roulette', '降低选择成本，按状态推荐下一项活动'],
      ['architecture', 'system', 'Architecture', '活动池、选择引擎与计时反馈', 'roulette'],
      ['pool', 'data', 'Activity Pool', '候选活动及其类别与时长', 'architecture'],
      ['engine', 'logic', 'Selection Engine', '按权重选出下一项活动', 'architecture'],
      ['timer', 'system', 'Timer', '记录实际投入时间', 'architecture'],
      ['feedback', 'logic', 'Fatigue Feedback', '结束后更新疲劳状态', 'architecture'],
      ['data', 'data', 'Data', '活动、类别、时长、疲劳与历史', 'roulette'],
      ['activity', 'data', 'Activity', '可执行的学习或休息活动', 'data'],
      ['category', 'data', 'Category', '学习与放松等活动类别', 'data'],
      ['duration', 'data', 'Expected Duration', '活动预计投入时间', 'data'],
      ['fatigue', 'data', 'Fatigue', '影响活动权重的当前状态', 'data'],
      ['history', 'data', 'History', '用于回顾与避免重复', 'data'],
      ['logic', 'logic', 'Core Logic', '工作学习增加疲劳，放松帮助恢复', 'roulette'],
      ['work', 'logic', 'Work / Study', '完成一段高投入活动', 'logic'],
      ['weight', 'logic', 'Relax Weight', '疲劳上升时提高放松概率', 'logic'],
      ['relax', 'logic', 'Relax', '安排恢复性活动', 'logic'],
      ['decision', 'decision', 'Why not pure random?', '纯随机忽略了当下精力与恢复需要', 'roulette'],
      ['innovation', 'innovation', 'Adaptive Randomness', '疲劳越高，放松活动权重越大', 'roulette'],
      ['reduction', 'innovation', 'Decision Reduction', '减少每次开始前的选择成本', 'innovation'],
    ]),
  },
  {
    title: 'Agent Memory Map',
    summary: '短期上下文、长期知识与检索决策的个人记忆地图。',
    tags: ['Agent', 'Memory'],
    document: example([
      ['memory', 'system', 'Agent Memory', '让上下文与长期知识服务当前任务'],
      ['short', 'system', 'Short-term Memory', '当前对话和进行中的任务', 'memory'],
      ['conversation', 'data', 'Current Conversation', '最近的对话内容', 'short'],
      ['task', 'data', 'Active Task State', '目标、进度和待解决的问题', 'short'],
      ['long', 'system', 'Long-term Memory', '可跨会话使用的稳定信息', 'memory'],
      ['preference', 'data', 'User Preference', '用户明确表达的偏好', 'long'],
      ['knowledge', 'data', 'Project Knowledge', '项目结构与约定', 'long'],
      ['history', 'decision', 'Historical Decisions', '为什么这样设计', 'long'],
      ['context', 'logic', 'Context Management', '按需总结与检索', 'memory'],
      ['multi', 'logic', 'Multi-turn Context', '保持当前对话的连续性', 'context'],
      ['summary', 'logic', 'Summarization', '压缩较长的历史上下文', 'context'],
      ['retrieval', 'logic', 'Retrieval', '按当前任务取回相关知识', 'context'],
      ['storage', 'data', 'Storage', '数据库、文档与索引', 'memory'],
      ['database', 'data', 'Database', '结构化记忆与状态', 'storage'],
      ['documents', 'data', 'Documents', '较长的知识与决策记录', 'storage'],
      ['index', 'data', 'Search / Index', '按主题定位相关内容', 'storage'],
      ['decisions', 'decision', 'Memory Decisions', '决定记住、过期或忽略什么', 'memory'],
      ['remember', 'decision', 'What to remember?', '保留长期有用的信息', 'decisions'],
      ['expire', 'decision', 'What should expire?', '让临时状态及时失效', 'decisions'],
      ['noise', 'decision', 'Prevent noisy memory', '避免无关细节淹没重要信息', 'decisions'],
    ]),
  },
] as const;

export function exampleThumbnail(document: AtlasDocument): string {
  const canvas = window.document.createElement('canvas');
  canvas.width = 440; canvas.height = 248;
  const context = canvas.getContext('2d');
  if (!context) return '';
  const ctx = context;
  context.fillStyle = '#f8fafc'; context.fillRect(0, 0, 440, 248);
  const root = document.nodes.find(node => !node.parentId);
  if (!root) return '';
  const children = document.nodes.filter(node => node.parentId === root.id).slice(0, 5);
  context.strokeStyle = '#cbd5e1'; context.lineWidth = 2;
  children.forEach((_, index) => {
    const y = 22 + index * 44;
    context.beginPath(); context.moveTo(185, 124); context.lineTo(230, y + 16); context.stroke();
  });
  function card(x: number, y: number, w: number, label: string, fill: string) {
    ctx.fillStyle = fill; ctx.strokeStyle = '#cbd5e1';
    ctx.beginPath(); ctx.roundRect(x, y, w, 32, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#334155'; ctx.font = '12px sans-serif';
    ctx.fillText(label.length > 25 ? `${label.slice(0, 23)}…` : label, x + 10, y + 20, w - 18);
  }
  card(16, 108, 170, root.title, '#dbeafe');
  children.forEach((node, index) => card(230, 22 + index * 44, 190, node.title, '#ede9fe'));
  return canvas.toDataURL('image/png');
}
