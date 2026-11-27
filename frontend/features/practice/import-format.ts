import { normalized } from './domain.ts';

export const importInstructions = `请把材料整理成 Weave 导入格式，只输出文本：
# 大分类名称
Q: 题目内容
A:
回答要点整块写在这里，可以有任意段落、换行和列表，不必拆成固定条数。

每个分类以半角 # 和空格开头，每题以大写 Q: 开头，要点以独占一行的 A: 开始。
没有要点时可省略 A:。题目也可续行。A: 后的全部文字都属于本题要点，直到下一个分类或 Q:。
正文若有行以 #、Q:、A:、三个反引号开头，在行首加一个反斜杠，导入时会去掉它。
不要添加额外字段或解释，不要编造材料中没有的个人经历和事实。`;

export type ImportItem = { prompt: string; outline: string; line: number };
export type ImportGroup = { name: string; items: ImportItem[]; line: number };
export type ImportResult = { groups: ImportGroup[]; errors: { line: number; message: string }[]; count: number };

export function parseImport(source: string): ImportResult {
  const errors: ImportResult['errors'] = [];
  const fail = (line: number, message: string) => errors.push({ line, message });
  if (new TextEncoder().encode(source).length > 1_000_000) return { groups: [], count: 0, errors: [{ line: 1, message: '导入文本超过 1 MB。' }] };
  const lines = source.replace(/^\uFEFF/u, '').replace(/\r\n?/g, '\n').split('\n');
  let start = lines.findIndex(line => line.trim()), end = lines.length - 1;
  while (end >= 0 && !lines[end].trim()) end--;
  if (start >= 0 && /^```(?:text|markdown|md)?$/u.test(lines[start].trim())) {
    if (lines[end]?.trim() !== '```' || start === end) fail(start + 1, '代码块没有结束。');
    else { lines[start] = ''; lines[end] = ''; }
  }
  const groups: ImportGroup[] = [];
  let group: ImportGroup | undefined, item: ImportItem | undefined, outline = false;
  const finishItem = () => {
    if (!item) return;
    item.prompt = item.prompt.trim(); item.outline = item.outline.trim();
    if (!item.prompt) fail(item.line, '题目不能为空。');
    if (item.prompt.length > 4000 || item.outline.length > 200_000) fail(item.line, '题目或要点超出长度限制。');
    item = undefined;
  };
  for (let index = 0; index < lines.length; index++) {
    const raw = lines[index], line = raw.trim(), number = index + 1;
    if (/^# /u.test(line)) {
      finishItem(); outline = false;
      const name = line.slice(2).trim();
      if (!name || name.length > 100) { fail(number, '分类名需为 1–100 字。'); group = undefined; continue; }
      group = groups.find(value => normalized(value.name) === normalized(name));
      if (!group) { group = { name, items: [], line: number }; groups.push(group); }
    } else if (/^Q:/u.test(line)) {
      finishItem(); outline = false;
      if (!group) { fail(number, '请先填写大分类。'); continue; }
      item = { prompt: line.slice(2).trim(), outline: '', line: number }; group.items.push(item);
      if (!item.prompt) fail(number, 'Q: 后需填写题目。');
    } else if (line === 'A:') {
      if (!item || outline) fail(number, 'A: 必须在题目之后，且每题只能出现一次。');
      else outline = true;
    } else if (/^(?:#|＃|[qＱｑ][:：]|Q：|[aＡａ][:：]|A:|A：|```)/u.test(line)) {
      fail(number, '标记格式不正确；正文中的保留标记请在行首加反斜杠。');
    } else if (item) {
      const content = raw.replace(/^(\s*)\\(?=#|＃|[QqAaＱｑＡａ][:：]|```)/u, '$1');
      if (outline) item.outline += `${item.outline ? '\n' : ''}${content}`;
      else item.prompt += `\n${content}`;
    } else if (line) fail(number, '内容必须属于某个分类中的题目。');
  }
  finishItem();
  let count = 0;
  for (const entry of groups) {
    if (!entry.items.length) fail(entry.line, '分类下没有题目。');
    const seen = new Map<string, number>();
    for (const question of entry.items) {
      const key = normalized(question.prompt);
      if (seen.has(key)) fail(question.line, '同分类题目重复。');
      seen.set(key, question.line); count++;
    }
  }
  if (!count) fail(1, '没有可导入的题目。');
  if (count > 1000 || groups.length > 100) fail(1, '一次最多导入 100 个分类、1000 道题。');
  return { groups, errors, count };
}
