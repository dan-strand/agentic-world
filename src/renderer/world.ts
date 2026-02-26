import { Application, Container } from 'pixi.js';
import type { SessionInfo, ActivityType, SessionStatus } from '../shared/types';
import {
  BACKGROUND_COLOR,
  COMPOUND_INNER_RADIUS,
  COMPOUND_OUTER_RADIUS,
  COMPOUND_WIDTH,
  STATUS_DEBOUNCE_MS,
  GUILD_HALL_POS,
  QUEST_ZONE_POSITIONS,
  WORLD_WIDTH,
  WORLD_HEIGHT,
} from '../shared/constants';
import { Agent } from './agent';
import { AgentFactory } from './agent-factory';
import { HQ } from './hq';
import { Compound } from './compound';
import { calculateCompoundPositions } from './compound-layout';
import type { CompoundPosition } from './compound-layout';
import { SpeechBubble } from './speech-bubble';
import { buildWorldTilemap } from './tilemap-builder';

/** Compound lifecycle tracking for fade-in/fade-out. */
interface CompoundEntry {
  compound: Compound;
  position: CompoundPosition;
  /** Target alpha for fade transitions. 1 = visible, 0 = removing. */
  targetAlpha: number;
  /** Whether this compound is being removed (fading out). */
  removing: boolean;
}

/** Per-agent status debounce tracking to prevent jittery visual flickering. */
interface StatusDebounce {
  /** The raw status we're waiting to commit. */
  pendingStatus: SessionStatus;
  /** Milliseconds the pending status has been stable. */
  timer: number;
  /** The last committed (visual) status. */
  committedStatus: SessionStatus;
}

/**
 * World -- PixiJS Application composing tilemap ground, HQ, dynamic project compounds,
 * agents, vehicles, speech bubbles into a living fantasy RPG world.
 *
 * Scene hierarchy:
 *   app.stage
 *   +-- tilemapLayer (CompositeTilemap grass + dirt paths)
 *   +-- hq (HQ Container)
 *   +-- compoundsContainer (dynamic Compound children)
 *   +-- agentsContainer (dynamic Agent children)
 */
export class World {
  private app!: Application;

  // Scene containers (z-order: tilemap, HQ, compounds, agents)
  private tilemapLayer!: Container;
  private hq!: HQ;
  private compoundsContainer!: Container;
  private agentsContainer!: Container;

  // State tracking
  private agents: Map<string, Agent> = new Map();
  private compounds: Map<string, CompoundEntry> = new Map();
  private agentFactory: AgentFactory = new AgentFactory();

  // Speech bubbles managed per-agent
  private speechBubbles: Map<string, SpeechBubble> = new Map();
  // Track last known activity per agent for change detection
  private lastActivity: Map<string, ActivityType> = new Map();

  // Track which compound each agent is assigned to
  private agentCompoundAssignment: Map<string, string> = new Map();

  // Status debouncing (tracks raw -> committed status per agent)
  private statusDebounce: Map<string, StatusDebounce> = new Map();

  // Last committed status per agent (for active->idle completion detection)
  private lastCommittedStatus: Map<string, SessionStatus> = new Map();

  // Track last raw status received per agent (for tick-based debounce advancement)
  private lastRawStatus: Map<string, SessionStatus> = new Map();

  // Layout cache
  private lastProjectSet = '';
  private centerX = 0;
  private centerY = 0;

  async init(container: HTMLElement): Promise<void> {
    this.app = new Application();
    await this.app.init({
      width: WORLD_WIDTH,
      height: WORLD_HEIGHT,
      backgroundColor: BACKGROUND_COLOR,
      antialias: false,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      roundPixels: true,  // Prevents sub-pixel gaps between tiles
    });

    container.appendChild(this.app.canvas);

    // Tilemap ground layer (replaces backgroundContainer + roadsContainer)
    this.tilemapLayer = new Container();
    this.app.stage.addChild(this.tilemapLayer);

    const tilemap = buildWorldTilemap(
      GUILD_HALL_POS,
      Object.values(QUEST_ZONE_POSITIONS),
    );
    this.tilemapLayer.addChild(tilemap);

    this.hq = new HQ();
    this.app.stage.addChild(this.hq);

    this.compoundsContainer = new Container();
    this.app.stage.addChild(this.compoundsContainer);

    this.agentsContainer = new Container();
    this.app.stage.addChild(this.agentsContainer);

    // Position HQ at center
    this.centerX = WORLD_WIDTH / 2;
    this.centerY = WORLD_HEIGHT / 2;
    this.hq.position.set(this.centerX, this.centerY);
  }

