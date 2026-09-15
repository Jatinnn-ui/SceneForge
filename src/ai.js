import {TYPES, TIMES, WEATHER, validateScene} from './store.js';

const STORAGE_KEY = 'sceneforge_gemini_key';

export function getApiKey() {
  try {
    if (typeof window !== 'undefined' && window.self !== window.top) {
      return '';
    }
    return localStorage.getItem(STORAGE_KEY)?.trim() || '';
  } catch {
    return '';
  }
}

export function setApiKey(key) {
  try {
    if (key && key.trim()) {
      localStorage.setItem(STORAGE_KEY, key.trim());
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore localStorage errors in sandboxed environments
  }
}

export function hasApiKey() {
  return Boolean(getApiKey());
}

async function callGeminiApi(prompt, systemInstruction, apiKey) {
  const key = apiKey || getApiKey();
  if (!key) {
    throw new Error('Gemini is not connected. Enter your Gemini API key or use the Local builder.');
  }

  const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
  let lastError = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
      const body = {
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json'
        }
      };

      if (systemInstruction) {
        body.systemInstruction = {
          parts: [{ text: systemInstruction }]
        };
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const errMsg = errData.error?.message || `HTTP ${res.status}`;
        if (res.status === 400 && errMsg.includes('API_KEY_INVALID')) {
          throw new Error('Gemini API key is invalid. Please verify your key.');
        }
        if (res.status === 429) {
          throw new Error('Gemini API rate limit reached. Please wait a moment and try again.');
        }
        throw new Error(errMsg);
      }

      const data = await res.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        throw new Error('Gemini returned an empty response.');
      }

      return rawText;
    } catch (err) {
      lastError = err;
      if (err.message.includes('API key is invalid') || err.message.includes('rate limit')) {
        throw err;
      }
      // If model not found or another transient error, try next model in fallback list
    }
  }

  throw lastError || new Error('Failed to connect to Gemini API.');
}

function tryParseJson(text) {
  let s = text.trim();

  // Strip markdown code fences
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');

  // Extract outermost JSON object
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    s = s.slice(first, last + 1);
  }

  // 1. Direct JSON.parse
  try {
    return JSON.parse(s);
  } catch {}

  // 2. Remove comments
  s = s.replace(/("(?:[^"\\]|\\.)*")|\/\/[^\n]*/g, (m, str) => (str !== undefined ? str : ''));
  s = s.replace(/("(?:[^"\\]|\\.)*")|\/\*[\s\S]*?\*\//g, (m, str) => (str !== undefined ? str : ''));

  // 3. Convert single-quoted strings to double-quoted strings
  s = s.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"');

  // 4. Quote unquoted keys: e.g. { name: "test", objects: [...] }
  s = s.replace(/([{,]\s*)([a-zA-Z0-9_]+)\s*:/g, '$1"$2":');

  // 5. Remove trailing commas before closing } or ]
  s = s.replace(/,\s*([}\]])/g, '$1');

  try {
    return JSON.parse(s);
  } catch {}

  // 6. Cutoff recovery: strip trailing unclosed elements and balance brackets
  let repaired = s.trim();
  repaired = repaired.replace(/,\s*\{[^}]*$/, '');
  repaired = repaired.replace(/,\s*\[[^\]]*$/, '');
  repaired = repaired.replace(/,\s*"[^"]*$/, '');
  repaired = repaired.replace(/,\s*$/, '');

  const openBraces = (repaired.match(/\{/g) || []).length;
  const closeBraces = (repaired.match(/\}/g) || []).length;
  const openBrackets = (repaired.match(/\[/g) || []).length;
  const closeBrackets = (repaired.match(/\]/g) || []).length;

  for (let i = 0; i < Math.max(0, openBrackets - closeBrackets); i++) repaired += ']';
  for (let i = 0; i < Math.max(0, openBraces - closeBraces); i++) repaired += '}';

  return JSON.parse(repaired);
}

