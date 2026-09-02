import { useMemo, useState } from 'react'
import { BrowserRouter, Link, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { currentCandidate } from './data/candidates'
import { jobs } from './data/jobs'
import { getApplications, getApplicationById, createApplication, updateApplication, submitApplication, getApplicationSchema, validateApplication, getApplicationPreview } from './services/applicationService'
import { getCandidateProfile } from './services/candidateService'
import { getJobDetails, getRecommendedJobs, searchJobs } from './services/jobService'
import type { Application, ApplicationFormData, Job } from './types'
import { invokeWebMcpTool, registerWebMcpTools } from './webmcp'
import { getCurrentUser, loginUser, logoutUser, signupUser } from './auth'

if (typeof document !== 'undefined' && 'modelContext' in document) {
  void registerWebMcpTools()
}

function App() {
  const currentUser = getCurrentUser()

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/" element={currentUser ? <DashboardPage /> : <AuthPage />} />
        <Route path="/jobs" element={currentUser ? <JobsPage /> : <AuthPage />} />
        <Route path="/jobs/:jobId" element={currentUser ? <JobDetailsPage /> : <AuthPage />} />
        <Route path="/applications" element={currentUser ? <ApplicationsPage /> : <AuthPage />} />
        <Route path="/profile" element={currentUser ? <ProfilePage /> : <AuthPage />} />
        <Route path="/settings" element={currentUser ? <SettingsPage /> : <AuthPage />} />
        <Route path="/apply/:jobId" element={currentUser ? <ApplicationPage /> : <AuthPage />} />
        <Route path="/apply/:jobId/review" element={currentUser ? <ReviewPage /> : <AuthPage />} />
        <Route path="/apply/:jobId/submitted" element={currentUser ? <SubmittedPage /> : <AuthPage />} />
      </Routes>
    </BrowserRouter>
  )
}

function AuthPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleSubmit = () => {
    if (mode === 'login') {
      const result = loginUser({ email, password })
      if (!result.success) {
        setError(result.message)
        setSuccess('')
        return
      }

      setError('')
      setSuccess(result.message)
      window.location.assign('/jobs')
      return
    }

    const result = signupUser({ name, email, password })
    if (!result.success) {
      setError(result.message)
      setSuccess('')
      return
    }

    setError('')
    setSuccess(result.message)
    window.location.assign('/jobs')
  }

  return (
    <div className="auth-shell">
      <div className="auth-card panel">
        <div className="auth-header">
          <div className="brand">ApplyFlow</div>
          <h1>{mode === 'login' ? 'Welcome back' : 'Create account'}</h1>
        </div>

        <div className="auth-toggle">
          <button className={mode === 'login' ? 'tab active' : 'tab'} onClick={() => setMode('login')}>Login</button>
          <button className={mode === 'signup' ? 'tab active' : 'tab'} onClick={() => setMode('signup')}>Sign up</button>
        </div>

        {mode === 'signup' && (
          <label>
            Full name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
          </label>
        )}

        <label>
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </label>

        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="********" />
        </label>

        {error && <div className="auth-message error">{error}</div>}
        {success && <div className="auth-message success">{success}</div>}

        <button className="primary-button full-width" onClick={handleSubmit}>
          {mode === 'login' ? 'Login' : 'Sign up'}
        </button>

        <div className="auth-demo">
          <strong>Demo account:</strong>
          <div>demo@applyflow.com / demo123</div>
        </div>
      </div>
    </div>
  )
}

