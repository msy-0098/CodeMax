// ── Transcript — 会话区主组件 ─────────────────────────────────────────
// 参考 DeepSeek-Reasonix 的 Transcript.tsx
// 三层分区 (Hot/Warm/Cold) + TurnCollapse 过程折叠 + 滚动管理

import {
  createContext, memo, useCallback, useContext, useEffect, useLayoutEffect,
  useMemo, useRef, useState, type ReactNode,
} from 'react'
import { ChevronRight, Info, TriangleAlert, ArrowDown } from 'lucide-react'
import type { TranscriptItem, ToolItem, AssistantItem, NoticeItem, LiveStream } from '../../lib/transcriptTypes'
import {
  HOT_TURNS, WARM_PAGE_SIZE,
  buildTurnGroups, computeHotStartIdx, buildQuestions, questionTurnsById,
  lastQuestionTurn, questionAnchorId, compactQuestionText,
  warmPagination, createWarmLayerState, warmLayerWithNextColdPage, warmLayerWithExpandedTurn,
  scrollVersion, partitionTurnItems, turnWorkDurationMs,
  type TurnGroup, type QuestionAnchor, type WarmLayerState,
} from '../../lib/transcriptGrouping'
import { useScrollManager } from '../../lib/useScrollManager'
import { UserMessage } from './UserMessage'
import { LiveAssistantMessage, AssistantMessage, LiveStreamContext } from './AssistantMessage'
import { TurnActions } from './TurnActions'
import { QuestionJumpBar } from './QuestionJumpBar'
import { ToolCard, ToolGroup, ReadOnlyBatch } from './ToolCard'
import { toolGroupKind, isCreationGroupableTool, isReadOnlyTool } from '../../lib/transcriptTypes'
import type { ToolGroupKind } from '../../lib/transcriptTypes'

const QUESTION_NAV_MIN_COUNT = 2

// ── TurnCollapse — 过程折叠组件 ────────────────────────────────────────

interface TurnCollapseProps {
  items: TranscriptItem[]
  durationMs: number
  turnActive?: boolean
  turnStartAt?: number
  hasOutsideContent?: boolean
  live?: LiveStream
}

