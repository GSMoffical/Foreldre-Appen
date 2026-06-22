import { inputBase } from '../lib/ui'
import type { RelevanceProfile } from '../types'

interface RelevanceProfileFieldsProps {
  value: RelevanceProfile | undefined
  onChange: (next: RelevanceProfile | undefined) => void
}

/**
 * Minimal redigering av barnets relevansprofil (skole/klasse/trinn). Kontrollert komponent;
 * holder rå input — normalisering (trim/drop tomme) skjer ved lagring i `PersonForm`.
 * Aktivitet-liste er bevisst utelatt i denne fasen (modellen støtter det allerede).
 */
export function RelevanceProfileFields({ value, onChange }: RelevanceProfileFieldsProps) {
  const school = value?.school ?? {}

  function patchSchool(patch: Partial<NonNullable<RelevanceProfile['school']>>) {
    onChange({ ...value, school: { ...school, ...patch } })
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
    </div>
  )
}
