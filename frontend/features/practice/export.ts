import { FLUENT_POINTS, PASS_SCORE, fluentProgress, questionCode, ratingLabels, studyDay, type Attempt, type PracticeGroup, type PracticeItem, type PracticeSet } from './domain.ts';

export type PracticeExportSnapshot = {
  schema_version: 1; exported_at: string; scope: 'current' | 'all'; timezone: 'Asia/Tokyo'; study_day_boundary: '04:00'; numbering_last_allocated: number;
  sets: (PracticeSet & { created_at: string })[];
  groups: (PracticeGroup & { name_key: string })[];
  items: (Pick<PracticeItem, 'id' | 'question_number' | 'group_id' | 'prompt' | 'outline' | 'sort_order' | 'starred' | 'archived' | 'revision'> & { prompt_key: string })[];
  attempts: (Attempt & { sequence: number })[];
};

function fenced(value: string, language = 'text') {
  const longest = Math.max(0, ...[...value.matchAll(/`+/g)].map(match => match[0].length));
  const fence = '`'.repeat(Math.max(3, longest + 1));
  return `${fence}${language}\n${value}\n${fence}`;
}
function heading(value: string) { return value.replace(/\r\n?|\n/g, ' ').replace(/[\\`*_{}\[\]()#+.!<>|~]/g, '\\$&'); }
const json = (value: unknown) => fenced(JSON.stringify(value, null, 2), 'json');

export function exportMarkdown(snapshot: PracticeExportSnapshot): string {
  const day = studyDay(new Date(snapshot.exported_at)), attempts = new Map<string, PracticeExportSnapshot['attempts']>();
  for (const attempt of snapshot.attempts) {
    if (!attempts.has(attempt.item_id)) attempts.set(attempt.item_id, []);
    attempts.get(attempt.item_id)!.push(attempt);
  }
  const lines = ['# Weave 练习题库完整导出', '', `导出时间（UTC）：${snapshot.exported_at}`, `范围：${snapshot.scope === 'all' ? '全部题库' : '当前题库'}；学习日：${day}；时区：Asia/Tokyo；凌晨 04:00 分界。`,
    `共 ${snapshot.sets.length} 个题库、${snapshot.groups.length} 个分类、${snapshot.items.length} 道题、${snapshot.attempts.length} 条记录（包含已归档题目和已删除记录）。`, '',
    '## 给 AI 的说明', '', '请用固定题目编号（如 Q0001）对应每道题，回复时保留编号。编号与显示顺序无关，不要根据排序重新编号。题目 UUID 同时保留，便于机器精确匹配。',
    `流畅进度规则：有效流畅记录每次 +${FLUENT_POINTS}，卡顿/不会/未评级 +0，最高 ${PASS_SCORE}，无每日上限。只统计 deleted=0 的有效记录。统计与积分是导出时按历史重算的结果，不是额外练习记录。`,
    '达到目标不等于客观掌握。修改过的记录显示其当前值，本导出不包含修改前的操作审计。请勿补造经历、研究结果或不存在的练习。',
    '本文件供阅读、AI 整理和保留数据使用，不是当前内容导入框的格式，尚无一键恢复全部历史的功能。', '', '## 导出元数据', '',
    json({ schema_version: snapshot.schema_version, exported_at: snapshot.exported_at, scope: snapshot.scope, timezone: snapshot.timezone, study_day_boundary: snapshot.study_day_boundary,
      numbering_last_allocated: snapshot.numbering_last_allocated, scoring: { fluent_points: FLUENT_POINTS, pass_score: PASS_SCORE, daily_cap: null } }), ''];
  for (const set of snapshot.sets) {
    lines.push(`## 题库：${heading(set.name)}`, '', '题库元数据：', json(set), '');
    for (const group of snapshot.groups.filter(value => value.set_id === set.id)) {
      lines.push(`### 分类：${heading(group.name)}${group.archived ? '（已归档）' : ''}`, '', '分类元数据：', json(group), '');
      for (const item of snapshot.items.filter(value => value.group_id === group.id)) {
        const history = [...(attempts.get(item.id) ?? [])].sort((a, b) => a.sequence - b.sequence);
        const valid = history.filter(value => !value.deleted), rated = valid.filter(value => value.rating !== null);
        const latest = rated.at(-1)?.rating ?? null;
        const counts = { fluent_count: valid.filter(value => value.rating === 'fluent').length, shaky_count: valid.filter(value => value.rating === 'shaky').length, unknown_count: valid.filter(value => value.rating === 'unknown').length };
        const progress = fluentProgress({ ...counts, current_rating: latest });
        const { prompt, outline, ...metadata } = item;
        lines.push(`#### ${questionCode(item)}${item.archived || group.archived ? '（已归档）' : ''}`, '', '题目：', fenced(prompt), '', '回答要点：', fenced(outline), '',
          `统计：共练 ${valid.length} 次；流畅 ${counts.fluent_count} 次；卡顿 ${counts.shaky_count} 次；不会 ${counts.unknown_count} 次；未评级 ${valid.length - rated.length} 次。`,
          `今日 ${valid.filter(value => value.study_day === day).length} 次；最近评级：${latest ? ratingLabels[latest] : '未评级'}；流畅进度 ${progress.score}/${PASS_SCORE}；还差 ${progress.remaining} 次流畅记录。`,
          `状态：${progress.status === 'passed' ? '目标达成' : progress.status === 'review' ? '待复习' : '积累中'}；另有 ${history.length - valid.length} 条已删除记录，不参与上述统计。`, '',
          '题目元数据（固定编号、UUID、分类、星标、排序、归档及版本）：', json(metadata), '', '逐次练习记录（完整保留序号、UUID、时间、学习日、评级、备注和删除标记）：', json(history), '');
      }
    }
  }
  return lines.join('\n').trimEnd() + '\n';
}