function TurnCollapse({ items, durationMs, turnActive = false, turnStartAt, hasOutsideContent = true, live }: TurnCollapseProps): React.ReactElement | null {
  const [open, setOpen] = useState(() => !hasOutsideContent)
  const userOverridden = useRef(false)
  const prevRunning = useRef(false)
  const bodyRef = useRef<HTMLDivElement>(null)

  // 过滤出实际要渲染的 items
  const displayItems = useMemo(() => {
    return items.filter((it) => {
      if (it.kind === 'assistant') {
        return Boolean(it.reasoning || (live?.id === it.id && live.reasoning))
      }
      if (it.kind === 'phase') return true
      if (it.kind === 'notice') return true
      if (it.kind !== 'tool') return false
      if (it.name === 'todo_write' || it.name === 'exit_plan_mode') return false
      return true
    })
  }, [items, live?.id, live?.reasoning])

  const hasRunningProcess = displayItems.some((it) => {
    if (it.kind === 'tool') return it.status === 'running'
    if (it.kind !== 'assistant') return false
    if (live?.id === it.id) return !live.reasoningComplete
    return it.streaming && !it.reasoningComplete
  })
  const hasLiveAssistant = displayItems.some((it) => it.kind === 'assistant' && live?.id === it.id)
  const hasRunningWork = turnActive || hasRunningProcess || hasLiveAssistant

  // 运行计时
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!hasRunningWork) return
    const id = window.setInterval(() => setTick((n) => n + 1), 1000)
    return () => window.clearInterval(id)
  }, [hasRunningWork])

  const now = Date.now()
  const runningDurationMs = hasRunningWork
    ? turnStartAt
      ? Math.max(0, now - turnStartAt)
      : live?.reasoningStartedAt
        ? Math.max(0, now - live.reasoningStartedAt)
        : 0
    : 0
  const effectiveDurationMs = hasRunningWork ? Math.max(durationMs, runningDurationMs) : durationMs

  // 运行中自动展开，完成后自动折叠
  useEffect(() => {
    const wasRunning = prevRunning.current
    prevRunning.current = hasRunningWork
    if (hasRunningWork) {
      if (!wasRunning) userOverridden.current = false
      if (!userOverridden.current) setOpen(true)
    } else if (wasRunning && !userOverridden.current && hasOutsideContent) {
      setOpen(false)
    }
  }, [hasRunningWork, hasOutsideContent])

  if (displayItems.length === 0) return null

  // 确定折叠类型
  const collapseKind = displayItems.some((it) => it.kind === 'tool')
    ? 'tool'
    : displayItems.some((it) => it.kind === 'assistant' && Boolean(it.reasoning))
      ? 'reasoning'
      : 'process'

  const seconds = Math.round(effectiveDurationMs / 1000)
  const toolCount = displayItems.reduce((n, it) => n + (it.kind === 'tool' ? 1 : 0), 0)
  const thoughtCount = displayItems.reduce((n, it) => n + (it.kind === 'assistant' ? 1 : 0), 0)

  const countParts: string[] = []
  if (toolCount > 0) countParts.push(`${toolCount} 次工具`)
  if (thoughtCount > 0) countParts.push(`${thoughtCount} 次思考`)

  const baseLabel = hasRunningWork
    ? seconds > 0
      ? `工作中 · ${seconds}s`
      : '工作中'
    : seconds > 0
      ? `已处理 · ${seconds}s`
      : '已处理'

  const label = countParts.length > 0
    ? `${baseLabel} · ${countParts.join(' · ')}`
    : baseLabel

  // 构建 body
  const body: ReactNode[] = []
  const roBatch: ToolItem[] = []
  const toolBatch: ToolItem[] = []
  let toolBatchKind: ToolGroupKind | null = null

  const flushRO = () => {
    if (roBatch.length === 0) return
    body.push(<ReadOnlyBatch key={`rob-${roBatch[0].id}`} items={[...roBatch]} />)
    roBatch.length = 0
  }
  const flushToolBatch = () => {
    if (!toolBatchKind || toolBatch.length === 0) return
    body.push(<ToolGroup key={`tg-${toolBatch[0].id}`} kind={toolBatchKind} items={[...toolBatch]} />)
    toolBatch.length = 0
    toolBatchKind = null
  }

  for (const it of displayItems) {
    if (it.kind === 'tool' && isCreationGroupableTool(it as ToolItem)) {
      const kind = toolGroupKind(it as ToolItem)
      if (kind) {
        if (toolBatchKind && toolBatchKind !== kind) flushToolBatch()
        toolBatchKind = kind
        toolBatch.push(it as ToolItem)
        continue
      }
    }
    if (it.kind !== 'tool') {
      flushToolBatch()
      flushRO()
    }
    if (it.kind === 'tool' && it.status !== 'running' && isReadOnlyTool(it.name)) {
      roBatch.push(it as ToolItem)
      continue
    }
    if (it.kind === 'tool') {
      flushToolBatch()
      flushRO()
    }
    switch (it.kind) {
      case 'tool':
        if (it.name === 'todo_write' || it.name === 'exit_plan_mode') break
        body.push(<ToolCard key={it.id} item={it} />)
        break
      case 'phase': body.push(<PhaseCard key={it.id} text={it.text} />); break
      case 'notice': body.push(<NoticeCard key={it.id} item={it} />); break
      case 'assistant':
        body.push(<InlineReasoning key={`${it.id}-r`} item={it as AssistantItem} live={live} />)
        break
    }
  }
  flushToolBatch()
  flushRO()

  return (
    <div className={`turn-collapse${open ? ' turn-collapse--open' : ''}`} data-kind={collapseKind}>
      <button
        type="button"
        className="turn-collapse__head reasoning__head"
        onClick={() => { userOverridden.current = true; setOpen((v) => !v) }}
        aria-expanded={open}
      >
        <span className="turn-collapse__label">{label}</span>
        {!hasRunningWork && (
          <ChevronRight size={12} className={`reasoning__chevron${open ? ' reasoning__chevron--open' : ''}`} />
        )}
      </button>
      <div ref={bodyRef} className="turn-collapse__body">{body}</div>
    </div>
  )
}

