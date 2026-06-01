// Renderer entry point — plain TypeScript, no framework.
//
// The only way out of here is `window.api`, which the preload exposed over
// contextBridge. Each call is forwarded by IPC to the main process, which is
// the only place that knows where the Spring Boot backend is listening.

const helloButton = document.getElementById('hello') as HTMLButtonElement
const greetButton = document.getElementById('greet') as HTMLButtonElement
const nameInput = document.getElementById('name') as HTMLInputElement
const output = document.getElementById('output') as HTMLParagraphElement

/** Runs a backend call, showing its message (or any error) and disabling the UI. */
async function run(call: () => Promise<{ message: string }>): Promise<void> {
  helloButton.disabled = true
  greetButton.disabled = true
  try {
    const data = await call()
    output.textContent = data.message
  } catch (err) {
    output.textContent = `Error: ${(err as Error).message}`
  } finally {
    helloButton.disabled = false
    greetButton.disabled = false
  }
}

helloButton.addEventListener('click', () => run(() => window.api.hello()))
greetButton.addEventListener('click', () => run(() => window.api.greet(nameInput.value)))

// Enter in the name field triggers a greeting, like clicking the button.
nameInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') greetButton.click()
})
