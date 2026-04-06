import { AnimatePresence } from 'framer-motion'
import { AddEventSheet, REPEAT_INTERVAL_DAYS } from '../../components/AddEventSheet'
import { EditEventSheet } from '../../components/EditEventSheet'
import { EventDetailSheet } from '../../components/EventDetailSheet'
import { BackgroundDetailSheet } from '../../components/BackgroundDetailSheet'
import type { Event } from '../../types'

interface CalendarOverlaysProps {
  selectedEvent: { event: Event; date: string } | null
  setSelectedEvent: (value: { event: Event; date: string } | null) => void
  selectedBackgroundEvent: { event: Event; date: string } | null
  setSelectedBackgroundEvent: (value: { event: Event; date: string } | null) => void
  dayEvents: Event[]
  isAdding: boolean
  selectedDate: string
  addEventDateOverride: string | null
  addFlowSaved: boolean
  setAddFlowSaved: (value: boolean) => void
  setIsAdding: (value: boolean) => void
  setAddEventDateOverride: (value: string | null) => void
  editingEvent: { event: Event; date: string; scope: 'this' | 'all' } | null
  setEditingEvent: (value: { event: Event; date: string; scope: 'this' | 'all' } | null) => void
  addEvent: (date: string, input: Omit<Event, 'id'>) => Promise<void>
  addRecurring: (startDate: string, endDate: string, intervalDays: number, input: Omit<Event, 'id'>) => Promise<void>
  updateEvent: (
    date: string,
    eventId: string,
    updates: Partial<Pick<Event, 'personId' | 'title' | 'start' | 'end' | 'notes' | 'location' | 'reminderMinutes' | 'metadata'>>,
    newDate?: string
  ) => Promise<void>
  updateAllInSeries: (
    groupId: string,
    updates: Partial<Pick<Event, 'personId' | 'title' | 'start' | 'end' | 'notes' | 'location' | 'reminderMinutes'>>
  ) => Promise<void>
  deleteEvent: (date: string, eventId: string) => Promise<void>
  deleteAllInSeries: (groupId: string) => Promise<void>
  showSavingFeedback: () => void
  showSaveFeedback: () => void
  showSaveError: () => void
  showUndo: (config: { message: string; onUndo: () => Promise<void> }) => void
  onAddFlowSaved: () => void
  onAddFlowClosedWithoutSave: () => void
  onConflictResolved: () => void
}

export function CalendarOverlays({
  selectedEvent,
  setSelectedEvent,
  selectedBackgroundEvent,
  setSelectedBackgroundEvent,
  dayEvents,
  isAdding,
  selectedDate,
  addEventDateOverride,
  addFlowSaved,
  setAddFlowSaved,
  setIsAdding,
  setAddEventDateOverride,
  editingEvent,
  setEditingEvent,
  addEvent,
  addRecurring,
  updateEvent,
  updateAllInSeries,
  deleteEvent,
  deleteAllInSeries,
  showSavingFeedback,
  showSaveFeedback,
  showSaveError,
  showUndo,
  onAddFlowSaved,
  onAddFlowClosedWithoutSave,
  onConflictResolved,
}: CalendarOverlaysProps) {
  return (
    <AnimatePresence>
      {selectedEvent && (
        <EventDetailSheet
          key={selectedEvent.event.id}
          event={selectedEvent.event}
          date={selectedEvent.date}
          onClose={() => setSelectedEvent(null)}
          onDuplicate={async (targetDate, start, end) => {
            const { event } = selectedEvent
            if (!event) return
            showSavingFeedback()
            try {
              const { id: _id, ...rest } = event
              await addEvent(targetDate, { ...rest, start, end })
              showSaveFeedback()
            } catch {
              showSaveError()
            }
          }}
          onEdit={(scope) => {
            setEditingEvent({ ...selectedEvent, scope })
            setSelectedEvent(null)
          }}
          onDelete={async (scope) => {
            showSavingFeedback()
            try {
              if (scope === 'all' && selectedEvent.event.recurrenceGroupId) {
                await deleteAllInSeries(selectedEvent.event.recurrenceGroupId)
                showSaveFeedback()
                return
              }
              const eventSnapshot = { ...selectedEvent.event }
              const eventDate = selectedEvent.date
              await deleteEvent(eventDate, eventSnapshot.id)
              showUndo({
                message: `"${eventSnapshot.title}" ble slettet`,
                onUndo: async () => {
                  const { id: _id, ...rest } = eventSnapshot
                  await addEvent(eventDate, rest)
                },
              })
              showSaveFeedback()
            } catch {
              showSaveError()
            }
          }}
        />
      )}
      {selectedBackgroundEvent && (
        <BackgroundDetailSheet
          event={selectedBackgroundEvent.event}
          date={selectedBackgroundEvent.date}
          foregroundEvents={dayEvents}
          onResolveConflict={async (decision) => {
            showSavingFeedback()
            try {
              const previousResolutions = (selectedBackgroundEvent.event.metadata?.conflictResolution ?? []) as unknown[]
              const nextResolution = {
                ...decision,
                resolvedAt: new Date().toISOString(),
              }
              const nextMetadata = {
                ...(selectedBackgroundEvent.event.metadata ?? {}),
                conflictResolution: [...previousResolutions, nextResolution],
              }
              await updateEvent(selectedBackgroundEvent.date, selectedBackgroundEvent.event.id, { metadata: nextMetadata })
              onConflictResolved()
              showSaveFeedback()
            } catch {
              showSaveError()
            }
          }}
          onClose={() => setSelectedBackgroundEvent(null)}
        />
      )}
      {isAdding && (
        <AddEventSheet
          key={`add-${addEventDateOverride ?? selectedDate}`}
          date={addEventDateOverride ?? selectedDate}
          onSave={async (data, options) => {
            const targetDate = addEventDateOverride ?? selectedDate
            showSavingFeedback()
            try {
              if (options && options.repeat !== 'none' && options.endDate) {
                const interval = REPEAT_INTERVAL_DAYS[options.repeat]
                await addRecurring(targetDate, options.endDate, interval, data)
              } else {
                await addEvent(targetDate, data)
              }
              setAddFlowSaved(true)
              onAddFlowSaved()
              showSaveFeedback()
            } catch {
              showSaveError()
            }
          }}
          onClose={() => {
            if (!addFlowSaved) onAddFlowClosedWithoutSave()
            setIsAdding(false)
            setAddEventDateOverride(null)
          }}
        />
      )}
      {editingEvent && (
        <EditEventSheet
          key={`edit-${editingEvent.event.id}`}
          event={editingEvent.event}
          date={editingEvent.date}
          onSave={async (data, newDate) => {
            showSavingFeedback()
            try {
              if (editingEvent.scope === 'all' && editingEvent.event.recurrenceGroupId) {
                const { metadata: _metadata, ...rest } = data
                await updateAllInSeries(editingEvent.event.recurrenceGroupId, rest)
              } else {
                await updateEvent(editingEvent.date, editingEvent.event.id, data, newDate)
              }
              setEditingEvent(null)
              showSaveFeedback()
            } catch {
              showSaveError()
            }
          }}
          onClose={() => setEditingEvent(null)}
        />
      )}
    </AnimatePresence>
  )
}
