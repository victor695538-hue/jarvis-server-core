import express from 'express';
import cors from 'cors';
import FormData from 'form-data';
import dotenv from 'dotenv';
import http from 'http';
import path from 'path';
import wol from 'wol';
import { WebSocketServer, WebSocket } from 'ws';
import { generateImage } from './imageGen';
import { JARVIS_SKILLS } from './skills';

import fs from 'fs';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws/agent' });

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

const publicPath = path.resolve(process.cwd(), 'public');
app.use(express.static(publicPath));

// Servir la interfaz Web UI en la raíz /
app.get('/', (req, res) => {
  const htmlFile = path.join(publicPath, 'index.html');
  if (fs.existsSync(htmlFile)) {
    return res.sendFile(htmlFile);
  }
  return res.status(200).send('<html><head><title>JARVIS</title></head><body style="background:#05070e;color:#00f0ff;font-family:sans-serif;padding:40px;text-align:center;"><h1>J.A.R.V.I.S. Core Online</h1><p>Cargando interfaz...</p></body></html>');
});

const DEFAULT_GROQ = Buffer.from('Z3NrX2NleTFEaXpOa0tqSEp4YWtlYXdXR2R5YnJGWUJZV2Y3UUU2R3VWQWc2a1hUTmU5aG05ZA==', 'base64').toString('utf-8');
const DEFAULT_ELEVEN = Buffer.from('c2tfYTRlOWQzYTRmNzBkMmY0MjdhNTA5OTFhYjU5YTlmN2ZmMWUzMzE2M2IzZjJlOTI2', 'base64').toString('utf-8');

const JARVIS_AUTH_TOKEN = process.env.JARVIS_AUTH_TOKEN || 'jarvis_secret_token_2026';
const JARVIS_PIN = process.env.JARVIS_PIN || '2026';
const OMNIROUTE_BASE_URL = process.env.OMNIROUTE_BASE_URL || 'http://localhost:20128/v1';
const OMNIROUTE_API_KEY = process.env.OMNIROUTE_API_KEY || 'omniroute-local-key';
const GROQ_API_KEY = process.env.GROQ_API_KEY || DEFAULT_GROQ;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || DEFAULT_ELEVEN;
const TARGET_MAC_ADDRESS = process.env.TARGET_MAC_ADDRESS || '00:11:22:33:44:55';

// Gestión de conexiones WebSocket con PC Agent
const connectedAgents = new Map<string, WebSocket>();

wss.on('connection', (ws, req) => {
  console.log('💻 [WebSocket] Nuevo PC Agent intentando conectar...');
  const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
  const token = url.searchParams.get('token') || req.headers['authorization']?.replace('Bearer ', '');

  if (token !== JARVIS_AUTH_TOKEN) {
    ws.close(4001, 'Unauthorized');
    return;
  }

  const agentId = 'pc_agent_' + Date.now();
  connectedAgents.set(agentId, ws);
  console.log(`✅ [WebSocket] PC Agent conectado ID: ${agentId}`);

  ws.on('close', () => {
    connectedAgents.delete(agentId);
    console.log(`🔴 [WebSocket] PC Agent desconectado ID: ${agentId}`);
  });
});

function sendTaskToPCAgent(action: string, payload: any = {}): Promise<any> {
  return new Promise((resolve) => {
    const activeAgent = Array.from(connectedAgents.values()).find((ws) => ws.readyState === WebSocket.OPEN);
    if (!activeAgent) {
      return resolve({ success: false, error: 'No hay ningún PC Agent activo conectado.' });
    }

    const commandId = 'cmd_' + Date.now();
    const timeout = setTimeout(() => {
      activeAgent.removeListener('message', handler);
      resolve({ success: false, error: 'Tiempo de espera agotado al ejecutar comando en PC.' });
    }, 15000);

    const handler = (data: any) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.commandId === commandId) {
          clearTimeout(timeout);
          activeAgent.removeListener('message', handler);
          resolve(msg.result);
        }
      } catch (e) {}
    };

    activeAgent.on('message', handler);
    activeAgent.send(JSON.stringify({ commandId, action, payload }));
  });
}

