import { app, BrowserWindow, contextBridge, ipcMain } from 'electron';
import path from 'path';
import * as fs from "fs";
import net from 'net';
import AdmZip from 'adm-zip';

const TIMEOUT_REQUEST = 5000; // 30 seconds timeout for requests

type GetUserVersionByKey = {
  message: string;
  payload: {
    version: string;
    updateTo: string;
    canSkip?: boolean;
  };
  statusCode: number;
};

import crypto from 'crypto';
const spawn = require('child_process').spawn;

declare var MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare var MAIN_WINDOW_VITE_NAME: string;
const isDev = !true;//process.env.NODE_ENV === 'development';
let targetRootFolder = path.resolve(isDev ? "./fakeRoot/" : "./");

// Store reference to update window so we can close it when starting main app
let updateWindow: BrowserWindow | null = null;

// First we check for an update
const URL_UPDATE = 'https://backendapis.matmaksolutions.com/api/';
//const URL_UPDATE = 'http://localhost:8080/api/';

// function to generate a token where every 3rd character is a number from the current year month day like xx2xx0xx2xx5xx0xx6xx2xx4xx
// xx should be random numbers
// date should be full one 20250624 for june 24th 2025 should give xx2xx0xx2xx5xx0xx6xx2xx4xx
const generateVersionGUID = () => {
  const date = new Date();
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const dateStr = year + month + day; // e.g., 20250624

  let guid = '';
  for (const char of dateStr) {
    guid += Math.floor(Math.random() * 10).toString();
    guid += Math.floor(Math.random() * 10).toString();
    guid += char;
  }
  guid += Math.floor(Math.random() * 10).toString() + Math.floor(Math.random() * 10).toString();
  return Buffer.from(guid).toString('base64');
}


export const sFetch = async <T>(url: string, method: string, body: any, timeoutMs: number = TIMEOUT_REQUEST): Promise<T> => {
  const def = {
    method: method,
    headers: {
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(timeoutMs)
  } as any;

  if (body) {
    body.authToken = generateVersionGUID();
    def.body = JSON.stringify(body);
  }

  if (method.toLocaleLowerCase() === 'get') {
    // check if the url already has a query string
    if (url.includes('?')) {
      url += `&authToken=${generateVersionGUID()}`;
    } else {
      url += `?authToken=${generateVersionGUID()}`;
    }
  }

  const urlToCall = (URL_UPDATE + url).replace(/\/\//g, '/');

  console.log(`Fetching URL: ${urlToCall} with method: ${method} and body: ${JSON.stringify(body)}`);

  try {
    const res = await fetch(urlToCall, def);

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const json = await res.json();
    return json as T;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error(`Request timeout for ${urlToCall} after ${timeoutMs}ms`);
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    } else if (error.message.includes('fetch')) {
      console.error(`Network error for ${urlToCall}:`, error.message);
      throw new Error('Network error - unable to reach update server');
    } else {
      console.error(`Error fetching ${urlToCall}:`, error);
      throw error;
    }
  }
};

  function createWindow() {
    // Create the browser window.
    updateWindow = new BrowserWindow({
      width: 1536,
      height: 864,
      frame: false,
      // If IS_PROD is true we prevent the dev tools from being opened
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        devTools: true
      },
    });

    updateWindow.maximize();

    // and load the index.html of the app.
    //updateWindow.webContents.openDevTools();
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      updateWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    } else {
      updateWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
    }
  }

  app.on('ready', ()=> {
    checkForUpdate()
  });

let shouldUpdate = false;
let versionNumber = "";
let canSkip = true;
let updateFiles: { source: string, target: string }[] = [];
let globalAppKey = '';
let isBootstrapMode = false; // True when version is 3.2.25060000
let isServerUnreachable = false; // True when we can't contact the update server
let hasStartedMainApp = false; // Prevent infinite loop when transitioning to main app


