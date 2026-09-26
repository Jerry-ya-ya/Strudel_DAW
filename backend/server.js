import express from 'express';
import { mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const currentDir = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DATA_DIR = join(currentDir, 'data', 'scores');
const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const starterScore = {
  name: 'Neon Pulse',
  description: 'A warm four-on-the-floor starter groove.',
  bpm: 118,
  code: `stack(
  s("bd*4").gain(0.9),
  s("~ cp ~ cp").gain(0.72),
  s("hh*8").gain("0.45 0.28").pan(sine.slow(4)),
  note("<c2 c2 eb2 g2>")
    .s("sawtooth")
    .lpf(sine.range(500, 1800).slow(8))
    .gain(0.42)
).cpm(118)`
};

function scorePath(dataDir, id) {
  if (!ID_PATTERN.test(id)) return null;
  return join(dataDir, `${id}.json`);
}

function validateScore(input, partial = false) {
  const errors = [];
  if (!partial || input.name !== undefined) {
    if (typeof input.name !== 'string' || !input.name.trim()) errors.push('名稱不可為空白');
    if (typeof input.name === 'string' && input.name.trim().length > 120) errors.push('名稱不可超過 120 個字元');
  }
  if (!partial || input.code !== undefined) {
    if (typeof input.code !== 'string' || !input.code.trim()) errors.push('Strudel 樂譜不可為空白');
    if (typeof input.code === 'string' && input.code.length > 200_000) errors.push('樂譜不可超過 200 KB');
  }
  if (input.description !== undefined && typeof input.description !== 'string') errors.push('說明必須是文字');
  if (input.bpm !== undefined && (!Number.isFinite(input.bpm) || input.bpm < 20 || input.bpm > 400)) {
    errors.push('BPM 必須介於 20 到 400');
  }
  return errors;
}

async function atomicWrite(path, value) {
  const tempPath = `${path}.${randomUUID()}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(tempPath, path);
}

async function readScore(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export async function createApp(options = {}) {
  const dataDir = resolve(options.dataDir ?? process.env.SCORE_DATA_DIR ?? DEFAULT_DATA_DIR);
  await mkdir(dataDir, { recursive: true });

  if ((await readdir(dataDir)).filter((name) => name.endsWith('.json')).length === 0) {
    const now = new Date().toISOString();
    const initial = { id: randomUUID(), ...starterScore, createdAt: now, updatedAt: now };
    await atomicWrite(join(dataDir, `${initial.id}.json`), initial);
  }

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));
  app.use((request, response, next) => {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (request.method === 'OPTIONS') return response.sendStatus(204);
    next();
  });

  app.get('/api/health', (_request, response) => response.json({ status: 'ok' }));

  app.get('/api/scores', async (_request, response, next) => {
    try {
      const filenames = (await readdir(dataDir)).filter((name) => name.endsWith('.json'));
      const scores = await Promise.all(filenames.map((name) => readScore(join(dataDir, name))));
      scores.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      response.json(scores.map(({ code, ...metadata }) => ({ ...metadata, codeLength: code.length })));
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/scores/:id', async (request, response, next) => {
    const path = scorePath(dataDir, request.params.id);
    if (!path) return response.status(404).json({ message: '找不到這份樂譜' });
    try {
      response.json(await readScore(path));
    } catch (error) {
      if (error.code === 'ENOENT') return response.status(404).json({ message: '找不到這份樂譜' });
      next(error);
    }
  });

  app.post('/api/scores', async (request, response, next) => {
    const errors = validateScore(request.body);
    if (errors.length) return response.status(400).json({ message: errors.join('；') });
    const now = new Date().toISOString();
    const score = {
      id: randomUUID(),
      name: request.body.name.trim(),
      description: request.body.description?.trim() ?? '',
      bpm: request.body.bpm ?? 120,
      code: request.body.code,
      createdAt: now,
      updatedAt: now
    };
    try {
      await atomicWrite(join(dataDir, `${score.id}.json`), score);
      response.status(201).json(score);
    } catch (error) {
      next(error);
    }
  });

  app.put('/api/scores/:id', async (request, response, next) => {
    const path = scorePath(dataDir, request.params.id);
    if (!path) return response.status(404).json({ message: '找不到這份樂譜' });
    const errors = validateScore(request.body);
    if (errors.length) return response.status(400).json({ message: errors.join('；') });
    try {
      const existing = await readScore(path);
      const score = {
        ...existing,
        name: request.body.name.trim(),
        description: request.body.description?.trim() ?? '',
        bpm: request.body.bpm ?? 120,
        code: request.body.code,
        updatedAt: new Date().toISOString()
      };
      await atomicWrite(path, score);
      response.json(score);
    } catch (error) {
      if (error.code === 'ENOENT') return response.status(404).json({ message: '找不到這份樂譜' });
      next(error);
    }
  });

  app.delete('/api/scores/:id', async (request, response, next) => {
    const path = scorePath(dataDir, request.params.id);
    if (!path) return response.status(404).json({ message: '找不到這份樂譜' });
    try {
      await unlink(path);
      response.sendStatus(204);
    } catch (error) {
      if (error.code === 'ENOENT') return response.status(404).json({ message: '找不到這份樂譜' });
      next(error);
    }
  });

  app.use((error, _request, response, _next) => {
    console.error(error);
    if (error?.type === 'entity.parse.failed') return response.status(400).json({ message: 'JSON 格式錯誤' });
    response.status(500).json({ message: '伺服器暫時無法處理請求' });
  });

  return app;
}

const isEntrypoint = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isEntrypoint) {
  const port = Number(process.env.PORT ?? 3000);
  const app = await createApp();
  app.listen(port, '0.0.0.0', () => console.log(`Score API listening on http://0.0.0.0:${port}`));
}

