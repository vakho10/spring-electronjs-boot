import { contextBridge, ipcRenderer } from 'electron'

export interface HelloMessage {
  message: string
}

/**
 * The surface exposed to the renderer as `window.api`. Every call is forwarded
 * over IPC to the main process, which owns the backend URL — the renderer never
 * learns the port or talks to the network directly.
 */
export interface Api {
  hello(): Promise<HelloMessage>
  greet(name: string): Promise<HelloMessage>
}

const api: Api = {
  hello: () => ipcRenderer.invoke('api:hello'),
  greet: (name) => ipcRenderer.invoke('api:greet', name)
}

contextBridge.exposeInMainWorld('api', api)
