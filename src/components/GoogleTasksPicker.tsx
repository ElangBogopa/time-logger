'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, AlertCircle, ExternalLink } from 'lucide-react'
import { csrfFetch } from '@/lib/api'

interface GoogleTask {
  id: string
  title: string
  notes?: string
  dueDate?: string
  listName: string
}

interface GoogleTasksPickerProps {
  isOpen: boolean
  onClose: () => void
  onImport: (tasks: string[]) => void
  existingTaskCount?: number
}

export default function GoogleTasksPicker({ isOpen, onClose, onImport, existingTaskCount = 0 }: GoogleTasksPickerProps) {
  const [tasks, setTasks] = useState<GoogleTask[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (isOpen) {
      fetchTasks()
    }
  }, [isOpen])

  const fetchTasks = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await csrfFetch('/api/tasks/google')
      
      if (!response.ok) {
        const errorData = await response.json()
        if (errorData.code === 'NO_CALENDAR') {
          setError('no_calendar')
        } else if (errorData.code === 'TOKEN_EXPIRED') {
          setError('token_expired')
        } else {
          setError('fetch_failed')
        }
        return
      }

      const data = await response.json()
      setTasks(data.tasks || [])
    } catch (err) {
      console.error('Failed to fetch Google Tasks:', err)
      setError('fetch_failed')
    } finally {
      setLoading(false)
    }
  }

  const handleTaskToggle = (taskId: string) => {
    const newSelected = new Set(selectedTasks)
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId)
    } else {
      newSelected.add(taskId)
    }
    setSelectedTasks(newSelected)
  }

  const handleImport = () => {
    const selectedTaskTitles = tasks
      .filter(task => selectedTasks.has(task.id))
      .map(task => task.title)
    
    onImport(selectedTaskTitles)
    onClose()
    setSelectedTasks(new Set())
  }

  const groupTasksByList = () => {
    const groups: { [key: string]: GoogleTask[] } = {}
    tasks.forEach(task => {
      if (!groups[task.listName]) {
        groups[task.listName] = []
      }
      groups[task.listName].push(task)
    })
    return groups
  }

  const taskGroups = groupTasksByList()
  const hasSelectedTasks = selectedTasks.size > 0

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import from Google Tasks</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          {loading && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                <p className="text-sm text-muted-foreground">Loading your Google Tasks...</p>
              </div>
            </div>
          )}

          {error === 'no_calendar' && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-4">
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <AlertCircle className="h-5 w-5" />
                  <span>Google Calendar not connected</span>
                </div>
                <p className="text-sm text-muted-foreground max-w-sm">
                  To import tasks from Google Tasks, you need to connect your Google Calendar first.
                </p>
                <Button 
                  onClick={() => window.open('/api/calendar/connect', '_blank')}
                  variant="outline"
                  className="gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  Connect Google Calendar
                </Button>
              </div>
            </div>
          )}

          {error === 'token_expired' && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-4">
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <AlertCircle className="h-5 w-5" />
                  <span>Connection expired</span>
                </div>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Your Google Calendar connection has expired. Please reconnect to continue.
                </p>
                <Button 
                  onClick={() => window.open('/api/calendar/connect', '_blank')}
                  variant="outline"
                  className="gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  Reconnect Google Calendar
                </Button>
              </div>
            </div>
          )}

          {error === 'fetch_failed' && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-4">
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <AlertCircle className="h-5 w-5" />
                  <span>Failed to load tasks</span>
                </div>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Something went wrong while loading your Google Tasks. Please try again.
                </p>
                <Button onClick={fetchTasks} variant="outline">
                  Try Again
                </Button>
              </div>
            </div>
          )}

          {!loading && !error && tasks.length === 0 && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">No tasks found in Google Tasks</p>
                <p className="text-xs text-muted-foreground/60">Create some tasks in Google Tasks to import them here.</p>
              </div>
            </div>
          )}

          {!loading && !error && tasks.length > 0 && (
            <div className="flex-1 overflow-y-auto space-y-6">
              {Object.entries(taskGroups).map(([listName, listTasks]) => (
                <div key={listName} className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground">{listName}</h3>
                  <div className="space-y-2">
                    {listTasks.map((task) => (
                      <div key={task.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                        <Checkbox
                          checked={selectedTasks.has(task.id)}
                          onCheckedChange={() => handleTaskToggle(task.id)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 space-y-1">
                          <p className="text-sm font-medium text-foreground">{task.title}</p>
                          {task.notes && (
                            <p className="text-xs text-muted-foreground line-clamp-2">{task.notes}</p>
                          )}
                          {task.dueDate && (
                            <p className="text-xs text-muted-foreground/60">
                              Due: {new Date(task.dueDate).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            {selectedTasks.size} task{selectedTasks.size !== 1 ? 's' : ''} selected
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleImport} 
              disabled={!hasSelectedTasks}
            >
              Import Selected
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}