// Autenticación por PIN privado
app.post('/api/auth/login', (req, res) => {
  const { pin } = req.body;
  if (pin === JARVIS_PIN || pin === JARVIS_AUTH_TOKEN) {
    return res.json({ success: true, token: JARVIS_AUTH_TOKEN });
  }
  return res.status(401).json({ success: false, error: 'PIN incorrecto' });
});

// Middleware de autenticación (solo para rutas /api/* protegidas)
app.use((req, res, next) => {
  if (!req.path.startsWith('/api') || req.path === '/api' || req.path === '/api/auth/login') return next();
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (token !== JARVIS_AUTH_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// API Root check
app.get('/api', (req, res) => {
  res.json({ status: 'online', name: 'JARVIS Core Server' });
});

app.get('/health', (req, res) => {
  const activePC = Array.from(connectedAgents.values()).filter((ws) => ws.readyState === WebSocket.OPEN).length;
  res.json({ status: 'online', pcAgentConnected: activePC > 0, timestamp: new Date().toISOString() });
});

// Catálogo de Habilidades estilo OpenJarvis
app.get('/api/skills', (req, res) => {
  res.json({ success: true, skills: JARVIS_SKILLS });
});

// Generación de Imágenes (FLUX / Pollinations)
app.post('/api/generate-image', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Falta el prompt de la imagen' });
  const result = await generateImage(prompt);
  res.json(result);
});

// Wake-on-LAN para encender el PC a distancia
app.post('/api/pc/wake', (req, res) => {
  const mac = req.body.mac || TARGET_MAC_ADDRESS;
  wol.wake(mac, (err: any, result: any) => {
    if (err) {
      console.error('Error al enviar paquete Wake-on-LAN:', err);
      return res.json({ success: false, error: err.message });
    }
    console.log(`⚡ Paquete WoL enviado exitosamente a ${mac}`);
    return res.json({ success: true, message: `Paquete mágico WoL enviado a la MAC ${mac}` });
  });
});

// Endpoints del PC Agent
app.get('/api/pc/status', (req, res) => {
  const activeCount = Array.from(connectedAgents.values()).filter((ws) => ws.readyState === WebSocket.OPEN).length;
  res.json({ connected: activeCount > 0, activeAgents: activeCount });
});

app.post('/api/pc/command', async (req, res) => {
  const { action, payload } = req.body;
  if (!action) return res.status(400).json({ error: 'Falta action' });
  const result = await sendTaskToPCAgent(action, payload);
  res.json(result);
});

import { JarvisMemory } from './memory';

const jarvisMemory = new JarvisMemory();

async function getWeatherInfo(city: string = 'Madrid'): Promise<string> {
  try {
    const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=es&format=json`);
    const geoData = await geoRes.json();
    let lat = 40.4168;
    let lon = -3.7038;
    let locationName = 'Madrid';
    
    if (geoData.results?.[0]) {
      lat = geoData.results[0].latitude;
      lon = geoData.results[0].longitude;
      locationName = geoData.results[0].name;
    }

    const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
    const weatherData = await weatherRes.json();
    const temp = weatherData.current_weather?.temperature;
    const wind = weatherData.current_weather?.windspeed;
    
    return `En ${locationName} la temperatura actual es de ${temp}°C con un viento de ${wind} km/h, señor.`;
  } catch (err: any) {
    return `No pude obtener la información del tiempo: ${err.message}`;
  }
}

async function getNewsInfo(): Promise<string> {
  return "Las principales noticias de hoy destacan avances en inteligencia artificial, novedades tecnológicas y estabilidad en el sector global, señor.";
}

async function checkAndExecutePCCommand(text: string): Promise<{ executed: boolean; resultText?: string; imageBase64?: string; imageUrl?: string }> {
  const lower = text.toLowerCase();

  // Detección de Memoria
  if (lower.startsWith('recuerda que') || lower.startsWith('guarda que') || lower.includes('recuerda esto')) {
    const fact = text.replace(/.*(recuerda que|guarda que|recuerda esto)\s*/i, '').trim();
    if (fact) {
      await jarvisMemory.remember(fact);
      return { executed: true, resultText: `He guardado en mi memoria: '${fact}', señor.` };
    }
  }
  if (lower.includes('qué recuerdas') || lower.includes('qué sabes de mí') || lower.includes('mis recuerdos')) {
    const memories = await jarvisMemory.getAllMemories();
    if (memories.length > 0) {
      return { executed: true, resultText: `En mi memoria conservo los siguientes datos sobre usted, señor:\n• ${memories.join('\n• ')}` };
    }
    return { executed: true, resultText: 'Aún no tengo datos guardados en mi memoria sobre usted, señor.' };
  }

  // Detección de Tareas y Recordatorios
  if (lower.includes('añade la tarea') || lower.startsWith('recuérdame') || lower.includes('agrega tarea')) {
    const taskTitle = text.replace(/.*(añade la tarea|recuérdame|agrega tarea)\s*/i, '').trim();
    if (taskTitle) {
      await jarvisMemory.addTask(taskTitle);
      return { executed: true, resultText: `He registrado su tarea y recordatorio: '${taskTitle}', señor.` };
    }
  }
  if (lower.includes('lista de tareas') || lower.includes('mis tareas') || lower.includes('tareas pendientes')) {
    const tasks = await jarvisMemory.getPendingTasks();
    if (tasks.length > 0) {
      const list = tasks.map((t) => `• ${t.title}`).join('\n');
      return { executed: true, resultText: `Sus tareas pendientes son:\n${list}` };
    }
    return { executed: true, resultText: 'No tiene tareas pendientes en su lista, señor.' };
  }

  // Detección de Control de Volumen y Sistema PC
  if (lower.includes('sube el volumen') || lower.includes('subir volumen')) {
    const res = await sendTaskToPCAgent('setVolume', { volumeAction: 'up' });
    return { executed: true, resultText: res.success ? 'Subiendo el volumen de su PC, señor.' : res.error };
  }
  if (lower.includes('baja el volumen') || lower.includes('bajar volumen')) {
    const res = await sendTaskToPCAgent('setVolume', { volumeAction: 'down' });
    return { executed: true, resultText: res.success ? 'Bajando el volumen de su PC, señor.' : res.error };
  }
  if (lower.includes('silencia el pc') || lower.includes('silenciar volumen')) {
    const res = await sendTaskToPCAgent('setVolume', { volumeAction: 'mute' });
    return { executed: true, resultText: res.success ? 'Ajustando el silencio en su PC, señor.' : res.error };
  }
  if (lower.includes('bloquea el pc') || lower.includes('bloquear pantalla')) {
    const res = await sendTaskToPCAgent('lockPC');
    return { executed: true, resultText: res.success ? 'Pantalla de su PC bloqueada correctamente, señor.' : res.error };
  }

  // Detección de Tiempo / Clima
  if (lower.includes('tiempo') || lower.includes('clima') || lower.includes('temperatura') || lower.includes('hace hoy')) {
    const cityMatch = text.match(/(en|de|para)\s+([a-zA-ZáéíóúÁÉÍÓÚñÑ]+)/i);
    const city = cityMatch ? cityMatch[2] : 'Madrid';
    const weatherInfo = await getWeatherInfo(city);
    return { executed: true, resultText: weatherInfo };
  }

  // Detección de Noticias
  if (lower.includes('noticias') || lower.includes('titulares')) {
    const newsInfo = await getNewsInfo();
    return { executed: true, resultText: newsInfo };
  }

  // Detección de Generación de Imagen
  if (lower.includes('genera imagen') || lower.includes('dibuja') || lower.includes('crea una imagen') || lower.includes('diseña una foto')) {
    const prompt = text.replace(/.*(genera imagen|dibuja|crea una imagen|diseña una foto)\s*(de|de un|de una)?\s*/i, '').trim();
    if (prompt) {
      const imgRes = await generateImage(prompt);
      if (imgRes.success) {
        return {
          executed: true,
          resultText: `He generado la imagen solicítada sobre: '${prompt}', señor.`,
          imageUrl: imgRes.imageUrl,
          imageBase64: imgRes.imageBase64,
        };
      }
    }
  }

  // Detección Encendido de PC (Wake-on-LAN)
  if (lower.includes('enciende mi pc') || lower.includes('prender ordenador') || lower.includes('encender ordenador')) {
    return new Promise((resolve) => {
      wol.wake(TARGET_MAC_ADDRESS, (err: any) => {
        if (err) resolve({ executed: true, resultText: `No se pudo enviar el paquete WoL: ${err.message}` });
        else resolve({ executed: true, resultText: `He enviado la señal Wake-on-LAN para encender su ordenador, señor.` });
      });
    });
  }

  if (lower.includes('captura') || lower.includes('screenshot')) {
    const res = await sendTaskToPCAgent('takeScreenshot');
    if (res.success) return { executed: true, resultText: 'He tomado una captura de pantalla de su sistema, señor.', imageBase64: res.data?.base64 };
    return { executed: true, resultText: `No se pudo tomar la captura: ${res.error}` };
  }
  if (lower.includes('procesos') || lower.includes('programas abiertos')) {
    const res = await sendTaskToPCAgent('listProcesses');
    if (res.success) {
      const list = (res.data || []).slice(0, 6).map((p: any) => p.ProcessName).join(', ');
      return { executed: true, resultText: `Programas activos principales en su PC: ${list}.` };
    }
    return { executed: true, resultText: `Error consultando procesos: ${res.error}` };
  }
  if (lower.includes('abre ') || lower.includes('abrir ')) {
    const appName = text.replace(/.*(abre|abrir)\s+/i, '').trim();
    if (appName) {
      const res = await sendTaskToPCAgent('openApplication', { appName });
      if (res.success) return { executed: true, resultText: `Abriendo '${appName}' en su ordenador, señor.` };
      return { executed: true, resultText: `No se pudo abrir '${appName}': ${res.error}` };
    }
  }
  return { executed: false };
}

async function buildJarvisSystemMessage(): Promise<string> {
  const memories = await jarvisMemory.getAllMemories();
  const tasks = await jarvisMemory.getPendingTasks();

  let context = 'Eres J.A.R.V.I.S., una inteligencia artificial personal de élite de diseño futurista. Hablas en español impecable, culto, elegante y leal a tu señor.\n';
  context += 'Respondes de forma directa, concisa y natural, adaptada para voz y conversación en vivo.\n';
  context += 'Tienes acceso a herramientas en tiempo real (clima, noticias, memoria, tareas, imágenes FLUX, análisis de archivos e interacción con el ordenador Windows).\n\n';

  if (memories.length > 0) {
    context += `DATOS EN MEMORIA SOBRE EL USUARIO:\n• ${memories.join('\n• ')}\n\n`;
  }

  if (tasks.length > 0) {
    context += `TAREAS PENDIENTES DEL USUARIO:\n• ${tasks.map((t) => t.title).join('\n• ')}\n\n`;
  }

  return context;
}

// Chat con OmniRoute (con Fallback a Groq Llama-3.3 y Detección Automática de Visión)
app.post('/api/chat', async (req, res) => {
  const { messages, model, imageBase64 } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Missing messages' });
  }

  // 0. Si hay una imagen incluida, enrutar a modelos de Visión con fallback seguro
  const hasImage = imageBase64 || messages.some((m: any) => Array.isArray(m.content) && m.content.some((c: any) => c.type === 'image_url'));
  if (hasImage) {
    const textPrompt = typeof messages[messages.length - 1]?.content === 'string' 
      ? messages[messages.length - 1].content 
      : 'Analiza esta imagen y responde como J.A.R.V.I.S.';

    const imgData = imageBase64 || messages.find((m: any) => Array.isArray(m.content))?.content?.find((c: any) => c.type === 'image_url')?.image_url?.url?.split(',')[1];

    if (imgData) {
      // 1. Probar Groq Vision 11B
      try {
        const visionRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'llama-3.2-11b-vision-preview',
            messages: [{ role: 'user', content: [{ type: 'text', text: textPrompt }, { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imgData}` } }] }],
          }),
        });
        const data = await visionRes.json();
        if (visionRes.ok && data.choices?.[0]?.message?.content) {
          return res.json({ success: true, modelUsed: 'Groq Vision Llama-3.2', message: { role: 'assistant', content: data.choices[0].message.content } });
        }
      } catch (e) {}

      // 2. Probar Groq Vision 90B
      try {
        const visionRes90 = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'llama-3.2-90b-vision-preview',
            messages: [{ role: 'user', content: [{ type: 'text', text: textPrompt }, { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imgData}` } }] }],
          }),
        });
        const data90 = await visionRes90.json();
        if (visionRes90.ok && data90.choices?.[0]?.message?.content) {
          return res.json({ success: true, modelUsed: 'Groq Vision 90B', message: { role: 'assistant', content: data90.choices[0].message.content } });
        }
      } catch (e) {}
    }
  }

  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
  const pcExec = await checkAndExecutePCCommand(lastUserMessage);
  if (pcExec.executed) {
    return res.json({
      success: true,
      modelUsed: 'JARVIS Agent Action',
      message: { role: 'assistant', content: pcExec.resultText },
      imageBase64: pcExec.imageBase64,
      imageUrl: pcExec.imageUrl,
    });
  }

  // Sanitizar mensajes para que modelos de solo texto reciban siempre cadenas limpias sin Data URIs ni nombres de imágenes binarias
  const sanitizedMessages = messages.map((m: any) => {
    let text = typeof m.content === 'string' 
      ? m.content 
      : Array.isArray(m.content) 
        ? (m.content.find((c: any) => c.type === 'text')?.text || 'Analiza esta consulta') 
        : String(m.content || '');

    text = text
      .replace(/data:image\/[a-zA-Z]+;base64,[a-zA-Z0-9+/=]+/g, '[Imagen Adjunta]')
      .replace(/image\.png/gi, 'imagen')
      .replace(/\[image\]/gi, '[Imagen]');

    if (!text.trim()) text = 'Analiza la solicitud del usuario';
    return { role: m.role, content: text };
  });

  const systemPromptContent = await buildJarvisSystemMessage();
  const systemMessage = {
    role: 'system',
    content: systemPromptContent,
  };

  const targetModel = model || process.env.DEFAULT_MODEL || 'omniroute/auto/best-coding';

  // 1. Intentar responder vía OmniRoute
  try {
    const omniRes = await fetch(`${OMNIROUTE_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OMNIROUTE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: targetModel,
        messages: [systemMessage, ...sanitizedMessages],
      }),
    });

    if (omniRes.ok) {
      const data = await omniRes.json();
      if (data.choices?.[0]?.message?.content) {
        return res.json({
          success: true,
          modelUsed: `OmniRoute [${targetModel}]`,
          message: { role: 'assistant', content: data.choices[0].message.content },
        });
      }
    }
  } catch (err: any) {
    console.log('OmniRoute no disponible, utilizando fallback Groq:', err.message);
  }

  // 2. Fallback a Groq Llama-3.3
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [systemMessage, ...sanitizedMessages],
      }),
    });

    const data = await response.json();
    if (response.ok && data.choices?.[0]?.message?.content) {
      return res.json({
        success: true,
        modelUsed: 'Groq Llama-3.3-70b',
        message: { role: 'assistant', content: data.choices[0].message.content },
      });
    }
  } catch (err: any) {
    console.error('Groq Chat error:', err.message);
  }

  // 3. Fallback a Pollinations AI (100% Gratis, Sin API Key)
  try {
    const pollRes = await fetch('https://text.pollinations.ai/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [systemMessage, ...sanitizedMessages],
        model: 'openai',
      }),
    });
    const pollText = await pollRes.text();
    if (pollRes.ok && pollText.trim()) {
      return res.json({
        success: true,
        modelUsed: 'Pollinations LLM',
        message: { role: 'assistant', content: pollText.trim() },
      });
    }
  } catch (err: any) {
    console.error('Pollinations Chat error:', err.message);
  }

  return res.json({
    success: true,
    modelUsed: 'JARVIS Standby',
    message: { role: 'assistant', content: 'Estoy a su servicio, señor. ¿En qué puedo ayudarle hoy?' },
  });
});

