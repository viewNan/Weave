import assert from 'node:assert/strict';
import test from 'node:test';
import { messages, translate } from '../shared/i18n/messages.ts';

test('interface translations cover both languages and preserve interpolation values', () => {
  assert.equal(translate('en', '活动转盘'), 'Activity Roulette');
  assert.equal(translate('zh-CN', '活动转盘'), '活动转盘');
  assert.equal(translate('zh-CN', 'Research'), '研究');
  assert.equal(translate('en', '删除“{0}”？历史记录不会删除。', '我的笔记 $& {1}'), 'Delete “我的笔记 $& {1}”? History will be kept.');
  assert.equal(translate('en', '我的自定义活动'), '我的自定义活动');
  assert.equal(translate('en', '之后休息 {0} 分钟', 5), 'Then rest for 5 min');
  for (const [source, target] of Object.entries(messages)) {
    assert.ok(target.trim(), source);
    const placeholders = (text: string) => [...text.matchAll(/\{(\d+)\}/g)].map(match => match[1]).sort();
    assert.deepEqual(placeholders(target), placeholders(source), source);
  }
});
