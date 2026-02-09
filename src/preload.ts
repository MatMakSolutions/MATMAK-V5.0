// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';
import { TConfig } from "./core/Constant";


contextBridge.exposeInMainWorld('secureAPI', {
  getAppKey: (): Promise<string> => ipcRenderer.invoke('get-app-key')
});

contextBridge.exposeInMainWorld('updater', {
  shouldUpdate: (): Promise<boolean> => ipcRenderer.invoke('shouldUpdate'),
  versionNumber: (): Promise<string> => ipcRenderer.invoke('versionNumber'),
  canSkip: (): Promise<boolean> => ipcRenderer.invoke('canSkip'),
  isBootstrapMode: (): Promise<boolean> => ipcRenderer.invoke('isBootstrapMode'),
  isServerUnreachable: (): Promise<boolean> => ipcRenderer.invoke('isServerUnreachable'),
  hasStartedMainApp: (): Promise<boolean> => ipcRenderer.invoke('hasStartedMainApp'),
  installUpdate: (): Promise<void> => ipcRenderer.invoke('installUpdate'),
  getUpdateProgressInfo: (): Promise<{ globalProgress: number, fileName: string, fileProgress: number }> => ipcRenderer.invoke('getUpdateProgressInfo'),
  instalZiplUpdate: (): Promise<boolean> => ipcRenderer.invoke('instalZiplUpdate'),
  getZipUpdateProgress: (): Promise<{ progress: number, file: string, totalFiles: number, filesDone: number }> => ipcRenderer.invoke('getZipUpdateProgress'),
  startAppDirectly: (): Promise<void> => ipcRenderer.invoke('startAppDirectly'),
});

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object

// Expose minimize maimize and close for the main windows
contextBridge.exposeInMainWorld('minimize', () => ipcRenderer.send('minimize'));
contextBridge.exposeInMainWorld('maximize', () => ipcRenderer.send('maximize'));
contextBridge.exposeInMainWorld('restore', () => ipcRenderer.send('restore'));
contextBridge.exposeInMainWorld('forceMaximize', () => ipcRenderer.send('forceMaximize'));
contextBridge.exposeInMainWorld("sendCutToIp",(ip: string, port: string, hpgl: string) => ipcRenderer.invoke('sendCutToIp', { ip, port, hpgl}));
contextBridge.exposeInMainWorld("getConfig",() => ipcRenderer.invoke('getConfig', { }));
contextBridge.exposeInMainWorld("setConfig",(config: TConfig) => ipcRenderer.invoke('setConfig', config));

contextBridge.exposeInMainWorld("getPrinterList", () => ipcRenderer.invoke('getPrinterList', null));
contextBridge.exposeInMainWorld("sendCutToPrinter", (printerName: string, hpgl: string) => ipcRenderer.invoke('sendCutToPrinter', { printerName, hpgl}));
contextBridge.exposeInMainWorld("sendCutToSuma", (data: { message: string }) => ipcRenderer.invoke('sendCutToSuma', data));
///////comport function to expose /////////////////////////////////////////////////
 contextBridge.exposeInMainWorld("getPlotters", () => ipcRenderer.invoke('get-plotters'));
// Expose the cache set and get methods
contextBridge.exposeInMainWorld('cache', {
  set: (key: string, data: any) => ipcRenderer.invoke('cache:set', key, data),
  get: (key: string) => ipcRenderer.invoke('cache:get', key),
});

contextBridge.exposeInMainWorld('checkForUpdate', async (token: string, version: string) => {
    try {
      const isUpdateAvailable = await ipcRenderer.invoke('checkForUpdate', token, version);
      return isUpdateAvailable;
    } catch (error) {
      console.error('Failed to check for updates:', error);
      throw error;
    }
  }
);

contextBridge.exposeInMainWorld('installUpdate', async () => {
  try {
    await ipcRenderer.invoke('installUpdate');
  } catch (error) {
    console.error('Failed to install update:', error);
    throw error;
  }
}
);

contextBridge.exposeInMainWorld('updateProgress', async () => {
  try {
    return await ipcRenderer.invoke('updateProgress');
  } catch (error) {
    console.error('Failed to install update:', error);
    throw error;
  }
}
);

contextBridge.exposeInMainWorld('exitApp', async () => {
  await ipcRenderer.invoke('exitApp');
});

contextBridge.exposeInMainWorld('electronAPI', {
  storeCredentials: (creds: { email: string; password: string }) => ipcRenderer.invoke('store-credentials', creds),
  getCredentials: () => ipcRenderer.invoke('get-credentials'),
  clearCredentials: () => ipcRenderer.invoke('clear-credentials'),
  checkForUpdate: (token: string) => ipcRenderer.invoke('checkForUpdate', token),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  close: () => ipcRenderer.send('close'),

});

/////////////////////////
contextBridge.exposeInMainWorld('appState', {
  save: (state: any) => ipcRenderer.invoke('save-app-state', state),
  load: () => ipcRenderer.invoke('load-app-state'),
});

// ========================================================================
// IMPROVED IPC API EXPOSURE
// ========================================================================
contextBridge.exposeInMainWorld('api', {
  // Plotter communication
  sendCutToSuma: (data: { message: string }) => ipcRenderer.invoke('sendCutToSuma', data),
  sendCutToIp: (ip: string, port: string, hpgl: string) => ipcRenderer.invoke('sendCutToIp', { ip, port, hpgl }),

  // IPC health monitoring
  checkIpcHealth: () => ipcRenderer.invoke('checkIpcHealth'),
  restartIpc: () => ipcRenderer.invoke('restartIpc'),
  getIpcLogs: () => ipcRenderer.invoke('getIpcLogs'),

  // IPC event listeners
  onIpcReady: (callback: (data: { pid: number }) => void) => {
    ipcRenderer.on('ipc-ready', (_event, data) => callback(data));
  },
  onIpcFailed: (callback: (data: { reason: string; attempts: number }) => void) => {
    ipcRenderer.on('ipc-failed', (_event, data) => callback(data));
  },
  onPlotterError: (callback: (data: { error: string; timestamp: string }) => void) => {
    ipcRenderer.on('plotter-error', (_event, data) => callback(data));
  },
  onPlotterSuccess: (callback: (data: { timestamp: string }) => void) => {
    ipcRenderer.on('plotter-success', (_event, data) => callback(data));
  },
  onIpcMessage: (callback: (data: { message: string }) => void) => {
    ipcRenderer.on('ipc-message', (_event, data) => callback(data));
  },
  onShowErrorPopup: (callback: (data: { title: string; message: string }) => void) => {
    ipcRenderer.on('show-error-popup', (_event, data) => callback(data));
  },
  onShowSuccessPopup: (callback: (data: { title: string; message: string }) => void) => {
    ipcRenderer.on('show-success-popup', (_event, data) => callback(data));
  },

  // Remove event listeners
  removeIpcListener: (channel: string, callback: Function) => {
    ipcRenderer.removeListener(channel, callback as any);
  },
  removeAllIpcListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  }
});