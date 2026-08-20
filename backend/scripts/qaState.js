require('dotenv').config({ path: require('path').resolve(__dirname, '..', '..', '.env') });
const mongoose = require('mongoose');
const Interview = require('../models/Interview');
const Question = require('../models/Question');
const Feedback = require('../models/Feedback');
const User = require('../models/User');
(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const rows = await Interview.find({})
    .select('_id user company title language status createdAt overallScore')
    .sort({ createdAt: -1 })
    .lean();
  const users = new Map(
    (await User.find({}).select('_id email').lean()).map((u) => [String(u._id), u.email])
  );
  for (const r of rows) {
    console.log(
      `${r._id} | ${users.get(String(r.user)) || r.user} | company=${r.company ? 'YES' : 'no'} | ${r.language} | ${r.status} | score=${r.overallScore} | ${new Date(r.createdAt).toISOString().slice(0, 16)} | ${r.title}`
    );
  }
  console.log('\ntotals -> interviews:', rows.length,
    'questions:', await Question.countDocuments(),
    'feedback:', await Feedback.countDocuments());
  await mongoose.disconnect();
})();
