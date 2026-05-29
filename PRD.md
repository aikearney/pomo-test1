# Pomodoro Task Timer

A focused productivity application that combines Pomodoro time management with hierarchical task tracking, designed for minimal screen space with always-visible timer display.

**Experience Qualities**: 
1. **Focused** - Clean, distraction-free interface that prioritizes the active timer and current task
2. **Compact** - Ultra-efficient use of space allowing the app to run in a small browser tab
3. **Purposeful** - Every element serves the core mission of time management and task completion

**Complexity Level**: Light Application (multiple features with basic state)
The app manages timer state, hierarchical tasks with subtasks, and persistent data, but maintains a focused single-view interface optimized for continuous visibility during work sessions.

## Essential Features

### Pomodoro Timer
- **Functionality**: Automated 25-minute work sessions with 5-minute breaks (15-minute break after 4 iterations)
- **Purpose**: Implements proven Pomodoro technique for sustained focus
- **Trigger**: User starts first task or manually starts timer
- **Progression**: Timer starts → 25min work countdown → Ring notification → 5min break → Ring → Next iteration → After 4th iteration: 15min break
- **Success criteria**: Timer accurately counts down, rings at completion, automatically transitions between work/break periods

### Task Management with Iterations
- **Functionality**: Create tasks with estimated iteration counts, organize with nested subtasks
- **Purpose**: Connect time blocks to actual work, provide progress visibility
- **Trigger**: User clicks "Add Task" button
- **Progression**: Click add → Enter task name → Set iteration count → Optionally add subtasks → Task appears in list with calculated total time
- **Success criteria**: Tasks persist across sessions, iteration counts sum correctly with subtasks, completed tasks reduce total count

### Collapsible Task Hierarchy
- **Functionality**: Expand/collapse tasks to show/hide subtasks, minimize entire task list
- **Purpose**: Maximize screen space efficiency while maintaining information access
- **Trigger**: Click collapse icon on task or global collapse button
- **Progression**: Click collapse → Subtasks hide → Parent shows summary → Click expand → Subtasks reveal
- **Success criteria**: Collapse state persists, total time calculations remain visible when collapsed

### Time Display Calculation
- **Functionality**: Real-time calculation of total remaining time across all tasks
- **Purpose**: Provides workload visibility and planning insight
- **Trigger**: Automatic on task changes
- **Progression**: Task added/modified → Calculate total iterations → Convert to time (25min work + breaks) → Display as d/h/m format
- **Success criteria**: Accurately calculates time including appropriate break periods, updates immediately on changes

### Recurring Tasks
- **Functionality**: Set tasks to automatically reappear after a specified time interval once completed
- **Purpose**: Manage routine maintenance tasks without manual re-entry
- **Trigger**: User clicks recurrence button on task and configures interval
- **Progression**: Click recurrence icon → Enable recurrence → Set interval (e.g., 4 weeks) → Select unit (days/weeks/months) → Complete task → Task stays in completed list → After interval passes → Task automatically reactivates at top of list with notification
- **Success criteria**: Tasks reactivate exactly after specified interval, appear at top of list, show countdown until reactivation, persist recurrence settings across sessions

### Recurring Task Templates Library
- **Functionality**: Pre-configured library of common household recurring tasks organized by category
- **Purpose**: Quick-start recurring tasks without manual configuration, provide inspiration for routine task management
- **Trigger**: User clicks "Templates" button in task list header
- **Progression**: Click Templates → Browse categories (Cleaning, Kitchen, Laundry, Outdoor, Maintenance, Pets, Self-Care, Organization) → Search templates → Click Add on desired template → Task added with pre-configured recurrence settings
- **Success criteria**: 35+ templates available, categorized and searchable, each template includes name, description, iteration count, and appropriate recurrence interval, templates create tasks with recurrence enabled by default

### Audio Control
- **Functionality**: Mute/unmute timer ring notifications
- **Purpose**: Accommodate different work environments and preferences
- **Trigger**: User clicks mute toggle
- **Progression**: Click mute icon → Audio disabled → Visual notification only → Click unmute → Audio restored
- **Success criteria**: Mute state persists across sessions, visual indicator shows current state

## Edge Case Handling

- **Empty Task List**: Display encouraging empty state with clear "Add Task" call-to-action
- **Zero Iteration Tasks**: Prevent task creation without iterations, show inline validation
- **Timer Running During Task Deletion**: Pause timer and show confirmation dialog before deletion
- **Completed Task During Active Session**: Mark complete but allow timer to finish current iteration
- **Browser Close Mid-Session**: Persist timer state including remaining time and current phase
- **Subtask Iteration Changes**: Recalculate parent totals immediately, validate changes don't create negative counts
- **Recurring Task Reactivation**: Check for tasks to reactivate on app load and every minute, move reactivated tasks to top of list
- **Recurring Task Deletion**: Allow deletion of recurring tasks even when completed, clear recurrence settings when task is deleted
- **Template Search No Results**: Show helpful message and clear search button when no templates match search query
- **Duplicate Template Additions**: Allow same template to be added multiple times (user may want multiple instances)

