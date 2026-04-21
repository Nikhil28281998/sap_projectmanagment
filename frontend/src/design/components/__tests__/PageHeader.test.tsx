import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { PageHeader } from '../PageHeader';

describe('PageHeader', () => {
  it('renders title as h1', () => {
    const { container } = render(<PageHeader title="Projects" />);
    const h1 = container.querySelector('h1');
    expect(h1).toBeTruthy();
    expect(h1?.textContent).toBe('Projects');
  });

  it('renders breadcrumb items with last item unlinked', () => {
    const { container } = render(
      <PageHeader
        title="Detail"
        breadcrumb={[
          { label: 'Home', href: '/' },
          { label: 'Projects', href: '/projects' },
          { label: 'Detail' },
        ]}
      />,
    );
    const crumbs = container.querySelectorAll('[data-role="crumb"]');
    expect(crumbs.length).toBe(3);
    // first two should be anchors
    expect(crumbs[0].tagName).toBe('A');
    expect(crumbs[1].tagName).toBe('A');
    // last must not be an anchor
    expect(crumbs[2].tagName).not.toBe('A');
    expect(crumbs[2].getAttribute('data-last')).toBe('true');
  });

  it('renders actions slot', () => {
    const { container } = render(
      <PageHeader title="X" actions={<button>Add</button>} />,
    );
    const actions = container.querySelector('[data-role="actions"]');
    expect(actions).toBeTruthy();
    expect(actions?.textContent).toBe('Add');
  });

  it('renders description when provided', () => {
    const { getByText } = render(
      <PageHeader title="X" description="Helpful text" />,
    );
    expect(getByText('Helpful text')).toBeTruthy();
  });

  it('passes className and data-testid', () => {
    const { getByTestId } = render(
      <PageHeader title="X" className="c" data-testid="t" />,
    );
    expect(getByTestId('t').className).toBe('c');
  });
});
