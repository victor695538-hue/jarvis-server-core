import axios from 'axios';
import WebSocket from 'ws';

const JARVIS_URL = 'http://localhost:3000';
const AUTH_TOKEN = 'jarvis_secret_token_2026';

async function testJarvis() {
  console.log('🔍 1. Comprobando estado de JARVIS Server (/health)...');
  try {
    const health = await axios.get(`${JARVIS_URL}/health`);
    console.log('✅ Estado del Servidor:', health.data);
  } catch (e: any) {
    console.error('❌ El servidor JARVIS no está respondiendo en', JARVIS_URL);
    return;
  }

  console.log('\n🤖 2. Probando endpoint de chat (/api/chat)...');
  try {
    const res = await axios.post(
      `${JARVIS_URL}/api/chat`,
      {
        messages: [{ role: 'user', content: 'JARVIS, confirma tu estado e identifícate.' }],
      },
      {
        headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
      }
    );
    console.log('✅ Respuesta de JARVIS:');
    console.log(`[Modelo: ${res.data.modelUsed}]`);
    console.log(`Contenido: ${res.data.message.content}`);
  } catch (e: any) {
    if (e.response) {
      console.log('⚠️ Respuesta del Servidor:', e.response.data);
    } else {
      console.error('❌ Error de conexión:', e.message);
    }
  }

  console.log('\n⚡ 3. Probando conexión WebSocket...');
  const ws = new WebSocket('ws://localhost:3000');
  
  ws.on('open', () => {
    console.log('✅ Conectado por WebSocket a JARVIS. Enviando Ping...');
    ws.send(JSON.stringify({ type: 'ping' }));
  });

  ws.on('message', (data) => {
    console.log('📩 Mensaje recibido por WS:', data.toString());
    ws.close();
  });
}

testJarvis();
