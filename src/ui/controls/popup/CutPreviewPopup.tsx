/** @jsx h */
/** @jsxFrag f */
import { BaseComponent, TRenderHandler, h, f } from "@ekkojs/web-controls";
import { MainFrame } from "../../../ui/layout/Frame";
import { getUow } from "../../../uof/UnitOfWork";
import { config } from "../../../core/Constant";
import { ProtocolGenerator } from "../../../Graphics/ProtocolGenerator";
import '../../../utils/css/popup.css';

interface CutPreviewPopupProps {
  hpgl: string;
  onProceed: () => void;
  onCancel: () => void;
  usage: string;
  cost: string;
  selectedRoll: string;
  boardWidth : string ;
  boardlength : string ;
  swapxy : string ;
}

export class CutPreviewPopup extends BaseComponent {
  isVisible: boolean = false;
  private hpgl: string;
  private onProceed: () => void;
  private onCancel: () => void;
  private usage: string;
  private cost: string;
  private selectedRoll: string;
  private boardWidth : string ;
  private boardlength : string ;
  private swapxy : string ;
  isLoading: boolean = true;

  // Popup position and dragging
  popupX: number = window.innerWidth / 2 - 400;
  popupY: number = window.innerHeight / 2 - 300;
  isDragging: boolean = false;
  dragOffsetX: number = 0;
  dragOffsetY: number = 0;

  // Canvas and animation
  private canvasRef: HTMLCanvasElement | null = null;
  private animationFrameId: number | null = null;

  // Cache for parsed paths
  private cachedPaths: {x: number, y: number}[][] | null = null;
  private lastParsedHpgl: string | null = null;
  private worker: Worker | null = null;

  constructor(props: CutPreviewPopupProps) {
    super("CutPreviewPopup");
    this.hpgl = props.hpgl;
    this.onProceed = props.onProceed;
    this.onCancel = props.onCancel;
    this.usage = props.usage;
    this.cost = props.cost;
    this.selectedRoll = props.selectedRoll;
    this.boardWidth = props.boardWidth;
    this.swapxy = props.swapxy;
    this.boardlength = props.boardlength ;
    this.registerTemplate("default", _default);
    this.registerDependencyProperties(["isVisible", "popupX", "popupY", "isLoading"]);
  }

  show() {
    const mainFrame = getUow<MainFrame>("mainFrame");
    if (mainFrame) {
      if (!mainFrame.children.includes(this)) {
        mainFrame.children.push(this);
      }
      mainFrame.update();
    }
    this.isVisible = true;
    this.isLoading = true;
    this.update();
    
    // Start parsing asynchronously
    this.parseHPGLAsync();
  }

  hide() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    // Terminate worker if still running
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    
    this.isVisible = false;
    this.update();
    
