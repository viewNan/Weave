# Personal Knowledge & Agent Platform
## 项目架构设计文档 v0.1

## 1. 项目目标

构建一个以个人知识为核心、可进一步扩展到研究室多人使用的 AI Agent 平台。

系统需要支持：

- 统一管理个人文件、笔记、项目、事实信息和写作内容；
- AI 能够主动判断什么时候需要搜索个人知识库；
- AI 能够读取、搜索、总结和修改知识；
- 支持 ChatGPT、Claude、Cursor、自建 Web UI 等多个入口；
- 支持 Markdown、表格、文件列表等不同编辑和展示方式；
- 支持长期记忆、来源追踪和版本管理；
- 后期可扩展为研究室多人协作平台；
- Agent、模型、UI 和数据库之间保持低耦合，未来可以分别替换。

---

# 2. 核心设计原则

## 2.1 Knowledge 与 Agent 分离

知识系统不依赖某个 LLM 或 Agent Framework。

Agent 只能通过明确的 Tool Interface 访问知识。

例如：

```text
search_knowledge()
get_document()
get_facts()
create_note()
update_note()
save_draft()
```

因此未来可以替换：

```text
OpenAI Agents SDK
→ LangChain
→ LangGraph
→ Claude / Gemini
→ 其他 Agent Framework
```

而不需要修改底层数据。

---

## 2.2 数据与 UI 分离

数据库保存真正的数据结构。

UI 只是数据的一种 View。

例如同一组 Task 数据可以显示为：

```text
Weekly Grid
Calendar
Kanban
Project List
AI Summary
```

因此未来可以更换 UI，而不需要迁移数据。

---

## 2.3 MCP 与 Agent 分离

MCP 是系统对外提供能力的一种接口，而不是 Agent 本身。

```text
Knowledge Service
      │
      ├── Internal API
      ├── REST API
      └── MCP
```

自己的 Agent 可以直接调用内部 API。

ChatGPT、Claude、Cursor 等外部平台通过 MCP 调用。

---

## 2.4 Source of Truth 明确

每一种数据必须有明确的主要来源。

长期目标：

```text
PostgreSQL
= 核心结构化数据的 Source of Truth
```

Google Sheets、Google Drive 等属于：

```text
External Connector / View / Original File Source
```

避免多处同时修改产生数据冲突。

---

# 3. 总体系统架构

```text
                     ┌─────────────────────┐
                     │       Clients       │
                     │                     │
                     │ Personal Web UI     │
                     │ ChatGPT             │
                     │ Claude              │
                     │ Cursor              │
                     │ Future Apps         │
                     └──────────┬──────────┘
                                │
                    REST / MCP / Internal API
                                │
                ┌───────────────▼───────────────┐
                │       Knowledge Service       │
                │                               │
                │ Documents                     │
                │ Facts                         │
                │ Projects                      │
                │ Tasks                         │
                │ Drafts                        │
                │ Search                        │
                │ Version / Citation            │
                └───────────────┬───────────────┘
                                │
                 ┌──────────────┼──────────────┐
                 │              │              │
                 ▼              ▼              ▼
             PostgreSQL      pgvector       Storage
             structured      semantic       files
                 │
                 │
        ┌────────▼─────────┐
        │   Agent Runtime  │
        │                  │
        │ Skill Router     │
        │ Context Builder  │
        │ LLM              │
        │ Tool Selection   │
        │ Retry/Fallback   │
        │ Memory           │
        │ Evaluation       │
        └──────────────────┘
```

---

# 4. 系统模块划分

# A. Knowledge Layer

这是整个系统最核心、最不应该频繁重构的一层。

负责：

- 文件
- 笔记
- 项目
- Facts
- Tasks
- Drafts
- Metadata
- Version
- Source
- Permission

建议主要使用：

```text
PostgreSQL
Supabase
pgvector
Object Storage
```

---

## A1. Documents

保存知识文档的逻辑信息。

```text
documents

id
workspace_id
project_id
owner_id
title
document_type
source_type
source_url
current_version_id
visibility
created_at
updated_at
```

---

## A2. Document Versions

禁止直接覆盖旧内容。

```text
document_versions

id
document_id
version_number
content
storage_path
created_by
created_at
```

---

## A3. Chunks

用于检索。

```text
chunks

id
document_id
version_id
content
embedding
section
page
chunk_index
metadata
```

---

## A4. Facts

用于保存结构化长期信息。

```text
facts

id
workspace_id
subject
predicate
value

source_document_id
source_chunk_id

valid_from
valid_until

confidence
created_at
updated_at
```

例如：

```text
user
preferred_job
SE / SIer
2026-08-
```

而不是每次都依赖 RAG 搜聊天记录。

---

## A5. Projects

用于缩小 Agent 搜索范围。

```text
projects

id
workspace_id
name
description
status
created_at
updated_at
```

例如：

```text
Research
COSMIC
Job Hunting
Japanese Practice
Personal AI
```

---

## A6. Tasks

日程、计划等数据长期建议结构化保存。

```text
tasks

id
workspace_id
project_id

title
date
status
priority
category
notes

created_at
updated_at
```

