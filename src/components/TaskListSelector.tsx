import { useState, useRef } from 'react'
import { TaskList } from '@/lib/types'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { CaretDown, Plus, Trash, PencilSimple, Check, X, Copy, ChartBar, Image, UploadSimple, DownloadSimple, Palette } from '@phosphor-icons/react'
import { toast } from 'sonner'

type ImportLocalDataOptions = {
  mode: 'overwrite-current' | 'new-list' | 'restore-all-replace' | 'restore-all-merge'
  newListName?: string
  sourceListId?: string
}

type ImportableBackupList = {
  id: string
  name: string
}

interface TaskListSelectorProps {
  taskLists: TaskList[]
  currentTaskListId: string
  onSelectTaskList: (taskListId: string) => void
  onCreateTaskList: (name: string) => void
  onRenameTaskList: (taskListId: string, newName: string) => void
  onDeleteTaskList: (taskListId: string) => void
  onDuplicateTaskList: (taskListId: string) => void
  onShowStatistics?: () => void
  backgroundImage: string | null
  backgroundOpacity: number
  onBackgroundChange: (background: string | null) => void
  onOpacityChange: (opacity: number) => void
  onUpload: (file: File) => void
  onExportLocalData?: (filename: string) => void
  onImportLocalData?: (file: File, options: ImportLocalDataOptions) => void
  isAnonymousMode?: boolean
  isAuthenticated?: boolean
  onLogin?: () => void
  onLogout?: () => void
}

const PRESET_BACKGROUNDS = [
  {
    id: 'gradient-1',
    name: 'Purple Wave',
    url: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
  },
  {
    id: 'gradient-2',
    name: 'Ocean Blue',
    url: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
  },
  {
    id: 'gradient-3',
    name: 'Sunset',
    url: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
  },
  {
    id: 'gradient-4',
    name: 'Forest',
    url: 'linear-gradient(135deg, #0ba360 0%, #3cba92 100%)'
  },
  {
    id: 'gradient-5',
    name: 'Midnight',
    url: 'linear-gradient(135deg, #2e3192 0%, #1bffff 100%)'
  },
  {
    id: 'gradient-6',
    name: 'Rose Gold',
    url: 'linear-gradient(135deg, #ff6a00 0%, #ee0979 100%)'
  },
  {
    id: 'pattern-1',
    name: 'Dots',
    url: 'radial-gradient(circle, oklch(0.45 0.15 260) 1px, transparent 1px)',
    style: { backgroundSize: '20px 20px' }
  },
  {
    id: 'pattern-2',
    name: 'Grid',
    url: 'linear-gradient(oklch(0.45 0.15 260 / 0.1) 1px, transparent 1px), linear-gradient(90deg, oklch(0.45 0.15 260 / 0.1) 1px, transparent 1px)',
    style: { backgroundSize: '30px 30px' }
  },
  {
    id: 'pattern-3',
    name: 'Diagonal',
    url: 'repeating-linear-gradient(45deg, transparent, transparent 10px, oklch(0.45 0.15 260 / 0.05) 10px, oklch(0.45 0.15 260 / 0.05) 20px)',
    style: {}
  },
  {
    id: 'mesh-1',
    name: 'Purple Mesh',
    url: 'radial-gradient(at 0% 0%, oklch(0.45 0.15 260) 0px, transparent 50%), radial-gradient(at 100% 0%, oklch(0.55 0.20 300) 0px, transparent 50%), radial-gradient(at 100% 100%, oklch(0.50 0.18 280) 0px, transparent 50%), radial-gradient(at 0% 100%, oklch(0.60 0.15 250) 0px, transparent 50%)',
    style: { backgroundColor: 'oklch(0.98 0.002 240)' }
  },
  {
    id: 'mesh-2',
    name: 'Blue Mesh',
    url: 'radial-gradient(at 0% 0%, oklch(0.60 0.20 220) 0px, transparent 50%), radial-gradient(at 100% 0%, oklch(0.55 0.18 200) 0px, transparent 50%), radial-gradient(at 100% 100%, oklch(0.65 0.15 240) 0px, transparent 50%), radial-gradient(at 0% 100%, oklch(0.50 0.22 210) 0px, transparent 50%)',
    style: { backgroundColor: 'oklch(0.98 0.002 240)' }
  },
  {
    id: 'mesh-3',
    name: 'Warm Mesh',
    url: 'radial-gradient(at 0% 0%, oklch(0.70 0.15 60) 0px, transparent 50%), radial-gradient(at 100% 0%, oklch(0.65 0.18 40) 0px, transparent 50%), radial-gradient(at 100% 100%, oklch(0.60 0.20 20) 0px, transparent 50%), radial-gradient(at 0% 100%, oklch(0.75 0.12 80) 0px, transparent 50%)',
    style: { backgroundColor: 'oklch(0.98 0.002 240)' }
  }
]

