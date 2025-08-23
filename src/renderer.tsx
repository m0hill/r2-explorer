import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './components/App'
import './index.css'

const queryClient = new QueryClient()

const container = document.getElementById('root')
if (!container) throw new Error('Failed to find the root element')

const root = createRoot(container)
root.render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
)
