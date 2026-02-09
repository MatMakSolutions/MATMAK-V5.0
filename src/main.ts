import { app, BrowserWindow, contextBridge, ipcRenderer, shell, nativeTheme, safeStorage, ipcMain } from 'electron';
import path from 'path';
import * as fs from "fs";
import net from 'net';
import { config as cfg, TConfig } from "./core/Constant";
import crypto from 'crypto';
import { ChildProcess } from 'child_process';

declare var MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare var MAIN_WINDOW_VITE_NAME: string;

// Helper function to deep merge objects
function deepMerge(target: any, source: any): any {
  const output = Object.assign({}, target);
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target))
          Object.assign(output, { [key]: source[key] });
        else
          output[key] = deepMerge(target[key], source[key]);
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  return output;
}

function isObject(item: any): boolean {
  return item && typeof item === 'object' && !Array.isArray(item);
}

// Helper function to get config file path
function getConfigPath(): string {
  return path.join(__dirname, '../../assets/config/config.json');
}

// Helper function to safely load config with defaults
function loadConfigSafely(configFilePath: string): TConfig {
  try {
    // Check if file exists
    if (!fs.existsSync(configFilePath)) {
      console.warn('Config file does not exist. Creating with defaults...');
      // Create directory if it doesn't exist
      const configDir = path.dirname(configFilePath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      // Write default config
      fs.writeFileSync(configFilePath, JSON.stringify(cfg, null, 2), 'utf-8');
      console.log('Created default config file at:', configFilePath);
      return cfg;
    }

    // Try to read and parse the config file
    const fileContent = fs.readFileSync(configFilePath, 'utf8');
    let loadedConfig: any;
    
    try {
      loadedConfig = JSON.parse(fileContent);
    } catch (parseError: any) {
      console.error('Failed to parse config.json:', parseError.message);
      console.log('Using default config and backing up corrupted file...');
      
      // Backup corrupted file
      const backupPath = configFilePath + '.corrupted.' + Date.now();
      fs.renameSync(configFilePath, backupPath);
      console.log('Backed up corrupted config to:', backupPath);
      
      // Write default config
      fs.writeFileSync(configFilePath, JSON.stringify(cfg, null, 2), 'utf-8');
      return cfg;
    }

    // Deep merge with defaults to ensure all required fields are present
    const mergedConfig = deepMerge(cfg, loadedConfig);
    
    // Validate critical fields
    if (typeof mergedConfig.boardLenght !== 'number' || mergedConfig.boardLenght <= 0) {
      console.warn('Invalid boardLenght in config, using default:', cfg.boardLenght);
      mergedConfig.boardLenght = cfg.boardLenght;
    }
    
    if (typeof mergedConfig.boardWidth !== 'number' || mergedConfig.boardWidth <= 0) {
      console.warn('Invalid boardWidth in config, using default:', cfg.boardWidth);
      mergedConfig.boardWidth = cfg.boardWidth;
    }

    // Validate nested objects
    if (!mergedConfig.nesting || typeof mergedConfig.nesting !== 'object') {
      console.warn('Invalid or missing nesting config, using defaults');
      mergedConfig.nesting = cfg.nesting;
    } else {
      // Ensure geneticAlgorithm exists
      if (!mergedConfig.nesting.geneticAlgorithm) {
        mergedConfig.nesting.geneticAlgorithm = cfg.nesting.geneticAlgorithm;
      }
      // Validate required nesting fields
      if (typeof mergedConfig.nesting.spaceBetweenParts !== 'number') {
        mergedConfig.nesting.spaceBetweenParts = cfg.nesting.spaceBetweenParts;
      }
      if (typeof mergedConfig.nesting.rotationSteps !== 'number') {
        mergedConfig.nesting.rotationSteps = cfg.nesting.rotationSteps;
      }
    }

    if (!mergedConfig.cut || typeof mergedConfig.cut !== 'object') {
      console.warn('Invalid or missing cut config, using defaults');
      mergedConfig.cut = cfg.cut;
    } else {
      // Ensure printer exists
      if (!mergedConfig.cut.printer) {
        mergedConfig.cut.printer = cfg.cut.printer;
      }
      if (!mergedConfig.cut.summa) {
        mergedConfig.cut.summa = cfg.cut.summa;
      }
      if (!mergedConfig.cut.network) {
        mergedConfig.cut.network = cfg.cut.network;
      }
      if (!mergedConfig.cut.COMPORT) {
        mergedConfig.cut.COMPORT = cfg.cut.COMPORT;
      }
      if (!mergedConfig.cut.usb) {
        mergedConfig.cut.usb = cfg.cut.usb;
      }
      // Set default cuttingProtocol to HPGL if empty
      if (!mergedConfig.cut.cuttingProtocol || mergedConfig.cut.cuttingProtocol === '') {
        mergedConfig.cut.cuttingProtocol = 'HPGL';
        console.log('Setting default cuttingProtocol to HPGL');
      }
      // Set other cut fields to defaults if empty
      if (mergedConfig.cut.swapAxis === '') {
        mergedConfig.cut.swapAxis = cfg.cut.swapAxis;
      }
      if (mergedConfig.cut.returntooringin === '') {
        mergedConfig.cut.returntooringin = cfg.cut.returntooringin;
      }
      if (mergedConfig.cut.feedaftercut === '') {
        mergedConfig.cut.feedaftercut = cfg.cut.feedaftercut;
      }
    }

    // Validate and set defaults for custom protocol
    if (!mergedConfig.custom || typeof mergedConfig.custom !== 'object') {
      mergedConfig.custom = cfg.custom;
    } else {
      // Set default protocol to HPGL if empty
      if (!mergedConfig.custom.protocol || mergedConfig.custom.protocol === '') {
        mergedConfig.custom.protocol = 'HPGL';
        console.log('Setting default custom protocol to HPGL');
      }
      // Set other custom fields to defaults if empty
      if (!mergedConfig.custom.plotterName) {
        mergedConfig.custom.plotterName = cfg.custom.plotterName;
      }
      if (!mergedConfig.custom.model) {
        mergedConfig.custom.model = cfg.custom.model;
      }
      if (!mergedConfig.custom.moveUp) {
        mergedConfig.custom.moveUp = cfg.custom.moveUp;
      }
      if (!mergedConfig.custom.moveDown) {
        mergedConfig.custom.moveDown = cfg.custom.moveDown;
      }
      if (!mergedConfig.custom.start) {
        mergedConfig.custom.start = cfg.custom.start;
      }
      if (!mergedConfig.custom.finish) {
        mergedConfig.custom.finish = cfg.custom.finish;
      }
    }

    // Save merged config back to file to persist any added defaults
    fs.writeFileSync(configFilePath, JSON.stringify(mergedConfig, null, 2), 'utf-8');
    
    return mergedConfig as TConfig;
  } catch (error: any) {
    console.error('Error loading config file:', error.message);
    console.log('Using default config values');
    return cfg;
  }
}

export function startApp() {

  const spawn = require('child_process').spawn;
  const { dialog, ipcMain } = require('electron');

  function tryRunUpdaterThenExit() {
    const root = process.cwd();
    const zipPath = path.join(root, 'updates', 'update.zip');
    const installerPath = path.join(root, 'updates', 'LocalInstaller.exe');

    if (fs.existsSync(zipPath)) {
      console.log('Update found. Launching LocalInstaller.exe...');

      const child = spawn(installerPath, [], {
        cwd: path.dirname(installerPath),
        detached: true,
        stdio: 'ignore',
        windowsHide: false
      });

      child.unref();
      app.quit();
    }
  }

  const keyPath = path.join(process.cwd(), 'key.txt');

  ipcMain.handle('get-app-key', async () => {
    try {
      const key = fs.readFileSync(keyPath, 'utf-8');
      return key.trim();
    } catch {
      const newKey = generateUUID();
      fs.writeFileSync(keyPath, newKey, 'utf-8');
      return newKey;
    }
  });

  function generateUUID(): string {
    if (crypto.randomUUID) return crypto.randomUUID();

    const bytes = crypto.randomBytes(16);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    return [...bytes].map((b, i) =>
      [4, 6, 8, 10].includes(i) ? `-${b.toString(16).padStart(2, '0')}` : b.toString(16).padStart(2, '0')
    ).join('');
  }

  const sendPipe = '\\\\.\\pipe\\MatMakCSNamedPipe';
  const listenPipe = '\\\\.\\pipe\\MatMakJSNamedPipe';

  // Handle creating/removing shortcuts on Windows when installing/uninstalling.
  if (require('electron-squirrel-startup')) {
    app.quit();
  }

  const IS_DEBUG = false;
  let IS_PROD = false;

  if (!IS_PROD) {
    const args = process.argv.slice(1);
    IS_PROD = args.includes('--prod');
  }

  if (IS_PROD) {
    console.log = () => { };
    console.error = () => { };
    console.warn = () => { };
    console.info = () => { };
  }

  // ========================================================================
  // IMPROVED IPC MANAGEMENT SYSTEM
  // ========================================================================

  interface IpcState {
    child: ChildProcess | null;
    server: net.Server | null;
    isReady: boolean;
    reconnectAttempts: number;
    maxReconnectAttempts: number;
    lockFilePath: string;
  }

  const IPC_READY_TIMEOUT = 5000;
  const RECONNECT_DELAY = 2000;

  const ipcState: IpcState = {
    child: null,
    server: null,
    isReady: false,
    reconnectAttempts: 0,
    maxReconnectAttempts: 5,
    lockFilePath: path.join(app.getPath('temp'), 'matmak-ipc.lock')
  };

  let logStream: fs.WriteStream | null = null;
  let cleanupHandlersRegistered = false;

  // Initialize logging
  function initializeLogging() {
    try {
      const logDir = path.join(app.getPath('userData'), 'logs');
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      const logFile = path.join(logDir, `ipc-${new Date().toISOString().split('T')[0]}.log`);
      logStream = fs.createWriteStream(logFile, { flags: 'a' });

      logIpc('=== IPC System Initialized ===');
    } catch (error) {
      console.error('Failed to initialize logging:', error);
    }
  }

  function logIpc(message: string, level: 'INFO' | 'WARN' | 'ERROR' = 'INFO') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}`;

    if (level === 'ERROR') {
      console.error(logMessage);
    } else if (level === 'WARN') {
      console.warn(logMessage);
    } else {
      console.log(logMessage);
    }

    if (logStream && !logStream.destroyed) {
      logStream.write(logMessage + '\n');
    }
  }

  // Check and create lock file to prevent multiple instances
  function acquireLock(): boolean {
    try {
      if (fs.existsSync(ipcState.lockFilePath)) {
        // Check if process is still running
        try {
          const pid = parseInt(fs.readFileSync(ipcState.lockFilePath, 'utf-8'));
          // Try to check if process exists (this will throw if it doesn't)
          process.kill(pid, 0);
          logIpc('Lock file exists and process is running', 'WARN');
          return false;
        } catch {
          // Process doesn't exist, remove stale lock
          fs.unlinkSync(ipcState.lockFilePath);
          logIpc('Removed stale lock file', 'INFO');
        }
      }

      // Create new lock file
      if (ipcState.child) {
        fs.writeFileSync(ipcState.lockFilePath, ipcState.child.pid?.toString() || '');
        logIpc(`Lock acquired with PID: ${ipcState.child.pid}`, 'INFO');
      }
      return true;
    } catch (error) {
      logIpc(`Failed to acquire lock: ${error}`, 'ERROR');
      return false;
    }
  }

  function releaseLock() {
    try {
      if (fs.existsSync(ipcState.lockFilePath)) {
        fs.unlinkSync(ipcState.lockFilePath);
        logIpc('Lock released', 'INFO');
      }
    } catch (error) {
      logIpc(`Failed to release lock: ${error}`, 'ERROR');
    }
  }

  // Improved startIpc function with comprehensive error handling
  async function startIpc(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      logIpc('Starting IPC server...', 'INFO');

      // Check if already running
      if (ipcState.child && !ipcState.child.killed) {
        logIpc('IPC server already running', 'INFO');
        resolve(true);
        return;
      }

      // Kill any existing processes
      cleanupIpc();

      const exePath = path.join(process.cwd(), 'sdk', 'ipcnet.exe');

      // Check if the exe exists
      if (!fs.existsSync(exePath)) {
        const error = `ipcnet.exe not found at: ${exePath}`;
        logIpc(error, 'ERROR');
        dialog.showErrorBox('IPC Server Error', error);
        reject(new Error(error));
        return;
      }

      try {
        let child: ChildProcess;

        if (!IS_DEBUG) {
          // Production mode: spawn normally with output capture
          child = spawn(exePath, [], {
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true,
            cwd: path.dirname(exePath)
          });

          // Log stdout/stderr for debugging
          child.stdout?.on('data', (data) => {
            const output = data.toString().trim();
            logIpc(`[ipcnet.exe] ${output}`, 'INFO');
          });

          child.stderr?.on('data', (data) => {
            const output = data.toString().trim();
            logIpc(`[ipcnet.exe ERROR] ${output}`, 'ERROR');
          });
        } else {
          // Debug mode: spawn in new window
          child = spawn('cmd.exe', ['/c', 'start', exePath], {
            detached: true,
            stdio: 'ignore',
            windowsHide: false,
            cwd: path.dirname(exePath)
          });
          child.unref();
        }

        ipcState.child = child;
        logIpc(`IPC process spawned with PID: ${child.pid}`, 'INFO');

        // Acquire lock
        if (!IS_DEBUG) {
          acquireLock();
        }

        // Handle process exit
        child.on('exit', (code, signal) => {
          logIpc(`ipcnet.exe exited with code ${code}, signal ${signal}`, code === 0 ? 'INFO' : 'ERROR');
          ipcState.isReady = false;
          releaseLock();

          // Attempt restart if unexpected exit
          if (code !== 0 && code !== null && ipcState.reconnectAttempts < ipcState.maxReconnectAttempts) {
            ipcState.reconnectAttempts++;
            logIpc(`Attempting to restart IPC server (attempt ${ipcState.reconnectAttempts}/${ipcState.maxReconnectAttempts})...`, 'WARN');

            setTimeout(() => {
              startIpc().catch((err) => {
                logIpc(`Failed to restart IPC server: ${err}`, 'ERROR');
              });
            }, RECONNECT_DELAY);
          } else if (ipcState.reconnectAttempts >= ipcState.maxReconnectAttempts) {
            logIpc('Max reconnection attempts reached', 'ERROR');
            dialog.showErrorBox(
              'IPC Server Failed',
              'The plotter communication service has crashed multiple times. Please restart the application.'
            );

            // Notify renderer
            notifyRenderer('ipc-failed', {
              reason: 'max_reconnect_attempts',
              attempts: ipcState.reconnectAttempts
            });
          }
        });

        // Handle spawn errors
        child.on('error', (error) => {
          logIpc(`Failed to start ipcnet.exe: ${error}`, 'ERROR');
          dialog.showErrorBox('IPC Server Error', `Failed to start plotter service: ${error.message}`);
          reject(error);
        });

        // Wait for process to be ready, then start listening
        setTimeout(async () => {
          try {
            await startReceiver();
            ipcState.isReady = true;
            ipcState.reconnectAttempts = 0;

            logIpc('IPC server ready', 'INFO');

            // Notify renderer
            notifyRenderer('ipc-ready', { pid: child.pid });

            resolve(true);
          } catch (error) {
            logIpc(`Failed to start receiver: ${error}`, 'ERROR');
            reject(error);
          }
        }, 1000);

        // Setup cleanup handlers (only once)
        if (!cleanupHandlersRegistered) {
          const cleanup = () => {
            logIpc('Application shutting down, cleaning up IPC...', 'INFO');
            cleanupIpc();
          };

          process.on('exit', cleanup);
          process.on('SIGINT', cleanup);
          process.on('SIGTERM', cleanup);
          process.on('beforeExit', cleanup);

          cleanupHandlersRegistered = true;
        }

      } catch (error) {
        logIpc(`Error in startIpc: ${error}`, 'ERROR');
        reject(error);
      }
    });
  }

  // Improved receive function with better error handling
  function startReceiver(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Close existing server if any
      if (ipcState.server) {
        try {
          ipcState.server.close();
          logIpc('Closed existing server', 'INFO');
        } catch (err) {
          logIpc(`Error closing existing server: ${err}`, 'WARN');
        }
        ipcState.server = null;
      }

      const server = net.createServer((connection) => {
        logIpc('IPC client connected', 'INFO');

        connection.on('data', (data) => {
          const message = data.toString().trim();
          logIpc(`IPC Received: ${message}`, 'INFO');

          // Handle new SUCCESS/ERROR format
          if (message.startsWith('SUCCESS') || message.startsWith('ERROR')) {
            // Call the response handler if it exists
            const handler = (global as any).__ipcResponseHandler;
            if (handler) {
              handler(message);
              delete (global as any).__ipcResponseHandler;
            }
            // Note: Notifications are shown by the sendCutToSuma handler, not here
            // This prevents duplicate popups
          }
          // Legacy format support
          else if (message === 'KO') {
            logIpc('Received error response from plotter (legacy format)', 'ERROR');
            dialog.showErrorBox(
              'Plotter Communication Error',
              'Failed to communicate with the plotter. Please check:\n' +
              '• Plotter is powered on\n' +
              '• USB cable is connected\n' +
              '• Plotter drivers are installed'
            );

            // Notify renderer process
            notifyRenderer('plotter-error', {
              error: 'Communication failed',
              timestamp: new Date().toISOString()
            });
          } else if (message === 'OK' || message === 'DONE') {
            logIpc('Plotter operation successful (legacy format)', 'INFO');
            notifyRenderer('plotter-success', {
              timestamp: new Date().toISOString()
            });
          } else {
            // Unknown message, log it
            logIpc(`Unknown IPC message: ${message}`, 'WARN');
            notifyRenderer('ipc-message', { message });
          }
        });

        connection.on('error', (error) => {
          logIpc(`IPC connection error: ${error}`, 'ERROR');
        });

        connection.on('end', () => {
          logIpc('IPC client disconnected', 'INFO');
        });
      });

      // Handle server errors
      server.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE') {
          logIpc(`Pipe ${listenPipe} is already in use. Retrying...`, 'WARN');

          // Try to clean up and retry
          setTimeout(() => {
            server.close();
            startReceiver().then(resolve).catch(reject);
          }, 1000);
        } else {
          logIpc(`IPC server error: ${error}`, 'ERROR');
          reject(error);
        }
      });

      server.listen(listenPipe, () => {
        logIpc(`IPC server listening on ${listenPipe}`, 'INFO');
        ipcState.server = server;
        resolve();
      });
    });
  }

  // Improved send function with validation, auto-start and retry logic
  async function send(message: string, timeout: number = 300000): Promise<void> {
    // Step 1: Check if ipcnet.exe is running
    const isProcessRunning = ipcState.child !== null && !ipcState.child.killed;
    
    if (!isProcessRunning || !ipcState.isReady) {
      logIpc('IPC process not running or not ready, attempting to start...', 'WARN');
      
      try {
        // Step 2: Try to start ipcnet.exe
        await startIpc();
        
        // Step 3: Wait a moment for it to fully initialize
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Step 4: Verify it's ready
        if (!ipcState.isReady) {
          logIpc('IPC failed to become ready after restart attempt', 'ERROR');
          
          // Show error popup to user via renderer
          notifyRenderer('show-error-popup', {
            title: 'Plotter Driver Not Responding',
            message: 'The plotter communication driver is not responding.\n\n' +
              'Please restart the application and try again.\n\n' +
              'If the problem persists, check that:\n' +
              '• ipcnet.exe exists in the sdk folder\n' +
              '• No antivirus is blocking the driver\n' +
              '• Windows has not quarantined the driver'
          });
          
          throw new Error('IPC driver not responding after restart attempt');
        }
        
        logIpc('IPC successfully started and ready', 'INFO');
      } catch (error) {
        logIpc(`Failed to start IPC: ${error}`, 'ERROR');
        
        // Show error popup to user via renderer
        notifyRenderer('show-error-popup', {
          title: 'Plotter Driver Not Responding',
          message: 'The plotter communication driver is not responding.\n\n' +
            'Please restart the application and try again.\n\n' +
            'If the problem persists, check that:\n' +
            '• ipcnet.exe exists in the sdk folder\n' +
            '• No antivirus is blocking the driver\n' +
            '• Windows has not quarantined the driver'
        });
        
        throw error;
      }
    }

    // Step 5: Now attempt to send the message
    return new Promise((resolve, reject) => {
      logIpc(`Sending message to IPC: ${message.substring(0, 100)}...`, 'INFO');

      const timeoutHandle = setTimeout(() => {
        client.destroy();
        const error = `IPC send timeout after ${timeout}ms`;
        logIpc(error, 'ERROR');
        
        // Show error popup for timeout via renderer
        notifyRenderer('show-error-popup', {
          title: 'Plotter Driver Not Responding',
          message: 'The plotter communication driver is not responding.\n\nPlease restart the application and try again.'
        });
        
        reject(new Error(error));
      }, timeout);

      const client = net.connect(sendPipe, () => {
        logIpc('Connected to IPC send pipe', 'INFO');
        clearTimeout(timeoutHandle);

        client.write(message, (err) => {
          if (err) {
            logIpc(`Error writing to IPC pipe: ${err}`, 'ERROR');
            reject(err);
          } else {
            logIpc('Successfully sent message to IPC pipe', 'INFO');
            resolve();
          }
          client.end();
        });
      });

      client.on('error', (error: NodeJS.ErrnoException) => {
        clearTimeout(timeoutHandle);
        logIpc(`IPC client error: ${error}`, 'ERROR');

        // Show error popup for connection failure via renderer
        notifyRenderer('show-error-popup', {
          title: 'Plotter Driver Not Responding',
          message: 'The plotter communication driver is not responding.\n\nPlease restart the application and try again.\n\nError: ' + error.message
        });

        reject(error);
      });

      client.on('end', () => {
        clearTimeout(timeoutHandle);
        logIpc('Disconnected from IPC send pipe', 'INFO');
      });
    });
  }


  // Cleanup function
  function cleanupIpc() {
    logIpc('Cleaning up IPC resources...', 'INFO');

    // Close server
    if (ipcState.server) {
      try {
        ipcState.server.close(() => {
          logIpc('Server closed', 'INFO');
        });
      } catch (err) {
        logIpc(`Error closing server: ${err}`, 'ERROR');
      }
      ipcState.server = null;
    }

    // Kill child process
    if (ipcState.child && !ipcState.child.killed) {
      try {
        ipcState.child.kill();
        logIpc('Child process killed', 'INFO');
      } catch (err) {
        logIpc(`Error killing child process: ${err}`, 'ERROR');
      }
      ipcState.child = null;
    }

    // Release lock
    releaseLock();

    ipcState.isReady = false;

    // Close log stream
    if (logStream && !logStream.destroyed) {
      logStream.end();
      logStream = null;
    }
  }

  // Helper to notify renderer process
  function notifyRenderer(channel: string, data: any) {
    try {
      const windows = BrowserWindow.getAllWindows();
      if (windows.length > 0) {
        windows[0].webContents.send(channel, data);
        logIpc(`Event sent to renderer on channel: ${channel}`, 'INFO');
      }
    } catch (error) {
      logIpc(`Failed to notify renderer on channel ${channel}: ${error}`, 'ERROR');
    }
  }

  // ========================================================================
  // IPC HANDLERS
  // ========================================================================

  // Updated sendCutToSuma handler with SUCCESS/ERROR response parsing
  ipcMain.handle('sendCutToSuma', async (_evt, data) => {
    try {
      logIpc('Sending cut command to plotter', 'INFO');

      // Validate data
      if (!data || !data.message) {
        throw new Error('Invalid cut data: message is missing');
      }

      logIpc(`Cut message: ${data.message.substring(0, 100)}...`, 'INFO');

      // Send with extended timeout for cutting operations (5 minutes for large files)
      await send(data.message + '\n', 300000);

      // Wait for response from IPC.NET
      const response = await new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Timeout waiting for cut response'));
        }, 310000); // Slightly longer than send timeout (5 minutes + 10 seconds)

        // Set up one-time listener for response
        const responseHandler = (message: string) => {
          clearTimeout(timeout);
          resolve(message);
        };

        // Store handler temporarily (will be called by receiver)
        (global as any).__ipcResponseHandler = responseHandler;
      });

      logIpc(`Cut response: ${response}`, 'INFO');

      // Parse response
      if (response.startsWith('SUCCESS')) {
        logIpc('Cut command sent successfully', 'INFO');
        
        // Show success notification
        notifyRenderer('show-success-popup', {
          title: 'Cut Successful',
          message: response.replace('SUCCESS: ', '')
        });

        return { 
          success: true, 
          message: response.replace('SUCCESS: ', '') 
        };
      } else if (response.startsWith('ERROR')) {
        const errorMsg = response.replace('ERROR: ', '');
        logIpc(`Cut failed: ${errorMsg}`, 'ERROR');

        // Show error notification
        notifyRenderer('show-error-popup', {
          title: 'Cut Failed',
          message: errorMsg
        });

        return {
          success: false,
          error: errorMsg
        };
      } else {
        // Unknown response format
        logIpc(`Unknown response format: ${response}`, 'WARN');
        return {
          success: false,
          error: `Unknown response: ${response}`
        };
      }
    } catch (error: any) {
      logIpc(`Failed to send cut command: ${error}`, 'ERROR');

      // Show error notification
      notifyRenderer('show-error-popup', {
        title: 'Cut Failed',
        message: error.message || 'Unknown error occurred'
      });

      return {
        success: false,
        error: error.message || 'Unknown error',
        details: error.toString()
      };
    }
  });

  // Health check handler
  ipcMain.handle('checkIpcHealth', async () => {
    const health = {
      isReady: ipcState.isReady,
      childRunning: ipcState.child !== null && !ipcState.child.killed,
      childPid: ipcState.child?.pid || null,
      reconnectAttempts: ipcState.reconnectAttempts,
      serverListening: ipcState.server !== null && ipcState.server.listening
    };

    logIpc(`Health check: ${JSON.stringify(health)}`, 'INFO');
    return health;
  });

  // Manual restart handler
  ipcMain.handle('restartIpc', async () => {
    try {
      logIpc('Manual IPC restart requested', 'INFO');
      cleanupIpc();
      await startIpc();
      return { success: true, message: 'IPC restarted successfully' };
    } catch (error: any) {
      logIpc(`Failed to restart IPC: ${error}`, 'ERROR');
      return { success: false, error: error.message };
    }
  });

  // Get IPC logs handler
  ipcMain.handle('getIpcLogs', async () => {
    try {
      const logDir = path.join(app.getPath('userData'), 'logs');
      const logFile = path.join(logDir, `ipc-${new Date().toISOString().split('T')[0]}.log`);

      if (fs.existsSync(logFile)) {
        const logs = fs.readFileSync(logFile, 'utf-8');
        return { success: true, logs };
      } else {
        return { success: false, error: 'Log file not found' };
      }
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // ========================================================================
  // EXISTING HANDLERS (PRESERVED)
  // ========================================================================

  ipcMain.handle('save-app-state', (event, state) => {
    try {
      const jsonState = JSON.stringify(state);
      const encryptedState = safeStorage.encryptString(jsonState);
      const appStatePath = path.join(app.getPath('userData'), 'MATMAK');
      fs.writeFileSync(appStatePath, new Uint8Array(encryptedState));
      return { success: true };
    } catch (error: any) {
      console.error('Failed to save encrypted app state:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('load-app-state', () => {
    try {
      const appStatePath = path.join(app.getPath('userData'), 'MATMAK');
      if (fs.existsSync(appStatePath)) {
        const encryptedState = fs.readFileSync(appStatePath);
        const jsonState = safeStorage.decryptString(encryptedState);
        const state = JSON.parse(jsonState);
        return { success: true, state };
      }
      return { success: true, state: null };
    } catch (error: any) {
      console.error('Failed to load encrypted app state:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('cache:set', async (event, key, data) => {
    const cacheDir = path.join(__dirname, '../../cache');
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    const cacheKey = Buffer.from(key).toString('base64');
    fs.writeFileSync(path.join(cacheDir, `${cacheKey}.json`), JSON.stringify(data, null, 2));
  });

  ipcMain.handle('cache:get', async (event, key) => {
    const cacheKey = Buffer.from(key).toString('base64');
    try {
      const data = fs.readFileSync(path.join(__dirname, `../../cache/${cacheKey}.json`), 'utf8');
      return JSON.parse(data);
    } catch (e) {
      return null;
    }
  });

  ipcMain.handle('store-credentials', async (_, { email, password }) => {
    try {
      const userDataPath = app.getPath('userData');
      const emailPath = path.join(userDataPath, 'm.bin');
      const passwordPath = path.join(userDataPath, 'd.bin');
      const encryptedEmail = email ? safeStorage.encryptString(email) : Buffer.from('');
      const encryptedPassword = password ? safeStorage.encryptString(password) : Buffer.from('');
      fs.writeFileSync(emailPath, new Uint8Array(encryptedEmail));
      fs.writeFileSync(passwordPath, new Uint8Array(encryptedPassword));
      return true;
    } catch (err: any) {
      throw new Error(`Failed to store credentials: ${err.message}`);
    }
  });

  ipcMain.handle('get-credentials', async () => {
    try {
      const userDataPath = app.getPath('userData');
      const emailPath = path.join(userDataPath, 'm.bin');
      const passwordPath = path.join(userDataPath, 'd.bin');
      if (fs.existsSync(emailPath) && fs.existsSync(passwordPath)) {
        const emailBuffer = fs.readFileSync(emailPath);
        const passwordBuffer = fs.readFileSync(passwordPath);
        const email = emailBuffer.length ? safeStorage.decryptString(emailBuffer) : '';
        const password = passwordBuffer.length ? safeStorage.decryptString(passwordBuffer) : '';
        return { email, password };
      }
      return { email: '', password: '' };
    } catch (err: any) {
      throw new Error(`Failed to retrieve credentials: ${err.message}`);
    }
  });

  ipcMain.handle('clear-credentials', async () => {
    try {
      const userDataPath = app.getPath('userData');
      const emailPath = path.join(userDataPath, 'm.bin');
      const passwordPath = path.join(userDataPath, 'd.bin');
      if (fs.existsSync(emailPath)) {
        fs.unlinkSync(emailPath);
      }
      if (fs.existsSync(passwordPath)) {
        fs.unlinkSync(passwordPath);
      }
      return true;
    } catch (err: any) {
      throw new Error(`Failed to clear credentials: ${err.message}`);
    }
  });

  ipcMain.handle('open-external', async (_, url) => {
    try {
      if (typeof url !== 'string' || !url.startsWith('https://')) {
        throw new Error('Invalid URL: Only HTTPS URLs are allowed');
      }
      await shell.openExternal(url);
      console.log('open-external: Opened URL:', url);
      return true;
    } catch (err: any) {
      console.error('open-external: Error:', err);
      throw new Error(`Failed to open URL: ${err.message}`);
    }
  });

  ipcMain.handle('get-plotters', async () => {
    const plottersFilePath = path.join(__dirname, '../../assets/config/plotters.json');
    try {
      const data = fs.readFileSync(plottersFilePath, 'utf8');
      return JSON.parse(data);
    } catch (error: any) {
      console.error(`Failed to read or parse plotters.json: ${error.message}`);
      return [];
    }
  });

  // Load config safely with validation and defaults
  const configPath = getConfigPath();
  const configFile = loadConfigSafely(configPath);

  cfg.boardLenght = configFile.boardLenght;
  cfg.boardWidth = configFile.boardWidth;
  cfg.nesting = configFile.nesting;
  cfg.cut = configFile.cut;

  // Update getConfig handler to use the safe loader
  ipcMain.handle('getConfig', async () => {
    const configPath = getConfigPath();
    return loadConfigSafely(configPath);
  });
  
  ipcMain.handle('setConfig', async (event, config) => {
    try {
      const configPath = getConfigPath();
      // Validate config before saving
      const validatedConfig = loadConfigSafely(configPath); // This will merge with loaded config
      // Deep merge the new config with existing
      const mergedConfig = deepMerge(validatedConfig, config);
      fs.writeFileSync(configPath, JSON.stringify(mergedConfig, null, 2), 'utf-8');
    } catch (error: any) {
      console.error('Failed to save config:', error.message);
      throw new Error(`Failed to save config: ${error.message}`);
    }
  });

  ipcMain.handle('getPrinterList', (event, url) => {
    return new Promise((r) => {
      console.log("Getting printer list");
      r(BrowserWindow.getAllWindows()[0].webContents.getPrintersAsync());
    });
  });

  ipcMain.on('minimize', () => BrowserWindow.getAllWindows()[0].minimize());
  
  ipcMain.on('maximize', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  });
  
  ipcMain.on('forceMaximize', () => {
    const win = BrowserWindow.getAllWindows()[0];
    win.maximize();
  });
  
  ipcMain.on('restore', () => BrowserWindow.getAllWindows()[0].unmaximize());
  ipcMain.on('close', () => BrowserWindow.getAllWindows()[0].close());

  // Update system handlers
  let version = "";
  let currentVersion = "";
  let files = [] as { source: string, target: string }[];
  let apiUrl = "";
  let config: { updateUrl: string, lastUpdate: string, checkForUpdate: boolean } | null = null;
  let percent = 0;
  let token = "";
  let versionChecker = "";

  ipcMain.handle('checkForUpdate_old', async (a, b, v) => {
    token = b;
    versionChecker = v;
    let configPath = path.join(process.cwd(), 'conf', 'config.json');
    config = require(configPath);

    if (!config.checkForUpdate) {
      return false;
    }

    apiUrl = config.updateUrl;
    const url = `${apiUrl}autoupdate/getUpdate`;
    console.log('Checking for update', url, {
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      }
    });
    const updateVersion = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token
      }
    });
    const result = await updateVersion.json();

    version = result.version;
    currentVersion = versionChecker;

    files = result.files;
    return version !== currentVersion;
  });

  ipcMain.handle('installUpdate_old', async () => {
    console.log('Installing update');
    let configPath = path.join(process.cwd(), 'conf', 'config.json');
    percent = 0;
    const maxFiles = files.length;
    let nbFiles = 0;
    for (const file of files) {
      const source = file.source;
      const target = file.target;
      const urlEncodedParam = encodeURIComponent(`${version}/${source}`);
      const sizeResponse = await fetch(`${apiUrl}autoupdate/GetSize?filePath=${urlEncodedParam}`, {
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + token
        }
      });
      const fileSize = await sizeResponse.json();
      console.log('Downloading file', source, 'to', target, 'size:', fileSize);
      const chunkSize = 1024 * 100;
      let startIndex = 0;
      let endIndex = chunkSize;
      const targetPath = path.join(process.cwd(), target);
      const targetDir = path.dirname(targetPath);

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const fileDescriptor = fs.openSync(targetPath, 'w');

      while (startIndex < fileSize) {
        const chunkResponse = await fetch(`${apiUrl}autoupdate/GetChunk?filePath=${urlEncodedParam}&startIndex=${startIndex}&endIndex=${endIndex}`, {
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token
          }
        });
        const chunkText = await chunkResponse.text();
        const decoded = Buffer.from(chunkText, 'base64');
        fs.writeSync(fileDescriptor, decoded as any, 0, decoded.length, startIndex);

        startIndex += chunkSize;
        endIndex += chunkSize;

        percent = Math.round((startIndex / fileSize) * 100);
        console.log('Downloading', percent, '%');
      }

      fs.closeSync(fileDescriptor);
      console.log('File downloaded: ', target);
      nbFiles++;
      percent = Math.round((nbFiles / maxFiles) * 100);
    }

    config!.lastUpdate = version;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log('Config updated');
  });

  ipcMain.handle('updateProgress', () => {
    return Math.min(percent, 100);
  });

  ipcMain.handle('sendCutToIp', async (_evt, data) => {
    try {
      logIpc(`Attempting to send cut to IP plotter at ${data.ip}:${data.port}`, 'INFO');
      const res = await sendHPGLToPlotter(data.ip, data.port, data.hpgl);
      
      if (res === null) {
        // Success
        logIpc(`Successfully sent cut to IP plotter at ${data.ip}:${data.port}`, 'INFO');
        
        // Show success popup to user
        notifyRenderer('show-success-popup', {
          title: 'Cut Sent Successfully',
          message: `Cut command sent successfully to plotter at ${data.ip}:${data.port}`
        });
        
        return { success: true, message: 'Cut command sent successfully' };
      } else {
        // Error occurred
        const errorMessage = res instanceof Error ? res.message : String(res);
        logIpc(`Failed to send cut to IP plotter: ${errorMessage}`, 'ERROR');
        
        // Show error popup to user
        notifyRenderer('show-error-popup', {
          title: 'Failed to Send Cut Command',
          message: `Could not connect to plotter at ${data.ip}:${data.port}\n\nError: ${errorMessage}\n\nPlease check:\n• Plotter is powered on\n• IP address and port are correct\n• Network connection is working`
        });
        
        return { success: false, error: errorMessage };
      }
    } catch (ex: any) {
      const errorMessage = ex.message || 'Unknown error';
      logIpc(`Exception while sending cut to IP plotter: ${errorMessage}`, 'ERROR');
      
      // Show error popup to user
      notifyRenderer('show-error-popup', {
        title: 'Failed to Send Cut Command',
        message: `An unexpected error occurred while sending to plotter.\n\nError: ${errorMessage}`
      });
      
      return { success: false, error: errorMessage };
    }
  });

  function sendHPGLToPlotter(ip: string, port: number, hpgl: string): Promise<Error | null> {
    return new Promise((resolve) => {
      let client: net.Socket;
      
      const timeout = setTimeout(() => {
        if (client) {
          client.destroy();
        }
        logIpc(`Connection to plotter at ${ip}:${port} timed out`, 'ERROR');
        resolve(new Error('Connection timeout - plotter did not respond within 5 minutes'));
      }, 300000); // 5 minute timeout for large files

      client = net.createConnection({ host: ip, port }, () => {
        clearTimeout(timeout);
        logIpc(`Connected to IP plotter at ${ip}:${port}`, 'INFO');
        
        client.write(hpgl, (err) => {
          if (err) {
            logIpc(`Error writing to IP plotter: ${err}`, 'ERROR');
            resolve(err);
          } else {
            logIpc('HPGL data written successfully to IP plotter', 'INFO');
            // Resolve immediately after successful write
            resolve(null);
          }
          client.end();
        });
      });

      client.on('end', () => {
        clearTimeout(timeout);
        logIpc('Disconnected from IP plotter', 'INFO');
      });

      client.on('error', (err) => {
        clearTimeout(timeout);
        logIpc(`Error connecting to IP plotter: ${err.message}`, 'ERROR');
        resolve(err);
      });
    });
  }

  // ========================================================================
  // CREATE WINDOW (ASYNC WITH IPC INITIALIZATION)
  // ========================================================================

  const createWindow = async () => {
    // Initialize logging first
    initializeLogging();

    try {
      // Start IPC first
      logIpc('Initializing IPC system...', 'INFO');
      await startIpc();
      logIpc('IPC started successfully', 'INFO');
    } catch (error: any) {
      logIpc(`Failed to start IPC: ${error}`, 'ERROR');
      
      // Show warning but continue
      const result = await dialog.showMessageBox({
        type: 'warning',
        title: 'Plotter Service Warning',
        message: 'Failed to start the plotter communication service. Direct USB plotter cutting may not work.',
        detail: error.message,
        buttons: ['Continue Anyway', 'Quit']
      });

      if (result.response === 1) {
        app.quit();
        return;
      }
    }

    // Create the browser window.
    const mainWindow = new BrowserWindow({
      width: 1536,
      height: 864,
      frame: true,
      autoHideMenuBar: true,
      resizable: true,
      title: "MATMAK ADVANCED PRECUT SOLUTIONS",
      backgroundColor: '#FFFFFF',
      titleBarStyle: 'default',
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        devTools: !IS_PROD
      },
    });

    mainWindow.maximize();

    if (IS_PROD) {
      mainWindow.webContents.on("devtools-opened", () => {
        mainWindow.webContents.closeDevTools();
      });

      mainWindow.webContents.on("before-input-event", (event, input) => {
        const ctrlOrCmd = process.platform === 'darwin' ? input.meta : input.control;
        if (
          ctrlOrCmd &&
          (input.key.toLowerCase() === 'i' || input.key === 'F12')
        ) {
          event.preventDefault();
        }
      });
    }

    // Load the app
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      console.log('Loading Vite dev server URL:', MAIN_WINDOW_VITE_DEV_SERVER_URL);
      mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL + "?route=");
    } else {
      mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
    }

    if (IS_DEBUG) {
      mainWindow.webContents.openDevTools();
    }
  };

  // ========================================================================
  // APP LIFECYCLE
  // ========================================================================

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  setTimeout(() => {
    createWindow();
  }, 500);
}