export function TaskListSelector({
  taskLists,
  currentTaskListId,
  onSelectTaskList,
  onCreateTaskList,
  onRenameTaskList,
  onDeleteTaskList,
  onDuplicateTaskList,
  onShowStatistics,
  backgroundImage,
  backgroundOpacity,
  onBackgroundChange,
  onOpacityChange,
  onUpload,
  onExportLocalData,
  onImportLocalData,
  isAnonymousMode = false,
  isAuthenticated = false,
  onLogin,
  onLogout,
}: TaskListSelectorProps) {
  const [isCreating, setIsCreating] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [editingListId, setEditingListId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [deleteConfirmListId, setDeleteConfirmListId] = useState<string | null>(null)
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null)
  const [showImportChoiceDialog, setShowImportChoiceDialog] = useState(false)
  const [showImportListDialog, setShowImportListDialog] = useState(false)
  const [importableBackupLists, setImportableBackupLists] = useState<ImportableBackupList[]>([])
  const [showExportNameDialog, setShowExportNameDialog] = useState(false)
  const [exportFileName, setExportFileName] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const editInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const importInputRef = useRef<HTMLInputElement>(null)

  const currentTaskList = taskLists.find(list => list.id === currentTaskListId)

  const handleCreate = () => {
    if (!newListName.trim()) {
      toast.error('Please enter a list name')
      return
    }
    onCreateTaskList(newListName.trim())
    setNewListName('')
    setIsCreating(false)
  }

  const handleRename = (listId: string) => {
    if (!editingName.trim()) {
      toast.error('Please enter a list name')
      return
    }
    onRenameTaskList(listId, editingName.trim())
    setEditingListId(null)
    setEditingName('')
  }

  const handleDelete = () => {
    if (deleteConfirmListId) {
      onDeleteTaskList(deleteConfirmListId)
      setDeleteConfirmListId(null)
    }
  }

  const startEditing = (list: TaskList, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingListId(list.id)
    setEditingName(list.name)
    setTimeout(() => editInputRef.current?.focus(), 50)
  }

  const cancelEditing = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingListId(null)
    setEditingName('')
  }

  const confirmEditing = (listId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    handleRename(listId)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onUpload(file)
    }
  }

  const getImportableBackupLists = async (file: File) => {
    const raw = await file.text()
    const parsed = JSON.parse(raw) as {
      entries?: Record<string, string>
    }
    const entries = parsed?.entries

    if (!entries || typeof entries !== 'object') {
      throw new Error('Invalid backup file')
    }

    const lists: ImportableBackupList[] = []
    const manifestRaw = entries['pomodoro-local-lists']
    if (typeof manifestRaw === 'string') {
      try {
        const manifest = JSON.parse(manifestRaw) as Array<{ id?: string; name?: string }>
        if (Array.isArray(manifest)) {
          for (const list of manifest) {
            if (list?.id && list?.name) {
              lists.push({ id: list.id, name: list.name })
            }
          }
        }
      } catch {
        // Ignore malformed list manifests and fall back to personal if possible.
      }
    }

    if (typeof entries.personalTasks === 'string' && !lists.some((list) => list.id === 'personal')) {
      lists.unshift({ id: 'personal', name: 'Personal' })
    }

    if (!lists.length) {
      throw new Error('No importable lists were found in this backup')
    }

    return lists
  }

  const handleImportUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''

    if (file) {
      try {
        const lists = await getImportableBackupLists(file)
        setPendingImportFile(file)
        setImportableBackupLists(lists)
        setShowImportChoiceDialog(true)
        setIsOpen(false)
      } catch (err: any) {
        toast.error('Invalid backup file', {
          description: err?.message || 'Please choose a valid backup JSON file.',
        })
      }
    }
  }

  const resetImportFlow = () => {
    setPendingImportFile(null)
    setShowImportChoiceDialog(false)
    setShowImportListDialog(false)
    setImportableBackupLists([])
  }

  const handleImportSingleList = () => {
    if (!pendingImportFile) {
      resetImportFlow()
      return
    }
    setShowImportChoiceDialog(false)
    setShowImportListDialog(true)
  }

  const handleImportSelectedList = (sourceList: ImportableBackupList) => {
    if (!pendingImportFile) {
      resetImportFlow()
      return
    }

    onImportLocalData?.(pendingImportFile, {
      mode: 'overwrite-current',
      sourceListId: sourceList.id,
    })
    resetImportFlow()
  }

  const handleRestoreAllReplace = () => {
    if (!pendingImportFile) { resetImportFlow(); return }
    onImportLocalData?.(pendingImportFile, { mode: 'restore-all-replace' })
    resetImportFlow()
  }

  const handleRestoreAllMerge = () => {
    if (!pendingImportFile) { resetImportFlow(); return }
    onImportLocalData?.(pendingImportFile, { mode: 'restore-all-merge' })
    resetImportFlow()
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />
      <input
        ref={importInputRef}
        type="file"
        accept="application/json"
        onChange={handleImportUpload}
        className="hidden"
      />
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2 max-w-[min(62vw,16rem)] justify-between">
            <span className="font-medium truncate">{currentTaskList?.name || 'Select List'}</span>
            <CaretDown size={16} weight="bold" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel className="font-bold underline">Task Lists</DropdownMenuLabel>
          {taskLists.map(list => (
            <DropdownMenuItem
              key={list.id}
              onClick={() => {
                if (editingListId !== list.id) {
                  onSelectTaskList(list.id)
                }
              }}
              className={`${
                list.id === currentTaskListId ? 'bg-accent' : ''
              } ${editingListId === list.id ? 'p-0' : ''}`}
            >
              {editingListId === list.id ? (
                <div className="flex items-center gap-2 w-full p-2" onClick={(e) => e.stopPropagation()}>
                  <Input
                    ref={editInputRef}
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      e.stopPropagation()
                      if (e.key === 'Enter') {
                        handleRename(list.id)
                      } else if (e.key === 'Escape') {
                        setEditingListId(null)
                        setEditingName('')
                      }
                    }}
                    className="flex-1 h-8"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    onClick={(e) => confirmEditing(list.id, e)}
                  >
                    <Check size={16} />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    onClick={cancelEditing}
                  >
                    <X size={16} />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between w-full">
                  <span className="flex-1">{list.name}</span>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDuplicateTaskList(list.id)
                      }}
                      title="Duplicate list"
                    >
                      <Copy size={16} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={(e) => startEditing(list, e)}
                      title="Rename list"
                    >
                      <PencilSimple size={16} />
                    </Button>
                    {taskLists.length > 1 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteConfirmListId(list.id)
                        }}
                        title="Delete list"
                      >
                        <Trash size={16} />
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          {isAnonymousMode && (onExportLocalData || onImportLocalData) && (
            <>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <DownloadSimple size={16} className="mr-2" />
                  Local Data
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-56">
                  {onExportLocalData && (
                    <DropdownMenuItem
                      onClick={() => {
                        const today = new Date().toISOString().split('T')[0]
                        setExportFileName(`pomodoro-backup-${today}`)
                        setShowExportNameDialog(true)
                        setIsOpen(false)
                      }}
                    >
                      <DownloadSimple size={16} className="mr-2" />
                      Export Backup
                    </DropdownMenuItem>
                  )}
                  {onImportLocalData && (
                    <DropdownMenuItem
                      onClick={() => importInputRef.current?.click()}
                    >
                      <UploadSimple size={16} className="mr-2" />
                      Import Backup
                    </DropdownMenuItem>
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
            </>
          )}
          {isCreating ? (
            <div className="p-2 space-y-2" onClick={(e) => e.stopPropagation()}>
              <Input
                ref={inputRef}
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation()
                  if (e.key === 'Enter') {
                    handleCreate()
                  } else if (e.key === 'Escape') {
                    setIsCreating(false)
                    setNewListName('')
                  }
                }}
                placeholder="List name"
                autoFocus
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleCreate} className="flex-1">
                  Create
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setIsCreating(false)
                    setNewListName('')
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault()
                setIsCreating(true)
                setTimeout(() => inputRef.current?.focus(), 50)
              }}
            >
              <Plus size={16} className="mr-2" />
              New List
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {onShowStatistics && (
            <>
              <DropdownMenuItem
                onClick={() => {
                  onShowStatistics()
                  setIsOpen(false)
                }}
              >
                <ChartBar size={16} className="mr-2" />
                Statistics
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          {(onLogin || onLogout) && (
            <>
              <DropdownMenuItem
                onClick={() => {
                  if (isAuthenticated) {
                    onLogout?.()
                  } else {
                    onLogin?.()
                  }
                  setIsOpen(false)
                }}
              >
                {isAuthenticated ? 'Logout' : 'Login'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Image size={16} className="mr-2" />
              Background
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-56">
              <DropdownMenuItem onClick={() => onBackgroundChange(null)}>
                <X size={16} className="mr-2" />
                None
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Gradients</DropdownMenuLabel>
              {PRESET_BACKGROUNDS.filter(bg => bg.id.startsWith('gradient')).map(bg => (
                <DropdownMenuItem
                  key={bg.id}
                  onClick={() => onBackgroundChange(bg.id)}
                >
                  <div className="flex items-center gap-2 w-full">
                    <div 
                      className="w-4 h-4 rounded border border-border"
                      style={{ background: bg.url }}
                    />
                    <span className="flex-1">{bg.name}</span>
                    {backgroundImage === bg.id && <Check size={16} />}
                  </div>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Patterns</DropdownMenuLabel>
              {PRESET_BACKGROUNDS.filter(bg => bg.id.startsWith('pattern')).map(bg => (
                <DropdownMenuItem
                  key={bg.id}
                  onClick={() => onBackgroundChange(bg.id)}
                >
                  <div className="flex items-center gap-2 w-full">
                    <div 
                      className="w-4 h-4 rounded border border-border"
                      style={{ background: bg.url, ...bg.style }}
                    />
                    <span className="flex-1">{bg.name}</span>
                    {backgroundImage === bg.id && <Check size={16} />}
                  </div>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Mesh Gradients</DropdownMenuLabel>
              {PRESET_BACKGROUNDS.filter(bg => bg.id.startsWith('mesh')).map(bg => (
                <DropdownMenuItem
                  key={bg.id}
                  onClick={() => onBackgroundChange(bg.id)}
                >
                  <div className="flex items-center gap-2 w-full">
                    <div 
                      className="w-4 h-4 rounded border border-border"
                      style={{ background: bg.url, ...bg.style }}
                    />
                    <span className="flex-1">{bg.name}</span>
                    {backgroundImage === bg.id && <Check size={16} />}
                  </div>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                <UploadSimple size={16} className="mr-2" />
                Upload Image
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          {backgroundImage && (
            <div className="p-2" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2 mb-1">
                <Palette size={14} className="text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Opacity</span>
              </div>
              <Slider
                value={[backgroundOpacity]}
                onValueChange={([value]) => onOpacityChange(value)}
                min={0}
                max={1}
                step={0.05}
                className="w-full"
              />
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={showExportNameDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowExportNameDialog(false)
            setExportFileName('')
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Name your backup file</AlertDialogTitle>
            <AlertDialogDescription>
              Choose a filename for the backup. A <code>.json</code> extension will be added automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Input
              value={exportFileName}
              onChange={(e) => setExportFileName(e.target.value)}
              placeholder="pomodoro-backup"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const name = exportFileName.trim()
                  if (name) {
                    setShowExportNameDialog(false)
                    onExportLocalData?.(name)
                  }
                }
              }}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setShowExportNameDialog(false); setExportFileName('') }}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const name = exportFileName.trim()
                if (!name) {
                  toast.error('Please enter a filename')
                  return
                }
                setShowExportNameDialog(false)
                onExportLocalData?.(name)
              }}
            >
              Save backup
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteConfirmListId !== null} onOpenChange={(open) => !open && setDeleteConfirmListId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task List?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{taskLists.find(l => l.id === deleteConfirmListId)?.name}"? All tasks in this list will be permanently deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={showImportChoiceDialog}
        onOpenChange={setShowImportChoiceDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import local backup</AlertDialogTitle>
            <AlertDialogDescription>How would you like to import this backup?</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <button
              className="w-full text-left rounded-md border px-4 py-3 hover:bg-accent transition-colors"
              onClick={handleRestoreAllMerge}
            >
              <div className="font-medium">Merge with existing lists</div>
              <div className="text-sm text-muted-foreground">Adds lists from the backup. Lists you already have are kept as-is.</div>
            </button>
            <button
              className="w-full text-left rounded-md border px-4 py-3 hover:bg-accent transition-colors"
              onClick={handleRestoreAllReplace}
            >
              <div className="font-medium">Replace all lists</div>
              <div className="text-sm text-muted-foreground">Removes your current lists and restores everything from the backup.</div>
            </button>
            <button
              className="w-full text-left rounded-md border px-4 py-3 hover:bg-accent transition-colors"
              onClick={handleImportSingleList}
            >
              <div className="font-medium">Import one list by name</div>
              <div className="text-sm text-muted-foreground">Choose exactly one list from this backup to import into your current list.</div>
            </button>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={resetImportFlow}>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={showImportListDialog}
        onOpenChange={setShowImportListDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Choose a list to import</AlertDialogTitle>
            <AlertDialogDescription>
              Select one list from this backup.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {importableBackupLists.map((list) => (
              <button
                key={list.id}
                className="w-full text-left rounded-md border px-4 py-3 hover:bg-accent transition-colors"
                onClick={() => handleImportSelectedList(list)}
              >
                <div className="font-medium">{list.name}</div>
                <div className="text-sm text-muted-foreground">{list.id}</div>
              </button>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={resetImportFlow}>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
