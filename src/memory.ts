import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';

export interface MemoryItem {
  id?: number;
  category: string;
  fact: string;
  timestamp?: string;
}

export class JarvisMemory {
  private db: Database | null = null;

  async init() {
    const dbPath = path.resolve(__dirname, '../jarvis_memory.sqlite');
    this.db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_memory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        fact TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('🧠 [JarvisMemory] Base de datos de memoria persistente lista.');
  }

  // Guardar un dato en la memoria
  async remember(fact: string, category = 'general'): Promise<MemoryItem> {
    if (!this.db) await this.init();
    const result = await this.db!.run(
      'INSERT INTO user_memory (category, fact) VALUES (?, ?)',
      [category, fact]
    );
    return { id: result.lastID, category, fact };
  }

  // Obtener todos los recuerdos para el prompt del sistema
  async getAllMemories(): Promise<string[]> {
    if (!this.db) await this.init();
    const rows = await this.db!.all('SELECT category, fact FROM user_memory ORDER BY id DESC');
    return rows.map((r) => `[${r.category}] ${r.fact}`);
  }

  // Borrar un recuerdo por id
  async forget(id: number): Promise<boolean> {
    if (!this.db) await this.init();
    const res = await this.db!.run('DELETE FROM user_memory WHERE id = ?', [id]);
    return (res.changes || 0) > 0;
  }
}