// ── InlineReasoning — 内联推理 ────────────────────────────────────────

function InlineReasoning({ item, live }: { item: AssistantItem; live?: LiveStream }): React.ReactElement | null {
  const [open, setOpen] = useState(true)
  const reasoning = (live && live.id === item.id ? live.reasoning : item.reasoning)?.trim()
  if (!reasoning) return null
  const running = live?.id === item.id && !live.reasoningComplete

  return (
    <div className={`turn-collapse__inline-reasoning${open ? ' turn-collapse__inline-reasoning--open' : ''}`}>
      <button
        type="button"
        className="turn-collapse__reasoning-head reasoning__head"
        data-running={running ? '' : undefined}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <ChevronRight size={12} className={`reasoning__chevron${open ? ' reasoning__chevron--open' : ''}`} />
        <span>{running ? '思考中' : '思考过程'}</span>
      </button>
      {open && <div className="turn-collapse__inline-body">{reasoning}</div>}
    </div>
  )
}

// ── PhaseCard / NoticeCard ────────────────────────────────────────────

function PhaseCard({ text }: { text: string }): React.ReactElement {
  return <div className="phase"><span>{text}</span></div>
}

function NoticeCard({ item }: { item: NoticeItem }): React.ReactElement {
  const Icon = item.level === 'warn' ? TriangleAlert : Info
  return (
    <div className={`notice-line notice-line--${item.level}`}>
      <Icon size={14} className="notice-line__icon" />
      <div className="notice-line__text">
        {item.title && <div className="notice-line__title">{item.title}</div>}
        <div className="notice-line__body">{item.text}</div>
        {item.detail && (
          <details className="notice-line__details">
            <summary>详情</summary>
            <div>{item.detail}</div>
          </details>
        )}
      </div>
    </div>
  )
}

// ── WarmZone — 温区/冷区 ──────────────────────────────────────────────

interface WarmZoneProps {
  turnGroups: TurnGroup[]
  expandedWarmTurns: ReadonlySet<number>
  warmStartTurn: number
  warmEndTurn: number
  coldTurnCount: number
  items: readonly TranscriptItem[]
  onToggleColdPage: () => void
  onToggleWarmTurn: (g: number, expand: boolean) => void
}

const WarmZone = memo(function WarmZone({
  turnGroups, expandedWarmTurns, warmStartTurn, warmEndTurn, coldTurnCount,
  items, onToggleColdPage, onToggleWarmTurn,
}: WarmZoneProps): React.ReactNode {
  const out: React.ReactNode[] = []

  // 冷区按钮
  if (coldTurnCount > 0) {
    out.push(
      <button key="cold-load-more" type="button" className="warm-collapse" onClick={onToggleColdPage}>
        显示更早的 {coldTurnCount} 轮对话
      </button>
    )
  }

  // 温区卡片
  if (turnGroups.length > HOT_TURNS) {
    for (let g = warmStartTurn; g < warmEndTurn; g++) {
      const group = turnGroups[g]
      if (!group) continue
      const expanded = expandedWarmTurns.has(g)
      const userText = group.userItem.text

      out.push(
        <WarmTurnCard
          key={`warm-${g}`}
          userText={compactQuestionText(userText)}
          assistantPreview={group.assistantPreview}
          toolCount={group.toolCount}
          expanded={expanded}
          onToggle={() => onToggleWarmTurn(g, !expanded)}
        >
          {expanded && <WarmTurnItems group={group} items={items} />}
        </WarmTurnCard>
      )
    }
  }

  return <>{out}</>
})

function WarmTurnCard({
  userText, assistantPreview, toolCount, expanded, onToggle, children,
}: {
  userText: string
  assistantPreview: string
  toolCount: number
  expanded: boolean
  onToggle: () => void
  children?: React.ReactNode
}): React.ReactElement {
  return (
    <div className={`warm-turn${expanded ? ' warm-turn--expanded' : ''}`}>
      <button type="button" className="warm-turn__head" onClick={onToggle} aria-expanded={expanded}>
        <span className="warm-turn__chevron">
          <ChevronRight size={13} className={expanded ? 'warm-turn__chevron--open' : ''} />
        </span>
        <span className="warm-turn__preview">{userText}</span>
        <span className="warm-turn__meta">
          {toolCount > 0 && <span>{toolCount} 次工具</span>}
        </span>
      </button>
      {expanded && <div className="warm-turn__content">{children}</div>}
      {!expanded && assistantPreview && (
        <div className="warm-turn__assistant">{assistantPreview}</div>
      )}
    </div>
  )
}

