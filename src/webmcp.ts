import { getApplications } from './services/applicationService'
import { getCandidateProfile } from './services/candidateService'
import { getJobDetails, searchJobs } from './services/jobService'

export type WebMcpStatus = { found: boolean; registered: string[]; error?: string }

type JsonSchema = {
  type: 'object'
  properties: Record<string, { type: string; description?: string; minimum?: number; maximum?: number }>
  required?: string[]
  additionalProperties: false
}

type WebMcpResult = { content: Array<{ type: 'text'; text: string }> }

export type WebMcpTool = {
  name: string
  description: string
  inputSchema: JsonSchema
  execute: (input: Record<string, unknown>) => WebMcpResult | Promise<WebMcpResult>
  annotations?: { readOnlyHint?: boolean }
}

type ModelContext = {
  registerTool: (tool: WebMcpTool, options?: { signal?: AbortSignal }) => Promise<void>
}

declare global {
  interface Document { modelContext?: ModelContext }
  interface Navigator { modelContext?: ModelContext }
}

const statusEvent = 'applyflow:webmcp-status'
let currentStatus: WebMcpStatus = { found: false, registered: [] }
let controller: AbortController | undefined
let registrationContext: ModelContext | undefined
let registrationPromise: Promise<void> | undefined

function publishStatus(status: WebMcpStatus) {
  currentStatus = status
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(statusEvent, { detail: status }))
}

function getModelContext(): ModelContext | undefined {
  if (typeof document === 'undefined') return undefined
  const modelContext = document.modelContext ?? navigator.modelContext
  return modelContext && typeof modelContext.registerTool === 'function' ? modelContext : undefined
}

export function getWebMcpStatus(): WebMcpStatus { return currentStatus }

export function subscribeToWebMcpStatus(listener: (status: WebMcpStatus) => void) {
  const handleStatus = (event: Event) => listener((event as CustomEvent<WebMcpStatus>).detail)
  window.addEventListener(statusEvent, handleStatus)
  return () => window.removeEventListener(statusEvent, handleStatus)
}

function requiredString(input: Record<string, unknown>, key: string): string {
  const value = input[key]
  if (typeof value !== 'string' || !value.trim()) throw new Error(`The ${key} is required.`)
  return value.trim()
}

function result(value: unknown): WebMcpResult {
  return { content: [{ type: 'text', text: JSON.stringify(value) }] }
}

function defineTools(): WebMcpTool[] {
  return [
    {
      name: 'search_jobs',
      description: 'Searches currently available jobs in ApplyFlow.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Words to match against job title, company, skills, or location.' },
          limit: { type: 'integer', minimum: 1, maximum: 20, description: 'Maximum number of jobs to return.' },
        },
        required: ['query'],
        additionalProperties: false,
      },
      async execute(input) {
        const query = requiredString(input, 'query')
        const requestedLimit = typeof input.limit === 'number' ? input.limit : 10
        const limit = Math.min(20, Math.max(1, Math.trunc(requestedLimit)))
        return result({ query, jobs: searchJobs({ query }).slice(0, limit) })
      },
      annotations: { readOnlyHint: true },
    },
    {
      name: 'get_job_details',
      description: 'Returns full details for one currently available ApplyFlow job.',
      inputSchema: {
        type: 'object',
        properties: { jobId: { type: 'string', description: 'Unique job ID such as job-1.' } },
        required: ['jobId'],
        additionalProperties: false,
      },
      async execute(input) {
        const jobId = requiredString(input, 'jobId')
        const job = getJobDetails(jobId)
        if (!job) throw new Error(`No job was found for ${jobId}.`)
        return result({ jobId, job })
      },
      annotations: { readOnlyHint: true },
    },
    {
      name: 'get_application_status',
      description: "Lists the current status of the user's ApplyFlow applications.",
      inputSchema: {
        type: 'object',
        properties: {
          applicationId: { type: 'string', description: 'Optional application ID to look up.' },
          jobId: { type: 'string', description: 'Optional job ID to find applications for.' },
        },
        additionalProperties: false,
      },
      async execute(input) {
        const applicationId = typeof input.applicationId === 'string' ? input.applicationId.trim() : ''
        const jobId = typeof input.jobId === 'string' ? input.jobId.trim() : ''
        const applications = getApplications().filter((application) =>
          (!applicationId && !jobId) ||
          (applicationId && application.id === applicationId) ||
          (jobId && application.jobId === jobId),
        )
        return result({ applications: applications.map(({ id, jobId: applicationJobId, jobTitle, company, status, updatedAt }) => ({ applicationId: id, jobId: applicationJobId, jobTitle, company, status, updatedAt })) })
      },
      annotations: { readOnlyHint: true },
    },
    {
      name: 'get_profile_summary',
      description: 'Returns a read-only summary of the signed-in ApplyFlow candidate profile.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      async execute() {
        const profile = getCandidateProfile()
        return result({ id: profile.id, name: profile.name, location: profile.location, experience: profile.experience, currentRole: profile.currentRole, skills: profile.skills, education: profile.education, workPreference: profile.workPreference, profileCompletion: profile.profileCompletion, summary: profile.summary })
      },
      annotations: { readOnlyHint: true },
    },
  ]
}

export async function registerWebMcpTools(): Promise<void> {
  if (typeof window === 'undefined') return
  const modelContext = getModelContext()
  if (!modelContext) {
    publishStatus({ found: false, registered: [], error: 'This browser does not support WebMCP.' })
    return
  }
  if (registrationPromise && registrationContext === modelContext) return registrationPromise

  controller?.abort()
  controller = new AbortController()
  registrationContext = modelContext
  const registrationController = controller
  registrationPromise = (async () => {
    const registered: string[] = []
    const errors: string[] = []
    for (const tool of defineTools()) {
      try {
        await modelContext.registerTool(tool, { signal: registrationController.signal })
        registered.push(tool.name)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        errors.push(`${tool.name}: ${message}`)
        console.error(`[ApplyFlow] WebMCP registration failed for ${tool.name}:`, error)
      }
    }
    publishStatus({ found: true, registered, ...(errors.length ? { error: errors.join('; ') } : {}) })
    console.info('[ApplyFlow] WebMCP tools registered:', registered)
  })()
  return registrationPromise
}

export function teardownWebMcpTools() {
  controller?.abort()
  controller = undefined
  registrationContext = undefined
  registrationPromise = undefined
  publishStatus({ found: false, registered: [] })
}