    const mainFrame = getUow<MainFrame>("mainFrame");
    if (mainFrame) {
      const index = mainFrame.children.indexOf(this);
      if (index > -1) {
        mainFrame.children.splice(index, 1);
        mainFrame.update();
      }
    }
  }

  private async parseHPGLAsync() {
    // Check if we already have cached paths
    if (this.lastParsedHpgl === this.hpgl && this.cachedPaths) {
      this.isLoading = false;
      this.update();
      if (this.canvasRef) {
        requestAnimationFrame(() => this.simulatePlotter());
      }
      return;
    }

    // Use the dynamic board width from props, fallback to config.boardWidth
    const currentBoardWidth = parseFloat(this.boardWidth) || config.boardWidth;

    // For small HPGL strings, parse synchronously
    if (this.hpgl.length < 50000) {
      try {
        this.cachedPaths = ProtocolGenerator.parseHPGL(this.hpgl, 40, currentBoardWidth * 40);
        this.lastParsedHpgl = this.hpgl;
        this.isLoading = false;
        this.update();
        if (this.canvasRef) {
          requestAnimationFrame(() => this.simulatePlotter());
        }
      } catch (error) {
        console.error("Error parsing HPGL:", error);
        this.isLoading = false;
        this.update();
      }
      return;
    }

    // For large HPGL strings, use Web Worker
    return new Promise<void>((resolve) => {
      try {
        // Create worker from the worker file
        this.worker = new Worker(new URL('../../../Graphics/HPGLWorker.ts', import.meta.url), { type: 'module' });
        
        this.worker.postMessage({ 
          hpgl: this.hpgl, 
          ratio: 40, 
          surfaceHeight: currentBoardWidth * 40 
        });
        
        this.worker.onmessage = (e) => {
          if (e.data.error) {
            console.error("Worker error:", e.data.error);
            // Fallback to synchronous parsing
            this.cachedPaths = ProtocolGenerator.parseHPGL(this.hpgl, 40, currentBoardWidth * 40);
          } else {
            this.cachedPaths = e.data.paths;
          }
          
          this.lastParsedHpgl = this.hpgl;
          this.isLoading = false;
          this.update();
          
          if (this.worker) {
            this.worker.terminate();
            this.worker = null;
          }
          
          if (this.canvasRef) {
            requestAnimationFrame(() => this.simulatePlotter());
          }
          
          resolve();
        };

        this.worker.onerror = (error) => {
          console.error("Worker failed:", error);
          // Fallback to synchronous parsing
          this.cachedPaths = ProtocolGenerator.parseHPGL(this.hpgl, 40, currentBoardWidth * 40);
          this.lastParsedHpgl = this.hpgl;
          this.isLoading = false;
          this.update();
          
          if (this.worker) {
            this.worker.terminate();
            this.worker = null;
          }
          
          if (this.canvasRef) {
            requestAnimationFrame(() => this.simulatePlotter());
          }
          
          resolve();
        };
      } catch (error) {
        console.error("Failed to create worker:", error);
        // Fallback to synchronous parsing
        this.cachedPaths = ProtocolGenerator.parseHPGL(this.hpgl, 40, currentBoardWidth * 40);
        this.lastParsedHpgl = this.hpgl;
        this.isLoading = false;
        this.update();
        
        if (this.canvasRef) {
          requestAnimationFrame(() => this.simulatePlotter());
        }
        
        resolve();
      }
    });
  }

  private simulatePlotter() {
    if (!this.canvasRef) return;
    const canvas = this.canvasRef;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }

    // Use cached paths
    const paths = this.cachedPaths;
    if (!paths) return;

    const parent = canvas.parentElement;
    if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (paths.length === 0 || paths.every(p => p.length === 0)) {
      ctx.font = "16px Arial";
      ctx.fillStyle = "black";
      ctx.textAlign = "center";
      ctx.fillText("No valid paths to draw.", canvas.width / 2, canvas.height / 2);
      return;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    paths.forEach(path => path.forEach(point => {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
    }));

    if (!isFinite(minX)) return;

    const PADDING = {
        top: 0.28,
        bottom: 0.06,
        left: 0.09,
        right: 0.09
    };

    const pathWidth = maxX - minX;
    const pathHeight = maxY - minY;

    const availableWidth = canvas.width * (1 - PADDING.left - PADDING.right);
    const availableHeight = canvas.height * (1 - PADDING.top - PADDING.bottom);

    const offsetX = canvas.width * PADDING.left;
    const offsetY = canvas.height * PADDING.top;

    const scale = Math.min(availableWidth / (pathWidth || 1), availableHeight / (pathHeight || 1));

    const translateX = offsetX + (availableWidth - pathWidth * scale) / 2 - minX * scale;
    const translateY = offsetY + (availableHeight - pathHeight * scale) / 2 - minY * scale;

    let pathIndex = 0;
    let pointIndex = 0;

    ctx.strokeStyle = '#000000ff';
    ctx.lineWidth = 5;
    ctx.save();
    ctx.translate(translateX, translateY);
    ctx.scale(scale, scale);

    const speed = 37;

    const drawSegment = () => {
      if (pathIndex >= paths.length) {
        ctx.restore();
        return;
      }

      for (let i = 0; i < speed; i++) {
        if (pathIndex >= paths.length) break;

        const currentPath = paths[pathIndex];
        if (pointIndex < currentPath.length - 1) {
          const startPoint = currentPath[pointIndex];
          const endPoint = currentPath[pointIndex + 1];

          ctx.beginPath();
          ctx.moveTo(startPoint.x, startPoint.y);
          ctx.lineTo(endPoint.x, endPoint.y);
          ctx.stroke();

          pointIndex++;
        } else {
          pathIndex++;
          pointIndex = 0;
        }
      }

      this.animationFrameId = requestAnimationFrame(drawSegment);
    };

    drawSegment();
  }
}

