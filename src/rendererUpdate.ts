/// <reference path="./Nesting/Types.ts" />
import { _boardEvts, _evtBus, _evts, nestingEvents } from './core/EventBus';
import './index.css';
import { CutBoard } from './ui/controls/CutBoard/CutBoard';
import { CutBoardPreview, blackButtonThin } from './ui/controls/CutBoardPreview/CutBoardPreview';
import { History } from "./ui/controls/MyBoards/History";
import { MyBoards } from './ui/controls/MyBoards/MyBoards';
import { Profile } from "./ui/controls/Profile/Profile";
import { Settings } from "./ui/controls/Settings/Settings";
import { Projects } from './ui/controls/Projects/Projects';
import { SearchResult } from './ui/controls/SearchResult/SearchResult';
import { SelectPattern } from "./ui/controls/SearchResult/SelectPattern";
import { SelectPatternToolbar } from "./ui/controls/SearchResult/SelectPatternToolbar";
import { Table } from './ui/controls/Table/Table';
import { ButtonBar } from './ui/controls/buttons/ButtonBar';
import { Popup, ppNesting } from './ui/controls/popup/Popup';
import { toastError } from './ui/controls/Toast/Toast';
import { FilterPane } from './ui/controls/search/FilterPane';
import { MainFrame } from './ui/layout/Frame';
import { LeftBar } from './ui/layout/LeftBar/LeftBar';
import { MainPanel } from './ui/layout/MainPanel/MainPanel';
import { TopBar } from './ui/layout/TopBar/TopBar';
import { LoginScreen } from './ui/LoginScreen';
import { InitializeSearch } from './uof/Services';
import { registerUow } from './uof/UnitOfWork';
import simplify from 'simplify-js';
import { config as _config, TConfig } from './core/Constant';
import { Path } from 'paper';
import { getPolygonDefinition } from './shared/Substract';
import '../src/utils/css/system.css'





declare var getPrinterList: () => Promise<string[]>;
declare var getConfig: () => TConfig;

// Export these so LoginScreen.tsx can access them
export let leftBar: LeftBar;
export let topBar: TopBar;
export let mainPanel: MainPanel;

