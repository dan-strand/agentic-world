import { Application, Container, Graphics } from 'pixi.js';
import type { SessionInfo, ActivityType } from '../shared/types';
import {
  BACKGROUND_COLOR,
  COMPOUND_INNER_RADIUS,
  COMPOUND_OUTER_RADIUS,
  COMPOUND_WIDTH,
} from '../shared/constants';
import { Agent } from './agent';
import { AgentFactory } from './agent-factory';
import { HQ } from './hq';
import { Compound } from './compound';
import { calculateCompoundPositions } from './compound-layout';
import type { CompoundPosition } from './compound-layout';
import { SpeechBubble } from './speech-bubble';

/** Compound lifecycle tracking for fade-in/fade-out. */
interface CompoundEntry {
  compound: Compound;
  position: CompoundPosition;
  /** Target alpha for fade transitions. 1 = visible, 0 = removing. */
  targetAlpha: number;
  /** Whether this compound is being removed (fading out). */
  removing: boolean;
}

/**
 * World -- PixiJS Application composing HQ, dynamic project compounds,
 * agents, vehicles, speech bubbles, and road spokes into a living spy world.
 *
 * Scene hierarchy:
 *   app.stage
 *   +-- backgroundContainer (ground fill)
 *   +-- roadsContainer (radial road spokes from HQ to compounds)
 *   +-- hq (HQ Container)
 *   +-- compoundsContainer (dynamic Compound children)
 *   +-- agentsContainer (dynamic Agent children)
 */
export class World {
  private app!: Application;

  // Scene containers (z-order: background, roads, HQ, compounds, agents)
  private backgroundContainer!: Container;
  private roadsContainer!: Container;
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

  // Layout cache
  private lastProjectSet = '';
  private centerX = 0;
  private centerY = 0;

  async init(container: HTMLElement): Promise<void> {
    this.app = new Application();
    await this.app.init({
      resizeTo: window,
      backgroundColor: BACKGROUND_COLOR,
      antialias: false,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    container.appendChild(this.app.canvas);

    // Create scene containers in z-order
    this.backgroundContainer = new Container();
    this.app.stage.addChild(this.backgroundContainer);

    this.roadsContainer = new Container();
    this.app.stage.addChild(this.roadsContainer);

    this.hq = new HQ();
    this.app.stage.addChild(this.hq);

    this.compoundsContainer = new Container();
    this.app.stage.addChild(this.compoundsContainer);

    this.agentsContainer = new Container();
    this.app.stage.addChild(this.agentsContainer);

    // Position HQ at center
    this.centerX = this.app.screen.width / 2;
    this.centerY = this.app.screen.height / 2;
    this.hq.position.set(this.centerX, this.centerY);

    // Draw ground
    this.drawGround();
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
    // Tick agents (state machine + animation)
    for (const agent of this.agents.values()) {
      agent.tick(deltaMs);
    }

    // Tick speech bubbles
    for (const bubble of this.speechBubbles.values()) {
      bubble.tick(deltaMs);
    }

    // Handle compound fade-in/fade-out
    for (const [projectName, entry] of this.compounds) {
      if (entry.removing) {
        // Fade out over 500ms
        entry.compound.alpha = Math.max(0, entry.compound.alpha - deltaMs / 500);
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
    this.centerX = this.app.screen.width / 2;
    this.centerY = this.app.screen.height / 2;

    // Recenter HQ
    this.hq.position.set(this.centerX, this.centerY);

    // Redraw ground
    this.drawGround();

    // Recalculate compound positions
    this.recalculateCompoundPositions();

    // Redraw roads
    this.drawRoads();

    // Update idle agent HQ positions
    this.repositionIdleAgents();
  }

  destroy(): void {
    this.app.destroy(true);
  }

  // --- Private: Ground & Roads ---

  private drawGround(): void {
    this.backgroundContainer.removeChildren();
    const w = this.app.screen.width;
    const h = this.app.screen.height;

    const bg = new Graphics();
    // Dark green-gray ground fill
    bg.rect(0, 0, w, h).fill(0x2a3a2a);
    this.backgroundContainer.addChild(bg);
  }

  /**
   * Draw radial road spokes from HQ center to each compound entrance.
   * Roads are 10px wide filled rects, drawn as angled lines.
   */
  private drawRoads(): void {
    this.roadsContainer.removeChildren();

    const roads = new Graphics();
    const pathColor = 0x4a4a3a;

    for (const entry of this.compounds.values()) {
      if (entry.removing) continue;

      // Road from HQ center to compound entrance (top-center of compound)
      const compX = entry.compound.x + COMPOUND_WIDTH / 2;
      const compY = entry.compound.y;

      const dx = compX - this.centerX;
      const dy = compY - this.centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1) continue;

      // Calculate perpendicular offset for road width
      const nx = -dy / dist; // normal x
      const ny = dx / dist;  // normal y
      const halfW = 5; // half road width

      // Draw road as a polygon (rectangle along the angle)
      roads.moveTo(this.centerX + nx * halfW, this.centerY + ny * halfW);
      roads.lineTo(compX + nx * halfW, compY + ny * halfW);
      roads.lineTo(compX - nx * halfW, compY - ny * halfW);
      roads.lineTo(this.centerX - nx * halfW, this.centerY - ny * halfW);
      roads.closePath();
      roads.fill(pathColor);
    }

    this.roadsContainer.addChild(roads);
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
      if (hasNonIdle) {
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
      this.drawRoads();
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
      }

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
          agentState !== 'walking_to_entrance'
        ) {
          const idlePos = this.getGlobalHQIdlePosition(session.sessionId);
          agent.assignToHQ(idlePos);
          this.agentCompoundAssignment.delete(session.sessionId);
        }
      }

      // Track activity
      this.lastActivity.set(session.sessionId, session.activityType);
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