async function checkForUpdate() {
  // Prevent re-running update check if we've already started the main app
  if (hasStartedMainApp) {
    console.log('Update check skipped - main app already started');
    return;
  }
  
  try {
    // Needs to check the version
    // try to get the key from local, if not present will create a new one
    const appKeyPath = path.resolve(path.join(".", 'appKey.txt'));
    console.log(`App Key Path: ${appKeyPath}`);
    // log if the app is running in dev mode or prod mode

    let appKey = '';
    if (fs.existsSync(appKeyPath)) {
      appKey = fs.readFileSync(appKeyPath, 'utf-8');
    } else {
      // Create appKey immediately
      appKey = crypto.randomBytes(16).toString('hex');
      fs.writeFileSync(appKeyPath, appKey);
      console.log('Created new appKey');

      // This is a new installation, so we're in bootstrap mode
      isBootstrapMode = true;
      console.log('New installation detected - bootstrap mode enabled');

      // Register new user with version 3.2.25060000
      try {
        const result = await sFetch<GetUserVersionByKey>(`userversion`, 'POST', {
          version: "3.2.25060003",
          key: appKey
        }, 10000);

        console.log(`Created new user version: ${JSON.stringify(result.payload, null, 2)}`);
        if (result.statusCode !== 201) {
          console.error(`Error creating user version: ${result.message}`);
          // In bootstrap mode, we MUST update - show update window even if registration fails
          shouldUpdate = true;
          versionNumber = "3.2.25060000"; // Default version to update to
          canSkip = false;
          globalAppKey = appKey;

          try {
            const updateContent = await sFetch<{ files: { source: string, target: string }[] }>(`autoupdate/getUpdate/${versionNumber}`, 'GET', null, 15000);
            updateFiles = updateContent.files;
            console.log(`Bootstrap mode - Update Files: ${JSON.stringify(updateFiles, null, 2)}`);
            createWindow();
          } catch (error) {
            console.error('Failed to fetch update content in bootstrap mode:', error);
            // Even if this fails, show the update window so user sees the error
            createWindow();
          }
          return;
        }
      } catch (error) {
        console.error('Failed to register new user version:', error);
        // In bootstrap mode, we MUST update - show update window
        shouldUpdate = true;
        versionNumber = "3.2.25060000"; // Default version for bootstrap
        canSkip = false;
        globalAppKey = appKey;

        // Even if we can't reach the server, show the update window
        createWindow();
        return;
      }
    }

    // check the api
    try {
      const currentVersion = await sFetch<GetUserVersionByKey>(`userversion/${appKey}`, 'GET', null, 10000);
      console.log(`Current Version: ${JSON.stringify(currentVersion.payload, null, 2)}`);

      if (currentVersion.statusCode !== 200) {
        console.error(`Error fetching user version: ${currentVersion.message}`);
        // If this is a 404, it means the user doesn't exist on the server
        // This could mean we're in bootstrap mode (never successfully updated)
        if (currentVersion.statusCode === 404) {
          console.error('User not found on server - assuming bootstrap mode');
          isBootstrapMode = true;
          shouldUpdate = true;
          canSkip = false; // Never allow skip in bootstrap mode
          versionNumber = "3.2.25060000"; // Default version to update to
          globalAppKey = appKey;
          createWindow();
          return;
        }
        // For other errors, we can't be sure, so allow normal startup
        console.warn('Cannot determine version due to network error - starting app normally');
        startAppDirectly();
        return;
      }

      // Check if we're in bootstrap mode (version 3.2.25060000)
      isBootstrapMode = currentVersion.payload.version === "3.2.25060000";
      console.log(`Bootstrap mode: ${isBootstrapMode} (current version: ${currentVersion.payload.version})`);

      shouldUpdate = !!currentVersion.payload.updateTo && (currentVersion.payload.version !== currentVersion.payload.updateTo);
      console.log(`Should Update: ${shouldUpdate}`);

      if (shouldUpdate) {
        globalAppKey = appKey;
        versionNumber = currentVersion.payload.updateTo;
        canSkip = currentVersion.payload.canSkip ?? true;
        // In bootstrap mode, never allow skipping
        if (isBootstrapMode) {
          canSkip = false;
        }

        try {
          const updateContent = await sFetch<{ files: { source: string, target: string }[] }>(`autoupdate/getUpdate/${versionNumber}`, 'GET', null, 15000);
          updateFiles = updateContent.files;
          console.log(`Update Files: ${JSON.stringify(updateFiles, null, 2)}`);
          createWindow();
        } catch (error) {
          console.error('Failed to fetch update content:', error);
          // If we're in bootstrap mode, show update window anyway
          if (isBootstrapMode) {
            console.error('Bootstrap mode: Showing update window despite fetch failure');
            createWindow();
          } else {
            // If we can't get update details in normal mode, start normally
            startAppDirectly();
          }
        }
      } else {
        startAppDirectly();
      }
    } catch (error) {
      console.error('Failed to check for updates:', error);
      // If we have an appKey but can't reach the server, show a special error
      console.error('Cannot reach update server - showing connection error dialog');
      isServerUnreachable = true;
      shouldUpdate = true;
      canSkip = true; // Allow user to decide
      globalAppKey = appKey;
      createWindow();
    }
  } catch (error) {
    console.error('Critical error in checkForUpdate:', error);
    // If we're in bootstrap mode, we can't start the app
    if (isBootstrapMode) {
      console.error('Bootstrap mode: Critical error - cannot start app');
      app.quit();
    } else {
      // Try to start the app
      startAppDirectly();
    }
  }
}