export async function mainRenderer() {

  
// Initialize components with new UI from ui-delivery
leftBar = new LeftBar();
topBar = new TopBar();
mainPanel = new MainPanel();
const mainFrame = new MainFrame();
mainFrame.children.push(new LoginScreen()); // Start with LoginScreen

// Register mainFrame and profile button from LeftBar
registerUow({ key: 'mainFrame', data: mainFrame });
registerUow({ key: 'profile', data: leftBar.profile });

// LeftBar buttons
const btnSearch = new ButtonBar();
btnSearch.name = 'lens';
btnSearch.text = 'Search Vehicle';
leftBar.children.push(btnSearch);
registerUow({ key: 'btnSearch', data: btnSearch });

const btnCutBoards = new ButtonBar();
btnCutBoards.name = 'cut-board';
btnCutBoards.text = 'Cut Boards';
leftBar.children.push(btnCutBoards);

const btnMyBoards = new ButtonBar();
btnMyBoards.name = 'mark';
btnMyBoards.text = 'Saved Boards';
leftBar.children.push(btnMyBoards);

const _Projects = new ButtonBar();
_Projects.name = 'projects';
_Projects.text = 'Projects';
leftBar.children.push(_Projects);

const btnHistory = new ButtonBar();
btnHistory.name = 'history';
btnHistory.text = 'Cut History';
leftBar.children.push(btnHistory);

const settings = new ButtonBar();
settings.name = 'settings';
settings.text = 'Settings';
leftBar.children.push(settings);
registerUow({ key: 'settings', data: settings });

const popup = new Popup();
registerUow({ key: 'popup', data: popup });
popup.content = 'This is a popup';
popup.title = 'Popup Title';
popup.isVisible = false;
mainFrame.children.push(popup);

// Event bus for navigation
_evtBus.on(_evts.ButtonBar.Click, (payload: { id: string; name: string }) => {
  topBar.isExpanded = false;

  if (payload.name === 'selectItem') {
    mainPanel.setState('3Panes');
    mainPanel.topPanel = selectPatternToolbar;
    mainPanel.leftPanel = selectPattern;
    mainPanel.rightPanel = cutPreview;
  }
  if (payload.name === 'lens') {
    mainPanel.setState('3Panes');
    mainPanel.topPanel = vehicleSearch;
    mainPanel.leftPanel = searchresult;
    mainPanel.rightPanel = cutPreview;
  }
  if (payload.name === 'cut-board') {
    mainPanel.setState('default');
    mainPanel.maxPanel = cutBoard;
    topBar.isExpanded = true;
  }
  if (payload.name === 'mark') {
    mainPanel.setState('default');
    mainPanel.maxPanel = myBoards;
  }
  if (payload.name === 'projects') {
    mainPanel.setState('default');
    mainPanel.maxPanel = projects;
  }
  if (payload.name === 'history') {
    mainPanel.setState('default');
    mainPanel.maxPanel = history;
  }
  if (payload.name === 'profile') {
    mainPanel.setState('default');
    mainPanel.maxPanel = profilePage;
  }
  if (payload.name === 'settings') {
    mainPanel.setState('default');
    mainPanel.maxPanel = _settings;
  }
  if (payload.name === '') {
    mainPanel.setState('default');
    mainPanel.maxPanel = null;
  }
});

// Other components
const vehicleSearch = new FilterPane();
const searchresult = new SearchResult();
const cutPreview = new CutBoardPreview();
const cutBoard = new CutBoard();
const selectPattern = new SelectPattern();
const selectPatternToolbar = new SelectPatternToolbar();

registerUow({ key: 'vehicleSearch', data: vehicleSearch });
registerUow({ key: 'searchresult', data: searchresult });
registerUow({ key: 'cutPreview', data: cutPreview });
registerUow({ key: 'cutBoard', data: cutBoard });

const myBoards = new MyBoards();
const projects = new Projects();
const history = new History();
const _settings = new Settings();
registerUow({ key: 'settings', data: _settings });
_settings.bladeNumbers = [
  ['1', 'Blade number 1'],
  ['2', 'Blade number 2'],
  ['3', 'Blade number 3'],
  ['4', 'Blade number 4'],
];
_settings.summaList = [
  ['S1/S2|USB', 'Summa S1/S2/S3/D/F USB']

];
getPrinterList().then((res) => {
  _settings.printerList = res.map((p: any) => [p.name, p.displayName]);
});

const profilePage = new Profile();

history.title = 'Cut History';

const tableBoards = new Table();
tableBoards.fontSize = '14px';
tableBoards.columns = [
  { size: 0.5, title: 'S.No' },
  { size: 2, title: 'Board Name' },
  { size: 1, title: 'Date' },
  { size: 1, title: 'Time' },
  { size: 1, title: 'Action' },
];
const btn1 = blackButtonThin('add-to-cut', 'Add to cut Board');
const btn2 = blackButtonThin('rename', 'Rename', 100);
const btn3 = blackButtonThin('bin', 'Delete', 100);

registerUow({ key: 'tableBoards', data: tableBoards });

const tableProjects = new Table();
tableProjects.fontSize = '14px';
tableProjects.columns = [
  { size: 0.5, title: 'S.No' },
  { size: 2, title: 'Project Name' },
  { size: 1, title: 'Date' },
  { size: 1, title: 'Time' },
  { size: 1, title: 'Status' },
  { size: 1, title: 'Actions' },
];
const btn1p = blackButtonThin('add-to-cut', 'Add to cut Board');
const btn2p = blackButtonThin('white-triangle', 'Outgoing', 100, true);
const btn3p = blackButtonThin('bin', 'Delete', 100);
tableProjects.rows = [];

registerUow({ key: 'tableProjects', data: tableProjects });

const tableHistory = new Table();
tableHistory.fontSize = '14px';
tableHistory.columns = [
  { size: 0.5, title: 'S.No' },
  { size: 3.5, title: 'Vehicle' },
  { size: 1, title: 'Nb Patterns' },
  { size: 1, title: 'Cut Date' },
  { size: 1, title: 'Cut Time' },
  { size: 1, title: 'Material Usage' },
  { size: 1.5, title: 'Feedback' },
];
const btn2h = blackButtonThin('add-to-cut', 'Add to cut Board');
const btn1h = blackButtonThin('white-triangle', 'None', 100, true);
tableHistory.rows = [];

registerUow({ key: 'tableHistory', data: tableHistory });

myBoards.children.push(tableBoards);
projects.children.push(tableProjects);
history.children.push(tableHistory);

mainFrame.attachTo(document.body, {
  useShadowDom: false,
});

setTimeout(() => {
  InitializeSearch();
}, 1500);

// Config initialization
const cfg = await getConfig();

  _config.boardLenght = cfg.boardLenght;
  _config.boardWidth  = cfg.boardWidth;
  _config.nesting     = cfg.nesting;
  _config.cut         = cfg.cut;

  _settings.selectedPrinter = _config.cut.printer.name;
_settings.selectedSumma = _config.cut.summa.model;
_settings.ip = _config.cut.network.ip;
_settings.port = _config.cut.network.port.toString();
_settings.plotterType = _config.cut.target;
_settings.width = _config.boardWidth;
_settings.length = _config.boardLenght;
_settings.selectedBlade = _config.cut.summa.blade;
_settings.update();

_evtBus.emit(_boardEvts.BoardSurface.onConfigChange);

// Nesting logic
let packer = new Fit.Packer();
let config = {
  spacing: _config.nesting.spaceBetweenParts,
  rotationSteps: _config.nesting.rotationSteps,
  population: _config.nesting.geneticAlgorithm.populationSize,
  generations: _config.nesting.geneticAlgorithm.generation,
  mutationRate: _config.nesting.geneticAlgorithm.mutationRate,
};

let nestingIdx = 0;
let parts = [] as Part[];
let bins = [] as Bin[];

nestingEvents.sessionCreation.handle((_, result) => {
  try {
    packer.stop();
    packer = new Fit.Packer();
    parts = [];
    bins = [];
    nestingIdx = 0;
  } catch (error: any) {
    console.error("sessionCreation error:", error);
    nestingEvents.error.do(new Error(`Failed to initialize nesting session: ${error.message || 'Unknown error'}`));
    throw error;
  }
});

nestingEvents.addPart.handle((item, result) => {
  try {
    let fastPoly = [] as Point[];
    
    // Validate pattern has a vector
    if (!item.item._vector) {
      throw new Error(`Pattern ${item.idx} has no vector data`);
    }
    
    // Generate path string with error handling
    const itm = item.item._vector.generatePathString();
    if (!itm || itm.trim().length === 0) {
      throw new Error(`Pattern ${item.idx} generated empty path string`);
    }
    
    // Get polygon definition with validation
    const polygonDef = getPolygonDefinition(itm, true);
    if (!polygonDef || polygonDef.length < 3) {
      throw new Error(`Pattern ${item.idx} has invalid polygon (less than 3 points)`);
    }
    
    // Simplify polygon
    fastPoly = __simplifyPolygon(polygonDef, _config.nesting.polyognTolerance);
    
    // Validate simplified polygon
    if (!fastPoly || fastPoly.length < 3) {
      throw new Error(`Pattern ${item.idx} simplified to invalid polygon (less than 3 points)`);
    }
    
    // Validate polygon points for NaN/Infinity
    for (let i = 0; i < fastPoly.length; i++) {
      const p = fastPoly[i];
      if (!isFinite(p.x) || !isFinite(p.y)) {
        throw new Error(`Pattern ${item.idx} has invalid coordinates at point ${i}: (${p.x}, ${p.y})`);
      }
    }
    
    // Create part
    const part = new Fit.Part(nestingIdx++, fastPoly.map(p => new Fit.Vector(p.x, p.y)));
    parts.push(part);
    
  } catch (error: any) {
    console.error("addPart error:", error);
    nestingEvents.error.do(new Error(`Failed to add pattern for nesting: ${error.message || 'Unknown error'}`));
    throw error;
  }
});

nestingEvents.setBin.handle((bin, result) => {
  try {
    // Validate bin dimensions
    if (!bin || typeof bin.width !== 'number' || typeof bin.height !== 'number') {
      throw new Error('Invalid bin dimensions provided');
    }
    
    if (bin.width <= 0 || bin.height <= 0) {
      throw new Error(`Bin dimensions must be positive: width=${bin.width}, height=${bin.height}`);
    }
    
    if (!isFinite(bin.width) || !isFinite(bin.height)) {
      throw new Error(`Bin dimensions must be finite: width=${bin.width}, height=${bin.height}`);
    }
    
    bins = [new Fit.Bin(0, bin.width, bin.height)];
  } catch (error: any) {
    console.error("setBin error:", error);
    nestingEvents.error.do(new Error(`Failed to set bin dimensions: ${error.message || 'Unknown error'}`));
    throw error;
  }
});

nestingEvents.progress.handle((e, result) => {
  result(e);
});

nestingEvents.packingResult.handle((e, result) => {
  result(e);
});

// Add timeout tracking
let nestingStartTime: number | null = null;
let nestingTimeoutId: any = null;
const NESTING_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes timeout

nestingEvents.start.handle((_, result) => {
  try {
    // Validate inputs before starting
    if (!bins || bins.length === 0) {
      throw new Error('No bin defined for nesting');
    }
    
    if (!parts || parts.length === 0) {
      throw new Error('No patterns to nest');
    }
    
    // Clear any existing timeout
    if (nestingTimeoutId) {
      clearTimeout(nestingTimeoutId);
      nestingTimeoutId = null;
    }
    
    // Set timeout for nesting operation
    nestingStartTime = Date.now();
    nestingTimeoutId = setTimeout(() => {
      console.error('Nesting timeout exceeded');
      packer.stop();
      nestingEvents.error.do(new Error('Nesting operation timed out after 5 minutes. Try with fewer patterns or simpler shapes.'));
    }, NESTING_TIMEOUT_MS);
    
    console.log(`Starting nesting with ${parts.length} patterns in ${bins.length} bin(s)`);
    
    // Start packer with error handling in callbacks
    packer.start(bins, parts, config, {
      onEvaluation: (e) => {
        try {
          // Validate progress data
          if (e && typeof e.generation === 'number' && typeof e.progress === 'number') {
            nestingEvents.progress.do(e);
          }
        } catch (error: any) {
          console.error("onEvaluation callback error:", error);
          // Don't throw here, just log - we don't want to stop nesting for progress update errors
        }
      },
      onPacking: (e) => {
        try {
          if (e) {
            e.isLast = false;
            nestingEvents.packingResult.do(e);
          }
        } catch (error: any) {
          console.error("onPacking callback error:", error);
          // Don't throw here, just log
        }
      },
      onPackingCompleted: (e) => {
        try {
          // Clear timeout on completion
          if (nestingTimeoutId) {
            clearTimeout(nestingTimeoutId);
            nestingTimeoutId = null;
          }
          
          const elapsedTime = nestingStartTime ? (Date.now() - nestingStartTime) / 1000 : 0;
          console.log(`Nesting completed in ${elapsedTime.toFixed(2)} seconds`);
          
          if (e) {
            e.isLast = true;
            nestingEvents.packingResult.do(e);
          }
        } catch (error: any) {
          console.error("onPackingCompleted callback error:", error);
          nestingEvents.error.do(new Error(`Nesting completed but failed to process results: ${error.message || 'Unknown error'}`));
        }
      },
    });
    
  } catch (error: any) {
    // Clear timeout on error
    if (nestingTimeoutId) {
      clearTimeout(nestingTimeoutId);
      nestingTimeoutId = null;
    }
    
    console.error("nestingEvents.start error:", error);
    nestingEvents.error.do(new Error(`Failed to start nesting: ${error.message || 'Unknown error'}`));
    throw error;
  }
});

nestingEvents.stop.handle((_, result) => {
  try {
    // Clear timeout when manually stopped
    if (nestingTimeoutId) {
      clearTimeout(nestingTimeoutId);
      nestingTimeoutId = null;
    }
    
    console.log('Nesting stopped by user');
    packer.stop();
    result(true);
  } catch (error: any) {
    console.error("nestingEvents.stop error:", error);
    // Try to stop anyway
    try {
      packer.stop();
    } catch (e) {
      console.error("Failed to stop packer:", e);
    }
    result(false);
  }
});

// Add error event handler for nesting
nestingEvents.error.handle((error, result) => {
  console.error("Nesting error event received:", error);
  
  // Extract error message
  let errorMessage = "An unknown error occurred during nesting";
  if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === 'string') {
    errorMessage = error;
  }
  
  // Show error to user via toast
  toastError(`Nesting Error: ${errorMessage}`, 5000);
  
  // Clear timeout if it exists
  if (nestingTimeoutId) {
    clearTimeout(nestingTimeoutId);
    nestingTimeoutId = null;
  }
  
  // Result the error so other handlers can process it
  result(error);
});