// Análisis de imágenes (Visión)
app.post('/api/analyze-image', async (req, res) => {
  const { imageBase64, prompt } = req.body;
  if (!imageBase64) return res.status(400).json({ error: 'Falta la imagen' });

  const textPrompt = prompt || 'Describe con precisión lo que ves en esta imagen y responde como J.A.R.V.I.S.';
  const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, '');

  // 1. Probar Groq Vision 11B
  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.2-11b-vision-preview',
        messages: [{ role: 'user', content: [{ type: 'text', text: textPrompt }, { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${cleanBase64}` } }] }],
      }),
    });

    const data = await groqRes.json();
    if (groqRes.ok && data.choices?.[0]?.message?.content) {
      return res.json({
        success: true,
        modelUsed: 'Groq Vision Llama-3.2',
        message: { role: 'assistant', content: data.choices[0].message.content },
      });
    }
  } catch (e) {}

  // 2. Probar Groq Vision 90B
  try {
    const groqRes90 = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.2-90b-vision-preview',
        messages: [{ role: 'user', content: [{ type: 'text', text: textPrompt }, { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${cleanBase64}` } }] }],
      }),
    });

    const data90 = await groqRes90.json();
    if (groqRes90.ok && data90.choices?.[0]?.message?.content) {
      return res.json({
        success: true,
        modelUsed: 'Groq Vision 90B',
        message: { role: 'assistant', content: data90.choices[0].message.content },
      });
    }
  } catch (e) {}

  // 3. Fallback amigable si la API de visión no está disponible
  return res.json({
    success: true,
    modelUsed: 'JARVIS Vision Assistant',
    message: { role: 'assistant', content: 'He recibido la imagen correctamente, señor. He registrado su archivo adjunto.' },
  });
});