## Design Direction

The design should evoke **calm productivity** - a sense of controlled focus without anxiety. The interface should feel like a reliable companion that fades into the background while remaining instantly readable. Visual hierarchy should emphasize the active timer, with tasks as supporting context. The aesthetic should balance technical precision (exact time tracking) with organic warmth (encouraging progress).

## Color Selection

A focused productivity palette emphasizing calm readability and clear state differentiation.

- **Primary Color**: Deep indigo `oklch(0.35 0.12 270)` - Communicates focus and professionalism without harshness
- **Secondary Colors**: 
  - Soft slate `oklch(0.92 0.01 240)` for backgrounds and containers
  - Warm gray `oklch(0.65 0.02 260)` for muted text and borders
- **Accent Color**: Energetic coral `oklch(0.68 0.17 25)` for active timer state and completion celebrations
- **Foreground/Background Pairings**:
  - Primary (Deep Indigo): White text `oklch(0.98 0 0)` - Ratio 8.2:1 ✓
  - Background (Soft Slate): Dark text `oklch(0.25 0.02 270)` - Ratio 12.1:1 ✓
  - Accent (Coral): White text `oklch(0.98 0 0)` - Ratio 4.9:1 ✓
  - Muted text on background: Ratio 4.6:1 ✓

## Font Selection

Typography should project reliability and clarity at small sizes while maintaining personality.

- **Primary Typeface**: Space Grotesk for headings and timer display - geometric precision with subtle warmth
- **Body Typeface**: Inter for task text and UI elements - exceptional legibility at all sizes

- **Typographic Hierarchy**:
  - Timer Display: Space Grotesk Bold/48px/tight tracking (dominant visual element)
  - Current Task: Inter Semibold/16px/normal
  - Task List Items: Inter Regular/14px/relaxed
  - Subtasks: Inter Regular/13px/relaxed with reduced opacity
  - Time Summaries: Inter Medium/12px/wide tracking
  - UI Labels: Inter Medium/11px/uppercase/wide tracking

## Animations

Animations should reinforce the passage of time and celebrate progress without disrupting focus. Use subtle motion to guide attention during state transitions and provide satisfying feedback for task completion. Timer transitions should feel smooth and inevitable, like clockwork. Task completions deserve a moment of celebration through gentle motion and color shifts.

- **Timer Countdown**: Smooth progress bar animation with easing
- **Phase Transitions**: 300ms fade between work/break states with color shift
- **Task Completion**: Gentle scale bounce (1.0 → 1.02 → 1.0) with checkmark reveal
- **Collapse/Expand**: 250ms height animation with ease-out
- **Add Task**: Slide in from top with 200ms fade-in

## Component Selection

- **Components**:
  - **Card**: Timer display container with elevated shadow
  - **Button**: Primary actions (Start, Add Task) with hover states
  - **Input**: Task name entry with floating labels
  - **Checkbox**: Task and subtask completion states
  - **Collapsible**: Task hierarchy expansion/collapse
  - **Progress**: Visual timer countdown bar
  - **Badge**: Iteration count indicators
  - **Separator**: Subtle dividers between task groups
  - **Scroll Area**: Task list overflow handling
  - **Dialog**: Task templates library modal
  - **Tabs**: Category navigation in templates library

- **Customizations**:
  - **Compact Mode Toggle**: Custom minimal view that shows only timer and task count
  - **Mini Timer Card**: Custom floating timer component optimized for small window sizes
  - **Nested Task List**: Custom recursive component for subtask rendering
  - **Time Calculator Badge**: Custom component showing total time breakdown

- **States**:
  - **Buttons**: Distinct hover (bg darken 5%), active (scale 0.98), disabled (opacity 50%)
  - **Inputs**: Focus with accent border glow, error with red border and shake
  - **Tasks**: Hover highlight, active session with accent border, completed with strikethrough and fade
  - **Timer**: Active (accent color), paused (muted), break (secondary color)

- **Icon Selection**:
  - Play/Pause: Play, Pause from phosphor-icons
  - Tasks: CheckSquare, Square for completion
  - Hierarchy: CaretDown, CaretRight for expand/collapse
  - Actions: Plus for add, X for delete, Bell/BellSlash for audio
  - Time: Timer, Clock for phase indicators
  - Recurrence: ArrowClockwise for recurring task indicator and configuration
  - Templates: Books for template library button
  - Search: MagnifyingGlass for template search

- **Spacing**:
  - Container padding: `p-4` (16px) in normal mode, `p-2` (8px) in compact
  - Task list items: `py-2 px-3` with `gap-2` between elements
  - Section gaps: `gap-4` for major sections, `gap-2` for related items
  - Timer card: `p-6` with `gap-4` internal spacing

- **Mobile**: 
  - Timer remains prominent but scales down from 48px to 36px
  - Task list becomes full width below 768px
  - Add task button becomes floating action button
  - Collapse all tasks by default on mobile to save space
  - Touch targets minimum 44px for all interactive elements