function WarmTurnItems({ group, items }: { group: TurnGroup; items: readonly TranscriptItem[] }): React.ReactNode {
  const turnItems = items.slice(group.startIdx + 1, Math.min(group.endIdx, items.length))
  const segments = partitionTurnItems(turnItems)
  const nodes: React.ReactNode[] = []

  // 用户消息
  nodes.push(
    <UserMessage
      key={group.userItem.id}
      item={group.userItem}
      anchorId={questionAnchorId(group.userItem.id)}
    />
  )

  // 分段渲染
  segments.forEach((segment) => {
    if (segment.processItems.length > 0) {
      nodes.push(
        <TurnCollapse
          key={`warm-process-${segment.processItems[0].id}`}
          items={segment.processItems}
          durationMs={0}
          hasOutsideContent={segment.outsideItems.length > 0}
        />
      )
    }
    for (const item of segment.outsideItems) {
      if (item.kind === 'notice') {
        nodes.push(<NoticeCard key={item.id} item={item} />)
      } else {
        nodes.push(
          <AssistantMessage
            key={item.id}
            item={{ ...item, reasoning: '', reasoningComplete: true }}
          />
        )
      }
    }
  })

  return <>{nodes}</>
}

// ── 主 Transcript 组件 ────────────────────────────────────────────────

interface TranscriptProps {
  items: TranscriptItem[]
  live?: LiveStream
  running?: boolean
  turnStartAt?: number
  onPrompt?: (text: string) => void
  onEditMessage?: (turn: number, text: string) => boolean | void | Promise<boolean | void>
  onRegenerate?: () => void
  canRegenerate?: boolean
  hydrating?: boolean
}

