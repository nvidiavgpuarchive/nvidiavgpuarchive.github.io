import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community'
import { createRoot } from 'react-dom/client'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-quartz.css'
import './i18n/setup'
import './styles/app.scss'
import App from './App.tsx'

ModuleRegistry.registerModules([AllCommunityModule])

createRoot(document.getElementById('root')!).render(<App />)