function startAppDirectly() {
  try {
    console.log('startAppDirectly called - loading main.js');
    
    // CRITICAL: Set flag to prevent infinite loop
    // When main window loads renderer.ts, it will check this flag
    // and skip the update UI even if shouldUpdate is true
    hasStartedMainApp = true;
    
    console.log('Set hasStartedMainApp=true to prevent infinite loop');
    
    // Load and call startApp from main.js
    // This will register all main app IPC handlers and create the main app window
    console.log('Calling startApp from main.js');
    const startApp = require(path.resolve(path.join(__dirname, "main.js"))).startApp;
    startApp();
    
    console.log('startApp called - main.js will create window in 500ms');
    
    // Hide update window immediately so user doesn't see both windows
    if (updateWindow && !updateWindow.isDestroyed()) {
      console.log('Hiding update window immediately');
      updateWindow.hide();
    }
    
    // IMPORTANT: Close update window AFTER main window is created
    // We need to wait for main.ts's setTimeout(createWindow, 500) to execute
    // AND for the window to be fully created before we can safely close update window
    setTimeout(() => {
      const allWindows = BrowserWindow.getAllWindows();
      console.log(`Total windows after main app start: ${allWindows.length}`);
      
      if (allWindows.length >= 1) {
        // At least one window exists (should be main window)
        if (updateWindow && !updateWindow.isDestroyed()) {
          console.log('Closing update window now');
          updateWindow.close();
          updateWindow = null;
        }
      } else {
        console.error('No windows exist! This should not happen.');
        // Show update window again as fallback
        if (updateWindow && !updateWindow.isDestroyed()) {
          updateWindow.show();
        }
      }
    }, 2000); // Wait 2 seconds to ensure main window is fully created
  } catch (error) {
    console.error('Failed to start app:', error);
    // Create a basic window as last resort
    createWindow();
  }
};


ipcMain.handle('shouldUpdate', async () => {
  return shouldUpdate;
});

ipcMain.handle('versionNumber', async () => {
  return versionNumber;
});

ipcMain.handle('canSkip', async () => {
  return canSkip;
});

ipcMain.handle('isBootstrapMode', async () => {
  return isBootstrapMode;
});

ipcMain.handle('isServerUnreachable', async () => {
  return isServerUnreachable;
});

ipcMain.handle('hasStartedMainApp', async () => {
  return hasStartedMainApp;
});

ipcMain.handle('startAppDirectly', async () => {
  startAppDirectly();
});

// Track file progress and name
let currentFileName = '';
let currentFileProgress = 0;

let pctUpdate = 0;

// --- ZIP Update Install Handler ---
let zipUpdateProgress = 0;
let zipUpdateCurrentFile = '';
let zipUpdateTotalFiles = 0;
let zipUpdateFilesDone = 0;

