require('dotenv').config({ path: require('path').resolve(__dirname, '..', '..', '.env') });
const connectDB = require('../config/db');
const User = require('../models/User');

const run = async () => {
  const { SUPERADMIN_NAME, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD } = process.env;
  if (!SUPERADMIN_NAME || !SUPERADMIN_EMAIL || !SUPERADMIN_PASSWORD) {
    throw new Error('Set SUPERADMIN_NAME, SUPERADMIN_EMAIL, and SUPERADMIN_PASSWORD before running this command.');
  }
  if (SUPERADMIN_PASSWORD.length < 8) throw new Error('SUPERADMIN_PASSWORD must contain at least 8 characters.');
  await connectDB();
  const existing = await User.findOne({ email: SUPERADMIN_EMAIL.toLowerCase() }).select('+password');
  if (existing && existing.role !== 'superadmin') throw new Error('The configured SUPERADMIN_EMAIL is already assigned to another role.');
  if (existing) {
    existing.name = SUPERADMIN_NAME;
    existing.password = SUPERADMIN_PASSWORD;
    existing.accountStatus = 'active';
    existing.refreshTokens = [];
    await existing.save();
    console.log(`Updated superadmin ${existing.email}`);
  } else {
    await User.create({ name: SUPERADMIN_NAME, email: SUPERADMIN_EMAIL, password: SUPERADMIN_PASSWORD, role: 'superadmin' });
    console.log(`Created superadmin ${SUPERADMIN_EMAIL}`);
  }
  process.exit(0);
};
run().catch((error) => { console.error(error.message); process.exit(1); });
