export interface JarvisSkill {
  id: string;
  name: string;
  description: string;
  keywords: string[];
}

export const JARVIS_SKILLS: JarvisSkill[] = [
  {
    id: 'pcControl',
    name: 'Control Remoto de PC',
    description: 'Abre aplicaciones, toma capturas de pantalla, gestiona archivos y lista procesos en Windows.',
    keywords: ['abre', 'abrir', 'captura', 'screenshot', 'procesos', 'programas', 'crea carpeta', 'elimina'],
  },
  {
    id: 'imageGen',
    name: 'Generador de Imágenes FLUX',
    description: 'Genera imágenes artísticas y fotorrealistas a partir de descripciones por texto.',
    keywords: ['genera imagen', 'dibuja', 'crea imagen', 'diseña una foto', 'imagen de'],
  },
  {
    id: 'wakeOnLan',
    name: 'Wake-on-LAN (Encendido de PC)',
    description: 'Envía un paquete mágico a la tarjeta de red de la PC para encenderla a distancia.',
    keywords: ['enciende mi pc', 'prender ordenador', 'encender ordenador', 'wake pc'],
  },
  {
    id: 'visionAnalysis',
    name: 'Análisis Multimodal de Imágenes y Documentos',
    description: 'Lee y describe fotografías, código en pantallas, gráficos y documentos.',
    keywords: ['mira esta foto', 'analiza la imagen', 'qué ves en la foto', 'revisa este documento'],
  },
  {
    id: 'persistentMemory',
    name: 'Memoria Adaptativa',
    description: 'Recuerda datos del usuario, preferencias y notas entre sesiones.',
    keywords: ['recuerda que', 'guarda esto', 'olvida', 'mis preferencias'],
  },
];

export function findMatchingSkills(input: string): JarvisSkill[] {
  const lower = input.toLowerCase();
  return JARVIS_SKILLS.filter((skill) =>
    skill.keywords.some((kw) => lower.includes(kw.toLowerCase()))
  );
}