ipcMain.handle('instalZiplUpdate', async () => {
  try {
    const targetRootFolder = path.resolve(isDev ? "./fakeRoot/" : "./");
    const zipPath = path.join(targetRootFolder, 'updates', 'update.zip');
    if (!fs.existsSync(zipPath)) {
      throw new Error('update.zip not found');
    }
    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();
    zipUpdateTotalFiles = entries.length;
    zipUpdateFilesDone = 0;
    zipUpdateProgress = 0;
    for (const entry of entries) {
      if (entry.isDirectory) {
        // Ensure directory exists
        const dirPath = path.join(targetRootFolder, entry.entryName);
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }
        continue;
      }
      zipUpdateCurrentFile = entry.entryName;
      // Extract file to target
      const destPath = path.join(targetRootFolder, entry.entryName);
      const destDir = path.dirname(destPath);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      fs.writeFileSync(destPath, entry.getData() as any);
      zipUpdateFilesDone++;
      zipUpdateProgress = Math.round((zipUpdateFilesDone / zipUpdateTotalFiles) * 100);
    }
    zipUpdateProgress = 100;
    //zipUpdateCurrentFile = '';
    console.log(`Update extracted successfully: ${zipUpdateFilesDone}/${zipUpdateTotalFiles} files processed.`);

    // No need to save appKey here - it's already created at startup

    // Only update the version after SUCCESSFUL extraction
    // This ensures we don't mark an update as complete if extraction failed
    try {
      const result = await sFetch<GetUserVersionByKey>(`userversion`, 'PATCH', {
        version: versionNumber,
        key: globalAppKey
      }, 10000);

      // If user not found (404), create it with POST
      if (result.statusCode === 404) {
        console.log('User not found, creating new user version with POST');
        const createResult = await sFetch<GetUserVersionByKey>(`userversion`, 'POST', {
          version: versionNumber,
          key: globalAppKey
        }, 10000);
        console.log(`Created user version after successful installation: ${JSON.stringify(createResult.payload, null, 2)}`);
      } else {
        console.log(`Updated user version after successful installation: ${JSON.stringify(result.payload, null, 2)}`);
      }
    } catch (error) {
      console.error('Failed to update version after ZIP install:', error);
      // Don't throw - update was installed successfully
    }
    return true;
  } catch (e) {
    zipUpdateProgress = 0;
    zipUpdateCurrentFile = '';
    throw e;
  }
});

ipcMain.handle('getZipUpdateProgress', async () => {
  return {
    progress: zipUpdateProgress,
    file: zipUpdateCurrentFile,
    totalFiles: zipUpdateTotalFiles,
    filesDone: zipUpdateFilesDone
  };
});