UI 可以把这些数据展示成 Google Sheets 风格。

---

## A7. Drafts

用于多平台写作。

```text
drafts
    master content

draft_variants
    platform
    content
    version
```

例如：

```text
Master Article
├── Blog
├── LinkedIn
├── Xiaohongshu
└── Presentation
```

---

# B. Retrieval Layer

负责：

> Agent 如何准确找到信息。

第一阶段：

```text
Metadata Filter
+
Keyword Search
+
Vector Search
```

形成：

```text
Hybrid Search
```

之后再扩展：

```text
Query Rewrite
Reranking
Multi-step Retrieval
Agentic Retrieval
```

统一对外暴露：

```text
search_knowledge()
```

而不是让 Agent 直接操作 pgvector。

---

# C. Knowledge Service

负责把数据库能力包装成稳定接口。

例如：

```text
search_knowledge()

get_document()

list_documents()

get_facts()

get_project()

create_note()

update_note()

create_task()

update_task()

save_draft()
```

这一层非常重要。

原则：

> Agent 不知道数据库表结构。

Agent 只知道 Tool Contract。

---

# D. Agent Runtime

这是完整 Agent 部署的核心部分。

第一版：

```text
User Query
    ↓
Skill Router
    ↓
Load Skill
    ↓
LLM
    ↓
Tool Call
    ↓
Knowledge Service
    ↓
LLM
    ↓
Response
```

之后可以扩展：

```text
Memory
Retry
Fallback
Verification
Evaluation
State
Human Approval
```

---

# E. Skills

Skill 负责：

> 某类任务应该怎么做。

目录：

```text
skills/

research.md
career.md
writing.md
personal.md
meeting.md
```

示例：

```yaml
---
name: career

tools:
  - search_knowledge
  - get_facts
  - web_search

knowledge_scope:
  - career

rules:
  - 优先使用最新信息
  - 不允许编造经历
  - 企业信息需要外部搜索
---
```

正文：

```text
1. Identify task
2. Retrieve personal experience
3. Retrieve previous related content
4. Search current company information
5. Generate response
```

---

# F. MCP Layer

MCP 用于让其他 AI 平台访问自己的知识。

例如：

```text
ChatGPT
Claude
Cursor
      │
      ▼
Remote MCP
      │
      ▼
Knowledge Service
```

MCP 暴露：

```text
search_knowledge
get_document
get_facts
list_projects
create_note
update_note
```

MCP 不直接访问数据库。

---

# G. Connector Layer

用于连接外部数据源。

```text
connectors/

google_drive
google_sheets
google_calendar
github
future connectors
```

例如 Google Sheets：

```text
read_week_plan()
update_week_plan()
```

Google Drive：

```text
list_files()
read_file()
sync_file()
```

Connector 与内部数据库通过统一接口衔接。

---

# H. UI Layer

UI 不属于核心架构，可以后续自由迭代。

长期可以做成：

```text
Personal Workspace
```

支持：

```text
Markdown Block
Table Block
File Block
Calendar Block
Kanban Block
AI Block
Search Block
```

因此：

```text
页面 ≠ 固定功能
```

而是：

```text
Page
├── Markdown
├── Table
├── Files
└── AI
```

周计划只是其中一个 View。

---

# I. Authentication & Permission

个人版第一阶段：

```text
Supabase Auth
Personal API Token
```

研究室扩展：

```text
users
workspaces
roles
permissions
```

核心字段从第一天保留：

```text
owner_id
workspace_id
project_id
visibility
created_by
updated_by
```

后期可增加：

```text
Owner
Admin
Editor
Viewer
```

数据库使用：

```text
PostgreSQL RLS
```

---

# J. Observability

用于真正做 Agent Deployment Optimization。

建议从早期就保存：

```text
agent_runs

id
user_id
conversation_id
skill
model
status

input_tokens
output_tokens
cost

started_at
finished_at
```

以及：

```text
tool_calls

agent_run_id
tool_name
arguments
status
duration
```

以后可以分析：

```text
回答准确率
检索准确率
Tool Call 数量
Latency
Token Cost
Failure Rate
Retry Rate
```

---

# K. Memory

第一阶段可以不自动保存。

之后增加：

```text
Conversation
    ↓
Candidate Memory
    ↓
Validation
    ↓
Conflict Detection
    ↓
Save / Supersede
```

Memory 不等于聊天历史。

---

# 5. 云端部署结构

建议：

```text
Frontend
Next.js

Backend
FastAPI

Deployment
Google Cloud Run

Database
Supabase PostgreSQL

Vector
pgvector

Storage
Supabase Storage / GCS

Secrets
Google Secret Manager

Authentication
Supabase Auth

External AI Access
Remote MCP
```

个人版可以保持非常低的固定成本。

---

# 6. 研究室扩展

个人版：

```text
workspace = personal
```

以后：

```text
workspace = lab
workspace = cosmic
workspace = project_A
```

整体架构不改变。

只增加：

```text
Multi-user
RBAC
Shared workspace
Audit log
Cost tracking
Sensitivity level
Admin UI
```