  /**
   * Core logic -- called on every IPC session update.
   * Groups sessions by project, manages compound lifecycle,
   * creates/updates/transitions agents.
   */
  updateSessions(sessions: SessionInfo[]): void {
    // a. Group sessions by projectName
    const projectSessions = new Map<string, SessionInfo[]>();
    for (const s of sessions) {
      const list = projectSessions.get(s.projectName) ?? [];
      list.push(s);
      projectSessions.set(s.projectName, list);
    }

    // b. Manage compounds -- spawn/despawn based on active projects
    this.manageCompounds(projectSessions);

    // c. Manage agents -- create/update/transition
    this.manageAgents(sessions, projectSessions);
  }

  /**
   * Tick all agents and speech bubbles. Handle compound fade transitions.
   */
  tick(deltaMs: number): void {
    // Tick agents (state machine + animation) and advance status debouncing
    for (const agent of this.agents.values()) {
      agent.tick(deltaMs);

      // Capture previous committed status before debounce may update it
      const prevCommitted = this.lastCommittedStatus.get(agent.sessionId);

      // Advance status debounce and check for committed changes
      const newStatus = this.advanceStatusDebounce(agent.sessionId, deltaMs);
      if (newStatus !== null) {
        // Status just committed -- apply visuals
        agent.applyStatusVisuals(newStatus);

        // Check for completion (active -> idle)
        if (this.checkForCompletion(agent.sessionId, newStatus, prevCommitted)) {
          // Celebrate unless agent is already idle at HQ or already celebrating
          const agentState = agent.getState();
          if (agentState !== 'idle_at_hq' && agentState !== 'celebrating') {
            agent.startCelebration();
          }
        }
      }
    }

    // Tick speech bubbles
    for (const bubble of this.speechBubbles.values()) {
      bubble.tick(deltaMs);
    }

    // Handle compound fade-in/fade-out
    for (const [projectName, entry] of this.compounds) {
      if (entry.removing) {
        // Fade out over 2500ms (slow fade per user decision)
        entry.compound.alpha = Math.max(0, entry.compound.alpha - deltaMs / 2500);
        if (entry.compound.alpha <= 0) {
          this.compoundsContainer.removeChild(entry.compound);
          entry.compound.destroy();
          this.compounds.delete(projectName);
        }
      } else if (entry.compound.alpha < 1) {
        // Fade in over 500ms
        entry.compound.alpha = Math.min(1, entry.compound.alpha + deltaMs / 500);
      }
    }
  }

  getApp(): Application {
    return this.app;
  }

  resize(): void {
    // Window is now fixed 1024x768 -- resize is a no-op
    // Keep method signature for GameLoop/index.ts compatibility
  }

  destroy(): void {
    this.app.destroy(true);
  }

  // --- Private: Compound Management ---

  /**
   * Spawn/despawn compounds based on active projects.
   * A compound is created when a project has at least one non-idle session.
   * A compound is removed (faded out) when all sessions for the project are idle
   * or the project disappears.
   */
  private manageCompounds(projectSessions: Map<string, SessionInfo[]>): void {
    // Determine which projects need compounds (at least one non-idle session)
    const activeProjects = new Set<string>();
    for (const [projectName, sessions] of projectSessions) {
      const hasNonIdle = sessions.some(s => s.activityType !== 'idle');
      // Also check if any agent at this compound is still celebrating
      const hasCelebrating = sessions.some(s => {
        const agent = this.agents.get(s.sessionId);
        if (!agent) return false;
        const state = agent.getState();
        return state === 'celebrating' || state === 'walking_to_entrance';
      });
      if (hasNonIdle || hasCelebrating) {
        activeProjects.add(projectName);
      }
    }

    // Mark compounds for removal if project no longer active
    for (const [projectName, entry] of this.compounds) {
      if (!activeProjects.has(projectName) && !entry.removing) {
        entry.removing = true;
        entry.targetAlpha = 0;
      }
    }

    // Create new compounds for newly active projects
    let needsRepositioning = false;
    for (const projectName of activeProjects) {
      const existing = this.compounds.get(projectName);
      if (existing && existing.removing) {
        // Reactivate compound that was being removed
        existing.removing = false;
        existing.targetAlpha = 1;
      } else if (!existing) {
        // Create new compound
        const compound = new Compound(projectName);
        compound.alpha = 0; // Start invisible, fade in
        this.compoundsContainer.addChild(compound);
        this.compounds.set(projectName, {
          compound,
          position: { x: 0, y: 0, angle: 0 },
          targetAlpha: 1,
          removing: false,
        });
        needsRepositioning = true;
      }
    }

    // Check if active project set changed (for repositioning)
    const sortedProjects = [...activeProjects].sort().join(',');
    if (sortedProjects !== this.lastProjectSet) {
      needsRepositioning = true;
      this.lastProjectSet = sortedProjects;
    }

    if (needsRepositioning) {
      this.recalculateCompoundPositions();
    }
  }

