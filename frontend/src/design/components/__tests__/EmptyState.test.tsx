import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { EmptyState } from '../EmptyState';

describe('EmptyState', () => {
  it('renders title and description', () => {
    const { getByText } = render(
      <EmptyState title="No projects" description="Create your first project to begin." />,
    );
    expect(getByText('No projects')).toBeTruthy();
    expect(getByText('Create your first project to begin.')).toBeTruthy();
  });

  it('renders action button and fires onClick', () => {
    const onClick = vi.fn();
    const { getByText } = render(
      <EmptyState title="No data" action={{ label: 'Add one', onClick }} />,
    );
    const btn = getByText('Add one');
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renders icon when provided', () => {
    const { container } = render(
      <EmptyState title="Empty" icon={<span>icon</span>} />,
    );
    const iconWrap = container.querySelector('[data-role="icon"]');
    expect(iconWrap).toBeTruthy();
    expect(iconWrap?.textContent).toBe('icon');
  });

  it('passes className and data-testid', () => {
    const { getByTestId } = render(
      <EmptyState title="x" className="c" data-testid="t" />,
    );
    const el = getByTestId('t');
    expect(el.className).toBe('c');
  });

  it('renders title as an h3', () => {
    const { container } = render(<EmptyState title="Heading" />);
    const h = container.querySelector('h3');
    expect(h?.textContent).toBe('Heading');
  });
});
