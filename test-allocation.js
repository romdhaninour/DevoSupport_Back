const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const envPath = path.join(process.cwd(), '.env');
const env = fs.readFileSync(envPath, 'utf8').split(/\r?\n/).reduce((acc, line) => {
  if (!line || line.startsWith('#')) return acc;
  const idx = line.indexOf('=');
  if (idx !== -1) acc[line.slice(0, idx)] = line.slice(idx + 1);
  return acc;
}, {});

const uri = env.MONGODB_URI;
const jwtSecret = env.JWT_SECRET || 'your-jwt-secret-key';
const apiUrl = 'http://localhost:3000';

async function run() {
  const consultantId = '6a4aa0daa27adbf49fa99b38';
  const deviceId = '6a4907e8dc299d05d033f38';
  const itId = '6a4aa32374f4ede4823c362b';
  const itToken = jwt.sign({ email: 'nourromdhani09@gmail.com', sub: itId, role: 'IT', status: 'active' }, jwtSecret, { expiresIn: '1h' });
  const consultantToken = jwt.sign({ email: 'nour.romdhani@esprit.tn', sub: consultantId, role: 'CONSULTANT', status: 'active' }, jwtSecret, { expiresIn: '1h' });

  console.log('IT_TOKEN', itToken);
  console.log('CONSULTANT_TOKEN', consultantToken);

  const res = await fetch(`${apiUrl}/devices/${deviceId}/allocate`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${itToken}`,
    },
    body: JSON.stringify({ consultantId }),
  });

  console.log('ALLOCATE STATUS', res.status);
  console.log('ALLOCATE BODY', await res.text());

  const assignedResConsultant = await fetch(`${apiUrl}/devices/assigned`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${consultantToken}` },
  });
  console.log('CONSULTANT ASSIGNED STATUS', assignedResConsultant.status);
  console.log('CONSULTANT ASSIGNED BODY', await assignedResConsultant.text());

  const assignedResIt = await fetch(`${apiUrl}/devices/assigned`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${itToken}` },
  });
  console.log('IT ASSIGNED STATUS', assignedResIt.status);
  console.log('IT ASSIGNED BODY', await assignedResIt.text());
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
