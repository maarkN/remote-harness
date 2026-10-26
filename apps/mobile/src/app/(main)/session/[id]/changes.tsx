import { useLocalSearchParams } from 'expo-router'
import { ChangesScreen } from '@/features/changes/ChangesScreen'

export default function ChangesRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <ChangesScreen sessionId={id} />
}
