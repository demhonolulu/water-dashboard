const express = require('express');
const app = express();

const PORT = 3000;

// IMPORTANT: allow JSON requests
app.use(express.json());

// Test route
app.get('/', (req, res) => {
  res.send('LAN server test 1');
});

// Example API route
app.get('/api/hello', (req, res) => {
  res.json({
    message: 'Hello from another device on the network!',
    time: new Date()
  });
});

// Example POST route
app.post('/api/data', (req, res) => {
  res.json({
    received: req.body,
    status: 'ok'
  });
});

// IMPORTANT: listen on all network interfaces
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});