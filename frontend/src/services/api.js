import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

// Response interceptor for error normalization
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message = error.response?.data?.detail || error.message || 'Unknown error'
    return Promise.reject(new Error(message))
  }
)

export const getHealth = () => api.get('/health')
export const getStatus = () => api.get('/status')
export const getEdaSummary = () => api.get('/eda/summary')
export const getEdaInsights = () => api.get('/eda/insights')
export const getFeatureImportance = (topN = 20) => api.get(`/model/feature-importance?top_n=${topN}`)
export const getModelMetadata = () => api.get('/model/metadata')
export const getRules = () => api.get('/rules')

export const predict = (applicantData) => api.post('/predict', applicantData)
export const predictWithExplanation = (applicantData) => api.post('/predict/explain', applicantData)
export const evaluateRules = (applicantData) => api.post('/rules/evaluate', applicantData)
export const sendChatMessage = (question, apiKey = null) =>
  api.post('/chat', { question, api_key: apiKey })

export default api
