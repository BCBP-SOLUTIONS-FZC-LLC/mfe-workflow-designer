import { createServer } from 'node:http'

const plans = {
  plans: [
    { code: 'starter', workflow_template_limit: 5 },
    { code: 'pro', workflow_template_limit: 50 },
    { code: 'enterprise' },
  ],
}

const server = createServer((req, res) => {
  const path = req.url?.split('?')[0]
  if (req.method === 'GET' && path === '/api/v1/internal/plans') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify(plans))
    return
  }
  res.writeHead(404, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ code: 'NOT_FOUND', detail: 'no route matches this method and path' }))
})

server.listen(8081, '0.0.0.0')
