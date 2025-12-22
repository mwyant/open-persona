const fs = require('fs');
const path = 'workspaces/cb61ed2a6a9882ff/opencode.jsonc';
let raw = fs.readFileSync(path, 'utf8');
// crude JSONC stripping: remove // comments and /* */ blocks
let cleaned = raw.replace(/\/\/[^\n]*\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '');
let obj;
try {
  obj = JSON.parse(cleaned);
} catch (e) {
  console.error('failed to parse opencode.jsonc');
  process.exit(1);
}
if (!obj.provider) obj.provider = {};
if (!obj.provider.openai) {
  const env = fs.readFileSync('.env.launcher', 'utf8');
  const m = env.match(/^OPEN_PERSONA_DEFAULT_OPENAI_API_KEY=(.*)$/m);
  const key = m ? m[1].trim() : '';
  obj.provider.openai = {
    npm: '@ai-sdk/openai-compatible',
    name: 'OpenAI (remote)',
    options: {
      baseURL: 'https://api.openai.com/v1',
      apiKey: key
    },
    models: {
      'openai/gpt-5-mini': { name: 'gpt-5-mini (openai)' }
    }
  };
  fs.writeFileSync(path, JSON.stringify(obj, null, 2) + '\n');
  console.log('openai provider added to', path);
} else {
  console.log('openai provider already present in', path);
}
