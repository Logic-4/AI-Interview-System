require('dotenv').config({ path: require('path').resolve(__dirname, '..', '..', '.env') });
const [, , id] = process.argv;
async function main() {
  const login = await fetch('http://localhost:5000/api/v1/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'mohamud.devx@gmail.com', password: 'Mohamud1234' }),
  }).then((r) => r.json());
  const token = login.data.accessToken;
  const t0 = Date.now();
  for (let i = 0; i < 90; i++) {
    const res = await fetch(`http://localhost:5000/api/v1/interviews/${id}/progress`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json());
    const iv = res.data.interview;
    const ready = (iv.questions || []).filter((q) => q.text).length;
    console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] status=${iv.generationStatus} ready=${ready}/${iv.expectedQuestionCount} questionsReady=${iv.questionsReady}`);
    if (iv.questionsReady) { console.log('DONE - resolved, not stuck'); return; }
    await new Promise((r) => setTimeout(r, 5000));
  }
  console.log('STILL NOT READY after 90 polls');
}
main();