function DashboardPage() {
  const jobsForDashboard = getRecommendedJobs()
  return (
    <AppShell>
      <div className="dashboard-shell">
        <section className="hero-panel panel">
          <div className="hero-copy">
            <p className="eyebrow">AI candidate workspace</p>
            <h1>Your next role, orchestrated.</h1>
            <p className="hero-subtitle">ApplyFlow blends your profile with agent intelligence so you can discover, tailor, and approve every opportunity from a single workspace.</p>
            <div className="hero-actions">
              <Link to="/jobs" className="primary-button">Browse Jobs</Link>
              <button className="secondary-button" onClick={async () => {
                const result = await invokeWebMcpTool('search_jobs', {
                  query: 'oracle dba',
                  location: 'Pune',
                  limit: 3,
                })
                console.log('WebMCP search_jobs result:', result)
                window.alert(`Agent found ${result.jobs.length} matching roles.`)
              }}>Run Agent</button>
            </div>
          </div>

          <div className="hero-spotlight">
            <div className="spotlight-card">
              <span className="mini-label">Top signal</span>
              <div className="spotlight-score">94%</div>
              <div className="spotlight-meta">Senior Oracle DBA</div>
              <div className="spotlight-loc">TechNova • Pune • Hybrid</div>
              <div className="spotlight-footer">
                <span>₹18L – ₹25L</span>
                <Link to="/jobs/job-1">Open</Link>
              </div>
            </div>
          </div>
        </section>

        <div className="stats-grid">
          <StatCard label="Profile Completion" value="92%" accent="green" />
          <StatCard label="Matching Jobs" value="24" accent="blue" />
          <StatCard label="Applications" value="8" accent="purple" />
          <StatCard label="Interviews" value="2" accent="amber" />
        </div>

        <div className="workspace-grid">
          <div className="workspace-main">
            <div className="panel">
              <div className="panel-header">
                <h2>Recommended for you</h2>
                <Link to="/jobs">View all</Link>
              </div>
              <div className="job-list grid-compact">
                {jobsForDashboard.map((job) => (
                  <div key={job.id} className="job-card compact-card">
                    <div className="job-card-header">
                      <div>
                        <h3>{job.title}</h3>
                        <p>{job.company}</p>
                      </div>
                      <span className="badge">{job.matchScore}%</span>
                    </div>
                    <p className="meta-line">{job.location} • {job.workMode}</p>
                    <p className="meta-line salary">{job.salary}</p>
                    <div className="tag-list">
                      {job.skills.slice(0, 3).map((skill) => (
                        <span key={skill} className="tag">{skill}</span>
                      ))}
                    </div>
                    <div className="actions-row">
                      <Link to={`/jobs/${job.id}`} className="secondary-button">View Job</Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <aside className="workspace-side">
            <div className="panel agent-panel">
              <div className="panel-header panel-header-tight">
                <h2>Agent workflow</h2>
                <span className="pulse-dot">Live</span>
              </div>

              <div className="assistant-card">
                <div className="assistant-header">
                  <span className="bot-pill">AI</span>
                  <div>
                    <strong>ApplyFlow agent</strong>
                    <small>Watching your fit signals</small>
                  </div>
                </div>
                <div className="assistant-message">
                  “I ranked your opportunities, prepared the strongest applications, and flagged the two roles worth custom tailoring.”
                </div>
              </div>

              <div className="workflow-list">
                <div className="task-item complete">
                  <span className="task-state">✓</span>
                  <div>
                    <strong>Prioritized top 3 matches</strong>
                    <small>Updated 14 minutes ago</small>
                  </div>
                </div>
                <div className="task-item active">
                  <span className="task-state">◎</span>
                  <div>
                    <strong>Drafting cover note</strong>
                    <small>For Senior Oracle DBA</small>
                  </div>
                </div>
                <div className="task-item">
                  <span className="task-state">•</span>
                  <div>
                    <strong>Skill gap review</strong>
                    <small>Kubernetes + Goldengate</small>
                  </div>
                </div>
              </div>

              <div className="signal-card">
                <div className="signal-header">
                  <span className="signal-label">Opportunity quality</span>
                  <span className="signal-score">8.7/10</span>
                </div>
                <div className="signal-bar"><span /></div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  )
}

function JobsPage() {
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState({
    location: 'All',
    experience: 'Any',
    workMode: 'All',
    salary: 'Any',
    jobType: 'All',
  })

  const result = useMemo(() => searchJobs({
    query,
    ...filters,
  }), [query, filters])

  return (
    <AppShell>
      <div className="page-header jobs-header">
        <div>
          <p className="eyebrow">Career platform</p>
          <h1>Find your next opportunity</h1>
        </div>
      </div>

      <div className="toolbar">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search jobs, skills or companies"
          className="search-input"
        />
        <button
          className="primary-button"
          onClick={async () => {
            const result = await invokeWebMcpTool('search_jobs', {
              query,
              location: filters.location === 'All' ? undefined : filters.location,
              experience: filters.experience === 'Any' ? undefined : filters.experience,
              workMode: filters.workMode === 'All' ? undefined : filters.workMode,
              salary: filters.salary === 'Any' ? undefined : filters.salary,
              jobType: filters.jobType === 'All' ? undefined : filters.jobType,
              limit: 10,
            })
            console.log('WebMCP search result:', result)
            window.alert(`Agent returned ${result.jobs.length} roles for your filters.`)
          }}
        >
          🤖 Find for me
        </button>
      </div>

      <div className="filter-row">
        <select value={filters.location} onChange={(e) => setFilters({ ...filters, location: e.target.value })}>
          <option value="All">Location</option>
          <option value="Pune">Pune</option>
          <option value="Bengaluru">Bengaluru</option>
          <option value="Hyderabad">Hyderabad</option>
          <option value="Mumbai">Mumbai</option>
          <option value="Remote">Remote</option>
        </select>
        <select value={filters.experience} onChange={(e) => setFilters({ ...filters, experience: e.target.value })}>
          <option value="Any">Experience</option>
          <option value="3+">3+ years</option>
          <option value="4+">4+ years</option>
          <option value="5+">5+ years</option>
          <option value="6+">6+ years</option>
        </select>
        <select value={filters.workMode} onChange={(e) => setFilters({ ...filters, workMode: e.target.value })}>
          <option value="All">Work Mode</option>
          <option value="Hybrid">Hybrid</option>
          <option value="Remote">Remote</option>
          <option value="On-site">On-site</option>
        </select>
        <select value={filters.salary} onChange={(e) => setFilters({ ...filters, salary: e.target.value })}>
          <option value="Any">Salary</option>
          <option value="₹15L+">₹15L+</option>
          <option value="₹20L+">₹20L+</option>
          <option value="₹25L+">₹25L+</option>
          <option value="₹30L+">₹30L+</option>
        </select>
        <select value={filters.jobType} onChange={(e) => setFilters({ ...filters, jobType: e.target.value })}>
          <option value="All">Job Type</option>
          <option value="Full-time">Full-time</option>
          <option value="Contract">Contract</option>
        </select>
      </div>

      <div className="job-list">
        {result.map((job) => (
          <div key={job.id} className="job-card">
            <div className="company-mark">{job.company.slice(0, 2).toUpperCase()}</div>
            <div className="job-main">
              <div className="job-card-heading">
                <div>
                  <h3>{job.title}</h3>
                  <p className="company-name">{job.company}</p>
                </div>
                <span className="badge accent">{job.matchScore}% match</span>
              </div>
              <p className="meta-line">{job.location} • {job.workMode}</p>
              <div className="inline-metrics">
                <span>{job.salary}</span>
                <span>{job.experience}</span>
              </div>
              <div className="tag-list">
                {job.skills.slice(0, 4).map((skill) => (
                  <span key={skill} className="tag">{skill}</span>
                ))}
              </div>
              <div className="job-footer">
                <small>Posted {job.postedDaysAgo} days ago</small>
                <Link to={`/jobs/${job.id}`} className="primary-button compact">View Job</Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  )
}

function JobDetailsPage() {
  const { jobId } = useParams()
  const job = jobId ? getJobDetails(jobId) : undefined
  const navigate = useNavigate()

  if (!job) return <AppShell><div className="empty-state">Job not found.</div></AppShell>

  return (
    <AppShell>
      <button className="back-link" onClick={() => navigate('/jobs')}>&larr; Back to Jobs</button>
      <div className="job-detail-layout">
        <div className="job-detail-content">
          <h1>{job.title}</h1>
          <div className="company-row">
            <span>{job.company}</span>
            <span>{job.location} • {job.workMode}</span>
          </div>
          <div className="inline-metrics large">
            <span>{job.salary}</span>
            <span>{job.experience} experience</span>
          </div>
          <button className="primary-button" onClick={() => navigate(`/apply/${job.id}`)}>Apply Now</button>

          <div className="detail-section">
            <h3>About the role</h3>
            <p>{job.description}</p>
          </div>

          <div className="detail-section">
            <h3>Responsibilities</h3>
            <ul>
              {job.responsibilities.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>

          <div className="detail-section">
            <h3>Requirements</h3>
            <ul>
              {job.requirements.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>

          <div className="detail-section">
            <h3>Nice to have</h3>
            <div className="tag-list">
              {job.niceToHave.map((item) => <span key={item} className="tag">{item}</span>)}
            </div>
          </div>
        </div>

        <aside className="side-panel match-panel">
          <h3>Your match</h3>
          <div className="match-score">{job.matchScore}%</div>
          <p>Strong match for this role.</p>
          <div className="match-detail">
            <strong>Matched skills</strong>
            <ul>
              {job.skills.slice(0, 5).map((skill) => <li key={skill}>✓ {skill}</li>)}
            </ul>
          </div>
          <div className="match-detail">
            <strong>Missing</strong>
            <ul>
              <li>• Kubernetes</li>
            </ul>
          </div>
          <div className="mini-info">
            <span>{job.fields} fields</span>
            <span>15–20 min manual</span>
          </div>
          <button className="primary-button" onClick={() => navigate(`/apply/${job.id}`)}>Start Application</button>
        </aside>
      </div>
    </AppShell>
  )
}

function ApplicationPage() {
  const { jobId } = useParams()
  const navigate = useNavigate()
  const [applicationId, setApplicationId] = useState<string | null>(() => {
    const existing = getApplications().find((app) => app.jobId === jobId && app.draft)
    return existing ? existing.id : null
  })

  const [draft, setDraft] = useState<ApplicationFormData>(() => {
    const existing = getApplications().find((app) => app.jobId === jobId && app.draft)
    return existing?.data ?? buildDefaultFormData(jobId)
  })
  const [step, setStep] = useState(0)
  const [saved, setSaved] = useState(false)

  const steps = ['Personal', 'Experience', 'Education', 'Preferences', 'Questions', 'Review']

  const updateField = (key: keyof ApplicationFormData, value: string | string[]) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  const handleSaveDraft = () => {
    if (applicationId) {
      updateApplication(applicationId, draft)
    } else {
      const created = createApplication(jobId || jobs[0].id)
      setApplicationId(created.id)
      updateApplication(created.id, draft)
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  const nextStep = () => {
    if (step < steps.length - 1) {
      setStep(step + 1)
    }
  }

  const prevStep = () => {
    if (step > 0) setStep(step - 1)
  }

  const submitReview = () => {
    if (!applicationId) {
      const created = createApplication(jobId || jobs[0].id)
      setApplicationId(created.id)
      updateApplication(created.id, draft)
      navigate(`/apply/${jobId}/review?applicationId=${created.id}`)
      return
    }
    navigate(`/apply/${jobId}/review?applicationId=${applicationId}`)
  }

  const renderStepContent = () => {
    switch (step) {
      case 0:
        return (
          <div className="form-grid">
            <label>Full Name<input value={draft.fullName} onChange={(e) => updateField('fullName', e.target.value)} /></label>
            <label>Email<input value={draft.email} onChange={(e) => updateField('email', e.target.value)} /></label>
            <label>Phone<input value={draft.phone} onChange={(e) => updateField('phone', e.target.value)} /></label>
            <label>Location<input value={draft.location} onChange={(e) => updateField('location', e.target.value)} /></label>
            <label>LinkedIn<input value={draft.linkedin} onChange={(e) => updateField('linkedin', e.target.value)} /></label>
            <label>Portfolio<input value={draft.portfolio} onChange={(e) => updateField('portfolio', e.target.value)} /></label>
          </div>
        )
      case 1:
        return (
          <div className="form-grid">
            <label>Current Company<input value={draft.currentCompany} onChange={(e) => updateField('currentCompany', e.target.value)} /></label>
            <label>Current Role<input value={draft.currentRole} onChange={(e) => updateField('currentRole', e.target.value)} /></label>
            <label>Years of Experience<input value={draft.yearsOfExperience} onChange={(e) => updateField('yearsOfExperience', e.target.value)} /></label>
            <label>Previous Company<input value={draft.previousCompany} onChange={(e) => updateField('previousCompany', e.target.value)} /></label>
            <label>Previous Role<input value={draft.previousRole} onChange={(e) => updateField('previousRole', e.target.value)} /></label>
          </div>
        )
      case 2:
        return (
          <div className="form-grid">
            <label>Degree<input value={draft.degree} onChange={(e) => updateField('degree', e.target.value)} /></label>
            <label>University<input value={draft.university} onChange={(e) => updateField('university', e.target.value)} /></label>
            <label>Graduation Year<input value={draft.graduationYear} onChange={(e) => updateField('graduationYear', e.target.value)} /></label>
          </div>
        )
      case 3:
        return (
          <div className="form-grid">
            <label>Expected Salary<input value={draft.expectedSalary} onChange={(e) => updateField('expectedSalary', e.target.value)} /></label>
            <label>Notice Period<input value={draft.noticePeriod} onChange={(e) => updateField('noticePeriod', e.target.value)} /></label>
            <label>Preferred Location<input value={draft.preferredLocation} onChange={(e) => updateField('preferredLocation', e.target.value)} /></label>
            <label>Work Mode<input value={draft.workMode} onChange={(e) => updateField('workMode', e.target.value)} /></label>
          </div>
        )
      case 4:
        return (
          <div className="question-list">
            {Object.entries(draft.screeningAnswers).map(([question, answer]) => (
              <div key={question} className="question-card">
                <label>{question}</label>
                <textarea value={answer} onChange={(e) => {
                  setDraft((prev) => ({
                    ...prev,
                    screeningAnswers: {
                      ...prev.screeningAnswers,
                      [question]: e.target.value,
                    },
                  }))
                }} rows={3} />
              </div>
            ))}
          </div>
        )
      case 5:
        return (
          <div className="review-section">
            <h3>Application completion</h3>
            <div className="progress-bar"><span style={{ width: '78%' }} /></div>
            <p>78% complete</p>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <AppShell>
      <div className="page-header compact-header">
        <div>
          <p className="eyebrow">Apply to {jobs.find((j) => j.id === jobId)?.title || 'role'}</p>
          <h1>Step {step + 1} of {steps.length}</h1>
        </div>
        <div className="save-indicator">{saved ? 'Draft saved' : 'Autosave on'}</div>
      </div>

      <div className="stepper">
        {steps.map((label, index) => (
          <div key={label} className={`step ${index === step ? 'active' : ''}`}>
            <span>{index + 1}</span>
            {label}
          </div>
        ))}
      </div>

      <div className="application-shell">
        <div className="application-form panel">
          {renderStepContent()}
        </div>
        <aside className="side-panel agent-panel small-panel">
          <h3>🤖 ApplyFlow</h3>
          <p>Match: {jobs.find((item) => item.id === jobId)?.matchScore || 94}%</p>
          <p>I filled this section using your saved profile and prepared the required answers.</p>
          <div className="agent-quote">
            <p>“I found 3 missing pieces and prepared answers based on your profile.”</p>
          </div>
          <button className="secondary-button full-width" onClick={async () => {
            if (!jobId) return
            const result = await invokeWebMcpTool('draft_application', { jobId })
            console.log('WebMCP draft_application result:', result)
            window.alert(`Agent drafted application for ${result.jobTitle}.`)
          }}>Ask Agent</button>
        </aside>
      </div>

      <div className="footer-actions">
        <button className="secondary-button" onClick={prevStep} disabled={step === 0}>Previous</button>
        <button className="secondary-button" onClick={handleSaveDraft}>Save Draft</button>
        {step < steps.length - 1 ? (
          <button className="primary-button" onClick={nextStep}>Next</button>
        ) : (
          <button className="primary-button" onClick={submitReview}>Review</button>
        )}
      </div>
    </AppShell>
  )
}

function ReviewPage() {
  const { jobId } = useParams()
  const navigate = useNavigate()
  const params = new URLSearchParams(window.location.search)
  const applicationId = params.get('applicationId') ?? getApplications()[0]?.id
  const job = jobId ? getJobDetails(jobId) : undefined
  const app = applicationId ? getApplicationById(applicationId) : undefined

  if (!app || !job) {
    return <AppShell><div className="empty-state">Application not found.</div></AppShell>
  }

  const handleSubmit = () => {
    if (applicationId) submitApplication(applicationId)
    navigate(`/apply/${jobId}/submitted?applicationId=${applicationId}`)
  }

  return (
    <AppShell>
      <div className="panel review-panel">
        <h1>Review your application</h1>
        <p className="subtle">Everything looks ready.</p>
        <div className="checklist">
          <div className="check-row"><span>✓</span><span>Personal information</span><em>Complete</em></div>
          <div className="check-row"><span>✓</span><span>Experience</span><em>Complete</em></div>
          <div className="check-row"><span>✓</span><span>Education</span><em>Complete</em></div>
          <div className="check-row"><span>✓</span><span>Screening questions</span><em>3 prepared</em></div>
        </div>

        <div className="agent-summary">
          <h3>🤖 Agent prepared this application</h3>
          <p>“I found 3 missing pieces and prepared answers based on your profile. Please review them before submission.”</p>
        </div>

        <div className="review-actions">
          <button className="secondary-button" onClick={() => navigate(`/apply/${jobId}`)}>Edit</button>
          <button className="primary-button" onClick={handleSubmit}>Approve & Submit</button>
        </div>
        <div className="approval-note">🔒 Application will NOT be submitted without your approval.</div>
      </div>
    </AppShell>
  )
}

function SubmittedPage() {
  const { jobId } = useParams()
  const params = new URLSearchParams(window.location.search)
  const applicationId = params.get('applicationId') ?? 'AF-2026-00124'
  const job = jobId ? getJobDetails(jobId) : undefined

  return (
    <AppShell>
      <div className="success-panel panel">
        <div className="success-icon">✓</div>
        <h1>Application submitted</h1>
        <h3>{job?.title || 'Senior Oracle DBA'}</h3>
        <p>{job?.company || 'TechNova Technologies'}</p>
        <small>Submitted just now</small>
        <div className="submitted-grid">
          <div><span>Application ID</span><strong>{applicationId}</strong></div>
          <div><span>Status</span><strong>Application Submitted</strong></div>
        </div>
        <div className="review-actions">
          <Link to="/applications" className="secondary-button">View Application</Link>
          <Link to="/jobs" className="primary-button">Browse More Jobs</Link>
        </div>
      </div>
    </AppShell>
  )
}

function ApplicationsPage() {
  const applications = getApplications()
  const [activeTab, setActiveTab] = useState('All')
  const tabStatusMap: Record<string, string> = {
    Drafts: 'Draft',
    Submitted: 'Application Submitted',
    Interview: 'Interview',
    Rejected: 'Rejected',
  }
  const filtered = activeTab === 'All' ? applications : applications.filter((app) => app.status === tabStatusMap[activeTab])

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <p className="eyebrow">Applications</p>
          <h1>Track your progress</h1>
        </div>
      </div>

      <div className="tabs">
        {['All', 'Drafts', 'Submitted', 'Interview', 'Rejected'].map((tab) => (
          <button key={tab} className={`tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>{tab}</button>
        ))}
      </div>

      <div className="application-list">
        {filtered.map((app) => (
          <div key={app.id} className="application-card panel">
            <div>
              <h3>{app.jobTitle}</h3>
              <p>{app.company}</p>
            </div>
            <div className="small-badges">
              <span className="badge accent">{app.matchScore}% match</span>
              <span className="status-tag">{app.status}</span>
            </div>
            <p className="submitted-date">Submitted {new Date(app.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
            <Link to={`/jobs/${app.jobId}`} className="secondary-button">View</Link>
          </div>
        ))}
      </div>
    </AppShell>
  )
}

function ProfilePage() {
  const profile = getCandidateProfile()
  return (
    <AppShell>
      <div className="page-header profile-header">
        <div>
          <p className="eyebrow">Profile Overview</p>
          <h1>{profile.name}</h1>
        </div>
        <div className="profile-progress">{profile.profileCompletion}% Complete</div>
      </div>

      <div className="profile-grid">
        <div className="panel">
          <h3>Personal Information</h3>
          <ul className="info-list">
            <li><strong>Email:</strong> {profile.email}</li>
            <li><strong>Location:</strong> {profile.location}</li>
            <li><strong>Phone:</strong> {profile.phone}</li>
            <li><strong>LinkedIn:</strong> {profile.linkedin}</li>
          </ul>
        </div>
        <div className="panel">
          <h3>Professional Summary</h3>
          <p>{profile.summary}</p>
        </div>
        <div className="panel">
          <h3>Experience</h3>
          <p>{profile.experience} years • {profile.currentRole}</p>
        </div>
        <div className="panel">
          <h3>Skills</h3>
          <div className="tag-list">
            {profile.skills.map((skill) => <span key={skill} className="tag">{skill}</span>)}
          </div>
        </div>
        <div className="panel">
          <h3>Education</h3>
          <p>{profile.education}</p>
        </div>
        <div className="panel">
          <h3>Job Preferences</h3>
          <ul className="info-list">
            <li><strong>Expected Salary:</strong> {profile.expectedSalary}</li>
            <li><strong>Notice Period:</strong> {profile.noticePeriod}</li>
            <li><strong>Work Preference:</strong> {profile.workPreference}</li>
          </ul>
        </div>
      </div>
    </AppShell>
  )
}

function SettingsPage() {
  return (
    <AppShell>
      <div className="page-header">
        <div>
          <p className="eyebrow">Settings</p>
          <h1>Workspace preferences</h1>
        </div>
      </div>

      <div className="panel settings-card">
        <div className="setting-row"><span>Demo Mode</span> <strong>Enabled</strong></div>
        <div className="setting-row"><span>Notifications</span> <strong>On</strong></div>
        <div className="setting-row"><span>Profile visibility</span> <strong>Public to recruiters</strong></div>
      </div>
    </AppShell>
  )
}

function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const navItems = [
    { label: 'Dashboard', path: '/' },
    { label: 'Jobs', path: '/jobs' },
    { label: 'Applications', path: '/applications' },
    { label: 'Profile', path: '/profile' },
  ]
  const currentUser = getCurrentUser()

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand">ApplyFlow</div>
        </div>
        <nav className="nav">
          {navItems.map((item) => (
            <Link key={item.path} to={item.path} className={location.pathname === item.path ? 'nav-item active' : 'nav-item'}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="divider" />
        <Link to="/settings" className={location.pathname === '/settings' ? 'nav-item active' : 'nav-item'}>Settings</Link>
      </aside>

      <main className="content-area">
        <header className="topbar">
          <div className="search-shell">
            <span>⌕</span>
            <input placeholder="Search" />
          </div>
          <div className="topbar-actions">
            <button className="icon-button">🔔</button>
            <div className="user-pill">
              <div className="avatar">{(currentUser?.name ?? currentCandidate.name).slice(0, 2).toUpperCase()}</div>
              <span>{currentUser?.name ?? currentCandidate.name}</span>
            </div>
            <button
              className="secondary-button"
              onClick={() => {
                logoutUser()
                window.location.assign('/auth')
              }}
            >
              Logout
            </button>
            <span className="demo-badge">DEMO MODE</span>
          </div>
        </header>
        <div className="page-body">{children}</div>
      </main>
    </div>
  )
}

function StatCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className={`stat-card stat-${accent}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  )
}

function buildDefaultFormData(jobId?: string): ApplicationFormData {
  const job = jobId ? getJobDetails(jobId) : jobs[0]
  return {
    fullName: currentCandidate.name,
    email: currentCandidate.email,
    phone: currentCandidate.phone,
    location: currentCandidate.location,
    linkedin: currentCandidate.linkedin,
    portfolio: currentCandidate.portfolio,
    currentCompany: 'Apex Systems',
    currentRole: currentCandidate.currentRole,
    yearsOfExperience: String(currentCandidate.experience),
    previousCompany: 'NovaWorks',
    previousRole: 'Oracle DBA',
    skills: currentCandidate.skills.slice(0, 6),
    degree: currentCandidate.education,
    university: 'VIT Pune',
    graduationYear: '2019',
    expectedSalary: currentCandidate.expectedSalary,
    noticePeriod: currentCandidate.noticePeriod,
    preferredLocation: job?.location || 'Pune',
    workMode: job?.workMode || 'Hybrid',
    screeningAnswers: {
      'How many years of Oracle RAC experience do you have?': '4 years',
      'Have you worked with GoldenGate?': 'Yes, for replication and failover',
      'Describe your experience with database disaster recovery.': 'I have managed backup and restore across production systems.',
      'Are you willing to work hybrid from Pune?': 'Yes',
      'What is your notice period?': currentCandidate.noticePeriod,
    },
    resumeName: currentCandidate.resumeName,
    resumeUploaded: true,
  }
}

export default App
