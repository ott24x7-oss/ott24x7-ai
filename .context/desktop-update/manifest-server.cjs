const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')

const root = __dirname
const server = http.createServer((request, response) => {
  const filename = request.url === '/forced' ? 'desktop-version-forced.json' : 'desktop-version-optional.json'
  response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
  response.end(fs.readFileSync(path.join(root, filename)))
})

server.listen(8766, '127.0.0.1', () => process.stdout.write(`Local update fixture listening on 127.0.0.1:8766 (pid ${process.pid})\n`))
