/** One active operation; invalidation makes every pending continuation stale. */
export class OperationGate {
  private generation = 0;
  private active = false;

  begin(): number | null {
    if (this.active) return null;
    this.active = true;
    return ++this.generation;
  }

  isCurrent(token: number): boolean {
    return this.active && token === this.generation;
  }

  finish(token: number): void {
    if (this.isCurrent(token)) this.active = false;
  }

  invalidate(): void {
    this.generation++;
    this.active = false;
  }
}
