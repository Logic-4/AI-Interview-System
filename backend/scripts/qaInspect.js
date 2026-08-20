require('dotenv').config({ path: require('path').resolve(__dirname, '..', '..', '.env') });
const mongoose = require('mongoose');
const Interview = require('../models/Interview');
const Question = require('../models/Question');
(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  for (const id of process.argv.slice(2)) {
    const iv = await Interview.findById(id).select('status generationStatus generationError questionsReady expectedQuestionCount overallScore firstQuestionReadyAt generationCompletedAt');
    console.log(`\n=== ${id} ===`);
    console.log(JSON.stringify(iv, null, 2));
    const qs = await Question.find({ interview: id }).sort({ order: 1 }).select('order evaluationStatus score isAnswered');
    qs.forEach((q) => console.log(` order=${q.order} status=${q.evaluationStatus} score=${q.score} answered=${q.isAnswered}`));
  }
  await mongoose.disconnect();
})();
