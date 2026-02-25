import { Application, Container, Graphics } from 'pixi.js';
import { SessionInfo } from '../shared/types';
import { BACKGROUND_COLOR } from '../shared/constants';
import { PlaceholderAgent } from './placeholder-agent';
import { calculateAgentPositions } from './agent-layout';

/**
 * World -- PixiJS Application with spy compound background,
 * agent container management, and session-to-visual mapping.
 */
export class World {
  private app!: Application;
  private agents: Map<string, PlaceholderAgent> = new Map();
  private agentContainer!: Container;
  private backgroundContainer!: Container;
  private lastAgentCount = 0;

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

    // Background renders behind everything
    this.backgroundContainer = new Container();
    this.app.stage.addChild(this.backgroundContainer);

    // Agents render on top
    this.agentContainer = new Container();
    this.app.stage.addChild(this.agentContainer);

    this.drawCompoundBackground();
  }

  /**
   * Draw the bird's-eye spy compound background.
   * Uses muted, dark colors so agents remain the focal point.
   */
  private drawCompoundBackground(): void {
    // Clear previous background
    this.backgroundContainer.removeChildren();

    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const bg = new Graphics();

    // 1. Ground fill -- dark green-gray (grass/concrete)
    bg.rect(0, 0, w, h);
    bg.fill(0x2a3a2a);

    // 2. Perimeter fence -- subtle border
    bg.rect(20, 20, w - 40, h - 40);
    bg.stroke({ color: 0x555555, width: 2 });

    // 3. Buildings -- positioned around edges, leaving center open as courtyard

    // HQ -- main building, top-center
    const hqW = 180;
    const hqH = 80;
    const hqX = (w - hqW) / 2;
    const hqY = 40;
    bg.rect(hqX, hqY, hqW, hqH);
    bg.fill(0x3a3a50);
    bg.rect(hqX, hqY, hqW, hqH);
    bg.stroke({ color: 0x50506a, width: 1.5 });
    // HQ label accent -- small lighter strip on top
    bg.rect(hqX + 10, hqY + 5, hqW - 20, 8);
    bg.fill(0x50506a);

    // Comms building -- left side
    const commsW = 100;
    const commsH = 60;
    const commsX = 40;
    const commsY = h * 0.25;
    bg.rect(commsX, commsY, commsW, commsH);
    bg.fill(0x3a4a3a);
    bg.rect(commsX, commsY, commsW, commsH);
    bg.stroke({ color: 0x506050, width: 1.5 });

    // Barracks -- right side
    const barracksW = 100;
    const barracksH = 70;
    const barracksX = w - 40 - barracksW;
    const barracksY = h * 0.25;
    bg.rect(barracksX, barracksY, barracksW, barracksH);
    bg.fill(0x3a3a40);
    bg.rect(barracksX, barracksY, barracksW, barracksH);
    bg.stroke({ color: 0x505060, width: 1.5 });

    // Armory -- bottom-left
    const armoryW = 90;
    const armoryH = 55;
    const armoryX = 50;
    const armoryY = h - 40 - armoryH;
    bg.rect(armoryX, armoryY, armoryW, armoryH);
    bg.fill(0x403030);
    bg.rect(armoryX, armoryY, armoryW, armoryH);
    bg.stroke({ color: 0x604545, width: 1.5 });

    // Garage -- bottom-right
    const garageW = 110;
    const garageH = 55;
    const garageX = w - 50 - garageW;
    const garageY = h - 40 - garageH;
    bg.rect(garageX, garageY, garageW, garageH);
    bg.fill(0x3a3530);
    bg.rect(garageX, garageY, garageW, garageH);
    bg.stroke({ color: 0x554a40, width: 1.5 });

    // 4. Paths -- lighter colored strips connecting buildings
    const pathColor = 0x4a4a3a;
    const pathWidth = 10;

    // Vertical path from HQ down to courtyard center
    bg.rect(w / 2 - pathWidth / 2, hqY + hqH, pathWidth, h / 2 - hqY - hqH);
    bg.fill(pathColor);

    // Horizontal path across middle
    bg.rect(commsX + commsW, h * 0.45 - pathWidth / 2, barracksX - commsX - commsW, pathWidth);
    bg.fill(pathColor);

    // Path from comms to center
    bg.rect(commsX + commsW, commsY + commsH / 2 - pathWidth / 2, w / 2 - commsX - commsW, pathWidth);
    bg.fill(pathColor);

    // Path from barracks to center
    bg.rect(w / 2, barracksY + barracksH / 2 - pathWidth / 2, barracksX - w / 2, pathWidth);
    bg.fill(pathColor);

    // Vertical path from center down to bottom buildings
    bg.rect(w / 2 - pathWidth / 2, h * 0.5, pathWidth, armoryY - h * 0.5);
    bg.fill(pathColor);

    // 5. Open courtyard -- lighter ground area in center
    const courtW = w * 0.4;
    const courtH = h * 0.3;
    const courtX = (w - courtW) / 2;
    const courtY = (h - courtH) / 2;
    bg.rect(courtX, courtY, courtW, courtH);
    bg.fill(0x354535);

    // 6. Small accent details -- crates and guard posts
    // Guard post near gate (bottom-center)
    bg.rect(w / 2 - 8, h - 50, 16, 16);
    bg.fill(0x444444);
    bg.rect(w / 2 - 8, h - 50, 16, 16);
    bg.stroke({ color: 0x606060, width: 1 });

    // Crates near armory
    bg.rect(armoryX + armoryW + 10, armoryY + 10, 12, 12);
    bg.fill(0x5a4a30);
    bg.rect(armoryX + armoryW + 10, armoryY + 25, 10, 10);
    bg.fill(0x5a4a30);

    // Vehicle near garage
    bg.rect(garageX - 25, garageY + 15, 20, 12);
    bg.fill(0x3a5040);
    bg.rect(garageX - 25, garageY + 15, 20, 12);
    bg.stroke({ color: 0x4a6050, width: 1 });

    this.backgroundContainer.addChild(bg);
  }

  /**
   * Update agents from session data. Creates new agents, updates existing.
   * Recalculates positions only when agent count changes.
   */
  updateSessions(sessions: SessionInfo[]): void {
    const currentIds = new Set<string>();

    for (const session of sessions) {
      currentIds.add(session.sessionId);
      const existing = this.agents.get(session.sessionId);

      if (existing) {
        existing.updateStatus(session.status);
        existing.updateName(session.projectName);
      } else {
        const agent = new PlaceholderAgent(session.projectName, session.status);
        this.agents.set(session.sessionId, agent);
        this.agentContainer.addChild(agent);
      }
    }

    // Note: completed sessions persist (per user decision) -- we don't remove them.
    // We only add new ones and update existing.

    // Recalculate positions if agent count changed
    if (this.agents.size !== this.lastAgentCount) {
      this.repositionAgents();
      this.lastAgentCount = this.agents.size;
    }
  }

  private repositionAgents(): void {
    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const positions = calculateAgentPositions(this.agents.size, w, h);
    let i = 0;
    for (const agent of this.agents.values()) {
      if (i < positions.length) {
        agent.setBasePosition(positions[i].x, positions[i].y);
      }
      i++;
    }
  }

  /**
   * Tick all agent animations.
   */
  tick(deltaMs: number): void {
    for (const agent of this.agents.values()) {
      agent.animate(deltaMs);
    }
  }

  getApp(): Application {
    return this.app;
  }

  resize(): void {
    this.drawCompoundBackground();
    this.repositionAgents();
  }

  destroy(): void {
    this.app.destroy(true);
  }
}
