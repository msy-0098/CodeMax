import { useState, useEffect, useCallback } from 'react'
import type React from 'react'
import { Upload, FileText, Trash2, Power, X, ChevronDown, ChevronRight, Tag } from 'lucide-react'
import type { ImportedSkill } from '../../../../shared/types'

/**
 * SkillListPanel — 导入技能列表面板
 *
 * 支持导入 SKILL.md 格式的技能（兼容 Claude / CatPaw / Open Design 等）。
 * 导入方式：
 *   1. 从文件导入（选择 .md 文件）
 *   2. 粘贴文本导入（直接粘贴 SKILL.md 内容）
 *
 * 导入后持久化保存，可启用/禁用、可删除。
 */
export function SkillListPanel(): React.ReactElement {
  const [skills, setSkills] = useState<ImportedSkill[]>([])
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const [importError, setImportError] = useState('')
  const [importing, setImporting] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // 加载已导入的技能
  const loadSkills = useCallback(async () => {
    try {
      const loaded = await window.api.importedSkills.load()
      setSkills(loaded)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { void loadSkills() }, [loadSkills])

  // 从文件导入
  const handleImportFromFile = async (): Promise<void> => {
    try {
      setImporting(true)
      setImportError('')
      const filePaths = await window.api.dialog.openFile([
        { name: 'Markdown / Text', extensions: ['md', 'txt', 'markdown'] }
      ])
      if (filePaths.length === 0) return

      const result = await window.api.fs.readFileContent(filePaths[0], 10000)
      if (!result.success || !result.content) {
        setImportError(result.error || '读取文件失败')
        return
      }

      const parsed = await window.api.importedSkills.parseMarkdown(result.content)
      if (parsed.error) {
        setImportError(parsed.error)
        return
      }

      const newSkill: ImportedSkill = {
        id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        name: parsed.name,
        description: parsed.description,
        triggers: parsed.triggers,
        body: parsed.body,
        enabled: true,
        importedAt: Date.now(),
        source: 'file',
        fileName: filePaths[0].split(/[/\\]/).pop()
      }

      const updated = [newSkill, ...skills]
      setSkills(updated)
      await window.api.importedSkills.save(updated)
      setShowImport(false)
      setImportText('')
    } catch (e) {
      setImportError((e as Error).message || '导入失败')
    } finally {
      setImporting(false)
    }
  }

  // 从文本导入
  const handleImportFromText = async (): Promise<void> => {
    if (!importText.trim()) {
      setImportError('请粘贴 SKILL.md 内容')
      return
    }

    try {
      setImporting(true)
      setImportError('')
      const parsed = await window.api.importedSkills.parseMarkdown(importText)
      if (parsed.error) {
        setImportError(parsed.error)
        return
      }

      const newSkill: ImportedSkill = {
        id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        name: parsed.name,
        description: parsed.description,
        triggers: parsed.triggers,
        body: parsed.body,
        enabled: true,
        importedAt: Date.now(),
        source: 'text'
      }

      const updated = [newSkill, ...skills]
      setSkills(updated)
      await window.api.importedSkills.save(updated)
      setShowImport(false)
      setImportText('')
    } catch (e) {
      setImportError((e as Error).message || '导入失败')
    } finally {
      setImporting(false)
    }
  }

  // 切换启用/禁用
  const handleToggle = async (id: string): Promise<void> => {
    const updated = skills.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s)
    setSkills(updated)
    await window.api.importedSkills.save(updated)
  }

  // 删除
  const handleDelete = async (id: string): Promise<void> => {
    const updated = skills.filter(s => s.id !== id)
    setSkills(updated)
    await window.api.importedSkills.save(updated)
  }

  return (
    <div className="flex h-full flex-col">
      {/* 头部 */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2 shrink-0">
        <div className="flex items-center gap-2">
          <FileText size={13} className="text-accent" />
          <span className="text-xs font-semibold text-text-primary">导入技能</span>
          {skills.length > 0 && (
            <span className="text-[10px] text-text-muted">{skills.length} 个</span>
          )}
        </div>
        <button
          onClick={() => setShowImport(true)}
          className="flex items-center gap-1 rounded-lg bg-accent/10 px-2 py-1 text-[11px] font-medium text-accent transition-all hover:bg-accent/20"
        >
          <Upload size={11} />
          导入
        </button>
      </div>

      {/* 技能列表 */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {skills.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-bg-elevated text-text-muted mb-2">
              <FileText size={18} />
            </div>
            <p className="text-xs text-text-muted">暂无导入的技能</p>
            <p className="mt-1 text-[10px] text-text-muted/70">
              支持 SKILL.md 格式（兼容 Claude / CatPaw 等）
            </p>
            <button
              onClick={() => setShowImport(true)}
              className="mt-3 flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-[11px] text-text-secondary transition-all hover:border-accent/40 hover:text-accent"
            >
              <Upload size={11} />
              导入技能
            </button>
          </div>
        ) : (
          <div className="space-y-1.5">
            {skills.map((skill) => (
              <div
                key={skill.id}
                className={`group rounded-lg border transition-all ${
                  skill.enabled
                    ? 'border-border-subtle bg-bg-hover/30'
                    : 'border-border-subtle/50 bg-bg-elevated/30 opacity-60'
                }`}
              >
                <div className="flex items-center gap-2 px-2.5 py-2">
                  {/* 展开/折叠 */}
                  <button
                    onClick={() => setExpandedId(expandedId === skill.id ? null : skill.id)}
                    className="text-text-muted hover:text-text-primary transition-colors"
                  >
                    {expandedId === skill.id
                      ? <ChevronDown size={12} />
                      : <ChevronRight size={12} />
                    }
                  </button>

                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent">
                    <FileText size={10} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-text-primary truncate">{skill.name}</p>
                    <p className="text-[10px] text-text-muted truncate">
                      {skill.description || '无描述'}
                    </p>
                  </div>

                  {/* 启用/禁用 */}
                  <button
                    onClick={() => void handleToggle(skill.id)}
                    className={`icon-btn rounded-md p-1 transition-all ${
                      skill.enabled
                        ? 'text-green-400 hover:bg-green-400/10'
                        : 'text-text-muted hover:bg-bg-hover'
                    }`}
                    title={skill.enabled ? '已启用 — 点击禁用' : '已禁用 — 点击启用'}
                  >
                    <Power size={11} />
                  </button>

                  {/* 删除 */}
                  <button
                    onClick={() => void handleDelete(skill.id)}
                    className="icon-btn rounded-md p-1 text-text-muted opacity-0 transition-all hover:text-red-400 group-hover:opacity-100"
                    title="删除"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>

                {/* 展开详情 */}
                {expandedId === skill.id && (
                  <div className="border-t border-border-subtle px-2.5 py-2">
                    {/* 触发词 */}
                    {skill.triggers.length > 0 && (
                      <div className="mb-2">
                        <div className="flex items-center gap-1 mb-1">
                          <Tag size={9} className="text-text-muted" />
                          <span className="text-[9px] font-medium text-text-muted uppercase tracking-wider">触发词</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {skill.triggers.map((t, i) => (
                            <span
                              key={i}
                              className="rounded bg-accent/10 px-1.5 py-0.5 text-[9px] text-accent"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 正文预览 */}
                    <div>
                      <span className="text-[9px] font-medium text-text-muted uppercase tracking-wider mb-1 block">正文</span>
                      <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded bg-bg-elevated/50 p-2 text-[10px] leading-relaxed text-text-secondary">
                        {skill.body.slice(0, 500)}{skill.body.length > 500 ? '\n...' : ''}
                      </pre>
                    </div>

                    {/* 元信息 */}
                    <div className="mt-2 flex items-center gap-2 text-[9px] text-text-muted">
                      <span>来源：{skill.source === 'file' ? skill.fileName || '文件' : '粘贴'}</span>
                      <span>·</span>
                      <span>{new Date(skill.importedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 导入弹窗 */}
      {showImport && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => !importing && setShowImport(false)}
        >
          <div
            className="mx-4 w-full max-w-lg rounded-2xl border border-border-subtle bg-bg-base p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 弹窗头部 */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-text-primary">导入技能</h3>
                <p className="mt-0.5 text-[11px] text-text-muted">支持 SKILL.md 格式（YAML frontmatter + Markdown 正文）</p>
              </div>
              <button
                onClick={() => !importing && setShowImport(false)}
                className="icon-btn rounded-lg p-1.5 text-text-muted hover:text-text-primary"
                disabled={importing}
              >
                <X size={16} />
              </button>
            </div>

            {/* 格式示例 */}
            <div className="mb-3 rounded-lg bg-bg-elevated/50 border border-border-subtle p-2.5">
              <p className="text-[10px] text-text-muted mb-1">SKILL.md 格式示例：</p>
              <pre className="text-[10px] leading-relaxed text-text-secondary font-mono">{`---
name: "my-skill"
description: "技能描述"
triggers:
  - "触发词1"
  - "触发词2"
---

# 技能正文
AI 指令内容...`}</pre>
            </div>

            {/* 从文件导入 */}
            <button
              onClick={() => void handleImportFromFile()}
              disabled={importing}
              className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-2.5 text-xs text-text-secondary transition-all hover:border-accent/40 hover:text-accent disabled:opacity-50"
            >
              <Upload size={13} />
              选择 .md / .txt 文件
            </button>

            {/* 分隔线 */}
            <div className="my-3 flex items-center gap-2">
              <div className="h-px flex-1 bg-border-subtle" />
              <span className="text-[10px] text-text-muted">或粘贴内容</span>
              <div className="h-px flex-1 bg-border-subtle" />
            </div>

            {/* 粘贴文本 */}
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="粘贴 SKILL.md 内容..."
              rows={6}
              disabled={importing}
              className="w-full resize-none rounded-lg border border-border bg-bg-input px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none transition-colors font-mono"
            />

            {/* 错误提示 */}
            {importError && (
              <p className="mt-2 text-[11px] text-red-400">{importError}</p>
            )}

            {/* 操作按钮 */}
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => { setShowImport(false); setImportText(''); setImportError('') }}
                disabled={importing}
                className="rounded-lg px-3 py-1.5 text-xs text-text-secondary transition-all hover:bg-bg-hover disabled:opacity-50"
              >
                取消
              </button>
              <button
                onClick={() => void handleImportFromText()}
                disabled={importing || !importText.trim()}
                className="btn-liquid rounded-lg px-4 py-1.5 text-xs font-medium disabled:opacity-50"
              >
                {importing ? '导入中...' : '导入'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
