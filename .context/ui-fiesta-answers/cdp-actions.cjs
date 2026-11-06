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
  const expression = process.argv.slice(2).join(' ')
  const result = await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
    userGesture: true
  })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
  console.log(JSON.stringify(result.result.value))
  socket.close()
}
main().catch((error) => { console.error(error); process.exitCode = 1 })
