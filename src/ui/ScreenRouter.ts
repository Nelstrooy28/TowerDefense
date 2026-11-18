export interface ScreenController {
  readonly id: string;
  enter(params?: unknown): void;
  exit(): void;
  onBack?(): boolean; // return true if handled locally; false to pop
}

/**
 * Global Screen Router (Spec v4 Doc 01 §5 & AGENTS Rule 18).
 * Manages a stack of menu/overlay screens so Back & Esc always pop one level cleanly.
 */
class ScreenRouterImpl {
  private stack: ScreenController[] = [];
  private registry = new Map<string, ScreenController>();

  public register(screen: ScreenController): void {
    this.registry.set(screen.id, screen);
  }

  public get current(): ScreenController | null {
    return this.stack.length > 0 ? this.stack[this.stack.length - 1] : null;
  }

  public get depth(): number {
    return this.stack.length;
  }

  public push(id: string, params?: unknown): boolean {
    const scr = this.registry.get(id);
    if (!scr) return false;
    const prev = this.current;
    if (prev && prev.id === id) return true;
    prev?.exit();
    this.stack.push(scr);
    scr.enter(params);
    return true;
  }

  public replace(id: string, params?: unknown): boolean {
    const scr = this.registry.get(id);
    if (!scr) return false;
    while (this.stack.length > 0) {
      this.stack.pop()?.exit();
    }
    this.stack.push(scr);
    scr.enter(params);
    return true;
  }

  public pop(): boolean {
    if (this.stack.length <= 1) return false;
    const top = this.stack.pop()!;
    if (top.onBack && top.onBack()) {
      this.stack.push(top);
      return true;
    }
    top.exit();
    this.current?.enter();
    return true;
  }

  public popAll(): void {
    while (this.stack.length > 0) {
      this.stack.pop()?.exit();
    }
  }
}

export const ScreenRouter = new ScreenRouterImpl();
