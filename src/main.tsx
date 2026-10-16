import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Apple devices use the system font (SF Pro / SF Hebrew); Heebo is only a Hebrew fallback elsewhere.
import '@fontsource-variable/heebo'
import './i18n'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
