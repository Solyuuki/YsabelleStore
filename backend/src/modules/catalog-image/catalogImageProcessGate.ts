export class CatalogImageProcessGate {
  private active = 0;
  private readonly maxConcurrent: number;
  private readonly waiting: Array<() => void> = [];

  public constructor(maxConcurrent: number) {
    if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1) {
      throw new Error("Catalog image process concurrency must be a positive integer.");
    }

    this.maxConcurrent = maxConcurrent;
  }

  public get activeCount() {
    return this.active;
  }

  public get queuedCount() {
    return this.waiting.length;
  }

  public async run<T>(task: () => Promise<T>): Promise<T> {
    await this.acquire();

    try {
      return await task();
    } finally {
      this.release();
    }
  }

  private async acquire() {
    if (this.active < this.maxConcurrent) {
      this.active += 1;
      return;
    }

    await new Promise<void>((resolve) => {
      this.waiting.push(resolve);
    });
    this.active += 1;
  }

  private release() {
    this.active -= 1;
    const next = this.waiting.shift();

    if (next) {
      next();
    }
  }
}
