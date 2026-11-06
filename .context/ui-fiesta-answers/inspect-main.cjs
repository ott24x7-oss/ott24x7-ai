const fs = require('fs')
const path = require('path')
async function main() {
  const targets = await (await fetch('http://127.0.0.1:9222/json/list')).json()
  const target = targets.find((entry) => entry.type === 'page' && entry.url === 'http://localhost:5173/windows/main/index.html')
  if (!target) throw new Error('Main renderer target not found')
  const socket = new WebSocket(target.webSocketDebuggerUrl)
  const pending = new Map()
  let nextId = 1
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    const resolver = pending.get(message.id)
    if (!resolver) return
    pending.delete(message.id)
    message.error ? resolver.reject(new Error(JSON.stringify(message.error))) : resolver.resolve(message.result)
  })
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++
    pending.set(id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
    return result.result.value
  }
  await send('Runtime.enable')
  await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false })
  await new Promise((resolve) => setTimeout(resolve, 2000))
  const details = await evaluate("JSON.stringify({title: document.title, width: innerWidth, height: innerHeight, headings: Array.from(document.querySelectorAll('h1,h2,h3,[role=heading]')).map((e) => e.innerText.trim()).filter(Boolean).slice(0, 30), buttons: Array.from(document.querySelectorAll('button')).map((e) => (e.getAttribute('aria-label') || e.innerText).trim()).filter(Boolean).slice(0, 80), text: document.body.innerText.slice(0, 2500)})")
  const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  const output = path.resolve('.context/ui-fiesta-answers/initial-dark-1280x800.png')
  fs.writeFileSync(output, Buffer.from(screenshot.data, 'base64'))
  console.log(JSON.stringify({ target: target.url, details: JSON.parse(details), screenshot: output }, null, 2))
  socket.close()
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
