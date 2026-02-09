import {mainRenderer} from "./rendererUpdate";
import { sFetch } from "./updateMain";
import { boardManager } from './cutboard/BoardManager';
import { surfaceCollection } from './data/repository/SurfaceCollection';
import {SurfaceData } from './data/repository/SurfaceData';
import { searchResults, currentPatternSelection, curProjectId } from './uof/Globals';
import { ppInfo } from './ui/controls/popup/Popup';
import { initToastContainer, toastError, toastSuccess } from './ui/controls/Toast/Toast';
import { themeManager } from './utils/ThemeManager';


/////////////////////////////////////////////////////
export interface IAppState {
  save: (state: any) => Promise<{ success: boolean; error?: string }>;
  load: () => Promise<{ success: boolean; state?: any; error?: string }>;
}

declare global {
  interface Window {
    appState: IAppState;
  }
}

// ========================================================================
// SETUP EVENT LISTENERS FOR POPUPS
// ========================================================================
function setupPopupListeners() {
  // Listen for error popups from main process
  if ((window as any).api?.onShowErrorPopup) {
    (window as any).api.onShowErrorPopup((data: { title: string; message: string }) => {
      ppInfo(data.title, data.message);
    });
  }

  // Listen for success popups from main process
  if ((window as any).api?.onShowSuccessPopup) {
    (window as any).api.onShowSuccessPopup((data: { title: string; message: string }) => {
      ppInfo(data.title, data.message);
    });
  }
}

// UNUSED: Commented out to avoid confusion - we're using ppInfo popups via setupPopupListeners()
// If you want to use toasts instead of popups, replace setupPopupListeners() with this function
/*
function setupToastListeners() {
  if ((window as any).api?.onShowErrorPopup) {
    (window as any).api.onShowErrorPopup((data: { title: string; message: string }) => {
      toastError(`${data.title}: ${data.message}`);
    });
  }

  if ((window as any).api?.onShowSuccessPopup) {
    (window as any).api.onShowSuccessPopup((data: { title: string; message: string }) => {
      toastSuccess(data.message);
    });
  }

  if ((window as any).api?.onPlotterError) {
    (window as any).api.onPlotterError((data: { error: string }) => {
      toastError(`Plotter Error: ${data.error}`);
    });
  }

  if ((window as any).api?.onPlotterSuccess) {
    (window as any).api.onPlotterSuccess(() => {
      toastSuccess("Cut sent successfully!");
    });
  }
}
*/ 
async function start() {
    // Initialize theme manager first
    themeManager.initialize();
    
    const loaded = await loadAppState();

    if (!loaded) {
      
      mainRenderer();
    }

    // Set up popup listeners after mainRenderer has initialized the UI
    setupPopupListeners();
    initToastContainer();
    window.addEventListener('beforeunload', saveAppState);
}

function gatherAppState() {
 
  const state = {
    boardManager: {
      boards: boardManager.boards.map(board => board.newBoard),
      currentBoardIndex: boardManager.currentBoardIndex,
    },
    surfaceCollection: {
      collection: surfaceCollection.collection.map(surface => surface.serialize()),
      selectedSurfaceDataIndex: surfaceCollection.selectedSurfaceDataIndex,
    },
    searchResults: Array.from(searchResults.entries()), 
    currentPatternSelection,
    curProjectId,
   
  };

  return state;
}


async function saveAppState() {
  const state = gatherAppState();
  await window.appState.save(state);
}
/**
 * @returns 
 */