_evtBus.on(_boardEvts.BoardSurface.onAskForNesting, () => {
  ppNesting();
});

// Helper functions
interface Point {
  x: number;
  y: number;
}

function getPerpendicularDistance(point: Point, start: Point, end: Point): number {
  const area = Math.abs((end.x - start.x) * (start.y - point.y) - (start.x - point.x) * (end.y - start.y));
  const bottom = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
  return area / bottom;
}

function _simplifyPolygon(points: Point[], tolerance: number): Point[] {
  if (points.length < 20) {
    return points;
  }

  const start = points[0];
  const end = points[points.length - 1];

  let maxDistance = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const distance = getPerpendicularDistance(points[i], start, end);
    if (distance > maxDistance) {
      index = i;
      maxDistance = distance;
    }
  }

  if (maxDistance > tolerance) {
    const leftPoints = simplifyPolygon(points.slice(0, index + 1), tolerance);
    const rightPoints = simplifyPolygon(points.slice(index), tolerance);

    return [...leftPoints.slice(0, -1), ...rightPoints];
  } else {
    return [start, end];
  }
}

function vector(p1: Point, p2: Point): Point {
  return { x: p2.x - p1.x, y: p2.y - p1.y };
}

function dotProduct(v1: Point, v2: Point): number {
  return v1.x * v2.x + v1.y * v2.y;
}

