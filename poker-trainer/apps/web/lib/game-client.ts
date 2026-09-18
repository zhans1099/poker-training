import {
  heroHandResponseSchema,
  handReviewListResponseSchema,
  handReviewResponseSchema,
  leakDashboardResponseSchema,
  profileFeedbackListResponseSchema,
  profileFeedbackResponseSchema,
  createSessionResponseSchema,
  playerListResponseSchema,
  submitHandActionResponseSchema,
  type CreateTrainingSessionInput,
  type HeroHandView,
  type HandReviewRecord,
  type LeakDashboardItem,
  type ProfileFeedbackRecord,
  type PlayerListItem,
  type SubmitHandActionInput,
} from '@poker-trainer/schemas'

async function responseJson(response: Response): Promise<unknown> {
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const errorBody =
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof body.error === 'object' &&
      body.error !== null
        ? body.error
        : null
    const code =
      errorBody !== null &&
      'code' in errorBody &&
      typeof errorBody.code === 'string'
        ? errorBody.code
        : null
    const message =
      code === 'DATABASE_NOT_CONFIGURED'
        ? '数据库尚未配置，请先设置 DATABASE_URL 并导入初始化 SQL。'
        : errorBody !== null &&
            'message' in errorBody &&
            typeof errorBody.message === 'string'
          ? errorBody.message
          : `请求失败 (${response.status})`
    throw new Error(message)
  }
  return body
}

export async function fetchHandReviews(
  handId: string,
  signal?: AbortSignal,
): Promise<HandReviewRecord[]> {
  const response = await fetch(
    `/api/hands/${encodeURIComponent(handId)}/reviews`,
    signal === undefined ? undefined : { signal },
  )
  return handReviewListResponseSchema.parse(await responseJson(response)).data
}

export async function createHandReview(
  handId: string,
): Promise<HandReviewRecord> {
  const response = await fetch(
    `/api/hands/${encodeURIComponent(handId)}/reviews`,
    { method: 'POST' },
  )
  return handReviewResponseSchema.parse(await responseJson(response)).data
}

export async function fetchHandProfileFeedback(
  handId: string,
  signal?: AbortSignal,
): Promise<ProfileFeedbackRecord[]> {
  const response = await fetch(
    `/api/hands/${encodeURIComponent(handId)}/profile-feedback`,
    signal === undefined ? undefined : { signal },
  )
  return profileFeedbackListResponseSchema.parse(await responseJson(response))
    .data
}

export async function resolveProfileFeedback(
  playerId: string,
  feedbackId: string,
  resolution: 'ACCEPT' | 'REJECT',
): Promise<ProfileFeedbackRecord> {
  const response = await fetch(
    `/api/players/${encodeURIComponent(playerId)}/profile-feedback/${encodeURIComponent(feedbackId)}`,
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ resolution }),
    },
  )
  return profileFeedbackResponseSchema.parse(await responseJson(response)).data
}

export async function fetchLeakDashboard(
  signal?: AbortSignal,
): Promise<LeakDashboardItem[]> {
  const response = await fetch(
    '/api/leaks',
    signal === undefined ? undefined : { signal },
  )
  return leakDashboardResponseSchema.parse(await responseJson(response)).data
}

export async function fetchPlayers(
  signal?: AbortSignal,
): Promise<PlayerListItem[]> {
  const response = await fetch(
    '/api/players',
    signal === undefined ? undefined : { signal },
  )
  return playerListResponseSchema.parse(await responseJson(response)).data
}

export async function createSessionWithFirstHand(input: {
  session: CreateTrainingSessionInput
  buttonSeat: number
  randomizeSeats: boolean
}): Promise<HeroHandView> {
  const sessionResponse = await fetch('/api/sessions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input.session),
  })
  const session = createSessionResponseSchema.parse(
    await responseJson(sessionResponse),
  ).data
  const handResponse = await fetch(
    `/api/sessions/${encodeURIComponent(session.id)}/hands`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        buttonSeat: input.buttonSeat,
        randomizeSeats: input.randomizeSeats,
      }),
    },
  )
  return heroHandResponseSchema.parse(await responseJson(handResponse)).data
}

export async function fetchHeroHand(
  handId: string,
  signal?: AbortSignal,
): Promise<HeroHandView> {
  const response = await fetch(
    `/api/hands/${encodeURIComponent(handId)}`,
    signal === undefined ? undefined : { signal },
  )
  return heroHandResponseSchema.parse(await responseJson(response)).data
}

export async function submitHeroAction(
  handId: string,
  input: SubmitHandActionInput,
): Promise<HeroHandView> {
  const response = await fetch(
    `/api/hands/${encodeURIComponent(handId)}/events`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    },
  )
  return submitHandActionResponseSchema.parse(await responseJson(response)).data
    .hand
}

export async function createNextHand(
  handId: string,
  randomizeSeats: boolean,
): Promise<HeroHandView> {
  const response = await fetch(
    `/api/hands/${encodeURIComponent(handId)}/next`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ randomizeSeats }),
    },
  )
  return heroHandResponseSchema.parse(await responseJson(response)).data
}