  /**
   * Recalculate all compound positions using radial layout algorithm.
   * Smoothly transitions compounds to new positions.
   */
  private recalculateCompoundPositions(): void {
    // Get only non-removing compounds
    const activeEntries: [string, CompoundEntry][] = [];
    for (const [name, entry] of this.compounds) {
      if (!entry.removing) {
        activeEntries.push([name, entry]);
      }
    }

    if (activeEntries.length === 0) return;

    const positions = calculateCompoundPositions(
      activeEntries.length,
      this.centerX,
      this.centerY,
      COMPOUND_INNER_RADIUS,
      COMPOUND_OUTER_RADIUS,
    );

    for (let i = 0; i < activeEntries.length; i++) {
      const [, entry] = activeEntries[i];
      const pos = positions[i];
      entry.position = pos;

      // Position compound so its top-left is offset from the calculated center
      entry.compound.x = pos.x - COMPOUND_WIDTH / 2;
      entry.compound.y = pos.y - COMPOUND_WIDTH / 2;
    }
  }

  // --- Private: Agent Management ---

  /**
   * Create, update, and transition agents based on session data.
   */
  private manageAgents(
    sessions: SessionInfo[],
    projectSessions: Map<string, SessionInfo[]>,
  ): void {
    const currentIds = new Set<string>();

    for (const session of sessions) {
      currentIds.add(session.sessionId);
      let agent = this.agents.get(session.sessionId);

      if (!agent) {
        // Create new agent
        const slot = this.agentFactory.getSlot(session.sessionId);
        agent = new Agent(session.sessionId, slot);
        this.agents.set(session.sessionId, agent);
        this.agentsContainer.addChild(agent);

        // Create speech bubble for the agent
        const bubble = new SpeechBubble();
        this.speechBubbles.set(session.sessionId, bubble);
        agent.addChild(bubble);

        // Initialize debounce for new agent
        this.statusDebounce.set(session.sessionId, {
          pendingStatus: session.status,
          timer: 0,
          committedStatus: session.status,
        });
        this.lastCommittedStatus.set(session.sessionId, session.status);
        this.lastRawStatus.set(session.sessionId, session.status);

        // Apply initial visual status immediately (no debounce needed for first)
        agent.applyStatusVisuals(session.status);
      }

      // Store raw status for tick-based debounce advancement
      this.lastRawStatus.set(session.sessionId, session.status);

      // Determine the compound for this session's project
      const compoundEntry = this.compounds.get(session.projectName);
      const agentState = agent.getState();
      const prevAssignment = this.agentCompoundAssignment.get(session.sessionId);

      if (compoundEntry && !compoundEntry.removing) {
        // Project has an active compound
        if (agentState === 'idle_at_hq' && session.activityType !== 'idle') {
          // Agent is at HQ but session is active -- send to compound
          const entrance = this.getGlobalCompoundEntrance(compoundEntry);
          const subLoc = this.getGlobalSubLocation(compoundEntry, session.activityType);
          agent.assignToCompound(entrance, subLoc);
          this.agentCompoundAssignment.set(session.sessionId, session.projectName);
        } else if (
          agentState === 'working' &&
          prevAssignment === session.projectName
        ) {
          // Agent is working -- check for activity change
          const prevActivity = this.lastActivity.get(session.sessionId);
          if (prevActivity && prevActivity !== session.activityType && session.activityType !== 'idle') {
            const subLoc = this.getGlobalSubLocation(compoundEntry, session.activityType);
            agent.updateActivity(subLoc);
            // Show speech bubble on activity change
            const bubble = this.speechBubbles.get(session.sessionId);
            if (bubble) {
              bubble.show(session.activityType);
            }
          }
        }
      }

      // If compound was removed (all idle) and agent is at compound, send back to HQ
      if (
        !compoundEntry || compoundEntry.removing
      ) {
        if (
          agentState !== 'idle_at_hq' &&
          agentState !== 'driving_to_hq' &&
          agentState !== 'walking_to_entrance' &&
          agentState !== 'celebrating'
        ) {
          const idlePos = this.getGlobalHQIdlePosition(session.sessionId);
          agent.assignToHQ(idlePos);
          this.agentCompoundAssignment.delete(session.sessionId);
        }
      }

      // Track activity
      this.lastActivity.set(session.sessionId, session.activityType);
    }

    // Clean up debounce state for removed sessions
    for (const [sessionId] of this.statusDebounce) {
      if (!currentIds.has(sessionId)) {
        this.statusDebounce.delete(sessionId);
        this.lastCommittedStatus.delete(sessionId);
        this.lastRawStatus.delete(sessionId);
      }
    }

    // Reposition idle agents at HQ
    this.repositionIdleAgents();
  }

