import fs from 'node:fs/promises'

const targetUrl = 'http://127.0.0.1:9232/json/list'
const targets = await fetch(targetUrl).then((response) => response.json())
const target = targets.find((item) => item.type === 'page' && item.url.includes('/windows/main/index.html'))
if (!target) throw new Error('Could not find the verified Cherry Studio main window target.')

const socket = new WebSocket(target.webSocketDebuggerUrl)
const pending = new Map()
let nextId = 0

socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data)
  const resolve = pending.get(message.id)
  if (resolve) {
    pending.delete(message.id)
    if (message.error) resolve(Promise.reject(new Error(message.error.message)))
    else resolve(message.result)
  }
})

await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true })
  socket.addEventListener('error', reject, { once: true })
})

async function command(method, params = {}) {
  const id = ++nextId
  const result = new Promise((resolve) => pending.set(id, resolve))
  socket.send(JSON.stringify({ id, method, params }))
  return result
}

async function evaluate(expression) {
  const result = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
  return result.result?.value
}

await command('Page.enable')
await command('Runtime.enable')
await new Promise((resolve) => setTimeout(resolve, 500))

const [action, value] = process.argv.slice(2)
if (action === 'snapshot') {
  const result = await evaluate(`JSON.stringify({
    title: document.title,
    url: location.href,
    text: document.body.innerText.slice(0, 8000),
    buttons: Array.from(document.querySelectorAll('button,[role="button"],a')).map((node) => ({
      role: node.getAttribute('role') || node.tagName.toLowerCase(),
      text: node.innerText?.trim().replace(/\\s+/g, ' ').slice(0, 80),
      aria: node.getAttribute('aria-label')
    })).filter((item) => item.text || item.aria).slice(0, 100)
  })`)
  process.stdout.write(result)
} else if (action === 'click') {
  const point = await evaluate(`(() => {
    const wanted = ${JSON.stringify(value)}
    const nodes = Array.from(document.querySelectorAll('button,[role="button"],a'))
    const node = nodes.find((item) => item.getAttribute('aria-label') === wanted || item.innerText?.trim().replace(/\\s+/g, ' ') === wanted)
    if (!node) return null
    const rect = node.getBoundingClientRect()
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
  })()`)
  if (!point) process.stdout.write('false')
  else {
    await command('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point })
    await command('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', buttons: 1, clickCount: 1 })
    await command('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', buttons: 0, clickCount: 1 })
    process.stdout.write('true')
  }
} else if (action === 'eval') {
  process.stdout.write(String(await evaluate(value ?? 'undefined')))
} else if (action === 'resize') {
  const [width, height] = (value ?? '1600x1000').split('x').map(Number)
  await evaluate(`window.resizeTo(${width}, ${height})`)
  process.stdout.write('resized')
} else if (action === 'screenshot') {
  const result = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
  await fs.writeFile(value, Buffer.from(result.data, 'base64'))
  process.stdout.write(value)
} else {
  throw new Error('Use snapshot, click <text>, eval <expression>, resize WxH, or screenshot <output-path>.')
}

socket.close()
