import { createApplication, submitApplication } from './services/applicationService'
import { getJobDetails, searchJobs } from './services/jobService'
import { loginUser, signupUser, getCurrentUser, logoutUser } from './auth'
import type { Job } from './types'

export type WebMcpToolInput = Record<string, any>

export type WebMcpToolAnnotations = {
  readOnlyHint?: boolean
  destructiveHint?: boolean
  idempotentHint?: boolean
  openWorldHint?: boolean
}

export type WebMcpTool = {
  name: string
  title?: string
  description: string
  inputSchema: Record<string, unknown>
  annotations?: WebMcpToolAnnotations
  execute: (input: WebMcpToolInput) => Promise<any> | any
}

export type WebMcpToolSummary = {
  name: string
  title?: string
  description: string
  inputSchema: Record<string, unknown>
  annotations?: WebMcpToolAnnotations
}

export type WebMcpRuntime = {
  registerTool: (tool: WebMcpTool) => void
  getTools: () => WebMcpToolSummary[]
  listTools: () => WebMcpToolSummary[]
  getTool: (name: string) => WebMcpTool | undefined
  callTool: (name: string, input?: WebMcpToolInput) => Promise<any> | any
  invokeTool: (name: string, input?: WebMcpToolInput) => Promise<any> | any
}

declare global {
  interface Document {
    modelContext?: WebMcpRuntime
  }
}

const fallbackToolMap = new Map<string, WebMcpTool>()

function ensureRuntime(): WebMcpRuntime {
  if (typeof document !== 'undefined' && document.modelContext) {
    const runtime = document.modelContext

    if (typeof runtime.getTools !== 'function') {
      runtime.getTools = () => Array.from(fallbackToolMap.values()).map(({ name, title, description, inputSchema, annotations }) => ({
        name,
        title,
        description,
        inputSchema,
        annotations,
      }))
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

    return runtime
  }

  const runtime: WebMcpRuntime = {
    registerTool: (tool) => {
      fallbackToolMap.set(tool.name, tool)
    },
    getTools: () => Array.from(fallbackToolMap.values()).map(({ name, title, description, inputSchema, annotations }) => ({
      name,
      title,
      description,
      inputSchema,
      annotations,
    })),
    listTools: () => Array.from(fallbackToolMap.values()).map(({ name, title, description, inputSchema, annotations }) => ({
      name,
      title,
      description,
      inputSchema,
      annotations,
    })),
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
  }

  if (typeof document !== 'undefined') {
    document.modelContext = runtime
  }

  return runtime
}

export function registerWebMcpTools(): WebMcpRuntime {
  const runtime = ensureRuntime()

  const existingNames = new Set(runtime.getTools().map((tool) => tool.name))
  const tools: WebMcpTool[] = [
    {
      name: 'login_user',
      title: 'Login User',
      description: 'Authenticate a user with a registered email and password.',
      inputSchema: {
        type: 'object',
        properties: {
          email: { type: 'string' },
          password: { type: 'string' },
        },
        required: ['email', 'password'],
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
      execute: (input = {}) => {
        const result = loginUser({
          email: String(input.email ?? ''),
          password: String(input.password ?? ''),
        })

        return {
          tool: 'login_user',
          ...result,
        }
      },
    },
    {
      name: 'signup_user',
      title: 'Sign Up User',
      description: 'Create a new user account with validated credentials.',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string' },
          password: { type: 'string' },
        },
        required: ['name', 'email', 'password'],
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
      execute: (input = {}) => {
        const result = signupUser({
          name: String(input.name ?? ''),
          email: String(input.email ?? ''),
          password: String(input.password ?? ''),
        })

        return {
          tool: 'signup_user',
          ...result,
        }
      },
    },
    {
      name: 'get_current_user',
      title: 'Get Current User',
      description: 'Return the current authenticated user session if one exists.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      execute: () => ({
        tool: 'get_current_user',
        user: getCurrentUser(),
      }),
    },
    {
      name: 'logout_user',
      title: 'Log Out User',
      description: 'Log the current user out of the app.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
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
      description: 'Search and rank jobs for a candidate based on skills, location, and work preferences.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          location: { type: 'string' },
          experience: { type: 'string' },
          workMode: { type: 'string' },
          salary: { type: 'string' },
          jobType: { type: 'string' },
          limit: { type: 'number' },
        },
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      execute: (input = {}) => {
        const jobs = searchJobs({
          query: String(input.query ?? ''),
          location: String(input.location ?? 'All'),
          experience: String(input.experience ?? 'Any'),
          workMode: String(input.workMode ?? 'All'),
          salary: String(input.salary ?? 'Any'),
          jobType: String(input.jobType ?? 'All'),
        })

        const limit = Number(input.limit ?? jobs.length)
        return {
          tool: 'search_jobs',
          jobs: jobs.slice(0, Number.isFinite(limit) ? Math.max(0, limit) : jobs.length),
          count: jobs.length,
        }
      },
    },
    {
      name: 'get_job_details',
      title: 'Get Job Details',
      description: 'Fetch a single job posting with responsibilities, requirements, and fit score.',
      inputSchema: {
        type: 'object',
        properties: {
          jobId: { type: 'string' },
        },
        required: ['jobId'],
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      execute: (input = {}) => {
        const jobId = String(input.jobId ?? '')
        const job = getJobDetails(jobId)

        if (!job) {
          return {
            tool: 'get_job_details',
            job: null,
            message: `No job found for ${jobId}`,
          }
        }

        return {
          tool: 'get_job_details',
          job,
        }
      },
    },
    {
      name: 'draft_application',
      title: 'Draft Application',
      description: 'Create a draft application tailored to the selected role and profile.',
      inputSchema: {
        type: 'object',
        properties: {
          jobId: { type: 'string' },
        },
        required: ['jobId'],
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
      execute: (input = {}) => {
        const jobId = String(input.jobId ?? '')
        const created = createApplication(jobId)

        return {
          tool: 'draft_application',
          applicationId: created.id,
          jobId: created.jobId,
          jobTitle: created.jobTitle,
          status: created.status,
          message: 'Draft created successfully.',
        }
      },
    },
    {
      name: 'submit_application',
      title: 'Submit Application',
      description: 'Submit an application after user approval.',
      inputSchema: {
        type: 'object',
        properties: {
          applicationId: { type: 'string' },
        },
        required: ['applicationId'],
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
      execute: (input = {}) => {
        const applicationId = String(input.applicationId ?? '')
        const application = submitApplication(applicationId)

        return {
          tool: 'submit_application',
          application,
          message: application ? 'Application submitted.' : 'Application not found.',
        }
      },
    },
  ]

  for (const tool of tools) {
    if (!existingNames.has(tool.name)) {
      runtime.registerTool(tool)
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

export function getRegisteredWebMcpTools(): WebMcpToolSummary[] {
  return ensureRuntime().getTools()
}
