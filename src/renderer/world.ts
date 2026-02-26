import { Application, Container, ColorMatrixFilter } from 'pixi.js';
import type { SessionInfo, ActivityType, SessionStatus } from '../shared/types';
import {
  BACKGROUND_COLOR,
  STATUS_DEBOUNCE_MS,
  GUILD_HALL_POS,
  QUEST_ZONE_POSITIONS,
  WORLD_WIDTH,
  WORLD_HEIGHT,
  ACTIVITY_BUILDING,
} from '../shared/constants';
import type { BuildingType } from '../shared/constants';
import { Agent } from './agent';
import { AgentFactory } from './agent-factory';
import { Building } from './building';
import { buildingTextures } from './asset-loader';
import { SpeechBubble } from './speech-bubble';
import { buildWorldTilemap } from './tilemap-builder';
import { AmbientParticles } from './ambient-particles';

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
 * World -- PixiJS Application composing tilemap ground, static buildings,
 * agents, vehicles, speech bubbles into a living fantasy RPG world.
 *
 * Scene hierarchy:
 *   app.stage [warm ColorMatrixFilter]
 *   +-- tilemapLayer (canvas-rendered grass + dirt paths)
 *   +-- buildingsContainer (Guild Hall + 4 quest zone buildings)
 *   +-- ambientParticles (floating firefly particles)
 *   +-- agentsContainer (dynamic Agent children)
 */
export class World {
  private app!: Application;

  // Scene containers (z-order: tilemap, buildings, ambient particles, agents)
  private tilemapLayer!: Container;
  private guildHall!: Building;
  private buildingsContainer!: Container;
  private ambientParticles!: AmbientParticles;
  private agentsContainer!: Container;

  // State tracking
  private agents: Map<string, Agent> = new Map();
  private questZones: Map<ActivityType, Building> = new Map();
  private agentFactory: AgentFactory = new AgentFactory();

  // Speech bubbles managed per-agent
  private speechBubbles: Map<string, SpeechBubble> = new Map();
  // Track last known activity per agent for change detection
  private lastActivity: Map<string, ActivityType> = new Map();

  // Status debouncing (tracks raw -> committed status per agent)
  private statusDebounce: Map<string, StatusDebounce> = new Map();

  // Last committed status per agent (for active->idle completion detection)
  private lastCommittedStatus: Map<string, SessionStatus> = new Map();

  // Track last raw status received per agent (for tick-based debounce advancement)
  private lastRawStatus: Map<string, SessionStatus> = new Map();

  // Layout
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

    // Tilemap ground layer
    this.tilemapLayer = new Container();
    this.tilemapLayer.eventMode = 'none';
    this.tilemapLayer.interactiveChildren = false;
    this.app.stage.addChild(this.tilemapLayer);

    const tilemap = buildWorldTilemap(
      GUILD_HALL_POS,
      Object.values(QUEST_ZONE_POSITIONS),
    );
    this.tilemapLayer.addChild(tilemap);

    // Buildings container (replaces HQ + compoundsContainer)
    this.buildingsContainer = new Container();
    this.app.stage.addChild(this.buildingsContainer);

    // Position center for guild hall
    this.centerX = WORLD_WIDTH / 2;
    this.centerY = WORLD_HEIGHT / 2;

    // Create Guild Hall at world center
    this.guildHall = new Building('guild_hall', buildingTextures['guild_hall']);
    this.guildHall.position.set(GUILD_HALL_POS.x, GUILD_HALL_POS.y);
    this.buildingsContainer.addChild(this.guildHall);

    // Create 4 quest zone buildings from QUEST_ZONE_POSITIONS
    for (const [activityType, pos] of Object.entries(QUEST_ZONE_POSITIONS)) {
      const buildingType: BuildingType = ACTIVITY_BUILDING[activityType as ActivityType];
      const building = new Building(buildingType, buildingTextures[buildingType]);
      building.position.set(pos.x, pos.y);
      this.buildingsContainer.addChild(building);
      this.questZones.set(activityType as ActivityType, building);
    }

    // Ambient floating particles (between buildings and agents in z-order)
    this.ambientParticles = new AmbientParticles();
    this.app.stage.addChild(this.ambientParticles);

    this.agentsContainer = new Container();
    this.app.stage.addChild(this.agentsContainer);

