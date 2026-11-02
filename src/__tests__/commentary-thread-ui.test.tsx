/**
 * CommentaryThread — the follow-up conversation under a piece of commentary.
 *
 * The behaviour worth pinning is about requests, not looks: nothing is
 * fetched until the thread is opened, a failed open does not retry, and the
 * cap closes the input rather than letting sends pile up.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { csrfFetch } from '@/lib/api'
import CommentaryThread from '@/components/CommentaryThread'

jest.mock('@/lib/api', () => ({ csrfFetch: jest.fn() }))

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

function thread(messages: unknown[], atLimit = false) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ messages, userMessageCount: messages.length / 2, atLimit }),
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  global.fetch = jest.fn(async () => thread([])) as unknown as typeof fetch
})

function renderThread(commentary: string | null = 'Strong focus today.') {
  return render(
    <CommentaryThread subjectType="day" subjectKey="2026-11-02" commentary={commentary} />
  )
}

it('renders nothing when there is no commentary to reply to', () => {
  const { container } = renderThread(null)
  expect(container).toBeEmptyDOMElement()
})

it('fetches nothing until it is opened', async () => {
  renderThread()

  expect(screen.getByText('Ask about this')).toBeInTheDocument()
  await delay(30)
  expect(global.fetch).not.toHaveBeenCalled()
})

it('loads the existing thread when opened', async () => {
  global.fetch = jest.fn(async () =>
    thread([
      { seq: 1, role: 'user', content: 'why?' },
      { seq: 2, role: 'assistant', content: 'Because of your 150 minute block.' },
    ])
  ) as unknown as typeof fetch

  renderThread()
  fireEvent.click(screen.getByText('Ask about this'))

  await waitFor(() => expect(screen.getByText('Because of your 150 minute block.')).toBeInTheDocument())
  expect(screen.getByText('You: why?')).toBeInTheDocument()
  expect(global.fetch).toHaveBeenCalledTimes(1)
})

it('does not retry a failed load', async () => {
  global.fetch = jest.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })) as unknown as typeof fetch

  renderThread()
  fireEvent.click(screen.getByText('Ask about this'))

  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Could not load'))
  await delay(150)
  expect(global.fetch).toHaveBeenCalledTimes(1)
})

it('sends a question and shows both sides of the exchange', async () => {
  ;(csrfFetch as jest.Mock).mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      messages: [
        { seq: 1, role: 'user', content: 'Why do you say that?' },
        { seq: 2, role: 'assistant', content: 'Your longest block was this morning.' },
      ],
      userMessageCount: 1,
      atLimit: false,
    }),
  })

  renderThread()
  fireEvent.click(screen.getByText('Ask about this'))
  await waitFor(() => expect(screen.getByPlaceholderText('Why do you say that?')).toBeInTheDocument())

  const input = screen.getByPlaceholderText('Why do you say that?')
  fireEvent.change(input, { target: { value: 'Why do you say that?' } })
  fireEvent.click(screen.getByLabelText('Send question'))

  await waitFor(() =>
    expect(screen.getByText('Your longest block was this morning.')).toBeInTheDocument()
  )
  expect(csrfFetch).toHaveBeenCalledTimes(1)
  expect(input).toHaveValue('')
})

it('sends the subject and the commentary snapshot with the question', async () => {
  ;(csrfFetch as jest.Mock).mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ messages: [], userMessageCount: 1, atLimit: false }),
  })

  renderThread()
  fireEvent.click(screen.getByText('Ask about this'))
  await waitFor(() => expect(screen.getByPlaceholderText('Why do you say that?')).toBeInTheDocument())

  fireEvent.change(screen.getByPlaceholderText('Why do you say that?'), { target: { value: 'how come?' } })
  fireEvent.click(screen.getByLabelText('Send question'))

  await waitFor(() => expect(csrfFetch).toHaveBeenCalled())
  const body = JSON.parse((csrfFetch as jest.Mock).mock.calls[0][1].body)
  expect(body).toEqual({
    subject_type: 'day',
    subject_key: '2026-11-02',
    subject_commentary: 'Strong focus today.',
    message: 'how come?',
  })
})

it('will not send an empty question', async () => {
  renderThread()
  fireEvent.click(screen.getByText('Ask about this'))
  await waitFor(() => expect(screen.getByLabelText('Send question')).toBeInTheDocument())

  expect(screen.getByLabelText('Send question')).toBeDisabled()
  fireEvent.change(screen.getByPlaceholderText('Why do you say that?'), { target: { value: '   ' } })
  fireEvent.click(screen.getByLabelText('Send question'))

  await delay(30)
  expect(csrfFetch).not.toHaveBeenCalled()
})

it('closes the input when the thread is already at its limit', async () => {
  global.fetch = jest.fn(async () => thread([], true)) as unknown as typeof fetch

  renderThread()
  fireEvent.click(screen.getByText('Ask about this'))

  await waitFor(() =>
    expect(screen.getByText(/as far as this conversation goes/)).toBeInTheDocument()
  )
  expect(screen.queryByLabelText('Send question')).not.toBeInTheDocument()
})

it('closes the input when the server reports the limit on send', async () => {
  ;(csrfFetch as jest.Mock).mockResolvedValue({
    ok: false,
    status: 409,
    json: async () => ({ error: 'This conversation has reached its limit.', atLimit: true }),
  })

  renderThread()
  fireEvent.click(screen.getByText('Ask about this'))
  await waitFor(() => expect(screen.getByPlaceholderText('Why do you say that?')).toBeInTheDocument())

  fireEvent.change(screen.getByPlaceholderText('Why do you say that?'), { target: { value: 'one more' } })
  fireEvent.click(screen.getByLabelText('Send question'))

  await waitFor(() =>
    expect(screen.getByText(/as far as this conversation goes/)).toBeInTheDocument()
  )
  expect(screen.queryByLabelText('Send question')).not.toBeInTheDocument()
})

it('keeps the question in the box when sending fails, so it is not lost', async () => {
  ;(csrfFetch as jest.Mock).mockRejectedValue(new Error('offline'))

  renderThread()
  fireEvent.click(screen.getByText('Ask about this'))
  await waitFor(() => expect(screen.getByPlaceholderText('Why do you say that?')).toBeInTheDocument())

  fireEvent.change(screen.getByPlaceholderText('Why do you say that?'), { target: { value: 'why?' } })
  fireEvent.click(screen.getByLabelText('Send question'))

  await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
  expect(screen.getByPlaceholderText('Why do you say that?')).toHaveValue('why?')
  expect(csrfFetch).toHaveBeenCalledTimes(1)
})
