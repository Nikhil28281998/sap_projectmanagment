import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { SectionCard } from '../SectionCard';

describe('SectionCard', () => {
  it('renders title and children', () => {
    const { getByText } = render(
      <SectionCard title="Overview">
        <p>Hello</p>
      </SectionCard>,
    );
    expect(getByText('Overview')).toBeTruthy();
    expect(getByText('Hello')).toBeTruthy();
  });

  it('renders actions slot', () => {
    const { container } = render(
      <SectionCard title="X" actions={<button>Add</button>}>
        body
      </SectionCard>,
    );
    const actions = container.querySelector('[data-role="actions"]');
    expect(actions).toBeTruthy();
    expect(actions?.textContent).toBe('Add');
  });

  it('noPadding removes content padding', () => {
    const with_ = render(
      <SectionCard title="A" data-testid="a">
        x
      </SectionCard>,
    );
    const without = render(
      <SectionCard title="B" noPadding data-testid="b">
        x
      </SectionCard>,
    );
    const withContent = with_.container.querySelector('[data-role="content"]') as HTMLElement;
    const withoutContent = without.container.querySelector('[data-role="content"]') as HTMLElement;
    expect(withContent.style.padding).toBe('var(--space-5)');
    expect(withoutContent.style.padding).toBe('');
  });

  it('renders as specified element', () => {
    const { getByTestId } = render(
      <SectionCard as="article" data-testid="t">
        x
      </SectionCard>,
    );
    const el = getByTestId('t');
    expect(el.tagName).toBe('ARTICLE');
  });

  it('renders h2 for title', () => {
    const { container } = render(
      <SectionCard title="Heading">child</SectionCard>,
    );
    expect(container.querySelector('h2')?.textContent).toBe('Heading');
  });
});
