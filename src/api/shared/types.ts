export interface TaskList {
  id: string;
  userId: string;
  name: string;
  createdAt: number;
  color: string | null;
  order: number;
  pinned: boolean;
}

export interface Task {
  id: string;
  userId: string;
  listId: string;
  name: string;
  iterations: number;
  subtasks: any[];
  completed: boolean;
  collapsed: boolean;
  isHighPriority: boolean;
  createdAt: number;
}
