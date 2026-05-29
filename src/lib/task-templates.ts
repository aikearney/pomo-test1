import { RecurrenceUnit } from './types'

export interface TaskTemplate {
  id: string
  name: string
  category: TaskCategory
  iterations: number
  recurrenceInterval: number
  recurrenceUnit: RecurrenceUnit
  description: string
}

export type TaskCategory = 
  | 'cleaning'
  | 'maintenance'
  | 'kitchen'
  | 'laundry'
  | 'outdoor'
  | 'pets'
  | 'self-care'
  | 'organization'

export const TASK_TEMPLATES: TaskTemplate[] = [
  {
    id: 'clean-bathroom',
    name: 'Clean bathroom',
    category: 'cleaning',
    iterations: 1,
    recurrenceInterval: 1,
    recurrenceUnit: 'weeks',
    description: 'Deep clean sink, toilet, shower, and mirrors'
  },
  {
    id: 'vacuum-floors',
    name: 'Vacuum all floors',
    category: 'cleaning',
    iterations: 1,
    recurrenceInterval: 1,
    recurrenceUnit: 'weeks',
    description: 'Vacuum carpets and rugs throughout the house'
  },
  {
    id: 'mop-floors',
    name: 'Mop hard floors',
    category: 'cleaning',
    iterations: 1,
    recurrenceInterval: 2,
    recurrenceUnit: 'weeks',
    description: 'Mop kitchen, bathroom, and hallway floors'
  },
  {
    id: 'dust-surfaces',
    name: 'Dust all surfaces',
    category: 'cleaning',
    iterations: 1,
    recurrenceInterval: 2,
    recurrenceUnit: 'weeks',
    description: 'Dust shelves, furniture, and decorations'
  },
  {
    id: 'change-bedsheets',
    name: 'Change bed sheets',
    category: 'laundry',
    iterations: 1,
    recurrenceInterval: 2,
    recurrenceUnit: 'weeks',
    description: 'Wash and replace all bed linens'
  },
  {
    id: 'wash-towels',
    name: 'Wash bath towels',
    category: 'laundry',
    iterations: 1,
    recurrenceInterval: 1,
    recurrenceUnit: 'weeks',
    description: 'Launder all bathroom towels'
  },
  {
    id: 'laundry-wash',
    name: 'Do laundry',
    category: 'laundry',
    iterations: 1,
    recurrenceInterval: 1,
    recurrenceUnit: 'weeks',
    description: 'Wash, dry, and fold regular clothes'
  },
  {
    id: 'clean-fridge',
    name: 'Clean refrigerator',
    category: 'kitchen',
    iterations: 2,
    recurrenceInterval: 1,
    recurrenceUnit: 'months',
    description: 'Remove expired food, wipe shelves and drawers'
  },
  {
    id: 'clean-microwave',
    name: 'Clean microwave',
    category: 'kitchen',
    iterations: 1,
    recurrenceInterval: 2,
    recurrenceUnit: 'weeks',
    description: 'Clean interior and exterior of microwave'
  },
  {
    id: 'clean-oven',
    name: 'Clean oven',
    category: 'kitchen',
    iterations: 2,
    recurrenceInterval: 3,
    recurrenceUnit: 'months',
    description: 'Deep clean oven interior and racks'
  },
  {
    id: 'empty-dishwasher',
    name: 'Empty dishwasher',
    category: 'kitchen',
    iterations: 1,
    recurrenceInterval: 1,
    recurrenceUnit: 'days',
    description: 'Unload and put away clean dishes'
  },
  {
    id: 'take-out-trash',
    name: 'Take out trash',
    category: 'cleaning',
    iterations: 1,
    recurrenceInterval: 3,
    recurrenceUnit: 'days',
    description: 'Empty all trash bins and replace liners'
  },
  {
    id: 'water-plants',
    name: 'Water indoor plants',
    category: 'outdoor',
    iterations: 1,
    recurrenceInterval: 1,
    recurrenceUnit: 'weeks',
    description: 'Water all houseplants'
  },
  {
    id: 'mow-lawn',
    name: 'Mow lawn',
    category: 'outdoor',
    iterations: 2,
    recurrenceInterval: 2,
    recurrenceUnit: 'weeks',
    description: 'Cut grass and edge lawn'
  },
  {
    id: 'clean-gutters',
    name: 'Clean gutters',
    category: 'outdoor',
    iterations: 2,
    recurrenceInterval: 6,
    recurrenceUnit: 'months',
    description: 'Remove debris from roof gutters'
  },
  {
    id: 'wash-car',
    name: 'Wash car',
    category: 'maintenance',
    iterations: 1,
    recurrenceInterval: 2,
    recurrenceUnit: 'weeks',
    description: 'Exterior wash and interior vacuum'
  },
  {
    id: 'check-smoke-detectors',
    name: 'Test smoke detectors',
    category: 'maintenance',
    iterations: 1,
    recurrenceInterval: 6,
    recurrenceUnit: 'months',
    description: 'Test all smoke and carbon monoxide detectors'
  },
  {
    id: 'replace-air-filters',
    name: 'Replace HVAC filters',
    category: 'maintenance',
    iterations: 1,
    recurrenceInterval: 3,
    recurrenceUnit: 'months',
    description: 'Change air conditioning/heating filters'
  },
  {
    id: 'deep-clean-windows',
    name: 'Clean windows',
    category: 'cleaning',
    iterations: 2,
    recurrenceInterval: 3,
    recurrenceUnit: 'months',
    description: 'Clean interior and exterior windows'
  },
  {
    id: 'organize-closet',
    name: 'Organize closet',
    category: 'organization',
    iterations: 2,
    recurrenceInterval: 6,
    recurrenceUnit: 'months',
    description: 'Sort clothes, donate unused items'
  },
  {
    id: 'clean-carpets',
    name: 'Deep clean carpets',
    category: 'cleaning',
    iterations: 3,
    recurrenceInterval: 6,
    recurrenceUnit: 'months',
    description: 'Shampoo or steam clean all carpets'
  },
  {
    id: 'descale-kettle',
    name: 'Descale kettle',
    category: 'kitchen',
    iterations: 1,
    recurrenceInterval: 1,
    recurrenceUnit: 'months',
    description: 'Remove mineral buildup from electric kettle'
  },
  {
    id: 'clean-coffee-maker',
    name: 'Clean coffee maker',
    category: 'kitchen',
    iterations: 1,
    recurrenceInterval: 1,
    recurrenceUnit: 'months',
    description: 'Descale and clean coffee machine'
  },
  {
    id: 'wash-curtains',
    name: 'Wash curtains',
    category: 'laundry',
    iterations: 2,
    recurrenceInterval: 6,
    recurrenceUnit: 'months',
    description: 'Launder all window curtains and drapes'
  },
  {
    id: 'feed-pet',
    name: 'Feed pet',
    category: 'pets',
    iterations: 1,
    recurrenceInterval: 1,
    recurrenceUnit: 'days',
    description: 'Feed and refresh water for pet'
  },
  {
    id: 'clean-litter-box',
    name: 'Clean litter box',
    category: 'pets',
    iterations: 1,
    recurrenceInterval: 3,
    recurrenceUnit: 'days',
    description: 'Scoop and refresh cat litter'
  },
  {
    id: 'groom-pet',
    name: 'Groom pet',
    category: 'pets',
    iterations: 2,
    recurrenceInterval: 6,
    recurrenceUnit: 'weeks',
    description: 'Brush and bathe pet'
  },
  {
    id: 'floss-teeth',
    name: 'Floss teeth',
    category: 'self-care',
    iterations: 1,
    recurrenceInterval: 1,
    recurrenceUnit: 'days',
    description: 'Daily dental flossing routine'
  },
  {
    id: 'exercise',
    name: 'Exercise',
    category: 'self-care',
    iterations: 1,
    recurrenceInterval: 2,
    recurrenceUnit: 'days',
    description: 'Physical activity or workout session'
  },
  {
    id: 'meal-prep',
    name: 'Meal prep for week',
    category: 'kitchen',
    iterations: 3,
    recurrenceInterval: 1,
    recurrenceUnit: 'weeks',
    description: 'Prepare meals for the upcoming week'
  },
  {
    id: 'grocery-shopping',
    name: 'Food shopping',
    category: 'kitchen',
    iterations: 1,
    recurrenceInterval: 1,
    recurrenceUnit: 'weeks',
    description: 'Buy groceries and household essentials'
  },
  {
    id: 'pay-bills',
    name: 'Review and pay bills',
    category: 'organization',
    iterations: 1,
    recurrenceInterval: 1,
    recurrenceUnit: 'months',
    description: 'Check and pay monthly bills'
  },
  {
    id: 'budget-review',
    name: 'Review budget',
    category: 'organization',
    iterations: 2,
    recurrenceInterval: 1,
    recurrenceUnit: 'months',
    description: 'Track spending and update budget'
  },
  {
    id: 'clean-garage',
    name: 'Organize garage',
    category: 'organization',
    iterations: 3,
    recurrenceInterval: 6,
    recurrenceUnit: 'months',
    description: 'Sort and organize garage items'
  },
  {
    id: 'shred-documents',
    name: 'Shred old documents',
    category: 'organization',
    iterations: 1,
    recurrenceInterval: 3,
    recurrenceUnit: 'months',
    description: 'Securely dispose of old paperwork'
  },
  {
    id: 'clean-dishwasher',
    name: 'Clean dishwasher',
    category: 'kitchen',
    iterations: 1,
    recurrenceInterval: 1,
    recurrenceUnit: 'months',
    description: 'Run cleaning cycle and wipe down interior'
  },
  {
    id: 'clean-washing-machine',
    name: 'Clean washing machine',
    category: 'laundry',
    iterations: 1,
    recurrenceInterval: 1,
    recurrenceUnit: 'months',
    description: 'Run cleaning cycle to remove buildup'
  },
  {
    id: 'fertilize-plants',
    name: 'Fertilize plants',
    category: 'outdoor',
    iterations: 1,
    recurrenceInterval: 1,
    recurrenceUnit: 'months',
    description: 'Feed indoor and outdoor plants'
  },
  {
    id: 'meal-plan-week',
    name: 'Plan meals for the week',
    category: 'kitchen',
    iterations: 2,
    recurrenceInterval: 1,
    recurrenceUnit: 'weeks',
    description: 'Plan breakfast, lunch, and dinner for the upcoming week'
  },
  {
    id: 'plan-sunday-dinner',
    name: 'Plan Sunday dinner',
    category: 'kitchen',
    iterations: 2,
    recurrenceInterval: 1,
    recurrenceUnit: 'weeks',
    description: 'Plan and prepare ingredients for Sunday family dinner'
  },
  {
    id: 'pack-school-lunches',
    name: 'Pack school lunches for week',
    category: 'kitchen',
    iterations: 2,
    recurrenceInterval: 1,
    recurrenceUnit: 'weeks',
    description: 'Prepare and pack school lunches for the week ahead'
  }
]

export const CATEGORY_LABELS: Record<TaskCategory, string> = {
  cleaning: 'Cleaning',
  maintenance: 'Maintenance',
  kitchen: 'Kitchen',
  laundry: 'Laundry',
  outdoor: 'Outdoor',
  pets: 'Pets',
  'self-care': 'Self-Care',
  organization: 'Organization'
}

export const CATEGORY_ICONS: Record<TaskCategory, string> = {
  cleaning: '🧹',
  maintenance: '🔧',
  kitchen: '🍳',
  laundry: '🧺',
  outdoor: '🌱',
  pets: '🐾',
  'self-care': '💆',
  organization: '📋'
}

export function getTemplatesByCategory(category: TaskCategory): TaskTemplate[] {
  return TASK_TEMPLATES.filter(template => template.category === category)
}

export function getAllCategories(): TaskCategory[] {
  return Array.from(new Set(TASK_TEMPLATES.map(t => t.category)))
}

export function searchTemplates(query: string): TaskTemplate[] {
  const lowerQuery = query.toLowerCase()
  return TASK_TEMPLATES.filter(
    template =>
      template.name.toLowerCase().includes(lowerQuery) ||
      template.description.toLowerCase().includes(lowerQuery)
  )
}
