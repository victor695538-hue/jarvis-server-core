import express from 'express';
import cors from 'cors';
import FormData from 'form-data';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

const JARVIS_AUTH_TOKEN = process.env.JARVIS_AUTH_TOKEN || 'jarvis_secret_token_2026';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';

// Middleware de autenticación
app.use((req, res, next) => {
  if (req.path === '/' || req.path === '/health') return next();
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (token !== JARVIS_AUTH_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'online', name: 'JARVIS Core Server' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'online', timestamp: new Date().toISOString() });
});

// Chat con Groq Llama-3.3
app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Missing messages' });
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'Eres J.A.R.V.I.S., una inteligencia artificial personal de élite. Hablas en español, eres elegante, preciso y leal a tu señor. Respondes de forma concisa pero inteligente.',
          },
          ...messages,
        ],
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
    throw new Error(data.error?.message || 'Groq error');
  } catch (err: any) {
    console.error('Chat error:', err.message);
    return res.json({
      success: true,
      modelUsed: 'JARVIS Fallback',
      message: { role: 'assistant', content: 'Estoy en línea, señor. ¿En qué puedo asistirle?' },
    });
  }
});

// Transcripción de voz con Groq Whisper
app.post('/api/stt', async (req, res) => {
  const { audioBase64 } = req.body;
  if (!audioBase64) return res.status(400).json({ error: 'Falta el audio' });

  try {
    const buffer = Buffer.from(audioBase64, 'base64');
    const formData = new FormData();
    formData.append('file', buffer, { filename: 'audio.m4a', contentType: 'audio/m4a' });
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

app.listen(PORT, () => {
  console.log('==================================================');
  console.log(`🤖 JARVIS Core Server escuchando en puerto ${PORT}`);
  console.log(`🧠 IA: Groq Llama-3.3-70b + Whisper`);
  console.log(`🎙️ Voz: ElevenLabs`);
  console.log('==================================================');
});