    // Warm ambient lighting tint (FX-03)
    const warmFilter = new ColorMatrixFilter();
    warmFilter.tint(0xFFE8C0, false); // Warm golden tone for RPG atmosphere
    this.app.stage.filters = [warmFilter];
  }

  /**
   * Core logic -- called on every IPC session update.
   * Groups sessions by project, creates/updates/transitions agents.
   * Buildings are static -- no compound lifecycle management needed.
   */
  updateSessions(sessions: SessionInfo[]): void {
    // a. Group sessions by projectName (still needed for agent management)
    const projectSessions = new Map<string, SessionInfo[]>();
    for (const s of sessions) {
      const list = projectSessions.get(s.projectName) ?? [];
      list.push(s);
      projectSessions.set(s.projectName, list);
    }

    // b. Manage agents -- create/update/transition (no compound lifecycle)
    this.manageAgents(sessions, projectSessions);
  }

  /**
   * Tick all agents and speech bubbles.
   * Buildings are always visible at alpha 1.0 -- no fade transitions needed.
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

    // Tick ambient particles
    this.ambientParticles.tick(deltaMs);

    // Tick speech bubbles
    for (const bubble of this.speechBubbles.values()) {
      bubble.tick(deltaMs);
    }

    // Quest zone active highlights (ENV-04)
    const activeBuildingTypes = new Set<string>();
    for (const agent of this.agents.values()) {
      const agentState = agent.getState();
      if (agentState === 'working' || agentState === 'walking_to_workspot') {
        const activity = this.lastActivity.get(agent.sessionId);
        if (activity && activity !== 'idle') {
          activeBuildingTypes.add(ACTIVITY_BUILDING[activity]);
        }
      }
    }
    for (const [activityType, building] of this.questZones) {
      const buildingType = ACTIVITY_BUILDING[activityType];
      building.tint = activeBuildingTypes.has(buildingType) ? 0xFFDD88 : 0xFFFFFF;
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

  // --- Private: Agent Management ---

  /**
   * Create, update, and transition agents based on session data.
   * Routes agents to buildings by activity type instead of per-project compounds.
   */
  private manageAgents(
    sessions: SessionInfo[],
    _projectSessions: Map<string, SessionInfo[]>,
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

      // Route agent to building based on activity type
      const activityType = session.activityType;
      const agentState = agent.getState();

      if (activityType !== 'idle') {
        const building = this.questZones.get(activityType);
        if (building) {
          if (agentState === 'idle_at_hq') {
            // Agent at guild hall, needs to go work -- send to quest zone
            const entrance = this.getBuildingEntrance(building);
            const workPos = this.getBuildingWorkPosition(building, session.sessionId);
            agent.assignToCompound(entrance, workPos);
          } else if (agentState === 'working') {
            // Check for activity type change (different building needed)
            const prevActivity = this.lastActivity.get(session.sessionId);
            if (prevActivity && prevActivity !== activityType) {
              // Activity changed -- reassign to new building
              const entrance = this.getBuildingEntrance(building);
              const workPos = this.getBuildingWorkPosition(building, session.sessionId);
              agent.assignToCompound(entrance, workPos);
              // Show speech bubble on activity change
              const bubble = this.speechBubbles.get(session.sessionId);
              if (bubble) {
                bubble.show(activityType);
              }
            }
          }
        }
      } else {
        // Activity is idle -- agent should be at Guild Hall
        if (
          agentState !== 'idle_at_hq' &&
          agentState !== 'walking_to_building' &&
          agentState !== 'celebrating'
        ) {
          const idlePos = this.getGuildHallIdlePosition(session.sessionId);
          agent.assignToHQ(idlePos);
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

    // Reposition idle agents at Guild Hall
    this.repositionIdleAgents();
  }

  /**
   * Reposition all idle agents in front of Guild Hall.
   */
  private repositionIdleAgents(): void {
    const idleAgents: Agent[] = [];
    for (const agent of this.agents.values()) {
      if (agent.getState() === 'idle_at_hq') {
        idleAgents.push(agent);
      }
    }

    for (let i = 0; i < idleAgents.length; i++) {
      const localPos = this.guildHall.getIdlePosition(i, idleAgents.length);
      // Convert guild hall local position to global position
      const globalPos = {
        x: this.guildHall.x + localPos.x,
        y: this.guildHall.y + localPos.y,
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
   * Get building entrance position in global (world) coordinates.
   */
  private getBuildingEntrance(building: Building): { x: number; y: number } {
    const local = building.getEntrancePosition();
    return { x: building.x + local.x, y: building.y + local.y };
  }

  /**
   * Get building work position in global (world) coordinates.
   * Counts agents already at this building to fan them out.
   */
  private getBuildingWorkPosition(building: Building, sessionId: string): { x: number; y: number } {
    let agentIndex = 0;
    let totalAtBuilding = 0;
    for (const [sid, agent] of this.agents) {
      const state = agent.getState();
      if (state === 'working' || state === 'walking_to_workspot') {
        // Check if this agent's last activity maps to the same building
        const activity = this.lastActivity.get(sid);
        if (activity && this.questZones.get(activity) === building) {
          totalAtBuilding++;
          if (sid === sessionId) agentIndex = totalAtBuilding - 1;
        }
      }
    }
    const local = building.getWorkPosition(agentIndex, Math.max(totalAtBuilding, 1));
    return { x: building.x + local.x, y: building.y + local.y };
  }

  /**
   * Get a global idle position at Guild Hall for a specific agent.
   * Used when sending an agent back to Guild Hall.
   */
  private getGuildHallIdlePosition(sessionId: string): { x: number; y: number } {
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
    const localPos = this.guildHall.getIdlePosition(thisIndex, idleCount);
    return {
      x: this.guildHall.x + localPos.x,
      y: this.guildHall.y + localPos.y,
    };
  }
}
