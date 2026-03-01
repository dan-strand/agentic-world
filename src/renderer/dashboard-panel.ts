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
    this.sessionList.innerHTML = '';

    if (sessions.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'No active sessions';
      this.sessionList.appendChild(empty);
      return;
    }

    // Sort by status priority (active first), then by lastModified descending
    const sorted = [...sessions].sort((a, b) => {
      const pa = STATUS_PRIORITY[a.status] ?? 99;
      const pb = STATUS_PRIORITY[b.status] ?? 99;
      if (pa !== pb) return pa - pb;
      return b.lastModified - a.lastModified;
    });

    for (const session of sorted) {
      const row = document.createElement('div');
      row.className = 'session-row';
      row.dataset.sessionId = session.sessionId;

      const isExpanded = this.expandedSessions.has(session.sessionId);

      // Summary row
      const summary = document.createElement('div');
      summary.className = 'session-summary';
      summary.innerHTML =
        `<span class="project-name">${this.escapeHtml(session.projectName)}</span>` +
        `<span class="status-badge ${session.status}">${session.status}</span>` +
        `<span class="model-badge">${this.escapeHtml(session.modelDisplayName)}</span>` +
        `<span class="tool-name">${this.escapeHtml(session.lastToolName || '--')}</span>` +
        `<span class="duration">${formatDuration(session.lastModified)}</span>` +
        `<span class="cost">${formatCost(session.totalCostUsd, session.isEstimate)}</span>`;

      // Detail panel
      const detail = document.createElement('div');
      detail.className = 'session-detail';
      detail.style.display = isExpanded ? 'block' : 'none';
      detail.innerHTML =
        `<div class="token-row"><span class="token-label">Input:</span> <span class="token-value">${session.inputTokens.toLocaleString()}</span></div>` +
        `<div class="token-row"><span class="token-label">Output:</span> <span class="token-value">${session.outputTokens.toLocaleString()}</span></div>` +
        `<div class="token-row"><span class="token-label">Cache write:</span> <span class="token-value">${session.cacheCreationTokens.toLocaleString()}</span></div>` +
        `<div class="token-row"><span class="token-label">Cache read:</span> <span class="token-value">${session.cacheReadTokens.toLocaleString()}</span></div>` +
        `<div class="token-row cost-row"><span class="token-label">Cost:</span> <span class="token-value">${formatCost(session.totalCostUsd, session.isEstimate)}</span></div>` +
        `<div class="token-row savings-row"><span class="token-label">Cache saved:</span> <span class="token-value">~$${session.cacheSavingsUsd.toFixed(2)}</span></div>` +
        `<div class="token-row"><span class="token-label">Turns:</span> <span class="token-value">${session.turnCount}</span></div>`;

      // Click to toggle expand
      summary.addEventListener('click', () => {
        if (this.expandedSessions.has(session.sessionId)) {
          this.expandedSessions.delete(session.sessionId);
          detail.style.display = 'none';
        } else {
          this.expandedSessions.add(session.sessionId);
          detail.style.display = 'block';
        }
      });

      row.appendChild(summary);
      row.appendChild(detail);
      this.sessionList.appendChild(row);
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