function crossProduct(v1: Point, v2: Point): number {
  return v1.x * v2.y - v1.y * v2.x;
}

function magnitude(v: Point): number {
  return Math.hypot(v.x, v.y);
}

function angleBetweenVectors(v1: Point, v2: Point): number {
  const dot = dotProduct(v1, v2);
  const mag1 = magnitude(v1);
  const mag2 = magnitude(v2);
  const cosTheta = dot / (mag1 * mag2);
  const clampedCosTheta = Math.max(-1, Math.min(1, cosTheta));
  return Math.acos(clampedCosTheta) * (180 / Math.PI);
}

function isConcave(p0: Point, p1: Point, p2: Point): boolean {
  const v1 = vector(p1, p0);
  const v2 = vector(p1, p2);
  const cross = crossProduct(v1, v2);
  return cross < 0;
}

function isAlmostStraight(p0: Point, p1: Point, p2: Point, angleTolerance: number): boolean {
  const v1 = vector(p0, p1);
  const v2 = vector(p1, p2);
  const angle = angleBetweenVectors(v1, v2);
  return Math.abs(angle - 180) <= angleTolerance;
}

function reducePoints(points: Point[], numPoints: number): Point[] {
  if (points.length <= numPoints) {
    return points.slice();
  }
  const reducedPoints: Point[] = [];
  const total = points.length;
  for (let i = 0; i < numPoints; i++) {
    const index = Math.floor(i * (total - 1) / (numPoints - 1));
    reducedPoints.push(points[index]);
  }
  return reducedPoints;
}

