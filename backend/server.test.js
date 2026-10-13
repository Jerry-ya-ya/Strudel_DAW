import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { createApp } from './server.js';

let server;
let origin;
let dataDir;
let generatedMusicDir;

before(async () => {
  dataDir = await mkdtemp(join(tmpdir(), 'strudel-daw-'));
  generatedMusicDir = await mkdtemp(join(tmpdir(), 'strudel-generated-'));
  await mkdir(join(generatedMusicDir, 'echoes-beneath-the-vault'));
  await writeFile(join(generatedMusicDir, 'echoes-beneath-the-vault', 'song.strudel'), 'setcpm(72/4)\nnote("d4")');
  await writeFile(join(generatedMusicDir, 'echoes-beneath-the-vault', 'analysis.md'), '# Echoes Beneath the Vault\n\n- 曲風：神聖氛圍音樂\n- 速度：72 BPM');
  const app = await createApp({ dataDir, generatedMusicDir });
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      origin = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await rm(dataDir, { recursive: true, force: true });
  await rm(generatedMusicDir, { recursive: true, force: true });
});

test('score CRUD lifecycle', async () => {
  const initial = await fetch(`${origin}/api/scores`).then((response) => response.json());
  assert.equal(initial.length, 1);

  const createdResponse = await fetch(`${origin}/api/scores`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Test beat', code: 's("bd sd")', bpm: 96 })
  });
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json();

  const loaded = await fetch(`${origin}/api/scores/${created.id}`).then((response) => response.json());
  assert.equal(loaded.code, 's("bd sd")');

  const updatedResponse = await fetch(`${origin}/api/scores/${created.id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Updated beat', code: 's("bd*4")', bpm: 128 })
  });
  assert.equal(updatedResponse.status, 200);
  assert.equal((await updatedResponse.json()).name, 'Updated beat');

  assert.equal((await fetch(`${origin}/api/scores/${created.id}`, { method: 'DELETE' })).status, 204);
  assert.equal((await fetch(`${origin}/api/scores/${created.id}`)).status, 404);
});

test('rejects invalid score payloads and ids', async () => {
  const response = await fetch(`${origin}/api/scores`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: '', code: '', bpm: 900 })
  });
  assert.equal(response.status, 400);
  assert.match((await response.json()).message, /名稱不可為空白/);
  assert.equal((await fetch(`${origin}/api/scores/not-a-safe-id`)).status, 404);
});

test('dynamically lists and loads generated music files', async () => {
  const initialResponse = await fetch(`${origin}/api/generated-music`);
  assert.equal(initialResponse.headers.get('cache-control'), 'no-store');
  const initial = await initialResponse.json();
  assert.equal(initial.length, 1);
  assert.equal(initial[0].id, 'generated:echoes-beneath-the-vault');
  assert.equal(initial[0].name, 'Echoes Beneath the Vault');
  assert.equal(initial[0].description, '神聖氛圍音樂');
  assert.equal(initial[0].bpm, 72);
  assert.equal(initial[0].codeLength, 'setcpm(72/4)\nnote("d4")'.length);

  const detail = await fetch(`${origin}/api/generated-music/echoes-beneath-the-vault`).then((response) => response.json());
  assert.equal(detail.code, 'setcpm(72/4)\nnote("d4")');

  await mkdir(join(generatedMusicDir, 'new-song'));
  await writeFile(join(generatedMusicDir, 'new-song', 'song.strudel'), 'note("c4")');
  const refreshed = await fetch(`${origin}/api/generated-music`).then((response) => response.json());
  assert.deepEqual(refreshed.map((song) => song.id).sort(), [
    'generated:echoes-beneath-the-vault',
    'generated:new-song'
  ]);
  assert.equal((await fetch(`${origin}/api/generated-music/../server.js`)).status, 404);
});

