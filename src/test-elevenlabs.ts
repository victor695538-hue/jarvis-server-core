import dotenv from 'dotenv';
dotenv.config();

async function testElevenLabs() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  console.log('🔍 Clave detectada:', apiKey ? `${apiKey.substring(0, 8)}...` : 'NINGUNA');

  try {
    const res = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': apiKey || '' },
    });
    const data = await res.json();
    if (data.voices) {
      console.log('✅ Conexión con ElevenLabs exitosa. Voces encontradas:', data.voices.length);
      const jarvis = data.voices.find((v: any) => v.name.toLowerCase().includes('jarvis') || v.name.toLowerCase().includes('paul'));
      if (jarvis) {
        console.log(`🎯 Voz encontrada: ${jarvis.name} (ID: ${jarvis.voice_id})`);
      } else {
        console.log('ℹ️ Ejemplo de Voz por defecto (Adam):', data.voices[0]?.voice_id);
      }
    } else {
      console.error('❌ Respuesta de ElevenLabs:', data);
    }
  } catch (e: any) {
    console.error('❌ Error de red con ElevenLabs:', e.message);
  }
}

testElevenLabs();
