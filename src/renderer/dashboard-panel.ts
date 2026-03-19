import { DashboardData, DashboardSession, TodayTotals, DailyAggregate } from '../shared/types';

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return Math.round(n / 1_000) + 'K';
  return n.toLocaleString();
}

function formatCost(usd: number, isEstimate: boolean): string {
  if (isEstimate) return `~$${usd.toFixed(2)} est.`;
  return `~$${usd.toFixed(2)}`;
}

function formatDuration(lastModified: number): string {
  const mins = Math.floor((Date.now() - lastModified) / 60_000);
  if (mins < 1) return '<1m';
  if (mins >= 60) return Math.floor(mins / 60) + 'h ' + (mins % 60) + 'm';
  return mins + 'm';
}

const STATUS_PRIORITY: Record<string, number> = {
  active: 0,
  waiting: 1,
  idle: 2,
  error: 3,
};

export class DashboardPanel {
  private container: HTMLElement;
  private totalsBar: HTMLElement;
  private historyBar: HTMLElement;
  private sessionList: HTMLElement;
  private expandedSessions: Set<string> = new Set();

  constructor(container: HTMLElement) {
    this.container = container;
    this.container.innerHTML = '';

    this.totalsBar = document.createElement('div');
    this.totalsBar.className = 'dashboard-totals';
    this.container.appendChild(this.totalsBar);

    this.historyBar = document.createElement('div');
    this.historyBar.className = 'history-summary';
    this.historyBar.style.display = 'none'; // Hidden until history data arrives
    this.container.appendChild(this.historyBar);

    this.sessionList = document.createElement('div');
    this.sessionList.className = 'session-list';
    this.container.appendChild(this.sessionList);

    // Event delegation: single click handler on session list container
    this.sessionList.addEventListener('click', (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const summary = target.closest('.session-summary') as HTMLElement | null;
      if (!summary) return;
      const row = summary.parentElement;
      if (!row) return;
      const sessionId = row.dataset.sessionId;
      if (!sessionId) return;
      const detail = row.querySelector('.session-detail') as HTMLElement | null;
      if (!detail) return;

      if (this.expandedSessions.has(sessionId)) {
        this.expandedSessions.delete(sessionId);
        detail.style.display = 'none';
      } else {
        this.expandedSessions.add(sessionId);
        detail.style.display = 'block';
      }
    });
  }

  update(data: DashboardData): void {
    this.renderTotals(data.todayTotals);
    this.renderSessions(data.sessions);
  }

  updateHistory(history: DailyAggregate[]): void {
    if (!history || history.length === 0) {
      this.historyBar.style.display = 'none';
      return;
    }

    const totalTokens = history.reduce((sum, d) =>
      sum + d.inputTokens + d.outputTokens + d.cacheCreationTokens + d.cacheReadTokens, 0);
    const totalCost = history.reduce((sum, d) => sum + d.totalCostUsd, 0);
    const totalSavings = history.reduce((sum, d) => sum + d.cacheSavingsUsd, 0);
    const totalSessions = history.reduce((sum, d) => sum + d.sessionCount, 0);
    const dayCount = history.length;

    this.historyBar.style.display = 'flex';
    this.historyBar.innerHTML =
      `<span class="history-label">30-Day:</span>` +
      `<span class="stat"><span class="stat-label">Tokens:</span> ${formatTokens(totalTokens)}</span>` +
      `<span class="stat"><span class="stat-label">Cost:</span> ~$${totalCost.toFixed(2)}</span>` +
      `<span class="stat"><span class="stat-label">Saved:</span> ~$${totalSavings.toFixed(2)}</span>` +
      `<span class="stat"><span class="stat-label">Sessions:</span> ${totalSessions}</span>` +
      `<span class="stat"><span class="stat-label">Days:</span> ${dayCount}</span>`;
  }

  private renderTotals(totals: TodayTotals): void {
    this.totalsBar.innerHTML =
      `<span class="stat"><span class="stat-label">In:</span> ${formatTokens(totals.inputTokens)}</span>` +
      `<span class="stat"><span class="stat-label">Out:</span> ${formatTokens(totals.outputTokens)}</span>` +
      `<span class="stat"><span class="stat-label">Cost:</span> ~$${totals.totalCostUsd.toFixed(2)}</span>` +
      `<span class="stat"><span class="stat-label">Saved:</span> ~$${totals.cacheSavingsUsd.toFixed(2)}</span>` +
      `<span class="stat"><span class="stat-label">Sessions:</span> ${totals.sessionCount}</span>`;
  }

