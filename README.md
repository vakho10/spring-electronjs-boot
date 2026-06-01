# spring-electronjs-boot

A proof of concept that an **Electron** desktop app can drive a **Spring Boot**
backend — calling Java over a localhost HTTP port.

- **Frontend** — Electron + Vite + TypeScript, no framework (`frontend/`)
- **Backend** — Spring Boot 4, packaged as a single jar (`backend/`)

The Electron main process spawns the Spring Boot jar, waits for it to announce
readiness over **stdout**, then opens the app window. The renderer never talks
to the network directly: it calls `window.api`, the preload bridges that to the
main process over IPC, and only the main process knows the backend's URL.

```
┌────────── Electron ──────────┐         ┌──── Spring Boot ────┐
│ renderer (plain TS + DOM)    │         │                     │
│   window.api.hello()         │         │  GET  /api/hello    │
│        │ contextBridge       │         │  POST /api/greet    │
│   preload  → ipcRenderer     │         │                     │
│        │ IPC                 │         └─────────▲───────────┘
│   main process ──────────────┼── fetch ──────────┘
│        │ spawn java -jar      │   localhost:<port>
└────────┼──────────────────────┘
         │ stdout: APP_PORT=<n> / APP_READY
```

## Versions

| Component     | Version            |
| ------------- | ------------------ |
| Spring Boot   | 4.0.6              |
| Java          | 21 (build & run)   |
| Electron      | 42                 |
| electron-vite | 5                  |
| Vite          | 7                  |

## Prerequisites

- JDK 21 or newer on `PATH` (or set `JAVA_HOME`)
- Node.js 20+ and npm
- Maven 3.9+

## Running (dev — fixed port 8080)

```bash
# 1. Build the backend jar once → backend/target/app.jar
cd backend
mvn package -DskipTests

# 2. Start the desktop app (spawns the jar, opens the window)
cd ../frontend
npm install
npm run dev
```

Click **Say Hello** to call `GET /api/hello`, or type a name and click
**Greet Me** to call `POST /api/greet`.

## Running (stage — random port)

```bash
cd frontend
npm run stage
```

In `stage` the backend binds to an OS-assigned free port (`server.port=0`) and
reports it back over stdout as `APP_PORT=<n>`; the main process reads it and
points the window at the right URL.

## stdout signal protocol

stdout is the **only** IPC channel from Java to Electron — application logs go
to `backend/logs/app.log`, and the Spring banner is disabled.

| Signal        | Profile    | Meaning                      |
| ------------- | ---------- | ---------------------------- |
| `APP_PORT=<n>`| stage only | OS-assigned port             |
| `APP_READY`   | both       | Spring Boot is up and serving|

## Project layout

```
spring-electronjs-boot/
├── backend/                         # Spring Boot (Maven)
│   └── src/main/
│       ├── java/io/github/vakho10/
│       │   ├── Application.java
│       │   ├── PortWriter.java      # emits APP_PORT / APP_READY to stdout
│       │   └── HelloController.java # /api/hello, /api/greet
│       └── resources/
│           ├── application.properties
│           ├── application-dev.properties    # server.port=8080
│           ├── application-stage.properties  # server.port=0
│           └── logback-spring.xml            # logs → file only
└── frontend/                        # Electron + Vite + TypeScript
    ├── electron.vite.config.ts
    └── src/
        ├── main/index.ts            # spawns jar, reads stdout, owns backend URL
        ├── preload/index.ts         # exposes window.api over contextBridge
        └── renderer/
            ├── index.html           # the UI markup (button, input, output)
            ├── splash.html          # shown while the backend starts
            └── src/
                ├── main.ts          # wires the buttons to window.api
                └── styles.css
```

## Scripts (frontend)

| Script              | What it does                          |
| ------------------- | ------------------------------------- |
| `npm run dev`       | Run the app, backend on port 8080     |
| `npm run stage`     | Run the app, backend on a random port |
| `npm run build`     | Build the renderer/main/preload bundles|
| `npm run typecheck` | `tsc --noEmit`                        |
| `npm run lint`      | ESLint                                |
| `npm run format`    | Prettier                              |

## Troubleshooting

| Problem                  | Fix                                                      |
| ------------------------ | -------------------------------------------------------- |
| "Backend jar not found"  | Run `mvn package -DskipTests` in `backend/` first        |
| Backend won't start      | Check `backend/logs/app.log`                             |
| Port never received      | Ensure `System.out.flush()` runs in `PortWriter`         |
| `java` not found         | Put JDK 21+ on `PATH`, or set `JAVA_HOME`                |
| White flash on startup   | The window stays hidden until `ready-to-show`; the splash covers the gap |
