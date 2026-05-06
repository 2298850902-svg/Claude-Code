const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  loadSchedules: () => ipcRenderer.invoke('schedules:load'),
  saveSchedules: (schedules) => ipcRenderer.invoke('schedules:save', schedules),
});