function confirmRestoreDialog(): Promise<boolean> {
  return new Promise((resolve) => {
 
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.background = 'rgba(0, 0, 0, 0.7)';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.zIndex = '10000';
    overlay.style.fontFamily = 'Segoe UI, Arial, sans-serif';


    const dialog = document.createElement('div');
    dialog.style.background = '#fff';
    dialog.style.padding = '20px 40px';
    dialog.style.borderRadius = '8px';
    dialog.style.boxShadow = '0 5px 15px rgba(0,0,0,0.3)';
    dialog.style.textAlign = 'center';
    dialog.style.maxWidth = '400px';


    const title = document.createElement('h2');
    title.textContent = 'Restore Previous Session?';
    title.style.margin = '0 0 10px 0';
    title.style.color = '#333';


    const message = document.createElement('p');
    message.textContent = 'An unsaved session was found. Would you like to restore it?';
    message.style.margin = '0 0 20px 0';
    message.style.color = '#555';


    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'center';
    buttonContainer.style.gap = '15px';


    const restoreButton = document.createElement('button');
    restoreButton.textContent = 'Yes, Restore';
    
    const startFreshButton = document.createElement('button');
    startFreshButton.textContent = 'No, Start Fresh';
    

    [restoreButton, startFreshButton].forEach(button => {
        button.style.padding = '10px 20px';
        button.style.fontSize = '16px';
        button.style.border = 'none';
        button.style.borderRadius = '5px';
        button.style.color = '#fff';
        button.style.cursor = 'pointer';
    });

    restoreButton.style.background = '#0078D4'; 
    startFreshButton.style.background = '#6c757d'; 

 
    const cleanup = () => document.body.removeChild(overlay);

    restoreButton.onclick = () => {
      cleanup();
      resolve(true);
    };

    startFreshButton.onclick = () => {
      cleanup();
      resolve(false);
    };


    buttonContainer.appendChild(restoreButton);
    buttonContainer.appendChild(startFreshButton);
    dialog.appendChild(title);
    dialog.appendChild(message);
    dialog.appendChild(buttonContainer);
    overlay.appendChild(dialog);


    document.body.appendChild(overlay);
  });
}
/*
async function loadAppState(): Promise<boolean> {
  const { success, state, error } = await window.appState.load();

  if (!success || !state) {
    if (error) console.error('Failed to load app state:', error);
    return false;
  }


  const shouldRestore = await confirmRestoreDialog();
  if (!shouldRestore) {
      console.log("User chose not to restore the previous session.");
      return false; 
  }

  try {
    console.log("User chose to restore the session. Applying state...");

    if (state.boardManager) {
      boardManager.boards = state.boardManager.boards.map((boardData: any) => ({
        newBoard: boardData
      }));
      boardManager.currentBoardIndex = state.boardManager.currentBoardIndex;
    }


    if (state.surfaceCollection) {
      surfaceCollection.collection = state.surfaceCollection.collection.map((serializedData: string) => {
        const surfaceData = new SurfaceData();
        surfaceData.deserialize(serializedData);
        return surfaceData;
      });
      surfaceCollection.selectedSurfaceDataIndex = state.surfaceCollection.selectedSurfaceDataIndex;
    }


    if (state.searchResults) {
      searchResults.clear();
      for (const [key, value] of state.searchResults) {
        searchResults.set(key, value);
      }
    }


    Object.assign(currentPatternSelection, state.currentPatternSelection);
    Object.assign(curProjectId, state.curProjectId);

 
    mainRenderer();

    // Set up popup listeners after mainRenderer has initialized the UI
    // Note: Listeners already set up in start(), don't register again to avoid duplicates
    // setupPopupListeners();

    return true;
  } catch (loadError) {
    console.error("Error applying loaded state:", loadError);
    return false;
  }
}
*/