function simplifyPolygon(points: Point[], curveTolerance = 5, angleTolerance = 10): Point[] {
  const n = points.length;
  if (n < 3) return points.slice();

  const angles: number[] = [];
  const concavities: boolean[] = [];
  const straightness: boolean[] = [];

  for (let i = 0; i < n; i++) {
    const prevIndex = (i - 1 + n) % n;
    const nextIndex = (i + 1) % n;
    const p0 = points[prevIndex];
    const p1 = points[i];
    const p2 = points[nextIndex];

    const v1 = vector(p0, p1);
    const v2 = vector(p1, p2);
    const angle = angleBetweenVectors(v1, v2);
    const concave = false;
    const almostStraight = Math.abs(angle - 180) <= angleTolerance;

    angles[i] = angle;
    concavities[i] = concave;
    straightness[i] = almostStraight;
  }

  const resultPoints: Point[] = [];
  let i = 0;
  let pointsProcessed = 0;

  while (pointsProcessed < n) {
    if (concavities[i]) {
      const concavePoints: Point[] = [points[i]];
      let j = (i + 1) % n;
      pointsProcessed++;
      while (concavities[j] && pointsProcessed < n) {
        if (j === i) break;
        concavePoints.push(points[j]);
        j = (j + 1) % n;
        pointsProcessed++;
      }
      const reducedPoints = reducePoints(concavePoints, curveTolerance);
      resultPoints.push(...reducedPoints);
      i = j;
    } else if (straightness[i]) {
      const linePoints: Point[] = [points[i]];
      let j = (i + 1) % n;
      pointsProcessed++;
      while (straightness[j] && pointsProcessed < n) {
        if (j === i) break;
        linePoints.push(points[j]);
        j = (j + 1) % n;
        pointsProcessed++;
      }
      resultPoints.push(linePoints[0]);
      resultPoints.push(linePoints[linePoints.length - 1]);
      i = j;
    } else {
      resultPoints.push(points[i]);
      i = (i + 1) % n;
      pointsProcessed++;
    }
  }

  return resultPoints;
}

function internalAngle(pPrev: Point, pCurr: Point, pNext: Point): number {
  const v1 = { x: pPrev.x - pCurr.x, y: pPrev.y - pCurr.y };
  const v2 = { x: pNext.x - pCurr.x, y: pNext.y - pCurr.y };
  const cross = v1.x * v2.y - v1.y * v2.x;
  const dot = v1.x * v2.x + v1.y * v2.y;
  let angle = Math.atan2(cross, dot) * (180 / Math.PI);
  if (angle < 0) {
    angle += 360;
  }
  return angle;
}

function __simplifyPolygon(points: Point[], tolerance = 50): Point[] {
  const res = simplify(points, tolerance, false);
  return res;
}

} // end of mainRenderer()