# Practice / 练习清单

The personal Console feature lives at `/console/practice`. It uses the existing
`PUSH_SUBSCRIPTIONS_DB` Cloudflare D1 binding and the same-origin write protection
already used by the single-user Console. It does not add accounts or sharing.
The existing Console is directly accessible; same-origin validation is not a
login system. Any deployment-level Cloudflare Access policy must cover both the
Console page and `/api/internal/practice`.

The current score, count display and **Start practice** rules are documented in
[练习积分、统计与随机练习规则](practice-scoring.md). The bank keeps its original
category order; only an explicitly started practice round is shuffled.

## Storage and release

Apply `frontend/migrations/0013_practice.sql` and then
`frontend/migrations/0014_practice_question_numbers.sql` to the existing D1 database before
releasing this feature. For local development, from `frontend`:

```sh
npx wrangler d1 execute PUSH_SUBSCRIPTIONS_DB --local --file migrations/0013_practice.sql
```

Remote migration and deployment are separate release operations. No production
data or configuration is included here. Practice data is server-side; refreshing
or opening another device reads the same database. Offline writes are not queued.

## Import format / 导入格式

Only three fields exist: **category, question, whole answer outline**
（大分类、题目、整块回答要点）. There is no separate examples field and no required
number or structure of outline points.

| Marker | Meaning |
| --- | --- |
| `# ` followed by text | Start a category; editable name, 1–100 characters |
| `Q:` followed by text | Start a question; text can continue on subsequent lines |
| `A:` on its own line | Start the optional whole outline block |

Everything after `A:` belongs to that outline until the next category or `Q:`.
Paragraphs, blank lines, indentation, punctuation and lists are preserved. Only
leading/trailing whitespace around a completed block is removed. A new `A:`
inside a question is an error. A question without an outline can omit `A:`.

Markers use ASCII punctuation. Malformed reserved markers (including full-width
colons or lowercase `q:`) report their line number. To include a literal line
beginning with `#`, `Q:`, `A:`, or three backticks, put a backslash immediately
before that marker; the importer removes the backslash. This also works after
indentation. An optional single outer `text`, `markdown`, or unlabelled code fence
is accepted. Content is plain text, not executable HTML or rendered Markdown.

Import targets the selected practice set. Same-name categories merge, and a
duplicate question within a category is skipped. Existing outlines, archives,
stars, ratings and history are preserved. Comparison uses NFC and collapsed
whitespace; stored content retains its layout. The same question in another
category is a separate item. Duplicate questions within the input are errors.

Archived categories block the import until explicitly restored in Manage. No
archive is silently restored. Every format error blocks the entire import; D1
batch writes are atomic. Unique constraints make retries skip existing content.
The server re-parses and re-checks the input rather than trusting a preview.

The UI exposes the exact AI formatting instructions under Import. It provides a
local content preview, an optional server duplicate check, and one Import button.
There is no multi-step wizard. Operational limits per import: 1 MB UTF-8 text,
100 categories, 1,000 questions, 4,000 characters per question and 200,000
characters per outline. These are storage limits, not a required outline length.

## Practice semantics

- Study day: **Asia/Tokyo, 04:00** to the next 04:00. Server time is authoritative.
  Midnight does not reset the day. Old-page requests after 04:00 are rejected and
  refreshed, rather than editing the previous day's latest record.
- First check creates one unrated attempt. Rating afterwards updates that attempt.
  Rating directly creates an attempt if none exists today.
- Rating changes correct today's latest attempt. Repeating requires **Practice
  again (+1)**, which appends an unrated attempt. Earlier attempts remain intact.
- The controls show this attempt's rating; a separate label shows the most recent
  rated attempt. An unrated repeat never overwrites the mastery label.
- The checked box means at least one valid attempt today. Clicking an already
  checked box opens history; it never deletes all today's attempts.
- History supports individual soft deletion, restoration and notes. Recent
  attempt changes offer an eight-second undo. Historical deleted rows remain
  recoverable in history after this window.
- Practice writes use item revisions and atomic conditional batches. A stale
  device cannot overwrite a newer item revision. Retrying the same creation ID
  cannot create a duplicate attempt. Item edits also check the current revision.
- Statistics exclude archived questions and categories. Today's distinct-question
  count, total attempts, and latest-rating distribution are separate values.
  Search and filters change the list, not the practice-set totals.
- Per-question lifetime counts derive from non-deleted history. Fluent progress
  is 10 points per fluent attempt, capped at 100, with no daily cap. Counts are
  available in one expansion; a failed attempt does not reduce earlier points.
- Start practice creates a client-side shuffled round with latest-rating priority
  (unable, hesitant, unrated, fluent). Rating a question moves it behind the
  remaining questions for that round; returning to the bank restores category
  order. This never overwrites stored item order or creates automatic attempts.

## Verification

`npm test` includes real SQLite tests of the migration and service SQL, atomic
rollback, duplicate imports, archive conflicts, revision conflicts, history,
undo, 04:00 boundaries and existing same-origin validation. Run `npm run
typecheck` and `npm run build` before release. Local tests do not prove a remote
migration or Cloudflare Access policy has been applied.

## 固定编号与完整导出

每题有全题库唯一的固定编号（Q0001、Q0002……），用于给 AI 对应题目。
编号与排序无关，编辑、随机练习、移动分类和归档都不会改变编号。
0014 迁移按现有题库/分类顺序分配首批编号，新题由数据库触发器分配；
保留历史编号映射，即使以后永久删除题目，也不复用编号。UUID 仍是内部标识。

顶部“导出”可选择当前或全部题库，一次显示可复制的整合文字，也可下载
UTF-8 Markdown。包括分类、题目、要点、编号、UUID、星标、顺序、归档、
逐次练习评级、备注、时间、学习日及删除标记；统计和分数按有效历史重新计算。
导出使用一次数据库查询读取一致快照，接口禁止缓存，不会发送给外部 AI。

保留逐次记录可以在以后修改加分和排序规则时重新计算。仅有累计次数无法
重建练习顺序、时间或备注；从未保存的信息以及评级纠正前的旧值无法恢复。
导出 Markdown 适合阅读、保存及给 AI 整理，不是现有内容导入格式，目前
没有一键恢复全部历史的功能。实际数据和本地测试数据都不得提交到 Git。

题库主页保持明确的分类标题。每行的“要点”按钮直接弹出小窗口，手机无需
先展开题目；练习卡片也可直接查看要点。星标使用22px图标和44px点击区域。
