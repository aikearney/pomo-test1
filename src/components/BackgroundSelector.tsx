import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Image as ImageIcon, X, UploadSimple } from '@phosphor-icons/react'
import { toast } from 'sonner'

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

interface BackgroundSelectorProps {
  backgroundImage: string | null
  backgroundOpacity: number
  onBackgroundChange: (background: string | null) => void
  onOpacityChange: (opacity: number) => void
  onUpload: (file: File) => void
}

export function BackgroundSelector({
  backgroundImage,
  backgroundOpacity,
  onBackgroundChange,
  onOpacityChange,
  onUpload
}: BackgroundSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handlePresetSelect = (preset: typeof PRESET_BACKGROUNDS[0]) => {
    onBackgroundChange(preset.id)
    setIsOpen(false)
    toast.success('Background applied')
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be smaller than 5MB')
      return
    }

    onUpload(file)
    setIsOpen(false)
  }

  const handleRemove = () => {
    onBackgroundChange(null)
    toast.success('Background removed')
  }

  const isPreset = backgroundImage && !backgroundImage.startsWith('data:')
  const preset = isPreset ? PRESET_BACKGROUNDS.find(p => p.id === backgroundImage) : null

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          title="Change background"
        >
          <ImageIcon size={20} />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Background Settings</DialogTitle>
          <DialogDescription>
            Choose a preset background or upload your own image
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {backgroundImage && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Background Opacity</label>
                <span className="text-sm text-muted-foreground">{Math.round(backgroundOpacity * 100)}%</span>
              </div>
              <Slider
                value={[backgroundOpacity * 100]}
                onValueChange={([value]) => onOpacityChange(value / 100)}
                min={10}
                max={100}
                step={5}
                className="w-full"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleRemove}
                className="w-full"
              >
                <X size={16} className="mr-2" />
                Remove Background
              </Button>
            </div>
          )}

          <div className="space-y-3">
            <h3 className="text-sm font-medium">Preset Backgrounds</h3>
            <ScrollArea className="h-[300px]">
              <div className="grid grid-cols-3 gap-3 pr-4">
                {PRESET_BACKGROUNDS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => handlePresetSelect(preset)}
                    className="group relative aspect-video rounded-lg border-2 overflow-hidden transition-all hover:border-primary hover:scale-105"
                    style={{
                      backgroundImage: preset.url,
                      ...preset.style
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-2">
                      <span className="text-white text-xs font-medium">{preset.name}</span>
                    </div>
                    {backgroundImage === preset.id && (
                      <div className="absolute top-1 right-1 w-4 h-4 bg-primary rounded-full border-2 border-white" />
                    )}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-medium">Upload Custom Image</h3>
            <label htmlFor="custom-background-upload" className="block">
              <Card className="p-6 border-dashed cursor-pointer hover:border-primary hover:bg-accent/50 transition-colors">
                <div className="flex flex-col items-center gap-2 text-center">
                  <UploadSimple size={32} className="text-muted-foreground" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Click to upload</p>
                    <p className="text-xs text-muted-foreground">PNG, JPG or WEBP (max 5MB)</p>
                  </div>
                </div>
              </Card>
            </label>
            <input
              id="custom-background-upload"
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
