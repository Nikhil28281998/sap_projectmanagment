import { useTheme } from '../theme';
import { DENSITY_MODES } from '../tokens/density';
import { THEMES } from '../tokens/semantic';

export function DesignSystemSandbox() {
  const { theme, setTheme, density, setDensity } = useTheme();

  const swatches = [
    'color-bg-app', 'color-bg-elevated', 'color-surface-base',
    'color-text-primary', 'color-text-secondary', 'color-text-muted',
    'color-border-default', 'color-accent-primary',
    'color-status-risk-low', 'color-status-risk-medium', 'color-status-risk-high',
  ];

  return (
    <div style={{ padding: 'var(--space-6)', minHeight: '100vh', background: 'var(--color-bg-app)', color: 'var(--color-text-primary)' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: 'var(--space-6)' }}>
        Design System Sandbox
      </h1>

      <section style={{ marginBottom: 'var(--space-8)' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: 'var(--space-3)' }}>Theme</h2>
        {THEMES.map((t) => (
          <button
            key={t}
            onClick={() => setTheme(t)}
            aria-pressed={theme === t}
            style={{
              marginRight: 'var(--space-2)',
              padding: 'var(--space-2) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              border: `1px solid var(--color-border-default)`,
              background: theme === t ? 'var(--color-accent-primary)' : 'var(--color-bg-elevated)',
              color: theme === t ? 'var(--color-text-inverse)' : 'var(--color-text-primary)',
              cursor: 'pointer',
            }}
          >
            {t}
          </button>
        ))}
      </section>

      <section style={{ marginBottom: 'var(--space-8)' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: 'var(--space-3)' }}>Density</h2>
        {DENSITY_MODES.map((d) => (
          <button
            key={d}
            onClick={() => setDensity(d)}
            aria-pressed={density === d}
            style={{
              marginRight: 'var(--space-2)',
              padding: 'var(--space-2) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              border: `1px solid var(--color-border-default)`,
              background: density === d ? 'var(--color-accent-primary)' : 'var(--color-bg-elevated)',
              color: density === d ? 'var(--color-text-inverse)' : 'var(--color-text-primary)',
              cursor: 'pointer',
            }}
          >
            {d}
          </button>
        ))}
      </section>

      <section>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: 'var(--space-3)' }}>Semantic color swatches</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 'var(--space-3)' }}>
          {swatches.map((name) => (
            <div
              key={name}
              style={{
                border: '1px solid var(--color-border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-3)',
                background: 'var(--color-bg-elevated)',
              }}
            >
              <div
                aria-hidden
                style={{
                  height: '40px',
                  borderRadius: 'var(--radius-sm)',
                  background: `var(--${name})`,
                  border: '1px solid var(--color-border-subtle)',
                  marginBottom: 'var(--space-2)',
                }}
              />
              <code style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                --{name}
              </code>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
