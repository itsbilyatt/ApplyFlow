import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
import { registerWebMcpTools, teardownWebMcpTools } from './webmcp'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

void registerWebMcpTools()
window.addEventListener('pagehide', teardownWebMcpTools, { once: true })
