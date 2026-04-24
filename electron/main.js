// electron/main.js
//
// Responsibility: orchestrate the two servers, then open the window.
// It does NOT contain any business logic — that stays in main.py / server.py.

const { app, BrowserWindow, shell } = require("electron")
const path = require("path")
const { spawn } = require("child_process")
const http = require("http")

const NEXT_PORT    = 3000
const FASTAPI_PORT = 8000
const DEV = process.env.NODE_ENV === "development"

let mainWindow
let nextServer
let pythonServer

// ── Generic HTTP readiness poller ─────────────────────────────────────────────
function waitForServer(url, retries = 40, delay = 500) {
  return new Promise((resolve, reject) => {
    const attempt = (n) => {
      http.get(url, (res) => {
        if (res.statusCode < 500) resolve()
        else if (n > 0) setTimeout(() => attempt(n - 1), delay)
        else reject(new Error(`Server never became ready: ${url}`))
      }).on("error", () => {
        if (n > 0) setTimeout(() => attempt(n - 1), delay)
        else reject(new Error(`Server never started: ${url}`))
      })
    }
    attempt(retries)
  })
}

// ── Start Next.js ─────────────────────────────────────────────────────────────
function startNextServer() {
  if (DEV) return Promise.resolve()   // already running via `next dev`

  const nextBin = path.join(__dirname, "../node_modules/.bin/next")
  const appDir  = path.join(__dirname, "..")

  nextServer = spawn(
    process.platform === "win32" ? `${nextBin}.cmd` : nextBin,
    ["start", "--port", String(NEXT_PORT)],
    { cwd: appDir, stdio: "inherit" }
  )

  return waitForServer(`http://localhost:${NEXT_PORT}`)
}

// ── Start FastAPI (via backend/server.py) ─────────────────────────────────────
function startPythonServer() {
  if (DEV) {
    // In dev, the developer runs `uvicorn main:app` manually.
    // We still poll the port so the window doesn't open before the API is up.
    return waitForServer(`http://localhost:${FASTAPI_PORT}`)
  }

  // In production the PyInstaller-compiled binary sits next to the .exe
  const backendExe = path.join(
    process.resourcesPath,          // Electron unpacks extras here
    "backend",
    process.platform === "win32" ? "server.exe" : "server"
  )

  pythonServer = spawn(backendExe, ["--port", String(FASTAPI_PORT)], {
    stdio: "ignore",
    ...(process.platform === "win32" && { windowsHide: true }),
  })

  pythonServer.on("error", (err) => {
    console.error("[electron] Failed to start Python backend:", err)
  })

  return waitForServer(`http://localhost:${FASTAPI_PORT}`)
}

// ── Create the BrowserWindow ──────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    title: "Process Mining Tool",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.loadURL(`http://localhost:${NEXT_PORT}`)

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: "deny" }
  })

  mainWindow.on("closed", () => { mainWindow = null })
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  try {
    // Boot both servers in parallel for faster startup
    await Promise.all([startNextServer(), startPythonServer()])
    createWindow()
  } catch (err) {
    console.error("[electron] Startup failed:", err)
    app.quit()
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on("window-all-closed", () => {
  if (nextServer)   nextServer.kill()
  if (pythonServer) pythonServer.kill()
  if (process.platform !== "darwin") app.quit()
})