export async function generateSceneWithAI(userPrompt, apiKey) {
  const systemInstruction = `You are the 3D scene generation engine for SceneForge.
Convert the user's description into a structured 3D scene JSON object.
Allowed object types: ${JSON.stringify(TYPES)}
Allowed weather: ${JSON.stringify(WEATHER)}
Allowed time: ${JSON.stringify(TIMES)}

CRITICAL: Your entire response must be pure, valid JSON with double-quoted keys and values. No comments, no trailing commas.

Schema:
{
  "name": "Short name (max 30 chars)",
  "terrain": "meadow",
  "environment": {
    "weather": "clear",
    "time": "sunset"
  },
  "objects": [
    {
      "id": "obj-1",
      "type": "pine_tree",
      "position": [4, 0, -3],
      "scale": 1.2
    }
  ]
}

Rules:
1. terrain must be one of: "meadow", "desert", "island"
2. x and z positions can spread across the expanded map between -18.0 and 18.0. y is 0 for ground objects, 10 to 14 for clouds.
3. scale must be between 0.6 and 2.8.
4. Total objects: 12 to 35. Take advantage of the spacious map to arrange themed zones and detailed clusters.
5. Use only the allowed object types listed above.
6. Output ONLY the JSON object. Nothing else.`;

  const rawJson = await callGeminiApi(userPrompt, systemInstruction, apiKey);
  const parsed = tryParseJson(rawJson);

  if (!parsed.name) parsed.name = userPrompt.slice(0, 30);
  if (!parsed.terrain) parsed.terrain = 'meadow';
  if (!parsed.objects) parsed.objects = [];
  if (!parsed.environment) parsed.environment = { weather: 'clear', time: 'sunset' };

  // Guarantee valid IDs
  parsed.objects = parsed.objects.map((obj, i) => ({
    id: obj.id && typeof obj.id === 'string' ? obj.id : `obj-${i}-${Date.now()}`,
    type: TYPES.includes(obj.type) ? obj.type : 'rock',
    position: Array.isArray(obj.position) && obj.position.length === 3
      ? [
          Math.max(-19, Math.min(19, Number(obj.position[0]) || 0)),
          obj.type === 'cloud' ? (Number(obj.position[1]) || 12) : (Number(obj.position[1]) || 0),
          Math.max(-19, Math.min(19, Number(obj.position[2]) || 0))
        ]
      : [0, 0, 0],
    scale: Math.max(0.2, Math.min(5, Number(obj.scale) || 1))
  }));

  return validateScene(parsed);
}

export async function editSceneWithAI(command, currentScene, selectedId, apiKey) {
  const selectedObj = currentScene.objects.find(o => o.id === selectedId);

  const systemInstruction = `You are the natural-language 3D scene editing engine for SceneForge.
The user wants to modify their existing 3D scene.
Allowed object types: ${JSON.stringify(TYPES)}
Allowed weather: ${JSON.stringify(WEATHER)}
Allowed time: ${JSON.stringify(TIMES)}

Modify the existing scene according to the user's instruction.
Return a JSON object with:
{
  "message": "Brief friendly confirmation message (e.g. 'Added a pine tree near the river')",
  "scene": {
    "name": string,
    "terrain": "meadow" | "desert" | "island",
    "environment": {
      "weather": "clear" | "cloudy" | "rain" | "snow" | "fog",
      "time": "morning" | "afternoon" | "sunset" | "night"
    },
    "objects": [ ...updated list of objects... ]
  }
}

Rules:
- Preserve existing objects unless the user requested to remove, move, or change them.
- New objects must have a unique id (e.g. crypto.randomUUID() or type-timestamp), valid type, position [x, y, z] within [-19, 19], and scale between 0.5 and 3.0.
- When user asks to add objects (e.g. "add 3 trees", "add a castle", "place rocks near the river"), generate and append the new objects to the scene!
- Output ONLY valid JSON.`;

  const prompt = `Current Scene:
${JSON.stringify({
  terrain: currentScene.terrain,
  environment: currentScene.environment,
  selectedObject: selectedObj ? { id: selectedObj.id, type: selectedObj.type, position: selectedObj.position } : null,
  objectCount: currentScene.objects.length,
  objects: currentScene.objects.map(o => ({ id: o.id, type: o.type, position: o.position, scale: o.scale }))
}, null, 2)}

User Instruction: "${command}"`;

  const rawJson = await callGeminiApi(prompt, systemInstruction, apiKey);
  const parsed = tryParseJson(rawJson);

  if (!parsed.scene || !Array.isArray(parsed.scene.objects)) {
    throw new Error('Gemini returned an invalid scene modification.');
  }

  // Ensure terrain & environment
  parsed.scene.name = parsed.scene.name || currentScene.name;
  parsed.scene.terrain = parsed.scene.terrain || currentScene.terrain || 'meadow';
  parsed.scene.environment = parsed.scene.environment || currentScene.environment;

  // Sanitize objects
  parsed.scene.objects = parsed.scene.objects.map((obj, i) => ({
    id: obj.id && typeof obj.id === 'string' ? obj.id : `obj-${i}-${Date.now()}`,
    type: TYPES.includes(obj.type) ? obj.type : 'rock',
    position: Array.isArray(obj.position) && obj.position.length === 3
      ? [
          Math.max(-19, Math.min(19, Number(obj.position[0]) || 0)),
          obj.type === 'cloud' ? (Number(obj.position[1]) || 12) : (Number(obj.position[1]) || 0),
          Math.max(-19, Math.min(19, Number(obj.position[2]) || 0))
        ]
      : [0, 0, 0],
    scale: Math.max(0.2, Math.min(5, Number(obj.scale) || 1))
  }));

  const validatedScene = validateScene(parsed.scene);
  return {
    scene: validatedScene,
    message: parsed.message || 'Scene updated successfully.'
  };
}
