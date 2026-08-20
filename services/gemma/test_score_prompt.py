"""Self-check for the notebook's scoring prompt.

Extracts cell 4 from Colab_Gemma_LLM_Server_update.ipynb, stubs out the model
and tokenizer, and asserts the prompt the model actually receives is free of
the two defects that were confirmed from real stored interviews:

  * a literal example score (the old schema showed `"score": 78`, and real
    answers of very different quality all came back at or beside 78);
  * a field description used as a placeholder VALUE (the old schema showed
    `"feedback": "specific, actionable, explains why"`, which the model copied
    verbatim, so candidates were shown that string as their AI feedback).

Run:  python test_score_prompt.py
"""
import io
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
NOTEBOOK = os.path.join(HERE, 'Colab_Gemma_LLM_Server_update.ipynb')


class _StubTokenizer:
    """apply_chat_template just concatenates, so we can read the real prompt."""

    eos_token_id = 0

    def apply_chat_template(self, messages, tokenize=False, add_generation_prompt=True):
        return '\n'.join(m['content'] for m in messages)


def load_cell4_namespace():
    nb = json.load(io.open(NOTEBOOK, encoding='utf-8'))
    src = ''.join(nb['cells'][4]['source'])
    # Keep only the pure prompt-building helpers: everything from the imports
    # down to TASK_MAP. The rest boots uvicorn/ngrok and needs a live GPU.
    cut = src.index('TASK_MAP = {')
    src = src[:cut]
    # Drop the notebook-only imports that need the serving stack installed.
    src = '\n'.join(
        line for line in src.splitlines()
        if not re.match(r'\s*(import uvicorn|from fastapi|from pydantic|from pyngrok|from transformers|from threading)', line)
    )
    src = src.replace('conf.get_default().auth_token = NGROK_TOKEN', '')
    src = src.replace("app = FastAPI(title='Gemma 4 Tech Interviewer API')", '')
    # StoppingCriteria is only used as a base class here; a plain object works.
    ns = {'StoppingCriteria': object, 'json': json, 're': re, 'os': os,
          'tokenizer': _StubTokenizer(), 'torch': None, 'model': None,
          'BaseModel': object}
    exec(compile(src, 'cell4', 'exec'), ns)
    return ns


def main():
    ns = load_cell4_namespace()
    build_score_prompt = ns['build_score_prompt']

    payload = {
        'candidate_name': 'Test Candidate',
        'language': 'en',
        'specialization': 'Backend Development',
        'difficulty': 'mid',
        'question': 'What is a database index?',
        'answer': 'It speeds up lookups by keeping a sorted structure over a column.',
        'expected_answer': 'Explains B-tree structure, read speedup vs write cost.',
    }
    prompt = build_score_prompt(payload)

    # 1. The JSON schema must not show a literal score for the model to copy.
    #    Only the two deliberate worked examples (8 and 92, both at the
    #    extremes) and the "SHOULD score 90 or above" instruction may name a
    #    number; nothing mid-range, and nothing inside the schema itself.
    schema = prompt.split('Exact key set:')[1]
    assert not re.search(r'"score":\s*\d', schema), \
        f'the output schema shows a literal score again: {schema[:120]!r}'
    scores_in_prompt = set(re.findall(r'\bscore \d{1,3}\b', prompt))
    assert scores_in_prompt <= {'score 8', 'score 92', 'score 90'}, \
        f'unexpected literal example score in prompt: {scores_in_prompt}'
    assert '78' not in prompt, 'the 78 anchor is back in the prompt'

    # 2. No field description usable as a copyable placeholder value.
    assert 'specific, actionable, explains why' not in prompt, \
        'placeholder feedback string is back — the model copies it verbatim'
    assert 'never copy those descriptions into your output' in prompt, \
        'missing the explicit do-not-echo-the-placeholder instruction'

    # 3. The question rubric the backend sends is actually used.
    assert payload['expected_answer'] in prompt, 'expected_answer is not reaching the model'

    # 4. Full range is demanded, and follow-up fields are requested.
    assert '90-100' in prompt and '0-29' in prompt, 'score bands missing'
    assert 'SHOULD score 90 or above' in prompt, 'missing the high-end uncapping instruction'
    assert '"isFollowUp"' in prompt and '"nextInterviewerResponse"' in prompt, \
        'follow-up fields are not requested, so follow-ups can never fire'

    # 5. Somali requests must ask for Somali output.
    somali = build_score_prompt({**payload, 'language': 'so'})
    assert 'entirely in Somali' in somali, 'Somali directive missing'
    assert 'entirely in English' not in somali, 'Somali prompt also demands English'

    # 6. Somali needs its own worked example of well-formed JSON — live testing
    #    showed that with English-only examples the model would break out of a
    #    JSON string mid-sentence once it switched to writing Somali prose,
    #    spill "Strengths:" as loose text instead of the real key, and never
    #    close the object (ran to the full token budget, ~77s, unparseable).
    #    A non-Somali prompt must NOT pay for that extra example.
    assert 'Example C' in somali and 'Waa maxay REST API?' in somali, \
        'Somali-language worked example is missing'
    assert 'Example C' not in prompt, \
        'the Somali worked example is leaking into English-language prompts'

    print('All scoring-prompt checks passed.')


if __name__ == '__main__':
    sys.exit(main())
