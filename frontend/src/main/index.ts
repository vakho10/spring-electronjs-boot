import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { spawn, type ChildProcess } from 'node:child_process'

type JavaProfile = 'dev' | 'stage'

const JAVA_PROFILE: JavaProfile = process.env['JAVA_PROFILE'] === 'stage' ? 'stage' : 'dev'

/** Fixed port the dev profile binds to (see application-dev.properties). */
const DEV_PORT = 8080

/** Give Spring Boot this long to print its handshake before we give up. */
const BACKEND_TIMEOUT_MS = 30_000

/** Keep the splash visible at least this long so it never just flickers by. */
const SPLASH_MIN_MS = 700

let mainWindow: BrowserWindow | null = null
let splashWindow: BrowserWindow | null = null
let javaProcess: ChildProcess | null = null

/** Base URL of the Spring Boot backend; set once the handshake completes. */
let backendUrl = ''

/** Preload is emitted as either .mjs or .js depending on the electron-vite version. */
function preloadPath(): string {
  const mjs = join(__dirname, '../preload/index.mjs')
  return existsSync(mjs) ? mjs : join(__dirname, '../preload/index.js')
}

/**
 * Resolves the `java` executable. A packaged build ships a trimmed runtime
 * under resources/runtime (see scripts/make-runtime.mjs), so prefer that;
 * otherwise fall back to JAVA_HOME, then `java` on PATH.
 */
function javaExecutable(): string {
  const exe = process.platform === 'win32' ? 'java.exe' : 'java'

  if (app.isPackaged) {
    const bundled = join(process.resourcesPath, 'runtime', 'bin', exe)
    if (existsSync(bundled)) return bundled
  }

  const home = process.env['JAVA_HOME']
  if (home) {
    const candidate = join(home, 'bin', exe)
    if (existsSync(candidate)) return candidate
  }

  return 'java'
}

/** Locates the backend jar, both in development and inside a packaged app. */
function jarPath(): string {
  if (app.isPackaged) return join(process.resourcesPath, 'app.jar')
  // out/main -> out -> frontend -> repo root -> backend/target/app.jar
  return join(__dirname, '../../../backend/target/app.jar')
}

/** Loads one of the renderer's HTML entries, from the dev server or disk. */
function loadRenderer(window: BrowserWindow, page: 'index' | 'splash'): void {
  const rendererUrl = process.env['ELECTRON_RENDERER_URL']
  if (rendererUrl) window.loadURL(page === 'index' ? rendererUrl : `${rendererUrl}/${page}.html`)
  else window.loadFile(join(__dirname, `../renderer/${page}.html`))
}

/** Frameless window shown immediately while Spring Boot starts up. */
function createSplashWindow(): void {
  splashWindow = new BrowserWindow({
    width: 360,
    height: 260,
    frame: false,
    resizable: false,
    movable: false,
    show: false,
    center: true,
    transparent: true,
    backgroundColor: '#00000000',
    title: 'spring-electronjs-boot',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  })

  splashWindow.removeMenu()
  loadRenderer(splashWindow, 'splash')
  splashWindow.once('ready-to-show', () => splashWindow?.show())
  splashWindow.on('closed', () => {
    splashWindow = null
  })
}

/**
 * Spawns the Spring Boot jar and resolves once it reports readiness over stdout.
 * stdout is the only IPC channel: `APP_PORT=<n>` (stage only) carries the
 * OS-assigned port, and `APP_READY` marks the server as up.
 */
function startBackend(): Promise<number> {
  const jar = jarPath()
  if (!existsSync(jar)) {
    return Promise.reject(
      new Error(
        `Backend jar not found at ${jar}.\nRun "mvn package -DskipTests" in backend/ first.`
      )
    )
  }

  const proc = spawn(javaExecutable(), ['-jar', jar, `--spring.profiles.active=${JAVA_PROFILE}`], {
    windowsHide: true
  })
  javaProcess = proc

  return new Promise<number>((resolve, reject) => {
    let resolved = false
    let reportedPort: number | null = null
    let buffer = ''

    const timer = setTimeout(() => {
      if (!resolved) reject(new Error('Timed out waiting for the backend to start.'))
    }, BACKEND_TIMEOUT_MS)

    const finish = (port: number): void => {
      if (resolved) return
      resolved = true
      clearTimeout(timer)
      resolve(port)
    }

    proc.stdout?.setEncoding('utf8')
    proc.stdout?.on('data', (chunk: string) => {
      buffer += chunk
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const portMatch = line.match(/APP_PORT=(\d+)/)
        if (portMatch) reportedPort = Number(portMatch[1])
        if (line.includes('APP_READY')) finish(reportedPort ?? DEV_PORT)
      }
    })

    proc.stderr?.setEncoding('utf8')
    proc.stderr?.on('data', (chunk: string) => console.error(`[java] ${chunk.trimEnd()}`))

    proc.on('error', (err) => {
      clearTimeout(timer)
      reject(new Error(`Failed to launch Java: ${err.message}`))
    })

    proc.on('exit', (code) => {
      if (!resolved) {
        clearTimeout(timer)
        reject(new Error(`Backend exited with code ${code} before signalling readiness.`))
      }
    })
  })
}

function createMainWindow(): void {
  const shownAt = Date.now()

  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    title: 'spring-electronjs-boot',
    // Stay hidden until the renderer is painted; the splash covers the gap.
    show: false,
    backgroundColor: '#1e1e2e',
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      // The preload only uses electron's contextBridge/ipcRenderer, and the
      // renderer never touches Node, so the sandbox can stay on.
      sandbox: true
    }
  })

  mainWindow.removeMenu()
  loadRenderer(mainWindow, 'index')

  mainWindow.once('ready-to-show', () => {
    const reveal = (): void => {
      splashWindow?.close()
      mainWindow?.show()
    }
    const elapsed = Date.now() - shownAt
    if (elapsed >= SPLASH_MIN_MS) reveal()
    else setTimeout(reveal, SPLASH_MIN_MS - elapsed)
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

/** Calls the backend and returns its JSON, surfacing failures to the renderer. */
async function callBackend(path: string, init?: RequestInit): Promise<{ message: string }> {
  const res = await fetch(`${backendUrl}${path}`, init)
  if (!res.ok) throw new Error(`Backend responded ${res.status}`)
  return (await res.json()) as { message: string }
}

ipcMain.handle('api:hello', () => callBackend('/api/hello'))
ipcMain.handle('api:greet', (_e, name: string) =>
  callBackend('/api/greet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  })
)

function stopBackend(): void {
  if (!javaProcess?.pid) {
    javaProcess = null
    return
  }
  if (process.platform === 'win32') {
    // /T also terminates any child the JVM spawned.
    spawn('taskkill', ['/pid', String(javaProcess.pid), '/T', '/F'], { windowsHide: true })
  } else {
    javaProcess.kill()
  }
  javaProcess = null
}

app.whenReady().then(async () => {
  createSplashWindow()
  try {
    backendUrl = `http://localhost:${await startBackend()}`
  } catch (err) {
    splashWindow?.close()
    dialog.showErrorBox('Backend failed to start', (err as Error).message)
    app.quit()
    return
  }
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  stopBackend()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => stopBackend())
