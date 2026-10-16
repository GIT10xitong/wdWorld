import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { initializeLanguage } from './lib/i18n'
import { initializePlugins } from './features/plugins/store'
import { initializeTheme } from './lib/theme'
import './theme.css'
import './workspace-ui.css'

initializeTheme()

void Promise.all([initializeLanguage(), initializePlugins()]).then(() =>
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  ),
)