const PlotterBackground = () => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 2765.5 1232" 
    preserveAspectRatio="none" 
    style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      zIndex: 1 
    }}
  >

    <defs>
      <style>{`
        .st0 { fill: #1e1e1e; }
        .st1 { fill: #25a9e0; font-family: ArialMT, Arial; font-size: 30px; }
        .st1, .st2 { isolation: isolate; }
        .st3 { fill: none; stroke: #1e1e1e; stroke-width: 10px; }
      `}</style>
    </defs>
    <g class="st2"><g class="st2"><g class="st2"><text class="st1" transform="translate(2442.5 1213.9) rotate(1.5) scale(1.7 1) skewX(.1)"><tspan x="0" y="0">(0 , 0)</tspan></text></g></g></g>
    <g class="st2"><g class="st2"><g class="st2"><text class="st1" transform="translate(180.6 1183.5) rotate(-2.1) scale(1.7 1) skewX(-1.9)"><tspan x="0" y="0">Y</tspan></text></g></g></g>
    <g class="st2"><g class="st2"><g class="st2"><g class="st2"><text class="st1" transform="translate(2555.7 321.1) rotate(-2.1) scale(1.7 1) skewX(-1.9)"><tspan x="0" y="0">x</tspan></text></g></g></g></g>
    <g><line class="st3" x1="224.3" y1="1173.1" x2="2567.9" y2="1173.1"/><polygon class="st0" points="244.2 1190.1 227.2 1173.1 244.2 1156.2 229.8 1156.2 212.8 1173.1 229.8 1190.1 244.2 1190.1"/></g>
    <g><line class="st3" x1="2567.9" y1="332.5" x2="2567.9" y2="1173.1"/><polygon class="st0" points="2551 352.5 2567.9 335.5 2584.9 352.5 2584.9 338.1 2567.9 321.1 2551 338.1 2551 352.5"/></g>
    <path class="st0" d="M2674.9,155.1H90.6c-39.1,0-70.8,26.2-70.8,65.3v6.1c0,36.2,27.2,66,62.2,70.2h-.3s0,864.5,0,864.5c0,18.6,15,33.6,33.6,33.6s17.7-3.8,23.8-9.8c6.1-6.1,9.8-14.5,9.8-23.8V297.3h2461.7v864c0,18.6,15,33.6,33.6,33.6s17.7-3.8,23.8-9.8c6.1-6.1,9.8-14.5,9.8-23.8V297.2c37.7-1.5,67.9-32.6,67.9-70.7v-.6c0-39.1-31.7-70.8-70.8-70.8ZM2543.4,168.4c11.8,0,21.3,9.6,21.3,21.3s-9.6,21.3-21.3,21.3-21.3-9.6-21.3-21.3,9.5-21.3,21.3-21.3ZM2458.1,168.4c11.8,0,21.3,9.6,21.3,21.3s-9.6,21.3-21.3,21.3-21.3-9.6-21.3-21.3,9.6-21.3,21.3-21.3ZM2372.8,168.4c11.8,0,21.3,9.6,21.3,21.3s-9.6,21.3-21.3,21.3-21.3-9.6-21.3-21.3,9.6-21.3,21.3-21.3ZM1848.1,265.6H185.4v-25.7h1662.7v25.7ZM2614.1,265.6h-697.3v-25.7h697.3v25.7Z"/>
  </svg>
);

