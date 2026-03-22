import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders the Grecko launch surface with the seeded Stonefruit intake', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', {
        name: /Grecko gives every build a case file before you ship it/i,
      }),
    ).toBeInTheDocument()
    expect(screen.getByDisplayValue(/gitlab\.futo\.org\/stonefruit/i)).toBeVisible()
    expect(screen.getByText(/GitLab release detected/i)).toBeVisible()
    expect(screen.getByDisplayValue(/npm run tauri dev/i)).toBeVisible()
  })

  it('updates the intake banner when the URL is unsupported', () => {
    render(<App />)

    fireEvent.change(screen.getByLabelText(/public release url/i), {
      target: { value: 'https://example.com/releases' },
    })

    expect(screen.getByText(/Unsupported release URL/i)).toBeVisible()
  })
})
