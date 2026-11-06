const fs = require('fs')
const path = require('path')

async function main() {
  const target = (await (await fetch('http://127.0.0.1:9222/json/list')).json())
    .find((entry) => entry.type === 'page' && entry.url === 'http://localhost:5173/windows/main/index.html')
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
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true })
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
    return result.result.value
  }
  const wait = (duration = 800) => new Promise((resolve) => setTimeout(resolve, duration))
  const capture = async (theme, width, height, open) => {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
    await wait(1200)
    const state = await evaluate(`({width:innerWidth,height:innerHeight,dark:document.documentElement.classList.contains('dark'),panelOpen:!!document.querySelector('[aria-label^="Final answer"]') || !!document.querySelector('[role="dialog"][aria-label^="Final answer"]')})`)
    if (state.panelOpen !== open) throw new Error(`Panel state ${state.panelOpen} did not match expected ${open}: ${theme} ${width}`)
    const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    const output = path.resolve(`.context/ui-fiesta-answers/${theme}-${width}x${height}-${open ? 'open' : 'closed'}.png`)
    fs.writeFileSync(output, Buffer.from(screenshot.data, 'base64'))
    console.log(JSON.stringify({ output, ...state }))
    if (open) {
      const closed = await evaluate(`(() => { const button = [...document.querySelectorAll('button[aria-label="Close"]')].find((item) => item.getBoundingClientRect().x > innerWidth * 0.55 && item.getBoundingClientRect().y < 180); if (!button) throw new Error('Final answer close button not found'); button.click(); return true })()`)
      if (!closed) throw new Error('Could not close final answer')
      await wait(700)
    } else {
      await evaluate("window.dispatchEvent(new Event('ui-fiesta-open-final-answer'))")
      await wait(900)
    }
  }
  await evaluate("window.dispatchEvent(new Event('ui-fiesta-open-final-answer'))")
  await wait(700)
  const currentDark = await evaluate("document.documentElement.classList.contains('dark')")
  if (!currentDark) await evaluate("document.querySelector('button[aria-label=\"Dark mode\"]')?.click()")
  await wait(700)
  for (const [width, height] of [[1280, 800], [1920, 1080]]) {
    await capture('dark', width, height, true)
    await capture('dark', width, height, false)
  }
  await evaluate("document.querySelector('button[aria-label=\"Light mode\"]')?.click()")
  await wait(1000)
  for (const [width, height] of [[1280, 800], [1920, 1080]]) {
    await capture('light', width, height, true)
    await capture('light', width, height, false)
  }
  socket.close()
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
