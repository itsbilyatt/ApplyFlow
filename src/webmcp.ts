import { createApplication, getApplications, submitApplication } from './services/applicationService'
import { getJobDetails, searchJobs } from './services/jobService'
import { getCandidateProfile } from './services/candidateService'
import { loginUser, signupUser, getCurrentUser, logoutUser } from './auth'
import type { Job } from './types'

export type WebMcpToolInput = Record<string, any>

export type WebMcpToolAnnotations = {
  readOnlyHint?: boolean
  destructiveHint?: boolean
  idempotentHint?: boolean
  openWorldHint?: boolean
}

export type WebMcpToolSchemaProperty = {
  type: string
  description?: string
}

export type WebMcpToolInputSchema = {
  type: 'object'
  properties: Record<string, WebMcpToolSchemaProperty>
  required?: string[]
  additionalProperties?: boolean
}

export type WebMcpTool = {
  name: string
  title?: string
  description: string
  inputSchema: WebMcpToolInputSchema
  annotations?: WebMcpToolAnnotations
  execute: (input: WebMcpToolInput) => Promise<any> | any
}

export type WebMcpToolSummary = {
  name: string
  title?: string
  description: string
  inputSchema: WebMcpToolInputSchema
  annotations?: WebMcpToolAnnotations
}

export type WebMcpRuntime = {
  registerTool: (tool: WebMcpTool) => Promise<void> | void
  getTools: () => Promise<WebMcpToolSummary[]> | WebMcpToolSummary[]
  listTools: () => Promise<WebMcpToolSummary[]> | WebMcpToolSummary[]
  getTool: (name: string) => WebMcpTool | undefined
  callTool: (name: string, input?: WebMcpToolInput) => Promise<any> | any
  invokeTool: (name: string, input?: WebMcpToolInput) => Promise<any> | any
  executeTool?: (tool: WebMcpTool | string, input?: WebMcpToolInput) => Promise<any> | any
}

declare global {
  interface Document {
    modelContext?: WebMcpRuntime
  }
}

const fallbackToolMap = new Map<string, WebMcpTool>()

function summarizeTool(tool: WebMcpTool): WebMcpToolSummary {
  return {
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema: tool.inputSchema,
    annotations: tool.annotations,
  }
}

function normalizeString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return fallback
}