因此：

```text
Personal AI
      ↓
Multi-user Extension
      ↓
Lab Knowledge & Agent Platform
```

而不是重新开发一套系统。

---

# 7. 开发阶段 Roadmap

## Phase 1 — Knowledge Foundation

目标：

> 先证明自己的数据可以稳定保存、读取和搜索。

实现：

```text
PostgreSQL
Documents
Projects
Chunks
Basic Search
File Upload
```

完成标准：

用户可以：

```text
上传一个 Markdown / PDF
↓
系统保存
↓
解析
↓
搜索
↓
返回正确内容
```

这一阶段先不做 Agent。

---

## Phase 2 — Agent Core

增加：

```text
LLM
Tools
Skills
Agent Loop
Citations
```

完成标准：

用户问：

```text
“我之前研究里提到的 future work 是什么？”
```

Agent：

```text
判断需要搜索
↓
调用 search_knowledge
↓
读取来源
↓
回答
↓
提供 citation
```

---

## Phase 3 — Deployment & Cross-platform

增加：

```text
Cloud Run
Authentication
MCP
REST API
Secret Management
```

完成标准：

```text
电脑关机
```

仍然可以通过：

```text
ChatGPT
Claude
Cursor
```

访问自己的 Knowledge Service。

---

## Phase 4 — Agent Engineering

增加：

```text
Agentic Retrieval
Memory
Retry
Fallback
Tracing
Evaluation
Cost Tracking
```

开始真正做性能实验。

例如：

```text
Before
5.2 tool calls
8.6 sec
82% retrieval accuracy

After
2.8 tool calls
5.1 sec
91% retrieval accuracy
```

---

## Phase 5 — Lab Platform

增加：

```text
Multi-user
Workspaces
RBAC
Shared Knowledge
Admin
Usage Dashboard
Sensitive Data Policy
```

---

# 8. 当前阶段明确不做的东西

第一阶段不要做：

```text
LangGraph
Multi-Agent
Qdrant
Redis
Celery
Kubernetes
复杂 OAuth Server
自动发布
复杂 Memory
Google Sheets 双向同步
万能 Workspace Editor
```

这些全部可以后加。

---

# 9. 第一阶段真正应该从哪里开始

## Step 0：不要先写 Agent

第一个任务不是：

```text
接 OpenAI API
```

也不是：

```text
做聊天页面
```

而是：

> **定义自己的 Knowledge Data Model。**

首先建立最小 schema：

```text
users
workspaces
projects
documents
document_versions
chunks
facts
```

其中第一版甚至真正使用的只有：

```text
projects
documents
document_versions
chunks
```

但是把：

```text
workspace_id
owner_id
project_id
created_at
updated_at
```

这些未来需要的字段提前留下。

---

# 10. 第一个可运行 Milestone

第一版只完成这一条链：

```text
本地 Markdown 文件
       ↓
FastAPI Upload
       ↓
保存 Document
       ↓
解析文本
       ↓
生成 Chunk
       ↓
保存 PostgreSQL
       ↓
Embedding
       ↓
pgvector
       ↓
search_knowledge("...")
       ↓
返回相关 Chunk + Source
```

注意：

**到这里甚至没有 Agent。**

但是这是整个项目最核心的一条链路。

如果这一层稳定：

```text
Agent
MCP
Web UI
Claude
ChatGPT
LangGraph
```

全部只是上层消费者。

---

# 11. 第一周建议目标

第一周只做：

```text
1. 创建 GitHub Repository

2. 建立项目目录

3. 建 Supabase Project

4. 创建核心数据库 Schema

5. 建 FastAPI

6. 实现：
   create_document()

7. 实现：
   get_document()

8. 实现：
   search_documents()

9. 上传一个自己的 Markdown 文件

10. 确认可以搜索并返回正确来源
```

推荐目录：

```text
personal-agent-platform/

backend/
├── app/
│   ├── main.py
│   │
│   ├── models/
│   │   ├── document.py
│   │   ├── project.py
│   │   └── fact.py
│   │
│   ├── services/
│   │   ├── document_service.py
│   │   └── search_service.py
│   │
│   ├── repositories/
│   │   └── document_repository.py
│   │
│   └── ingestion/
│       ├── parser.py
│       ├── chunker.py
│       └── embedding.py
│
skills/
│
frontend/
│
docs/
│   └── architecture.md
│
└── README.md
```

---

# 12. 第一阶段成功标准

第一阶段结束时不要求：

```text
界面漂亮
Agent 很聪明
支持 ChatGPT
支持 Claude
```

只需要做到：

```text
我可以把自己的资料放进去。

我可以稳定地把它取出来。

数据的位置发生变化不会影响 identity。

每条结果知道自己来自哪里。

以后 Agent 可以通过统一接口调用它。
```

如果这五件事成立，后面的 Agent、MCP 和 UI 就都有了一个稳定地基。

---

# 项目一句话定位

**A framework-independent, cross-platform personal knowledge and AI agent infrastructure that provides structured knowledge, agentic retrieval, tools, memory, and extensible interfaces for both personal and collaborative research use.**