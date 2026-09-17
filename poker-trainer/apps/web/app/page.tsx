import { PokerTableScreen } from '../components/poker/poker-table-screen'

interface HomePageProps {
  searchParams: Promise<{ handId?: string | string[] }>
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const rawHandId = (await searchParams).handId
  const handId = Array.isArray(rawHandId) ? rawHandId[0] : rawHandId
  return <PokerTableScreen {...(handId === undefined ? {} : { handId })} />
}
