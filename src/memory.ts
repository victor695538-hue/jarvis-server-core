import fs from 'fs';
import path from 'path';

export interface TaskItem {
  id: string;
  title: string;
  dueDate?: string;
  completed: boolean;
  createdAt: string;
}

export interface FactItem {
  id: string;
  fact: string;
  category: string;
  createdAt: string;
}

export interface MemoryData {
  facts: FactItem[];
  tasks: TaskItem[];
}

export class JarvisMemory {
  private filePath: string;
  private data: MemoryData;

  constructor() {
    this.filePath = path.resolve(process.cwd(), 'jarvis_memory.json');
    this.data = this.loadData();
  }

  private loadData(): MemoryData {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error('Error cargando memoria JSON:', e);
    }
    return { facts: [], tasks: [] };
  }

  private saveData() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (e) {
      console.error('Error guardando memoria JSON:', e);
    }
  }

  // --- MEMORIA DE HECHOS / NOTAS ---
  async remember(fact: string, category = 'general'): Promise<FactItem> {
    const item: FactItem = {
      id: 'fact_' + Date.now(),
      fact,
      category,
      createdAt: new Date().toISOString(),
    };
    this.data.facts.unshift(item);
    this.saveData();
    return item;
  }

  async getAllMemories(): Promise<string[]> {
    return this.data.facts.map((f) => `[${f.category}] ${f.fact}`);
  }

  // --- TAREAS Y RECORDATORIOS ---
  async addTask(title: string, dueDate?: string): Promise<TaskItem> {
    const task: TaskItem = {
      id: 'task_' + Date.now(),
      title,
      dueDate,
      completed: false,
      createdAt: new Date().toISOString(),
    };
    this.data.tasks.unshift(task);
    this.saveData();
    return task;
  }

  async getPendingTasks(): Promise<TaskItem[]> {
    return this.data.tasks.filter((t) => !t.completed);
  }

  async completeTask(taskId: string): Promise<boolean> {
    const task = this.data.tasks.find((t) => t.id === taskId || t.title.toLowerCase().includes(taskId.toLowerCase()));
    if (task) {
      task.completed = true;
      this.saveData();
      return true;
    }
    return false;
  }
}
