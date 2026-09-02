// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

type RegisteredTool = {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

type FakeContext = {
  registerTool: ReturnType<typeof vi.fn>
  calls: RegisteredTool[]
  signals: AbortSignal[]
}

function installContext(context: FakeContext, target: 'document' | 'navigator' = 'document') {
  Object.defineProperty(target === 'document' ? document : navigator, 'modelContext', {
    configurable: true,
    value: context,
  })
}

function removeContexts() {
  Object.defineProperty(document, 'modelContext', { configurable: true, value: undefined })
  Object.defineProperty(navigator, 'modelContext', { configurable: true, value: undefined })
}

function fakeContext(): FakeContext {
  const calls: RegisteredTool[] = []
  const signals: AbortSignal[] = []
  const registerTool = vi.fn(async (tool: RegisteredTool, options: { signal: AbortSignal }) => {
    calls.push(tool)
    signals.push(options.signal)
  })
  return { registerTool, calls, signals }
}

async function loadWebMcp() {
  vi.resetModules()
  return import('./webmcp')
}

describe('WebMCP registration', () => {
  beforeEach(() => {
    removeContexts()
    window.localStorage.clear()
  })

  it('reports unsupported browsers without treating it as a registration failure', async () => {
    const webmcp = await loadWebMcp()

    await webmcp.registerWebMcpTools()

    expect(webmcp.getWebMcpStatus()).toEqual({
      found: false,
      registered: [],
      error: 'This browser does not support WebMCP.',
    })
  })

  it('prefers document.modelContext and registers discoverable read-only tools', async () => {
    const context = fakeContext()
    installContext(context)
    const fallback = fakeContext()
    installContext(fallback, 'navigator')
    const webmcp = await loadWebMcp()

    await webmcp.registerWebMcpTools()

    expect(fallback.registerTool).not.toHaveBeenCalled()
    expect(context.calls.map((tool) => tool.name)).toEqual([
      'search_jobs',
      'get_job_details',
      'get_application_status',
      'get_profile_summary',
    ])
    expect(context.calls.every((tool) => tool.description && tool.inputSchema.type === 'object')).toBe(true)
    expect(context.calls.every((tool) => tool.inputSchema.additionalProperties === false)).toBe(true)
    expect(webmcp.getWebMcpStatus()).toEqual({
      found: true,
      registered: context.calls.map((tool) => tool.name),
    })
  })

  it('uses navigator.modelContext only as the compatibility fallback', async () => {
    const context = fakeContext()
    installContext(context, 'navigator')
    const webmcp = await loadWebMcp()

    await webmcp.registerWebMcpTools()

    expect(context.registerTool).toHaveBeenCalledTimes(4)
  })

  it('surfaces invalid-schema and duplicate-name registration rejections by tool name', async () => {
    const context = fakeContext()
    context.registerTool.mockImplementation(async (tool: RegisteredTool, options: { signal: AbortSignal }) => {
      context.calls.push(tool)
      context.signals.push(options.signal)
      if (tool.name === 'search_jobs') throw new Error('invalid inputSchema')
      if (tool.name === 'get_job_details') throw new Error('duplicate tool name')
    })
    installContext(context)
    const webmcp = await loadWebMcp()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await webmcp.registerWebMcpTools()

    expect(webmcp.getWebMcpStatus().registered).toEqual(['get_application_status', 'get_profile_summary'])
    expect(webmcp.getWebMcpStatus().error).toContain('search_jobs: invalid inputSchema')
    expect(webmcp.getWebMcpStatus().error).toContain('get_job_details: duplicate tool name')
    errorSpy.mockRestore()
  })

  it('aborts the page-lifetime registration signal on teardown', async () => {
    const context = fakeContext()
    installContext(context)
    const webmcp = await loadWebMcp()

    await webmcp.registerWebMcpTools()
    webmcp.teardownWebMcpTools()

    expect(context.signals).toHaveLength(4)
    expect(context.signals[0].aborted).toBe(true)
    expect(webmcp.getWebMcpStatus()).toEqual({ found: false, registered: [] })
  })

  it('captures the metadata a browser agent must discover', async () => {
    const context = fakeContext()
    installContext(context)
    const webmcp = await loadWebMcp()

    await webmcp.registerWebMcpTools()

    const discovered = context.calls.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }))
    expect(discovered).toHaveLength(4)
    expect(discovered.find((tool) => tool.name === 'search_jobs')).toMatchObject({
      description: 'Searches currently available jobs in ApplyFlow.',
      inputSchema: {
        type: 'object',
        required: ['query'],
        additionalProperties: false,
      },
    })
  })
})
