require('dotenv').config({ path: require('path').resolve(__dirname, '..', '..', '.env') });
const mongoose = require('mongoose');
const Question = require('../models/Question');
const Interview = require('../models/Interview');
(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const id = process.argv[2];
  const iv = await Interview.findById(id).select('generationStartedAt firstQuestionReadyAt generationCompletedAt jobRole focusSkills');
  console.log('generationStartedAt:', iv.generationStartedAt);
  console.log('firstQuestionReadyAt:', iv.firstQuestionReadyAt, `(+${(iv.firstQuestionReadyAt - iv.generationStartedAt) / 1000}s)`);
  console.log('generationCompletedAt:', iv.generationCompletedAt, `(+${(iv.generationCompletedAt - iv.firstQuestionReadyAt) / 1000}s for remaining)`);
  console.log(`TOTAL: ${(iv.generationCompletedAt - iv.generationStartedAt) / 1000}s`);
  const qs = await Question.find({ interview: id }).sort({ order: 1 }).select('order category text');
  qs.forEach((q) => console.log(`[${q.order}] (${q.category}) ${q.text}`));
  await mongoose.disconnect();
})();
