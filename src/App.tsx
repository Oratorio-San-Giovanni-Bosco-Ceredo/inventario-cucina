import { AppProvider, useApp } from './context/AppContext'
import Login from './components/Login'
import ViewerView from './views/ViewerView'
import OrderView from './views/OrderView'
import AdminView from './views/AdminView'

function Router() {
  const { session } = useApp()

  if (!session) return <Login />

  switch (session.role) {
    case 'admin':
      return <AdminView />
    case 'editor':
      return <OrderView />
    default:
      return <ViewerView />
  }
}

export default function App() {
  return (
    <AppProvider>
      <Router />
    </AppProvider>
  )
}