const _default: TRenderHandler = ($this: CutPreviewPopup) => {
  if (!$this.isVisible) return <></>;
  
  const handleMouseDown = (e: MouseEvent) => {
    const popupEl = (e.target as HTMLElement).closest('.cut-preview-popup-container');
    const titleBar = (e.target as HTMLElement).closest('.popup-title');
    
    if (titleBar && popupEl) {
      $this.isDragging = true;
      const rect = popupEl.getBoundingClientRect();
      $this.dragOffsetX = e.clientX - rect.left;
      $this.dragOffsetY = e.clientY - rect.top;
      
      const handleMouseMove = (e: MouseEvent) => {
        if ($this.isDragging) {
          $this.popupX = e.clientX - $this.dragOffsetX;
          $this.popupY = e.clientY - $this.dragOffsetY;
          $this.update();
        }
      };
      
      const handleMouseUp = () => {
        $this.isDragging = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
      
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
  };
  
  let showWarning = false;
  const swapXYActive = ($this as any).swapxy?.toLowerCase() === 'true';

  if (swapXYActive) {
    const boardLengthStr: string = ($this as any).boardlength || '';
    const lengthValue = parseFloat(boardLengthStr);
    
    if (!isNaN(lengthValue)) {
      if (boardLengthStr.includes('mm') && lengthValue > 1200) {
        showWarning = true;
      } else if (boardLengthStr.includes('in') && lengthValue > 47.2) {
        showWarning = true;
      }
    }
  }
  
  return (
    <>
      <div className="popup-background visible"></div>
      <div 
        className="popup-container visible cut-preview-popup-container"
        style={{
          width: '800px',
          height: '600px',
          left: `${$this.popupX}px`,
          top: `${$this.popupY}px`,
        }}
      >
        <div 
          className="popup-title"
          style={{ cursor: 'move' }}
          onMouseDown={handleMouseDown}
        >
          Cut Preview
        </div>
        <div className="popup-content" style={{ display: 'flex', flexDirection: 'column', padding: 0 }}>
          <div 
            class="plotter-simulation-area" 
            style={{ 
              flex: 1, 
              position: 'relative',
              backgroundColor: '#ffffff' 
            }}
          >
            <PlotterBackground />

            {/* Loading overlay */}
            {($this as any).isLoading && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                zIndex: 10,
                flexDirection: 'column',
                gap: '10px'
              }}>
                <div style={{ 
                  fontSize: '18px', 
                  fontWeight: 'bold',
                  color: '#3b82f6' 
                }}>
                  Loading Preview...
                </div>
                <div style={{ 
                  fontSize: '14px', 
                  color: '#666' 
                }}>
                  Processing {Math.round(($this as any).hpgl.length / 1024)} KB of data
                </div>
                {/* Simple loading spinner */}
                <div style={{
                  width: '40px',
                  height: '40px',
                  border: '4px solid #f3f3f3',
                  borderTop: '4px solid #3b82f6',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
              </div>
            )}

            <canvas
              ref={(el: HTMLCanvasElement) => {
                  ($this as any).canvasRef = el;
                  if (el && !($this as any).isLoading) {
                     requestAnimationFrame(() => ($this as any).simulatePlotter());
                  }
              }}
              class="cut-preview-canvas"
              style={{ 
                position: 'absolute', 
                top: 0, 
                left: 0, 
                width: '100%', 
                height: '100%',
                zIndex: 2 
              }}
            ></canvas>
          </div>
       
          <div className="cut-info" style={{ padding: '10px', borderTop: '1px solid #3b82f6', backgroundColor: '#ffffffff' ,color :'#000000ff'}}>
            <div><strong>Material Usage:</strong> {($this as any).usage}</div>
            <div><strong>Estimated Cost:</strong> {($this as any).cost}</div>
            <div><strong>Selected Roll:</strong> {($this as any).selectedRoll}</div>
            <div><strong>CutBoard Width:</strong> {($this as any).boardWidth}</div>
            <div><strong>CutBoard Length:</strong> {($this as any).boardlength}</div>
            {showWarning && (
                <div style={{ color: 'red', marginTop: '5px', fontWeight: 'bold' }}>
                    Warning: Cut might fail or produce incorrect patterns with 'Swap X/Y' active on boards longer than 1200mm (47.2in). Please disable this option in settings or adjust your board size.
                </div>
            )}
          </div>
        </div>
        <div className="popup-actions">
          <div className="popup-action-button" onClick={() => {
            ($this as any).onProceed();
            $this.hide();
          }}>Proceed to Cut</div>
          <div className="popup-action-button popup-action-cancel" onClick={() => {
            ($this as any).onCancel();
            $this.hide();
          }}>Cancel</div>
        </div>
      </div>
      
      {/* Add CSS for spinner animation */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
};