  /**
   * Reposition all idle agents in front of HQ.
   */
  private repositionIdleAgents(): void {
    const idleAgents: Agent[] = [];
    for (const agent of this.agents.values()) {
      if (agent.getState() === 'idle_at_hq') {
        idleAgents.push(agent);
      }
    }

    for (let i = 0; i < idleAgents.length; i++) {
      const localPos = this.hq.getIdlePosition(i, idleAgents.length);
      // Convert HQ-local position to global position
      const globalPos = {
        x: this.hq.x + localPos.x,
        y: this.hq.y + localPos.y,
      };
      idleAgents[i].setHQPosition(globalPos);
    }
  }

  // --- Private: Status Debouncing & Completion Detection ---

  /**
   * Debounce status changes -- only commit a visual status change if the
   * new status holds for STATUS_DEBOUNCE_MS. Prevents jittery flickering.
   * Called per-agent in tick() for smooth timing.
   */
  private advanceStatusDebounce(sessionId: string, deltaMs: number): SessionStatus | null {
    const debounce = this.statusDebounce.get(sessionId);
    if (!debounce) return null;

    const rawStatus = this.lastRawStatus.get(sessionId);
    if (!rawStatus) return debounce.committedStatus;

    if (rawStatus === debounce.committedStatus) {
      // Status unchanged from committed -- reset pending
      debounce.pendingStatus = rawStatus;
      debounce.timer = 0;
      return null; // no change
    }

    if (rawStatus === debounce.pendingStatus) {
      // Same pending status -- accumulate time
      debounce.timer += deltaMs;
      if (debounce.timer >= STATUS_DEBOUNCE_MS) {
        // Debounce threshold met -- commit the change
        debounce.committedStatus = rawStatus;
        debounce.timer = 0;
        this.lastCommittedStatus.set(sessionId, rawStatus);
        return rawStatus; // signal: new committed status
      }
    } else {
      // Different pending status -- reset debounce
      debounce.pendingStatus = rawStatus;
      debounce.timer = 0;
    }

    return null; // no change yet
  }

  /**
   * Detect task completion: session was active, now committed to idle.
   * Returns true only on the transition, not on sustained idle.
   *
   * @param prevCommitted - The committed status BEFORE advanceStatusDebounce updated it
   */
  private checkForCompletion(
    _sessionId: string,
    newCommittedStatus: SessionStatus,
    prevCommitted: SessionStatus | undefined,
  ): boolean {
    // Completion = was active, now idle
    return prevCommitted === 'active' && newCommittedStatus === 'idle';
  }

  // --- Private: Position Helpers ---

  /**
   * Get compound entrance position in global (world) coordinates.
   */
  private getGlobalCompoundEntrance(entry: CompoundEntry): { x: number; y: number } {
    const local = entry.compound.getEntrancePosition();
    return {
      x: entry.compound.x + local.x,
      y: entry.compound.y + local.y,
    };
  }

  /**
   * Get sub-location position in global (world) coordinates.
   */
  private getGlobalSubLocation(
    entry: CompoundEntry,
    activity: ActivityType,
  ): { x: number; y: number } {
    const local = entry.compound.getSubLocationPosition(activity);
    return {
      x: entry.compound.x + local.x,
      y: entry.compound.y + local.y,
    };
  }

  /**
   * Get a global idle position at HQ for a specific agent.
   * Used when sending an agent back to HQ.
   */
  private getGlobalHQIdlePosition(sessionId: string): { x: number; y: number } {
    // Count current idle agents + this one
    let idleCount = 1;
    let thisIndex = 0;
    for (const agent of this.agents.values()) {
      if (agent.sessionId === sessionId) continue;
      if (agent.getState() === 'idle_at_hq') {
        idleCount++;
        thisIndex++;
      }
    }
    const localPos = this.hq.getIdlePosition(thisIndex, idleCount);
    return {
      x: this.hq.x + localPos.x,
      y: this.hq.y + localPos.y,
    };
  }
}
