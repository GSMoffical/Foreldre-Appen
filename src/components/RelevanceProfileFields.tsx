import { inputBase } from '../lib/ui'
import type { RelevanceProfile, RelevanceProfileActivity } from '../types'

interface RelevanceProfileFieldsProps {
  value: RelevanceProfile | undefined
  onChange: (next: RelevanceProfile | undefined) => void
}

/**
 * Minimal redigering av barnets relevansprofil (skole/klasse/trinn + fritidsaktiviteter).
 * Kontrollert komponent; holder rå input — normalisering (trim/drop tomme/aliaser) skjer ved
 * lagring i `PersonForm` via `normalizeRelevanceProfile`.
 */
export function RelevanceProfileFields({ value, onChange }: RelevanceProfileFieldsProps) {
  const school = value?.school ?? {}
  const activities = value?.activities ?? []

  function patchSchool(patch: Partial<NonNullable<RelevanceProfile['school']>>) {
    onChange({ ...value, school: { ...school, ...patch } })
  }

  function setActivities(next: RelevanceProfileActivity[]) {
    onChange({ ...value, activities: next })
  }
  function addActivity() {
    setActivities([...activities, { name: '' }])
  }
  function updateActivity(index: number, patch: Partial<RelevanceProfileActivity>) {
    setActivities(activities.map((a, i) => (i === index ? { ...a, ...patch } : a)))
  }
  function removeActivity(index: number) {
    setActivities(activities.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50/60 p-3">
      <div>
        <p className="text-caption font-semibold text-zinc-700">Relevansprofil</p>
        <p className="mt-0.5 text-caption text-zinc-500">
          Valgfritt. Lagres lokalt for at importen senere skal forstå hva som gjelder dette barnet
          (f.eks. klasse i et dokument med flere klasser). Sendes ikke til Tankestrømmen ennå.
        </p>
      </div>
      <div>
        <label className="text-caption font-medium text-zinc-600">Skole</label>
        <input
          type="text"
          value={school.name ?? ''}
          onChange={(e) => patchSchool({ name: e.target.value })}
          className={`mt-1 ${inputBase}`}
          placeholder="f.eks. Nydalen skole"
        />
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-caption font-medium text-zinc-600">Klasse</label>
          <input
            type="text"
            value={school.classCode ?? ''}
            onChange={(e) => patchSchool({ classCode: e.target.value })}
            className={`mt-1 ${inputBase}`}
            placeholder="f.eks. 2STC"
          />
        </div>
        <div className="flex-1">
          <label className="text-caption font-medium text-zinc-600">Trinn</label>
          <input
            type="text"
            value={school.grade ?? ''}
            onChange={(e) => patchSchool({ grade: e.target.value })}
            className={`mt-1 ${inputBase}`}
            placeholder="f.eks. VG2"
          />
        </div>
      </div>

      <div className="space-y-2 border-t border-zinc-200 pt-3">
        <div>
          <p className="text-caption font-semibold text-zinc-700">Aktiviteter</p>
          <p className="mt-0.5 text-caption text-zinc-500">
            Fritidsaktiviteter, lag og grupper. Lagres for senere relevansmatching. Sendes ikke til
            Tankestrømmen ennå.
          </p>
        </div>

        {activities.map((activity, index) => (
          <div
            key={index}
            className="space-y-2 rounded-md border border-zinc-200 bg-white p-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-caption font-medium text-zinc-500">Aktivitet {index + 1}</span>
              <button
                type="button"
                onClick={() => removeActivity(index)}
                className="rounded-md border border-synkaCoral/30 bg-white px-2 py-1 text-caption font-medium text-synkaCoral hover:bg-synkaCoral/5"
              >
                Fjern
              </button>
            </div>
            <div>
              <label className="text-caption font-medium text-zinc-600">Aktivitet / navn</label>
              <input
                type="text"
                value={activity.name ?? ''}
                onChange={(e) => updateActivity(index, { name: e.target.value })}
                className={`mt-1 ${inputBase}`}
                placeholder="f.eks. Kor"
              />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-caption font-medium text-zinc-600">Gruppe / lag</label>
                <input
                  type="text"
                  value={activity.groupName ?? ''}
                  onChange={(e) => updateActivity(index, { groupName: e.target.value })}
                  className={`mt-1 ${inputBase}`}
                  placeholder="f.eks. Nydalen J2015"
                />
              </div>
              <div className="flex-1">
                <label className="text-caption font-medium text-zinc-600">Type</label>
                <input
                  type="text"
                  value={activity.type ?? ''}
                  onChange={(e) => updateActivity(index, { type: e.target.value })}
                  className={`mt-1 ${inputBase}`}
                  placeholder="f.eks. kor"
                />
              </div>
            </div>
            <div>
              <label className="text-caption font-medium text-zinc-600">
                Aliaser (kommaseparert)
              </label>
              <input
                type="text"
                value={(activity.aliases ?? []).join(',')}
                onChange={(e) => updateActivity(index, { aliases: e.target.value.split(',') })}
                className={`mt-1 ${inputBase}`}
                placeholder="f.eks. kor, barnekor, sang"
              />
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addActivity}
          className="w-full rounded-md border border-dashed border-zinc-300 bg-white px-3 py-2 text-caption font-medium text-zinc-600 hover:border-zinc-400 hover:bg-zinc-50"
        >
          Legg til aktivitet
        </button>
      </div>
    </div>
  )
}
