import { createApplication, getApplications, getApplicationById, submitApplication, validateApplication } from './services/applicationService'
import { getJobDetails, searchJobs } from './services/jobService'

export type WebMcpStatus = { found: boolean; registered: string[] }
const statusEvent = 'applyflow:webmcp-status'
let currentStatus: WebMcpStatus = { found: false, registered: [] }

declare global {
  interface Navigator { modelContext?: ModelContext }
  interface Document { modelContext?: ModelContext }
}

type ModelContext = { registerTool: (tool: WebMcpTool, options?: { signal?: AbortSignal }) => Promise<void> }
type WebMcpTool = {
  name: string
  description: string
  inputSchema: { type: 'object'; properties: Record<string, { type: string; description: string }>; required?: string[]; additionalProperties?: boolean }
  execute: (input: Record<string, unknown>) => unknown | Promise<unknown>
  annotations?: { readOnlyHint?: boolean }
}

function publishStatus(status: WebMcpStatus) {
  currentStatus = status
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(statusEvent, { detail: status }))
}

export function getWebMcpStatus(): WebMcpStatus { return currentStatus }

export function subscribeToWebMcpStatus(listener: (status: WebMcpStatus) => void) {
  const handleStatus = (event: Event) => listener((event as CustomEvent<WebMcpStatus>).detail)
  window.addEventListener(statusEvent, handleStatus)
  return () => window.removeEventListener(statusEvent, handleStatus)
}

function requiredString(input: Record<string, unknown>, key: string): string {
  const value = input[key]
  if (typeof value !== 'string' || !value.trim()) throw new Error(`The ${key} is required. Retry with a non-empty ${key} string.`)
  return value.trim()
}

// Add a tool by copying one of the entries below: keep the service call in
// execute, describe every input, and publish state changes to the UI.
function defineTools(): WebMcpTool[] {
  return [
    {
      name: 'search_jobs',
      description: 'Search and filter available jobs by keyword and optional criteria. Choose this for discovering opportunities; use get_job_details for one known job.',
      inputSchema: { type: 'object', properties: {
        query: { type: 'string', description: 'Job title, company, skill, or location keyword.' },
        location: { type: 'string', description: 'Exact location filter, or All.' },
        experience: { type: 'string', description: 'Minimum experience filter such as 3+ or Any.' },
        workMode: { type: 'string', description: 'Work mode filter such as Remote, Hybrid, or All.' },
        salary: { type: 'string', description: 'Minimum salary filter such as ₹20L+ or Any.' },
        jobType: { type: 'string', description: 'Job type filter such as Full-time or All.' },
      }, required: ['query'], additionalProperties: false },
      execute: async (input) => {
        const query = requiredString(input, 'query')
        const jobs = searchJobs({ query, location: typeof input.location === 'string' ? input.location : 'All', experience: typeof input.experience === 'string' ? input.experience : 'Any', workMode: typeof input.workMode === 'string' ? input.workMode : 'All', salary: typeof input.salary === 'string' ? input.salary : 'Any', jobType: typeof input.jobType === 'string' ? input.jobType : 'All' })
        return { query, count: jobs.length, jobs }
      },
      annotations: { readOnlyHint: true },
    },
    {
      name: 'get_job_details',
      description: 'Return full details for one job by ID, including responsibilities and requirements. Choose this after search_jobs identifies a specific opportunity.',
      inputSchema: { type: 'object', properties: { jobId: { type: 'string', description: 'Unique job ID such as job-1.' } }, required: ['jobId'], additionalProperties: false },
      execute: async (input) => {
        const jobId = requiredString(input, 'jobId')
        const job = getJobDetails(jobId)
        if (!job) throw new Error(`No job was found for ${jobId}. Retry with an ID returned by search_jobs.`)
        return { jobId, job }
      },
      annotations: { readOnlyHint: true },
    },
    {
      name: 'draft_application',
      description: 'Create a saved draft application for a job using the existing flow. Choose this to prepare an application for user review; it does not submit it.',
      inputSchema: { type: 'object', properties: { jobId: { type: 'string', description: 'Unique job ID to prepare an application for.' } }, required: ['jobId'], additionalProperties: false },
      execute: async (input) => {
        const jobId = requiredString(input, 'jobId')
        if (!getJobDetails(jobId)) throw new Error(`No job was found for ${jobId}. Retry with an ID returned by search_jobs.`)
        const existing = getApplications().find((application) => application.jobId === jobId && application.draft)
        const application = existing ?? createApplication(jobId)
        publishStatus({ ...currentStatus })
        return { applicationId: application.id, jobId, status: application.status, created: !existing }
      },
    },
    {
      name: 'submit_application',
      description: 'Submit one existing application after validation. Choose this only after the user reviewed and approved the draft; this changes application state.',
      inputSchema: { type: 'object', properties: { applicationId: { type: 'string', description: 'Application ID of the reviewed draft.' } }, required: ['applicationId'], additionalProperties: false },
      execute: async (input) => {
        const applicationId = requiredString(input, 'applicationId')
        if (!getApplicationById(applicationId)) throw new Error(`No application was found for ${applicationId}. Retry with an ID returned by draft_application.`)
        const validation = validateApplication(applicationId)
        if (!validation.valid) throw new Error(`Application is not ready. Fix: ${validation.issues.join('; ')}`)
        const submitted = submitApplication(applicationId)
        if (!submitted) throw new Error(`Application ${applicationId} could not be submitted. Retry after checking its status.`)
        publishStatus({ ...currentStatus })
        return { applicationId: submitted.id, jobId: submitted.jobId, status: submitted.status }
      },
    },
    {
      name: 'get_application_status',
      description: 'Return application status records by application ID or job ID. Choose this to track progress after drafting or submitting.',
      inputSchema: { type: 'object', properties: { applicationId: { type: 'string', description: 'Optional application ID to look up.' }, jobId: { type: 'string', description: 'Optional job ID to find applications for.' } }, additionalProperties: false },
      execute: async (input) => {
        const applicationId = typeof input.applicationId === 'string' ? input.applicationId.trim() : ''
        const jobId = typeof input.jobId === 'string' ? input.jobId.trim() : ''
        if (!applicationId && !jobId) throw new Error('Provide applicationId or jobId. Retry with one identifier.')
        const applications = getApplications().filter((application) => (applicationId && application.id === applicationId) || (jobId && application.jobId === jobId))
        return { applicationId, jobId, count: applications.length, applications: applications.map((application) => ({ applicationId: application.id, jobId: application.jobId, jobTitle: application.jobTitle, company: application.company, status: application.status, updatedAt: application.updatedAt })) }
      },
      annotations: { readOnlyHint: true },
    },
  ]
}

export async function registerWebMcpTools(): Promise<void> {
  const modelContext = typeof document !== 'undefined' ? document.modelContext ?? (typeof navigator !== 'undefined' ? navigator.modelContext : undefined) : undefined
  if (!modelContext || !('registerTool' in modelContext)) {
    publishStatus({ found: false, registered: [] })
    return
  }
  const controller = new AbortController()
  const registered: string[] = []
  for (const tool of defineTools()) {
    try {
      await modelContext.registerTool(tool, { signal: controller.signal })
      registered.push(tool.name)
    } catch {
      publishStatus({ found: true, registered: [...registered] })
      continue
    }
    publishStatus({ found: true, registered: [...registered] })
  }
}