ipcMain.handle('installUpdate', async () => {
  console.log('Installing update');
  // Install update
  currentFileName = '';
  currentFileProgress = 0;
  let configPath = path.join(process.cwd(), 'conf', 'config.json');
  pctUpdate = 0;
  const maxFiles = updateFiles.length;
  let nbFiles = 0;
  let fileDescriptor: number | null = null;

  try {
    for (const file of updateFiles) {
      const source = file.source;
      const target = file.target;
      const urlEncodedParam = encodeURIComponent(`${versionNumber}/${source}`);

      let fileSize: number;
      try {
        const sizeResponse = await sFetch<any>(`/autoupdate/GetSize?filePath=${urlEncodedParam}`, "GET", null, 15000);
        fileSize = sizeResponse;
      } catch (error) {
        console.error(`Failed to get file size for ${source}:`, error);
        throw new Error(`Unable to download update: Failed to get file size for ${source}`);
      }

      console.log('Downloading file', source, 'to', target, 'size:', fileSize);
      const chunkSize = 1024 * 100;
      let startIndex = 0;
      const targetPath = path.join(targetRootFolder, target);
      const targetDir = path.dirname(targetPath);

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      currentFileName = target;
      currentFileProgress = 0;

      try {
        fileDescriptor = fs.openSync(targetPath, 'w');
      } catch (error) {
        console.error(`Failed to create file ${targetPath}:`, error);
        throw new Error(`Unable to write update file: ${target}`);
      }

      let retryCount = 0;
      const maxRetries = 3;

      while (startIndex < fileSize) {
        const endIndex = Math.min(startIndex + chunkSize, fileSize);

        try {
          const chunkResponse = await sFetch<any>(
            `/autoupdate/GetChunk?filePath=${urlEncodedParam}&startIndex=${startIndex}&endIndex=${endIndex}`,
            "GET",
            null,
            TIMEOUT_REQUEST // 30 second timeout for chunks
          );

          // Expecting JSON: { chunk: base64, checksum: string }
          const chunkJson = chunkResponse;
          const chunkText = chunkJson.chunk;
          const expectedChecksum = chunkJson.checksum;
          const decoded = Buffer.from(chunkText, 'base64');
          // Calculate checksum (sha256 hex)
          const actualChecksum = crypto.createHash('sha256').update(decoded as any).digest('hex');
          console.log(`Chunk checksum for ${startIndex} to ${endIndex}: expected ${expectedChecksum}, got ${actualChecksum}`);
          if (actualChecksum !== expectedChecksum) {
            fs.closeSync(fileDescriptor);
            fileDescriptor = null;
            throw new Error(`Checksum mismatch for chunk at offset ${startIndex}: expected ${expectedChecksum}, got ${actualChecksum}`);
          }
          fs.writeSync(fileDescriptor, decoded as any, 0, decoded.length, startIndex);
          startIndex += decoded.length;
          retryCount = 0; // Reset retry count on success

          // File progress (0-100), monotonic
          let filePct = Math.min(100, Math.max(0, Math.round((Math.min(startIndex, fileSize) / fileSize) * 100)));
          if (filePct < currentFileProgress) filePct = currentFileProgress; // never regress
          currentFileProgress = filePct;
          // Global progress (0-100), monotonic and accurate
          let globalPct = Math.min(100, Math.max(0, Math.round(((nbFiles + (Math.min(startIndex, fileSize) / fileSize)) / maxFiles) * 100)));
          if (globalPct < pctUpdate) globalPct = pctUpdate; // never regress
          pctUpdate = globalPct;
          // Log for debug
          // console.log('Downloading', pctUpdate, '%', 'File:', currentFileName, 'File progress:', currentFileProgress);
        } catch (error: any) {
          retryCount++;
          console.error(`Error downloading chunk ${startIndex}-${endIndex} (attempt ${retryCount}/${maxRetries}):`, error);

          if (retryCount >= maxRetries) {
            if (fileDescriptor !== null) {
              fs.closeSync(fileDescriptor);
              fileDescriptor = null;
            }
            // Try to clean up partial file
            try {
              fs.unlinkSync(targetPath);
            } catch (e) {
              // Ignore cleanup errors
            }
            throw new Error(`Failed to download update after ${maxRetries} attempts: ${error.message}`);
          }

          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
        }
      }

      if (fileDescriptor !== null) {
        fs.closeSync(fileDescriptor);
        fileDescriptor = null;
      }
      console.log('File downloaded: ', target);
      nbFiles++;
      pctUpdate = Math.max(pctUpdate, Math.round((nbFiles / maxFiles) * 100));
      currentFileProgress = 100;
    }

    // DO NOT update version here - only update after successful ZIP extraction
  } catch (error) {
    // Clean up any open file descriptors
    if (fileDescriptor !== null) {
      try {
        fs.closeSync(fileDescriptor);
      } catch (e) {
        // Ignore cleanup errors
      }
    }

    // Reset progress
    currentFileName = '';
    currentFileProgress = 0;
    pctUpdate = 0;

    throw error;
  }
});

// IPC handle to get update progress info
ipcMain.handle('getUpdateProgressInfo', async () => {
  return {
    globalProgress: pctUpdate,
    fileName: currentFileName,
    fileProgress: currentFileProgress
  };
});


ipcMain.handle('exitApp', async () => {
  app.quit();
});