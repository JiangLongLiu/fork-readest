class EventDispatcher {
  private target: EventTarget;

  constructor() {
    this.target = new EventTarget();
  }

  on(event: string, callback: (event: CustomEvent) => void): void {
    this.target.addEventListener(event, callback as EventListener);
  }

  off(event: string, callback: (event: CustomEvent) => void): void {
    this.target.removeEventListener(event, callback as EventListener);
  }

  dispatch(event: string, detail?: unknown): void {
    this.target.dispatchEvent(new CustomEvent(event, { detail }));
  }
}

export const eventDispatcher = new EventDispatcher();
