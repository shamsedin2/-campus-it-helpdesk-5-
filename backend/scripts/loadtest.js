// Load test: 50 users at once hitting GET /api/tickets for 15 seconds.
// Start the API first (npm start), then: npm run loadtest
// Target from the project plan: 95th-percentile response time under 300 ms with 1,000+ tickets.
const autocannon = require('autocannon');
const URL = process.env.API_URL || 'http://localhost:4000';

(async () => {
  const res = await fetch(`${URL}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'tech@campus.edu', password: 'tech123' }),
  });
  const { token } = await res.json();
  const result = await autocannon({
    url: `${URL}/api/tickets?active=true`,
    connections: 50, duration: 15,
    headers: { Authorization: `Bearer ${token}` },
  });
  const l = result.latency;
  console.log(`Requests: ${result.requests.total}  Errors: ${result.errors + result.non2xx}`);
  console.log(`Latency  median ${l.p50} ms | p95 ~${l.p97_5 ? `${l.p90}–${l.p97_5}` : l.p90} ms | p99 ${l.p99} ms`);
  console.log(l.p97_5 < 300 ? 'PASS: p95 under 300 ms' : 'Check: p95 may be over 300 ms');
})();
