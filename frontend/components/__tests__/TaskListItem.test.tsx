import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { ChecklistScope, TaskListItem, checklistKey, readTick, taskParts, textOf } from '@/components/response/TaskListItem'
import { officeMarkers } from '@/components/SectorMap'

const checkbox = <input type="checkbox" disabled />

describe('task list item', () => {
  beforeEach(() => window.localStorage.clear())

  it('finds the checkbox GFM puts first and leaves the text', () => {
    const parts = taskParts([checkbox, ' ', 'first ', <strong key="s">bold</strong>, ' item'])
    expect(parts).not.toBeNull()
    expect(textOf(parts!.rest).trim()).toBe('first bold item')
    expect(taskParts(['plain bullet'])).toBeNull()
  })

  it('ticks, strikes through, and remembers the tick for this chat only', () => {
    const rest = [' ', 'Ownership chain']
    const { unmount } = render(
      <ChecklistScope.Provider value="chat-1"><ul><TaskListItem rest={rest} /></ul></ChecklistScope.Provider>,
    )
    const box = screen.getByRole('checkbox', { name: 'Ownership chain' }) as HTMLInputElement
    expect(box.checked).toBe(false)
    fireEvent.click(box)
    expect(box.checked).toBe(true)
    expect(readTick(checklistKey('chat-1', 'Ownership chain'))).toBe(true)
    unmount()

    render(<ChecklistScope.Provider value="chat-1"><ul><TaskListItem rest={rest} /></ul></ChecklistScope.Provider>)
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true)
  })

  it('does not carry a tick into a different chat', () => {
    window.localStorage.setItem(checklistKey('chat-1', 'Ownership chain'), '1')
    render(<ChecklistScope.Provider value="chat-2"><ul><TaskListItem rest={['Ownership chain']} /></ul></ChecklistScope.Provider>)
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false)
  })

  it('still ticks, without saving, when there is no chat scope', () => {
    render(<ul><TaskListItem rest={['Ownership chain']} /></ul>)
    fireEvent.click(screen.getByRole('checkbox'))
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true)
    expect(window.localStorage.length).toBe(0)
  })

  it('survives storage that throws', () => {
    const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    render(<ChecklistScope.Provider value="chat-1"><ul><TaskListItem rest={['Ownership chain']} /></ul></ChecklistScope.Provider>)
    fireEvent.click(screen.getByRole('checkbox'))
    expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true)
    spy.mockRestore()
  })
})

describe('office marker', () => {
  it('pins a sector we hold coordinates for, as a Work marker', () => {
    expect(officeMarkers('Sector 63')).toEqual([{ name: 'Your office (Sector 63)', pos: [28.618, 77.374], category: 'Work' }])
    expect(officeMarkers('sec 62')).toEqual([])
    expect(officeMarkers('sector 93a')[0]?.name).toBe('Your office (Sector 93A)')
  })

  it('never guesses a position for a workplace it cannot place', () => {
    expect(officeMarkers('DLF Cyber Hub, Gurgaon')).toEqual([])
    expect(officeMarkers('Sector 999')).toEqual([])
    expect(officeMarkers(undefined)).toEqual([])
    expect(officeMarkers(63)).toEqual([])
  })
})