  private renderSessions(sessions: DashboardSession[]): void {
    if (sessions.length === 0) {
      // Show empty state (only if not already showing it)
      if (!this.sessionList.querySelector('.empty-state')) {
        this.sessionList.innerHTML = '';
        const empty = document.createElement('div');
        empty.className = 'empty-state';
        empty.textContent = 'No active sessions';
        this.sessionList.appendChild(empty);
      }
      return;
    }

    // Remove empty state if present
    const emptyState = this.sessionList.querySelector('.empty-state');
    if (emptyState) emptyState.remove();

    // Sort by status priority (active first), then by lastModified descending
    const sorted = [...sessions].sort((a, b) => {
      const pa = STATUS_PRIORITY[a.status] ?? 99;
      const pb = STATUS_PRIORITY[b.status] ?? 99;
      if (pa !== pb) return pa - pb;
      return b.lastModified - a.lastModified;
    });

    // Build a map of existing rows by sessionId
    const existingRows = new Map<string, HTMLElement>();
    for (const child of Array.from(this.sessionList.children)) {
      const el = child as HTMLElement;
      const id = el.dataset.sessionId;
      if (id) existingRows.set(id, el);
    }

    // Track which sessions are still present
    const currentIds = new Set<string>();

    // Update or create rows in sorted order
    for (let i = 0; i < sorted.length; i++) {
      const session = sorted[i];
      currentIds.add(session.sessionId);

      let row = existingRows.get(session.sessionId);
      if (row) {
        // UPDATE existing row in place (text content only, no element recreation)
        this.updateSessionRow(row, session);
      } else {
        // CREATE new row
        row = this.createSessionRow(session);
      }

      // Ensure correct DOM order: row should be at index i
      const currentChild = this.sessionList.children[i];
      if (currentChild !== row) {
        this.sessionList.insertBefore(row, currentChild || null);
      }
    }

    // REMOVE rows for sessions that no longer exist
    for (const [id, row] of existingRows) {
      if (!currentIds.has(id)) {
        row.remove();
        this.expandedSessions.delete(id);
      }
    }
  }

  private createSessionRow(session: DashboardSession): HTMLElement {
    const row = document.createElement('div');
    row.className = 'session-row';
    row.dataset.sessionId = session.sessionId;

    const isExpanded = this.expandedSessions.has(session.sessionId);

    const summary = document.createElement('div');
    summary.className = 'session-summary';
    // Use spans with data attributes for targeted updates
    summary.innerHTML =
      `<span class="project-name">${this.escapeHtml(session.projectName)}</span>` +
      `<span class="status-badge ${session.status}">${session.status}</span>` +
      `<span class="model-badge">${this.escapeHtml(session.modelDisplayName)}</span>` +
      `<span class="tool-name">${this.escapeHtml(session.lastToolName || '--')}</span>` +
      `<span class="duration">${formatDuration(session.lastModified)}</span>` +
      `<span class="cost">${formatCost(session.totalCostUsd, session.isEstimate)}</span>`;

    const detail = document.createElement('div');
    detail.className = 'session-detail';
    detail.style.display = isExpanded ? 'block' : 'none';
    this.updateDetailContent(detail, session);

    // No per-row click handler -- event delegation on sessionList handles it
    row.appendChild(summary);
    row.appendChild(detail);
    return row;
  }

  private updateSessionRow(row: HTMLElement, session: DashboardSession): void {
    const summary = row.querySelector('.session-summary');
    if (!summary) return;

    // Update text content of each span (no innerHTML replacement, preserves DOM)
    const projectName = summary.querySelector('.project-name');
    if (projectName) projectName.textContent = session.projectName;

    const statusBadge = summary.querySelector('.status-badge');
    if (statusBadge) {
      statusBadge.textContent = session.status;
      statusBadge.className = `status-badge ${session.status}`;
    }

    const modelBadge = summary.querySelector('.model-badge');
    if (modelBadge) modelBadge.textContent = session.modelDisplayName;

    const toolName = summary.querySelector('.tool-name');
    if (toolName) toolName.textContent = session.lastToolName || '--';

    const duration = summary.querySelector('.duration');
    if (duration) duration.textContent = formatDuration(session.lastModified);

    const cost = summary.querySelector('.cost');
    if (cost) cost.textContent = formatCost(session.totalCostUsd, session.isEstimate);

    // Update detail panel content (preserves expand/collapse state)
    const detail = row.querySelector('.session-detail') as HTMLElement | null;
    if (detail) {
      this.updateDetailContent(detail, session);
      // Preserve expand state -- do NOT touch detail.style.display
    }
  }

  private updateDetailContent(detail: HTMLElement, session: DashboardSession): void {
    detail.innerHTML =
      `<div class="token-row"><span class="token-label">Input:</span> <span class="token-value">${session.inputTokens.toLocaleString()}</span></div>` +
      `<div class="token-row"><span class="token-label">Output:</span> <span class="token-value">${session.outputTokens.toLocaleString()}</span></div>` +
      `<div class="token-row"><span class="token-label">Cache write:</span> <span class="token-value">${session.cacheCreationTokens.toLocaleString()}</span></div>` +
      `<div class="token-row"><span class="token-label">Cache read:</span> <span class="token-value">${session.cacheReadTokens.toLocaleString()}</span></div>` +
      `<div class="token-row cost-row"><span class="token-label">Cost:</span> <span class="token-value">${formatCost(session.totalCostUsd, session.isEstimate)}</span></div>` +
      `<div class="token-row savings-row"><span class="token-label">Cache saved:</span> <span class="token-value">~$${session.cacheSavingsUsd.toFixed(2)}</span></div>` +
      `<div class="token-row"><span class="token-label">Turns:</span> <span class="token-value">${session.turnCount}</span></div>`;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