async function loadAppState(): Promise<boolean> {
  try {
    // Check if appState API is available
    if (!window.appState || !window.appState.load) {
      console.log('App state API not available yet - skipping state restoration');
      return false;
    }

    const { success, state, error } = await window.appState.load();

    if (!success || !state) {
      if (error) console.error('Failed to load app state:', error);
      return false;
    }


  const shouldRestore = await confirmRestoreDialog();
  if (!shouldRestore) {
      console.log("User chose not to restore the previous session.");
      return false; 
  }

  try {
    console.log("User chose to restore the session. Applying state...");

    if (state.boardManager) {
      boardManager.boards = state.boardManager.boards.map((boardData: any) => ({
        newBoard: boardData
      }));
      boardManager.currentBoardIndex = state.boardManager.currentBoardIndex;
    }


    if (state.surfaceCollection) {
      surfaceCollection.collection = state.surfaceCollection.collection.map((serializedData: string) => {
        const surfaceData = new SurfaceData();
        surfaceData.deserialize(serializedData);
        return surfaceData;
      });
      surfaceCollection.selectedSurfaceDataIndex = state.surfaceCollection.selectedSurfaceDataIndex;
    }


    if (state.searchResults) {
      searchResults.clear();
      for (const [key, value] of state.searchResults) {
        searchResults.set(key, value);
      }
    }


    Object.assign(currentPatternSelection, state.currentPatternSelection);
    Object.assign(curProjectId, state.curProjectId);

 
    mainRenderer();

    // Set up popup listeners after mainRenderer has initialized the UI
    // Note: Listeners already set up in start(), don't register again to avoid duplicates
    // setupPopupListeners();

    return true;
  } catch (loadError) {
    console.error("Error applying loaded state:", loadError);
    return false;
  }
  } catch (error: any) {
    // Handle IPC errors gracefully (e.g., when handler is not registered)
    console.warn('Could not load app state:', error.message || error);
    return false;
  }
}
////////////////////////////////////////////////////////////////////////
// Check if we're in bootstrap mode (version 3.2.25060000)
async function isBootstrapMode(): Promise<boolean> {
  const response = await (window as any).updater.isBootstrapMode();
  return response === true;
}