function getSavedJobs(): string[] {
  if (typeof window === 'undefined') return []

  try {
    const raw = window.localStorage.getItem('applyflow-saved-jobs')
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function setSavedJobs(savedJobs: string[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem('applyflow-saved-jobs', JSON.stringify(savedJobs))
}

function ensureRuntime(): WebMcpRuntime {
  if (typeof document !== 'undefined' && document.modelContext) {
    const runtime = document.modelContext

    if (typeof runtime.getTools !== 'function') {
      runtime.getTools = () => Array.from(fallbackToolMap.values()).map(summarizeTool)
    }

    if (typeof runtime.listTools !== 'function') {
      runtime.listTools = () => runtime.getTools()
    }

    if (typeof runtime.getTool !== 'function') {
      runtime.getTool = (name) => fallbackToolMap.get(name)
    }

    if (typeof runtime.callTool !== 'function') {
      runtime.callTool = async (name, input = {}) => {
        const tool = runtime.getTool(name)
        if (!tool) {
          throw new Error(`Tool "${name}" is not registered.`)
        }

        return tool.execute(input)
      }
    }

    if (typeof runtime.invokeTool !== 'function') {
      runtime.invokeTool = runtime.callTool.bind(runtime)
    }

    if (typeof runtime.registerTool !== 'function') {
      runtime.registerTool = (tool) => {
        fallbackToolMap.set(tool.name, tool)
      }
    }

    if (typeof runtime.executeTool !== 'function') {
      runtime.executeTool = async (toolOrName, input = {}) => {
        const tool = typeof toolOrName === 'string' ? runtime.getTool(toolOrName) : toolOrName
        if (!tool) {
          throw new Error('Tool not found.')
        }

        return tool.execute(input)
      }
    }

    return runtime
  }

  const runtime: WebMcpRuntime = {
    registerTool: (tool) => {
      fallbackToolMap.set(tool.name, tool)
    },
    getTools: () => Array.from(fallbackToolMap.values()).map(summarizeTool),
    listTools: () => Array.from(fallbackToolMap.values()).map(summarizeTool),
    getTool: (name) => fallbackToolMap.get(name),
    callTool: async (name, input = {}) => {
      const tool = fallbackToolMap.get(name)
      if (!tool) {
        throw new Error(`Tool "${name}" is not registered.`)
      }

      return tool.execute(input)
    },
    invokeTool: async (name, input = {}) => {
      const tool = fallbackToolMap.get(name)
      if (!tool) {
        throw new Error(`Tool "${name}" is not registered.`)
      }

      return tool.execute(input)
    },
    executeTool: async (toolOrName, input = {}) => {
      const tool = typeof toolOrName === 'string' ? fallbackToolMap.get(toolOrName) : toolOrName
      if (!tool) {
        throw new Error('Tool not found.')
      }

      return tool.execute(input)
    },
  }

  if (typeof document !== 'undefined') {
    document.modelContext = runtime
  }

  return runtime
}

export async function registerWebMcpTools(): Promise<WebMcpRuntime> {
  const runtime = ensureRuntime()
  const existingNames = new Set((await Promise.resolve(runtime.getTools())).map((tool) => tool.name))
  const tools: WebMcpTool[] = [
    {
      name: 'login_user',
      title: 'Login User',
      description: 'Authenticate an existing ApplyFlow user with their email and password so the browser session can be used normally.',
      inputSchema: {
        type: 'object',
        properties: {
          email: { type: 'string', description: 'Registered email address for the ApplyFlow account.' },
          password: { type: 'string', description: 'Password for the matching user account.' },
        },
        required: ['email', 'password'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      execute: (input = {}) => {
        const result = loginUser({
          email: normalizeString(input.email),
          password: normalizeString(input.password),
        })

        return {
          tool: 'login_user',
          success: result.success,
          message: result.message,
          user: result.user ?? null,
        }
      },
    },
    {
      name: 'signup_user',
      title: 'Sign Up User',
      description: 'Create a new ApplyFlow account and immediately sign the user in so they can browse jobs and submit applications.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Full name for the new account.' },
          email: { type: 'string', description: 'Email address that will be used to sign in.' },
          password: { type: 'string', description: 'Password with at least 6 characters.' },
        },
        required: ['name', 'email', 'password'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      execute: (input = {}) => {
        const result = signupUser({
          name: normalizeString(input.name),
          email: normalizeString(input.email),
          password: normalizeString(input.password),
        })

        return {
          tool: 'signup_user',
          success: result.success,
          message: result.message,
          user: result.user ?? null,
        }
      },
    },
    {
      name: 'get_current_user',
      title: 'Get Current User',
      description: 'Return the currently logged-in ApplyFlow user from the browser session so the agent can operate with the same authenticated identity.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      execute: () => ({
        tool: 'get_current_user',
        user: getCurrentUser(),
      }),
    },
    {
      name: 'logout_user',
      title: 'Log Out User',
      description: 'Sign the current session out of ApplyFlow and clear the authenticated browser state.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
      execute: () => {
        logoutUser()
        return {
          tool: 'logout_user',
          success: true,
          message: 'User logged out successfully.',
        }
      },
    },
    {
      name: 'search_jobs',
      title: 'Search Jobs',
      description: 'Search available job opportunities by keyword and location. Returns matching jobs with title, company, location, salary, and job ID.',
      inputSchema: {
        type: 'object',
        properties: {
          keyword: { type: 'string', description: 'Job title, company, skill, or keyword to search for.' },
          location: { type: 'string', description: 'Location to filter by, such as Pune, Hyderabad, or Remote.' },
          experience: { type: 'string', description: 'Minimum required experience level, such as 3+ years or Any.' },
          workMode: { type: 'string', description: 'Work mode filter such as Hybrid, Remote, or On-site.' },
          salary: { type: 'string', description: 'Salary threshold such as ₹20L+ or Any.' },
          limit: { type: 'number', description: 'Maximum number of results to return.' },
        },
        required: ['keyword'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      execute: (input = {}) => {
        const keyword = normalizeString(input.keyword ?? input.query, '')
        const location = normalizeString(input.location, 'All')
        const jobs = searchJobs({
          query: keyword,
          location,
          experience: normalizeString(input.experience, 'Any'),
          workMode: normalizeString(input.workMode, 'All'),
          salary: normalizeString(input.salary, 'Any'),
          jobType: normalizeString(input.jobType, 'All'),
        })

        const limit = Number(input.limit ?? jobs.length)
        const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.min(limit, jobs.length)) : jobs.length

        return {
          tool: 'search_jobs',
          keyword,
          location,
          count: jobs.length,
          results: jobs.slice(0, safeLimit),
          jobs: jobs.slice(0, safeLimit),
        }
      },
    },
    {
      name: 'get_job_details',
      title: 'Get Job Details',
      description: 'Fetch one job posting by ID and return its responsibilities, requirements, salary, and matching details for a specific opportunity.',
      inputSchema: {
        type: 'object',
        properties: {
          jobId: { type: 'string', description: 'Unique ID of the job to retrieve, such as job-1.' },
        },
        required: ['jobId'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      execute: (input = {}) => {
        const jobId = normalizeString(input.jobId)
        const job = getJobDetails(jobId)

        if (!job) {
          return {
            tool: 'get_job_details',
            success: false,
            job: null,
            jobId,
            message: `No job found for ${jobId}`,
          }
        }

        return {
          tool: 'get_job_details',
          success: true,
          job,
          jobId: job.id,
        }
      },
    },
    {
      name: 'get_my_profile',
      title: 'Get My Profile',
      description: 'Return the current candidate profile, skills, resume information, and contact details used by ApplyFlow to match and apply for jobs.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      execute: () => ({
        tool: 'get_my_profile',
        success: true,
        profile: getCandidateProfile(),
      }),
    },
    {
      name: 'get_my_resumes',
      title: 'Get My Resumes',
      description: 'List the candidate resumes available in ApplyFlow so an application can be submitted using the correct resume document.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      execute: () => {
        const profile = getCandidateProfile()
        const resumes = [
          {
            resumeId: profile.resumeName,
            name: profile.resumeName,
            type: 'resume',
            isDefault: true,
            updatedAt: new Date().toISOString(),
          },
        ]

        return {
          tool: 'get_my_resumes',
          success: true,
          resumes,
          count: resumes.length,
        }
      },
    },
    {
      name: 'save_job',
      title: 'Save Job',
      description: 'Save a job to the user’s shortlist for later review. This is a personal bookmark action and does not submit an application.',
      inputSchema: {
        type: 'object',
        properties: {
          jobId: { type: 'string', description: 'Unique job ID to save for later.' },
        },
        required: ['jobId'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      execute: (input = {}) => {
        const jobId = normalizeString(input.jobId)
        const job = getJobDetails(jobId)

        if (!job) {
          return {
            tool: 'save_job',
            success: false,
            jobId,
            message: `No job found for ${jobId}`,
          }
        }

        const savedJobs = getSavedJobs()
        const nextSavedJobs = savedJobs.includes(jobId) ? savedJobs : [...savedJobs, jobId]
        setSavedJobs(nextSavedJobs)

        return {
          tool: 'save_job',
          success: true,
          jobId: job.id,
          title: job.title,
          company: job.company,
          saved: true,
          message: `Saved ${job.title} at ${job.company} for later.`,
        }
      },
    },
    {
      name: 'apply_job',
      title: 'Apply to Job',
      description: 'Submit an application for a job using the user’s selected resume and the existing ApplyFlow application flow.',
      inputSchema: {
        type: 'object',
        properties: {
          jobId: { type: 'string', description: 'Unique ID of the job to apply for.' },
          resumeId: { type: 'string', description: 'ID of the resume to use for this application.' },
        },
        required: ['jobId', 'resumeId'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      execute: (input = {}) => {
        const jobId = normalizeString(input.jobId)
        const resumeId = normalizeString(input.resumeId, getCandidateProfile().resumeName)
        const job = getJobDetails(jobId)

        if (!job) {
          return {
            tool: 'apply_job',
            success: false,
            jobId,
            resumeId,
            message: `No job found for ${jobId}`,
          }
        }

        const draft = createApplication(jobId)
        const submitted = submitApplication(draft.id)

        if (!submitted) {
          return {
            tool: 'apply_job',
            success: false,
            jobId,
            resumeId,
            message: `Application could not be submitted for ${job.title}.`,
          }
        }

        return {
          tool: 'apply_job',
          success: true,
          applicationId: submitted.id,
          jobId: submitted.jobId,
          resumeId,
          status: submitted.status,
          message: `Application submitted successfully for ${submitted.jobTitle}.`,
        }
      },
    },
    {
      name: 'get_application_status',
      title: 'Get Application Status',
      description: 'Check the status of an application by application ID or by job ID so the agent can confirm whether an application was submitted or is still a draft.',
      inputSchema: {
        type: 'object',
        properties: {
          applicationId: { type: 'string', description: 'Application ID to look up.' },
          jobId: { type: 'string', description: 'Job ID to find the related application.' },
        },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      execute: (input = {}) => {
        const applicationId = normalizeString(input.applicationId, '')
        const jobId = normalizeString(input.jobId, '')
        const applications = getApplications()

        const matches = applications.filter((application) => {
          if (applicationId && application.id === applicationId) return true
          if (jobId && application.jobId === jobId) return true
          return false
        })

        return {
          tool: 'get_application_status',
          success: matches.length > 0,
          count: matches.length,
          applications: matches.map((application) => ({
            applicationId: application.id,
            jobId: application.jobId,
            jobTitle: application.jobTitle,
            company: application.company,
            status: application.status,
            updatedAt: application.updatedAt,
          })),
          message: matches.length ? 'Application status retrieved successfully.' : 'No matching application found.',
        }
      },
    },
  ]

  for (const tool of tools) {
    if (!existingNames.has(tool.name)) {
      await Promise.resolve(runtime.registerTool(tool))
      existingNames.add(tool.name)
    }
  }

  return runtime
}

export async function invokeWebMcpTool(name: string, input: WebMcpToolInput = {}): Promise<any> {
  const runtime = ensureRuntime()
  const tool = runtime.getTool(name)

  if (!tool) {
    const method = typeof runtime.invokeTool === 'function' ? runtime.invokeTool : runtime.callTool
    return method.call(runtime, name, input)
  }

  return tool.execute(input)
}

export async function getRegisteredWebMcpTools(): Promise<WebMcpToolSummary[]> {
  const runtime = ensureRuntime()
  return await Promise.resolve(runtime.getTools())
}
