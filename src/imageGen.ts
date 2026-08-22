import axios from 'axios';

export interface ImageGenResult {
  success: boolean;
  imageUrl?: string;
  imageBase64?: string;
  error?: string;
}

export async function generateImage(prompt: string): Promise<ImageGenResult> {
  try {
    const encodedPrompt = encodeURIComponent(prompt);
    const seed = Math.floor(Math.random() * 1000000);
    const imageUrl = `https://pollinations.ai/p/${encodedPrompt}?width=1024&height=1024&seed=${seed}&model=flux&nologo=true`;

    // Descargar imagen para convertir a base64 opcionalmente
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const imageBase64 = Buffer.from(response.data).toString('base64');

    return {
      success: true,
      imageUrl,
      imageBase64,
    };
  } catch (error: any) {
    console.error('Error generando imagen:', error.message);
    return {
      success: false,
      error: `Error al generar la imagen: ${error.message}`,
    };
  }
}
