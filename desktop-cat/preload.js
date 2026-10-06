'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const EVENTS = ['settings', 'stats', 'reminder', 'reminder-end', 'nag', 'say', 'come-here', 'toy-action'];

contextBridge.exposeInMainWorld('catApi', {
  cursor: () => ipcRenderer.invoke('cursor'),
  setThrough: on => ipcRenderer.send('mouse-through', on),
  getState: () => ipcRenderer.invoke('get-state'),
  answer: done => ipcRenderer.send('reminder-answer', done),
  petted: () => ipcRenderer.send('petted'),
  ready: () => ipcRenderer.send('pet-ready'),
  toyStatus: (id, state, msg) => ipcRenderer.send('toy-status', id, state, msg),
  restart: () => ipcRenderer.send('restart-app'),
  contextMenu: () => ipcRenderer.send('context-menu'),
  openSettings: () => ipcRenderer.send('open-settings'),
  saveSettings: patch => ipcRenderer.invoke('save-settings', patch),
  resetStats: () => ipcRenderer.invoke('reset-stats'),
  testReminder: () => ipcRenderer.send('test-reminder'),
  setPaused: p => ipcRenderer.send('set-paused', p),
  on: (channel, fn) => { if (EVENTS.includes(channel)) ipcRenderer.on(channel, (_e, data) => fn(data)); },
});
