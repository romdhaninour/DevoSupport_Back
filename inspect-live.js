const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env');
const env = fs.readFileSync(envPath, 'utf8').split(/\r?\n/).reduce((acc, line) => {
  if (!line || line.startsWith('#')) return acc;
  const idx = line.indexOf('=');
  if (idx !== -1) {
    acc[line.slice(0, idx)] = line.slice(idx + 1);
  }
  return acc;
}, {});

const uri = env.MONGODB_URI;
if (!uri) {
  console.error('NO_URI');
  process.exit(1);
}

const deviceSchema = new mongoose.Schema({
  name: String,
  assignedTo: String,
  assignedAt: Date,
  assignedBy: String,
  status: String,
  email: String,
}, { collection: 'devices', strict: false });

const userSchema = new mongoose.Schema({
  email: String,
  role: String,
  isConsultant: Boolean,
}, { collection: 'users', strict: false });

const Device = mongoose.model('DeviceInspect', deviceSchema);
const User = mongoose.model('UserInspect', userSchema);

async function run() {
  await mongoose.connect(uri);

  const devices = await Device.find({}).limit(30).lean();
  const users = await User.find({ $or: [{ role: 'CONSULTANT' }, { role: 'IT' }] }).limit(30).lean();

  console.log('DEVICES_COUNT', devices.length);
  console.log('DEVICES', JSON.stringify(devices, null, 2));
  console.log('USERS_COUNT', users.length);
  console.log('USERS', JSON.stringify(users, null, 2));

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