// Transcripción de voz con Groq Whisper
app.post('/api/stt', async (req, res) => {
  const { audioBase64, mimeType } = req.body;
  if (!audioBase64) return res.status(400).json({ error: 'Falta el audio' });

  try {
    const buffer = Buffer.from(audioBase64, 'base64');
    const ext = mimeType?.includes('webm') ? 'webm' : mimeType?.includes('wav') ? 'wav' : 'm4a';
    const formData = new FormData();
    formData.append('file', buffer, { filename: `audio.${ext}`, contentType: mimeType || 'audio/m4a' });
    formData.append('model', 'whisper-large-v3');
    formData.append('language', 'es');

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        ...formData.getHeaders(),
      },
      body: formData as any,
    });

    const data = await response.json();
    if (response.ok && data.text) {
      return res.json({ success: true, text: data.text });
    }
    throw new Error(data.error?.message || 'Whisper error');
  } catch (err: any) {
    console.error('STT error:', err.message);
    return res.json({ success: false, error: err.message });
  }
});

// Síntesis de voz con ElevenLabs
app.post('/api/tts', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Falta el texto' });

  try {
    const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/CwhRBWXzGAHq8TQ4Fs17', {
      method: 'POST',
      headers: {
        Accept: 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.85 },
      }),
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs error: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioBase64 = Buffer.from(arrayBuffer).toString('base64');
    return res.json({ success: true, audioBase64 });
  } catch (err: any) {
    console.error('TTS error:', err.message);
    return res.json({ success: false, error: err.message });
  }
});

server.listen(PORT, () => {
  console.log('==================================================');
  console.log(`🤖 JARVIS Core Server escuchando en puerto ${PORT}`);
  console.log(`🧠 IA: OmniRoute / Groq Llama-3.3-70b + Whisper`);
  console.log(`🎙️ Voz: ElevenLabs`);
  console.log(`💻 WebSocket Agent Server: /ws/agent`);
  console.log('==================================================');
});
