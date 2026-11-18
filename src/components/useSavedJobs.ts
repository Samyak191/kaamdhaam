import { useDemo } from '../data/DemoStore'

export function useSavedJobs() {
  const { state, toggleSavedJob } = useDemo()
  return { savedIds: state.savedJobs, toggleSaved: toggleSavedJob }
}
