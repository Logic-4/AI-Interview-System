require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');

async function run() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required');
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  const completed = await db.collection('questions').updateMany(
    { score: { $type: 'number' } },
    { $set: { evaluationStatus: 'completed' } }
  );
  const failed = await db.collection('questions').updateMany(
    {
      score: null,
      isAnswered: true,
      userAnswer: { $type: 'string', $ne: '' },
    },
    { $set: { evaluationStatus: 'failed' } }
  );
  const invalid = await db.collection('questions').updateMany(
    {
      score: null,
      isAnswered: true,
      $or: [
        { userAnswer: '' },
        { userAnswer: { $exists: false } },
        { userAnswer: { $regex: '^\\[(No |Transcription)', $options: 'i' } },
      ],
    },
    { $set: { evaluationStatus: 'invalid' } }
  );
  const pending = await db.collection('questions').updateMany(
    { evaluationStatus: { $exists: false } },
    { $set: { evaluationStatus: 'pending' } }
  );
  const interviews = await db.collection('interviews').updateMany({}, { $unset: { visualMetrics: '' } });
  const feedback = await db.collection('feedbacks').updateMany({}, { $unset: { visualMetrics: '' } });
  const users = await db.collection('users').updateMany({}, { $unset: { subscription: '' } });

  console.log(JSON.stringify({
    questions: {
      completed: completed.modifiedCount,
      failed: failed.modifiedCount,
      invalid: invalid.modifiedCount,
      pending: pending.modifiedCount,
    },
    cleaned: {
      interviews: interviews.modifiedCount,
      feedback: feedback.modifiedCount,
      users: users.modifiedCount,
    },
  }, null, 2));
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exitCode = 1;
});
