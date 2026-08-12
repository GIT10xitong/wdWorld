import { useStore } from '@/store'
import { WelcomePage } from '@/components/WelcomePage'
import { Workspace } from '@/components/Workspace'

function App() {
  const { currentProject } = useStore()

  return currentProject ? <Workspace /> : <WelcomePage />
}

export default App