export function Transcript({
  items,
  live,
  running = false,
  turnStartAt,
  onEditMessage,
  onRegenerate,
  canRegenerate = false,
  hydrating = false,
}: TranscriptProps): React.ReactElement {
  const {
    scrollRef, stick, onScroll, onWheelIntent,
    onTouchStartIntent, onTouchMoveIntent, onKeyScrollIntent,
    isAtBottom, smoothScrollTo, scrollToBottomAfterLayout,
    trackQuestions, scheduleRepinIfWasPinned,
  } = useScrollManager()

  const autoScrollFrame = useRef<number | null>(null)

  const cancelStreamingAutoScroll = useCallback(() => {
    if (autoScrollFrame.current !== null) {
      cancelAnimationFrame(autoScrollFrame.current)
      autoScrollFrame.current = null
    }
  }, [])

  const handleWheelIntent = useCallback((event: React.WheelEvent<HTMLElement>) => {
    if (onWheelIntent(event)) cancelStreamingAutoScroll()
  }, [cancelStreamingAutoScroll, onWheelIntent])

  const handleTouchMoveIntent = useCallback((event: React.TouchEvent<HTMLElement>) => {
    if (onTouchMoveIntent(event)) cancelStreamingAutoScroll()
  }, [cancelStreamingAutoScroll, onTouchMoveIntent])

  const handleKeyScrollIntent = useCallback((event: React.KeyboardEvent<HTMLElement>) => {
    if (onKeyScrollIntent(event)) cancelStreamingAutoScroll()
  }, [cancelStreamingAutoScroll, onKeyScrollIntent])

  // 构建 questions
  const questions = useMemo<QuestionAnchor[]>(() => buildQuestions(items), [items])
  const showQuestionNav = questions.length >= QUESTION_NAV_MIN_COUNT

  useEffect(() => { trackQuestions(questions.length) }, [questions.length, trackQuestions])

  // 自动滚动 — 流式 token 合并
  const contentVersion = useMemo(() => scrollVersion(items), [items])
  useEffect(() => {
    if (items.length === 0) return
    if (!stick.current) return
    if (autoScrollFrame.current !== null) return
    autoScrollFrame.current = requestAnimationFrame(() => {
      autoScrollFrame.current = null
      if (!stick.current) return
      const el = scrollRef.current
      if (el) el.scrollTop = el.scrollHeight
    })
  }, [contentVersion, live?.text?.length ?? 0, live?.reasoning?.length ?? 0, items.length, stick, scrollRef])

  useEffect(() => {
    return () => {
      if (autoScrollFrame.current !== null) {
        cancelAnimationFrame(autoScrollFrame.current)
        autoScrollFrame.current = null
      }
    }
  }, [])

  // ResizeObserver
  useEffect(() => {
    const el = scrollRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      if (items.length === 0) return
      scheduleRepinIfWasPinned(0)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [items.length, scheduleRepinIfWasPinned])

  // 轮次分组
  const turnGroups = useMemo(() => buildTurnGroups(items), [items])
  const hotStartIdx = useMemo(() => computeHotStartIdx(items, HOT_TURNS), [items])

  // 温层状态
  const sessionKey = useMemo(() => `${items[0]?.id ?? ''}|${items[items.length - 1]?.id ?? ''}`, [items])
  const [warmLayerState, setWarmLayerState] = useState<WarmLayerState>(() => createWarmLayerState(sessionKey))
  const activeWarmLayer = warmLayerState.sessionKey === sessionKey
    ? warmLayerState
    : createWarmLayerState(sessionKey)
  const { expandedWarmTurns, coldPage } = activeWarmLayer

  const { warmStartTurn, warmEndTurn, coldTurnCount } = useMemo(
    () => warmPagination({ turnCount: turnGroups.length, hotTurns: HOT_TURNS, pageSize: WARM_PAGE_SIZE, coldPage }),
    [coldPage, turnGroups.length],
  )

  const userTurn = useMemo(() => questionTurnsById(questions), [questions])
  const lastTurn = useMemo(() => lastQuestionTurn(questions), [questions])

  // 跳转到问题
  const pendingQuestionJump = useRef<QuestionAnchor | null>(null)
  const handleJumpToQuestion = useCallback((question: QuestionAnchor) => {
    pendingQuestionJump.current = question
    const warmTurnStart = turnGroups.length - HOT_TURNS
    if (question.turn < warmTurnStart) {
      setWarmLayerState((prev) =>
        warmLayerWithExpandedTurn(
          warmLayerWithNextColdPage(prev, sessionKey),
          sessionKey,
          question.turn,
          true,
        ),
      )
    }
    const node = document.getElementById(questionAnchorId(question.id))
    if (node) {
      stick.current = false
      smoothScrollTo(node, 12)
    }
  }, [turnGroups.length, sessionKey, smoothScrollTo, stick])

  const empty = items.length === 0

  // live 标志
  const liveId = live?.id
  const liveHasAnswerText = Boolean(live?.text.trim())
  const liveHasReasoning = Boolean(live?.reasoning)

  // ── 热区渲染 ─────────────────────────────────────────────────────
  const hotZoneNodes = useMemo<ReactNode[]>(() => {
    const out: ReactNode[] = []

    const pushTurnActions = (turn: number | undefined, turnItems: readonly TranscriptItem[]) => {
      if (turn == null) return
      let actionText = ''
      for (const item of turnItems) {
        if (item.kind !== 'assistant' || item.streaming || !item.text.trim()) continue
        actionText += item.text
      }
      if (!actionText.trim()) return
      const isLastTurn = turn === lastTurn
      out.push(
        <TurnActions
          key={`ta-${turn}`}
          text={actionText}
          canRegenerate={canRegenerate && isLastTurn && !running}
          onRegenerate={onRegenerate}
        />
      )
    }

    const pushTurnBody = (key: string, turnItems: readonly TranscriptItem[], turnIsActive: boolean) => {
      const segments = partitionTurnItems(turnItems, liveId, liveHasAnswerText, liveHasReasoning)
      const turnHasOutsideContent = segments.some((s) => s.outsideItems.length > 0)
      segments.forEach((segment, segmentIndex) => {
        const isLastSegment = segmentIndex === segments.length - 1
        if (segment.processItems.length > 0) {
          out.push(
            <TurnCollapse
              key={`turn-process-${key}-${segment.processItems[0].id}`}
              items={segment.processItems}
              durationMs={isLastSegment ? turnWorkDurationMs(turnItems) : 0}
              turnActive={turnIsActive && isLastSegment}
              turnStartAt={turnIsActive && isLastSegment ? turnStartAt : undefined}
              hasOutsideContent={turnHasOutsideContent}
              live={live}
            />
          )
        }
        for (const item of segment.outsideItems) {
          if (item.kind === 'notice') {
            out.push(<NoticeCard key={item.id} item={item} />)
          } else {
            out.push(
              <LiveAssistantMessage
                key={item.id}
                item={{ ...item, reasoning: '', reasoningComplete: true }}
                defaultExpanded={false}
                expandWhileStreaming={false}
                truncateStreamingReasoning={true}
              />
            )
          }
        }
      })
    }

    const hotGroups = turnGroups.filter((g) => g.startIdx >= hotStartIdx)
    const firstHotStart = hotGroups[0]?.startIdx ?? items.length
    if (hotStartIdx < firstHotStart) {
      pushTurnBody('prelude', items.slice(hotStartIdx, firstHotStart), false)
    }

    for (let index = 0; index < hotGroups.length; index++) {
      const group = hotGroups[index]
      const user = group.userItem
      if (user.kind !== 'user') continue
      const turn = userTurn.get(user.id)
      const turnItems = items.slice(group.startIdx + 1, group.endIdx)
      const turnIsActive = running && index === hotGroups.length - 1
      out.push(
        <UserMessage
          key={user.id}
          item={user}
          anchorId={questionAnchorId(user.id)}
          turn={turn}
          onEdit={onEditMessage}
        />
      )
      pushTurnBody(user.id, turnItems, turnIsActive)
      if (!turnIsActive) pushTurnActions(turn, turnItems)
    }

    return out
  }, [hotStartIdx, items, turnGroups, userTurn, running, turnStartAt, live, liveId, liveHasAnswerText, liveHasReasoning, onEditMessage, onRegenerate, canRegenerate, lastTurn])

  // 空状态滚动重置
  useLayoutEffect(() => {
    if (!empty) return
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = 0
    stick.current = false
  }, [empty, scrollRef, stick])

  return (
    <LiveStreamContext.Provider value={live}>
      <div className="transcript-shell">
        <div
          className={`transcript${empty ? ' transcript--empty' : ''}`}
          ref={scrollRef}
          onScroll={onScroll}
          onWheelCapture={handleWheelIntent}
          onTouchStartCapture={onTouchStartIntent}
          onTouchMoveCapture={handleTouchMoveIntent}
          onKeyDownCapture={handleKeyScrollIntent}
        >
          {turnGroups.length > HOT_TURNS && (
            <WarmZone
              turnGroups={turnGroups}
              expandedWarmTurns={expandedWarmTurns}
              warmStartTurn={warmStartTurn}
              warmEndTurn={warmEndTurn}
              coldTurnCount={coldTurnCount}
              items={items}
              onToggleColdPage={() => setWarmLayerState((prev) => warmLayerWithNextColdPage(prev, sessionKey))}
              onToggleWarmTurn={(g, expand) => setWarmLayerState((prev) => warmLayerWithExpandedTurn(prev, sessionKey, g, expand))}
            />
          )}
          {hotZoneNodes}
        </div>

        {!empty && showQuestionNav && (
          <QuestionJumpBar questions={questions} onJump={handleJumpToQuestion} />
        )}

        {!empty && !isAtBottom && (
          <button
            type="button"
            className="transcript__jump-bottom"
            onClick={() => scrollToBottomAfterLayout(2)}
            aria-label="回到底部"
            title="回到底部"
          >
            <ArrowDown size={18} strokeWidth={2.2} aria-hidden="true" />
          </button>
        )}
      </div>
    </LiveStreamContext.Provider>
  )
}
