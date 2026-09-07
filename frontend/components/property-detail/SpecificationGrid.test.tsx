import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SpecificationGrid } from './SpecificationGrid'

function spec(overrides: Partial<{ label: string; value: string; category: string }> = {}) {
  return {
    label: 'Flooring',
    value: 'Vitrified tiles',
    category: 'flooring',
    ...overrides,
  }
}

describe('SpecificationGrid', () => {
  it('renders nothing when every spec has no value', () => {
    const { container } = render(
      <SpecificationGrid specs={[spec({ value: '' }), spec({ value: '   ' })]} />
    )
    // Every item was dropped for having no value, which leaves the category
    // list empty — this is the case the raw specs.length guard alone missed,
    // since the prop itself is non-empty.
    expect(container.firstChild).toBeNull()
  })

  it('renders the category once a spec has a real value', () => {
    render(<SpecificationGrid specs={[spec({ category: 'flooring', value: 'Marble' })]} />)
    expect(screen.getByText('Flooring & Surfaces')).toBeTruthy()
  })

  it('shows a real spec label after expanding its category, and never an empty one', async () => {
    const user = userEvent.setup()
    render(
      <SpecificationGrid
        specs={[
          spec({ label: 'Real Spec', value: 'Real Value', category: 'flooring' }),
          spec({ label: 'Ghost Spec', value: '', category: 'flooring' }),
        ]}
      />
    )
    await user.click(screen.getByText('Flooring & Surfaces'))
    expect(screen.getByText('Real Spec')).toBeTruthy()
    expect(screen.queryByText('Ghost Spec')).toBeNull()
    // The count badge reflects only the specs that survived filtering, not
    // the raw input length — it would read "2" if the empty one still counted.
    expect(screen.getByText('1')).toBeTruthy()
  })

  it('drops a category entirely when every spec in it is empty-valued', () => {
    render(
      <SpecificationGrid
        specs={[
          spec({ label: 'A', value: '', category: 'plumbing' }),
          spec({ label: 'B', value: 'Marble', category: 'flooring' }),
        ]}
      />
    )
    expect(screen.queryByText('Plumbing & Drainage')).toBeNull()
    expect(screen.getByText('Flooring & Surfaces')).toBeTruthy()
  })
})
