"use client";
import { InputNumber } from 'antd';
import { POINTS_MAX } from '@/lib/leagues';

// Egy játékos pontja a fájlfeltöltés előnézetében: alapból a fájlból számolt érték, de kézzel átírható.
// computed: a számolt pont (null, amíg nincs megadva a pontozás); value: a kézzel beírt pont (undefined = a számolt marad).
export default function ImportPointsInput({ computed, value, onChange, phone, label }) {
  const edited = value !== undefined && value !== computed;
  return (
    <span className="flex flex-col items-end gap-1" style={{ flex: 'none' }}>
      <InputNumber
        size={phone ? 'large' : 'middle'}
        inputMode="numeric"
        min={-POINTS_MAX}
        max={POINTS_MAX}
        precision={0}
        controls={false}
        disabled={computed === null}
        value={computed === null ? null : value ?? computed}
        placeholder="—"
        suffix="pont"
        status={edited ? 'warning' : undefined}
        onChange={(v) => onChange(Number.isInteger(v) && v !== computed ? v : undefined)}
        style={{ width: phone ? 130 : 120 }}
        aria-label={`${label}: pont`}
      />
      {edited && (
        <button type="button" onClick={() => onChange(undefined)} style={{ color: '#E5B15D', fontSize: 12, background: 'none', border: 0, padding: 0, cursor: 'pointer' }}>
          Kézzel átírva (számolt: {computed}) · visszaállítás
        </button>
      )}
    </span>
  );
}
