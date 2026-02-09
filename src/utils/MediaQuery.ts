export type TSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
export class MediaQuery {
  private currentSize: TSize;
  private readonly onSizeChange: EventTarget;

  xsTreshold = 576;
  smTreshold = 768;
  mdTreshold = 992;
  lgTreshold = 1200;
  xlTreshold = 1400;    

  constructor() {
    this.currentSize = this.getSize();
    this.onSizeChange = new EventTarget();

    window.addEventListener('resize', () => {
      const newSize = this.getSize();
      if (newSize !== this.currentSize) {
        this.currentSize = newSize;
        this.onSizeChange.dispatchEvent(new CustomEvent('sizeChange', { detail: newSize }));
      }
    });
  }

  private getSize(): TSize {
    const width = window.innerWidth;
    if (width < this.xsTreshold) {
      return 'xs';
    }
    if (width < this.smTreshold) {
      return 'sm';
    }
    if (width < this.mdTreshold) {
      return 'md';
    }
    if (width < this.lgTreshold) {
      return 'lg';
    }
    if (width < this.xlTreshold) {
      return 'xl';
    }
    return 'xxl';
  }

  public onSizeUpated(listener: { detail: TSize } ): void {
    this.onSizeChange.addEventListener('sizeChange', listener as unknown as EventListener);
  }

  public removeSizeUpated(listener: { detail: TSize }): void {
    this.onSizeChange.removeEventListener('sizeChange', listener as unknown as EventListener);
  }
}