// Config initialization
(async () => {
const hasStartedMainApp = await (window as any).updater.hasStartedMainApp();
const shouldUpdate = await (window as any).updater.shouldUpdate();
const versionNumber = await (window as any).updater.versionNumber();
const canSkip = await (window as any).updater.canSkip();
const bootstrapMode = await isBootstrapMode();
const serverUnreachable = await (window as any).updater.isServerUnreachable();
console.log(`Renderer: hasStartedMainApp=${hasStartedMainApp}, shouldUpdate=${shouldUpdate}, versionNumber=${versionNumber}, canSkip=${canSkip}, isBootstrapMode=${bootstrapMode}, isServerUnreachable=${serverUnreachable}`);

// If main app has already started, skip update UI and go straight to main app
// This prevents infinite loop when main window loads after clicking "Start Anyway"
if (hasStartedMainApp || !shouldUpdate) {
  console.log('Loading main app (hasStartedMainApp or no update needed)');
  start(); 
} else {
// Fake Updater Page for mm-ui
// Create a simple overlay div
const overlay = document.createElement('div');
overlay.style.position       = 'fixed';
overlay.style.top            = '0';
overlay.style.left           = '0';
overlay.style.width          = '100vw';
overlay.style.height         = '100vh';
overlay.style.background     = 'rgba(0, 0, 0, 0.85)';
overlay.style.display        = 'flex';
overlay.style.flexDirection  = 'column';
overlay.style.justifyContent = 'center';
overlay.style.alignItems     = 'center';
overlay.style.zIndex         = '9999';

// Create a centered message element
const centerMessage = document.createElement('h1');
centerMessage.style.color        = '#fff';
centerMessage.style.textAlign    = 'center';
centerMessage.style.margin       = '20px 0 0 0';
centerMessage.style.fontWeight   = 'normal';
centerMessage.style.display      = 'none';
centerMessage.style.fontSize     = '24px';
centerMessage.style.fontFamily   = 'Segoe UI, Arial, sans-serif';
centerMessage.style.marginBottom = '20px';

// Add the centered message to the overlay (before message box)
overlay.appendChild(centerMessage);

// Exported function to set the centered message
function setCenteredMessage(text: string) {
  centerMessage.innerHTML = text.replace(/\n/g, '<br>');
  centerMessage.style.display = text ? 'block' : 'none';
}

// Create a fake update message
const message = document.createElement('div');
// Declare these variables outside to access them in functions
let progress: HTMLDivElement;
let progress2: HTMLDivElement;
let globalLabel: HTMLDivElement;
let fileLabel: HTMLDivElement;
let status: HTMLDivElement;
let title: HTMLHeadingElement;
message.style.background   = '#CDE7F2';
message.style.padding      = '40px 60px';
message.style.borderRadius = '20px';
message.style.boxShadow    = '0 4px 32px rgba(0,0,0,0.2)';
message.style.textAlign    = 'center';
message.style.fontFamily   = 'Segoe UI, Arial, sans-serif';

title = document.createElement('h2');
title.textContent        = 'Updating to version' + ' ' + versionNumber;
title.style.marginBottom = '20px';

// Global Progression label (bold, left-aligned)
globalLabel = document.createElement('div');
globalLabel.textContent = 'Global Progression';
globalLabel.style.fontWeight = 'bold';
globalLabel.style.textAlign = 'left';
globalLabel.style.width = '300px';
globalLabel.style.margin = '0 auto 4px auto';

progress = document.createElement('div');
progress.style.width        = '300px';
progress.style.height       = '16px';
progress.style.background   = '#e0e0e0';
progress.style.borderRadius = '8px';
progress.style.overflow     = 'hidden';
progress.style.margin       = '0 auto 20px auto';

const progressBar = document.createElement('div');
progressBar.style.height     = '100%';
progressBar.style.width      = '0%';
progressBar.style.background = '#0078D4';
progressBar.style.transition = 'width 0.3s';

progress.appendChild(progressBar);

// Add a second progress bar
const progressBar2 = document.createElement('div');
progressBar2.style.height     = '100%';
progressBar2.style.width      = '0%';
progressBar2.style.background = '#00B294'; // Different color for distinction
progressBar2.style.transition = 'width 0.3s';

progress2 = document.createElement('div');
progress2.style.width        = '300px';
progress2.style.height       = '16px';
progress2.style.background   = '#e0e0e0';
progress2.style.borderRadius = '8px';
progress2.style.overflow     = 'hidden';
progress2.style.margin       = '0 auto 20px auto';
progress2.appendChild(progressBar2);

status = document.createElement('div');
status.textContent     = 'Downloading update...';
status.style.marginTop = '10px';
status.style.fontSize  = '16px';

// Append all elements
message.appendChild(title);
message.appendChild(globalLabel); // Add global progression label before first bar
message.appendChild(progress);

// File label before the second progress bar
fileLabel = document.createElement('div');
fileLabel.textContent = 'File :';
fileLabel.style.fontWeight = 'bold';
fileLabel.style.textAlign = 'left';
fileLabel.style.width = '300px';
fileLabel.style.margin = '12px auto 4px auto';
message.appendChild(fileLabel);
message.appendChild(progress2); // Add the second progress bar below the first
message.appendChild(status);
overlay.appendChild(message);
document.body.appendChild(overlay);

// Check if server is unreachable and show special dialog
if (serverUnreachable) {
  showServerUnreachableDialog();
  return;
}

 if (bootstrapMode) {
   setCenteredMessage(`Welcome to Matmak precut solution.
   Please wait while the application is being installed.`);
 } else {
   setCenteredMessage(`Matmak precut solution needs to be updated before you can continue to use it.
   Please wait while the update is being installed.`);
 }

if (canSkip && !bootstrapMode) {
  const skipButton = document.createElement('button');
  skipButton.textContent        = 'Skip Update';
  skipButton.style.marginTop    = '20px';
  skipButton.style.padding      = '10px 24px';
  skipButton.style.fontSize     = '16px';
  skipButton.style.border       = 'none';
  skipButton.style.borderRadius = '6px';
  skipButton.style.background   = '#0078D4';
  skipButton.style.color        = '#fff';
  skipButton.style.cursor       = 'pointer';
  skipButton.style.transition   = 'background 0.2s';

  skipButton.addEventListener('mouseenter', () => {
    skipButton.style.background = '#005a9e';
  });
  skipButton.addEventListener('mouseleave', () => {
    skipButton.style.background = '#0078D4';
  });

  skipButton.onclick = async () => {
    // Close update window and properly start main app with all IPC handlers
    await (window as any).updater.startAppDirectly();
  };

  message.appendChild(skipButton);
} else {
  (async () => {// Start update and poll progress
  let downloadSuccessful = false;
  try {
    setUpdateStatus('Downloading update...');
    setUpdateProgress(0);
    setSecondProgress(0);
    // Run the default update first, then the zip update
    await runDefaultUpdate();
    downloadSuccessful = true;
    setUpdateStatus('Extracting update files...');
    setSecondProgress(0);
    await runZipUpdate();
    setUpdateStatus('Update completed successfully! Application will now shut down.');
    setSecondProgress(100);
    setTimeout(() => {
      // Remove the overlay and reload the page after a short delay
      (window as any).exitApp();
    }, 2000);
  } catch (error: any) {
    console.error('Update failed:', error);
    // Re-check bootstrap mode in case it changed
    const currentBootstrapMode = await (window as any).updater.isBootstrapMode();
    console.log(`Re-checked bootstrap mode: ${currentBootstrapMode} (was: ${bootstrapMode})`);
    
    // If download was successful but ZIP extraction failed, it's critical
    // In bootstrap mode, ALL errors are critical
    const isCriticalError = downloadSuccessful || currentBootstrapMode || bootstrapMode;
    console.log(`Update failed. downloadSuccessful: ${downloadSuccessful}, isBootstrapMode: ${bootstrapMode}, currentBootstrapMode: ${currentBootstrapMode}, isCriticalError: ${isCriticalError}`);
    await showUpdateErrorDialog(isCriticalError);
  }
})();
}

// Exported functions to control progress and status
function setUpdateProgress(percent: number) {
  const clamped = Math.max(0, Math.min(100, percent));
  progressBar.style.width = clamped + '%';
}

function setUpdateStatus(text: string) {
  status.textContent = text;
}

// Exported function to control the second progress bar
function setSecondProgress(percent: number) {
  const clamped = Math.max(0, Math.min(100, percent));
  progressBar2.style.width = clamped + '%';
}

// Exported function to set the filename in the file label
function setFileLabel(filename: string) {
  fileLabel.textContent = 'File : ' + filename;
}

// Function to show server unreachable dialog
function showServerUnreachableDialog() {
  // Hide progress bars and status
  progress.style.display = 'none';
  progress2.style.display = 'none';
  globalLabel.style.display = 'none';
  fileLabel.style.display = 'none';
  status.style.display = 'none';
  
  // Update title
  title.textContent = 'Connection Error';
  title.style.color = '#D83B01';
  
  // Create error message
  const errorMessage = document.createElement('div');
  errorMessage.style.marginBottom = '20px';
  errorMessage.style.fontSize = '16px';
  errorMessage.style.lineHeight = '1.5';
  errorMessage.innerHTML = `
    <p style="margin: 0 0 10px 0; color: #D83B01; font-weight: bold;">Cannot contact the update server.</p>
    <p style="margin: 0 0 10px 0;">The application may not work properly without checking for updates.</p>
    <p style="margin: 0;">Do you want to start anyway?</p>
  `;
  message.appendChild(errorMessage);
  
  // Create button container
  const buttonContainer = document.createElement('div');
  buttonContainer.style.display = 'flex';
  buttonContainer.style.gap = '10px';
  buttonContainer.style.justifyContent = 'center';
  buttonContainer.style.marginTop = '20px';
  
  // Exit button
  const exitButton = document.createElement('button');
  exitButton.textContent = 'Exit';
  exitButton.style.padding = '10px 24px';
  exitButton.style.fontSize = '16px';
  exitButton.style.border = 'none';
  exitButton.style.borderRadius = '6px';
  exitButton.style.background = '#D83B01';
  exitButton.style.color = '#fff';
  exitButton.style.cursor = 'pointer';
  exitButton.style.transition = 'background 0.2s';
  
  exitButton.addEventListener('mouseenter', () => {
    exitButton.style.background = '#A4262C';
  });
  exitButton.addEventListener('mouseleave', () => {
    exitButton.style.background = '#D83B01';
  });
  
  exitButton.onclick = () => {
    (window as any).exitApp();
  };
  
  // Start anyway button
  const startButton = document.createElement('button');
  startButton.textContent = 'Start Anyway';
  startButton.style.padding = '10px 24px';
  startButton.style.fontSize = '16px';
  startButton.style.border = 'none';
  startButton.style.borderRadius = '6px';
  startButton.style.background = '#0078D4';
  startButton.style.color = '#fff';
  startButton.style.cursor = 'pointer';
  startButton.style.transition = 'background 0.2s';
  
  startButton.addEventListener('mouseenter', () => {
    startButton.style.background = '#005a9e';
  });
  startButton.addEventListener('mouseleave', () => {
    startButton.style.background = '#0078D4';
  });
  
  startButton.onclick = async () => {
    // Close update window and properly start main app with all IPC handlers
    await (window as any).updater.startAppDirectly();
  };
  
  buttonContainer.appendChild(exitButton);
  buttonContainer.appendChild(startButton);
  message.appendChild(buttonContainer);
  
  // Update centered message
  setCenteredMessage('');
}

// Function to show error dialog when update fails
async function showUpdateErrorDialog(isCriticalError: boolean = false) {
  // Always get the latest bootstrap mode from main process
  const latestBootstrapMode = await (window as any).updater.isBootstrapMode();
  console.log(`showUpdateErrorDialog called: isCriticalError=${isCriticalError}, isBootstrapMode=${bootstrapMode}, latestBootstrapMode=${latestBootstrapMode}`);
  
  // Override if we're in bootstrap mode
  if (latestBootstrapMode) {
    isCriticalError = true;
    console.log('Forcing critical error because bootstrap mode is true');
  }
  
  // Hide progress bars and status
  progress.style.display = 'none';
  progress2.style.display = 'none';
  globalLabel.style.display = 'none';
  fileLabel.style.display = 'none';
  status.style.display = 'none';
  
  // Update title
  title.textContent = isCriticalError ? 'Critical Update Error' : 'Update Failed';
  title.style.color = '#D83B01';
  
  // Create error message
  const errorMessage = document.createElement('div');
  errorMessage.style.marginBottom = '20px';
  errorMessage.style.fontSize = '16px';
  errorMessage.style.lineHeight = '1.5';
  
  if (isCriticalError) {
    if (latestBootstrapMode) {
      errorMessage.innerHTML = `
        <p style="margin: 0 0 10px 0; color: #D83B01; font-weight: bold;">The application could not be installed.</p>
        <p style="margin: 0 0 10px 0;">The installer was unable to download the necessary files.</p>
        <p style="margin: 0;">Please download the full installer from our website.</p>
      `;
    } else {
      errorMessage.innerHTML = `
        <p style="margin: 0 0 10px 0; color: #D83B01; font-weight: bold;">The update files could not be installed properly.</p>
        <p style="margin: 0 0 10px 0;">The application may be in an inconsistent state and cannot start.</p>
        <p style="margin: 0;">Please download and reinstall the application from our website.</p>
      `;
    }
  } else {
    errorMessage.innerHTML = `
      <p style="margin: 0 0 10px 0;">The automatic update could not be completed.</p>
      <p style="margin: 0;">Please download the update manually from our website.</p>
    `;
  }
  message.appendChild(errorMessage);
  
  // Only show skip button if it's not a critical error AND not in bootstrap mode
  console.log(`Deciding whether to show skip button: isCriticalError=${isCriticalError}, latestBootstrapMode=${latestBootstrapMode}, global isBootstrapMode=${bootstrapMode}`);
  if (!isCriticalError && !latestBootstrapMode && !bootstrapMode) {
    // Create skip button
    const skipButton = document.createElement('button');
    skipButton.textContent = 'Continue Without Update';
    skipButton.style.marginTop = '20px';
    skipButton.style.padding = '10px 24px';
    skipButton.style.fontSize = '16px';
    skipButton.style.border = 'none';
    skipButton.style.borderRadius = '6px';
    skipButton.style.background = '#0078D4';
    skipButton.style.color = '#fff';
    skipButton.style.cursor = 'pointer';
    skipButton.style.transition = 'background 0.2s';
    
    skipButton.addEventListener('mouseenter', () => {
      skipButton.style.background = '#005a9e';
    });
    skipButton.addEventListener('mouseleave', () => {
      skipButton.style.background = '#0078D4';
    });
    
    skipButton.onclick = () => {
     // mainRenderer();
     start(); 
    };
    
    message.appendChild(skipButton);
  } else {
    // Add exit button for critical errors
    const exitButton = document.createElement('button');
    exitButton.textContent = 'Exit Application';
    exitButton.style.marginTop = '20px';
    exitButton.style.padding = '10px 24px';
    exitButton.style.fontSize = '16px';
    exitButton.style.border = 'none';
    exitButton.style.borderRadius = '6px';
    exitButton.style.background = '#D83B01';
    exitButton.style.color = '#fff';
    exitButton.style.cursor = 'pointer';
    exitButton.style.transition = 'background 0.2s';
    
    exitButton.addEventListener('mouseenter', () => {
      exitButton.style.background = '#A4262C';
    });
    exitButton.addEventListener('mouseleave', () => {
      exitButton.style.background = '#D83B01';
    });
    
    exitButton.onclick = () => {
      (window as any).exitApp();
    };
    
    message.appendChild(exitButton);
  }
  
  // Update centered message
  setCenteredMessage('');
}

// Poll update progress and update UI

// Poll default update progress and update UI
async function pollUpdateProgress() {
  let done = false;
  while (!done) {
    try {
      const info = await (window as any).updater.getUpdateProgressInfo();
      const fileName = (info.fileName || '').replace(/\\/g, '/').split('/').pop();
      setUpdateProgress(info.globalProgress / 2);
      setSecondProgress(info.fileProgress);
      setFileLabel(fileName || 'Unknown');
      if (info.globalProgress >= 100) done = true;
    } catch (e) {}
    if (!done) await new Promise(r => setTimeout(r, 200));
  }
}

// Run the default update (network-based)
async function runDefaultUpdate() {
  try {
    pollUpdateProgress();
    await (window as any).updater.installUpdate();
    setUpdateStatus('Installing update...');
    setSecondProgress(0);
  } catch (error: any) {
    console.error('Default update failed:', error);
    throw error;
  }
}

// Poll zip update progress and update UI
async function pollZipUpdateProgress() {
  let done = false;
  while (!done) {
    try {
      const info = await (window as any).updater.getZipUpdateProgress();
      const fileName = (info.file || '').replace(/\\/g, '/').split('/').pop();
      setUpdateProgress(50 + (info.progress / 2));
      setSecondProgress(100 * (info.filesDone / (info.totalFiles || 1)));
      setFileLabel(fileName || 'Unknown');
      if (info.progress >= 100) {
        done = true;
        setSecondProgress(100);
      }
    } catch (e) {}
    if (!done) await new Promise(r => setTimeout(r, 200));
  }
}

// Run the zip update (local zip extraction)
async function runZipUpdate() {
  try {
    setUpdateStatus('Extracting update files...');
    setSecondProgress(0);
    pollZipUpdateProgress();
    await (window as any).updater.instalZiplUpdate();
    setUpdateStatus('Update extracted!');
    setSecondProgress(100);
  } catch (error: any) {
    console.error('Zip update failed:', error);
    throw error;
  }
}





 }



})();
