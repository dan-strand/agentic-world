import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { SessionStatus } from '../shared/types';
import { STATUS_COLORS } from '../shared/constants';

/**
 * PlaceholderAgent -- visual representation of a single Claude Code session.
 * Renders as a colored silhouette (circle head + rectangle body) with
 * project name above and status text below. Gently bobs up and down.
 */
export class PlaceholderAgent extends Container {
  private nameLabel: Text;
  private body: Graphics;
  private statusLabel: Text;
  private currentStatus: SessionStatus;
  private bobPhase: number;
  private baseX = 0;
  private baseY = 0;

  constructor(projectName: string, status: SessionStatus) {
    super();
    this.currentStatus = status;
    // Random initial phase offset so agents don't bob in sync
    this.bobPhase = Math.random() * Math.PI * 2;

    // Name label above the body
    this.nameLabel = new Text({
      text: projectName,
      style: new TextStyle({
        fontFamily: 'monospace',
        fontSize: 12,
        fill: 0xffffff,
        align: 'center',
      }),
    });
    this.nameLabel.anchor.set(0.5, 1);
    this.nameLabel.y = -40;
    this.addChild(this.nameLabel);

    // Body: circle head + rectangle torso
    this.body = new Graphics();
    this.drawBody(status);
    this.addChild(this.body);

    // Status label below the body
    this.statusLabel = new Text({
      text: status,
      style: new TextStyle({
        fontFamily: 'monospace',
        fontSize: 10,
        fill: STATUS_COLORS[status],
        align: 'center',
      }),
    });
    this.statusLabel.anchor.set(0.5, 0);
    this.statusLabel.y = 25;
    this.addChild(this.statusLabel);
  }

  private drawBody(status: SessionStatus): void {
    const color = STATUS_COLORS[status];
    this.body.clear();
    // Head -- circle at y=-20
    this.body.circle(0, -20, 10);
    this.body.fill(color);
    // Torso -- rectangle centered, top at y=-8, 16px wide, 30px tall
    this.body.rect(-8, -8, 16, 30);
    this.body.fill(color);
  }

  updateStatus(newStatus: SessionStatus): void {
    if (newStatus === this.currentStatus) return;
    this.currentStatus = newStatus;
    this.drawBody(newStatus);
    this.statusLabel.text = newStatus;
    (this.statusLabel.style as TextStyle).fill = STATUS_COLORS[newStatus];
  }

  updateName(newName: string): void {
    this.nameLabel.text = newName;
  }

  /**
   * Animate gentle bobbing. deltaMs is milliseconds since last tick.
   */
  animate(deltaMs: number): void {
    this.bobPhase += deltaMs * 0.002;
    this.y = this.baseY + Math.sin(this.bobPhase) * 3;
  }

  setBasePosition(x: number, y: number): void {
    this.baseX = x;
    this.baseY = y;
    this.x = x;
    this.y = y;
  }
}
