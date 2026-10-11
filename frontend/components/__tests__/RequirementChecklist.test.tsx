import { render, screen } from '@testing-library/react'
import { RequirementChecklist } from '../chat/RequirementChecklist'

describe('RequirementChecklist', () => {
  it('renders nothing, not an empty shell, when rows are absent or empty', () => {
    const { container: a } = render(<RequirementChecklist projectName="X" rows={undefined} />)
    const { container: b } = render(<RequirementChecklist projectName="X" rows={[]} />)
    expect(a).toBeEmptyDOMElement()
    expect(b).toBeEmptyDOMElement()
  })

  it('renders one row per criterion with an accessible status for each state', () => {
    render(
      <RequirementChecklist
        projectName="Elite X"
        rows={[
          { criterion: 'Budget ≤ ₹1.5 Cr', status: 'met', note: 'From ₹1.4 Cr' },
          { criterion: 'Sector 150', status: 'caution', note: 'x' },
          { criterion: '3 BHK', status: 'unmet', note: 'Offers 2 BHK' },
          { criterion: 'school', status: 'unknown', note: 'Nearby school not verified' },
        ]}
      />,
    )
    expect(screen.getByText('How Elite X fits your brief')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(4)
    for (const label of ['Meets:', 'Partly meets:', 'Does not meet:', 'Not on record:']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })
})
