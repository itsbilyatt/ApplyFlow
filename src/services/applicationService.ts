import { initialApplications } from '../data/applications'
import { jobs } from '../data/jobs'
import { currentCandidate } from '../data/candidates'
import type { Application, ApplicationFormData, Job } from '../types'

const STORAGE_KEY = 'applyflow-applications'

let applications: Application[] = loadApplications()

export function loadApplications(): Application[] {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return [...initialApplications]

  try {
    const parsed = JSON.parse(raw) as Application[]
    return parsed.length ? parsed : [...initialApplications]
  } catch {
    return [...initialApplications]
  }
}

export function getApplications(): Application[] {
  applications = loadApplications()
  return [...applications].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

export function getApplicationById(applicationId: string): Application | undefined {
  return getApplications().find((app) => app.id === applicationId)
}

export function createApplication(jobId: string): Application {
  const job = jobs.find((item) => item.id === jobId) ?? jobs[0]
  const app: Application = {
    id: `app-${Date.now()}`,
    jobId,
    jobTitle: job.title,
    company: job.company,
    matchScore: job.matchScore,
    status: 'Draft',
    submittedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    draft: true,
    data: buildApplicationData(job),
  }

  const all = getApplications()
  all.unshift(app)
  persist(all)
  return app
}

export function updateApplication(applicationId: string, data: Partial<ApplicationFormData>): Application | undefined {
  const all = getApplications()
  const target = all.find((app) => app.id === applicationId)
  if (!target) return undefined

  target.data = { ...target.data, ...data }
  target.updatedAt = new Date().toISOString()
  target.draft = true
  persist(all)
  return target
}

export function validateApplication(applicationId: string): { valid: boolean; issues: string[]; completion: number } {
  const app = getApplicationById(applicationId)
  if (!app) return { valid: false, issues: ['Application not found'], completion: 0 }

  const fields = [
    app.data.fullName,
    app.data.email,
    app.data.phone,
    app.data.location,
    app.data.currentCompany,
    app.data.currentRole,
    app.data.yearsOfExperience,
    app.data.degree,
    app.data.university,
    app.data.expectedSalary,
    app.data.noticePeriod,
    app.data.preferredLocation,
    app.data.workMode,
    app.data.resumeUploaded,
  ]

  const issues: string[] = []
  if (!app.data.fullName) issues.push('Full name is required')
  if (!app.data.email) issues.push('Email is required')
  if (!app.data.phone) issues.push('Phone is required')
  if (!app.data.resumeUploaded) issues.push('Resume is required')
  if (Object.values(app.data.screeningAnswers).some((value) => !value || !value.trim())) {
    issues.push('Screening questions must be answered')
  }

  const completed = fields.filter(Boolean).length
  const completion = Math.min(100, Math.round((completed / 14) * 100))
  return { valid: issues.length === 0, issues, completion }
}

export function getApplicationPreview(applicationId: string): Application | undefined {
  return getApplicationById(applicationId)
}

export function submitApplication(applicationId: string): Application | undefined {
  const all = getApplications()
  const target = all.find((app) => app.id === applicationId)
  if (!target) return undefined

  target.status = 'Application Submitted'
  target.draft = false
  target.submittedAt = new Date().toISOString()
  target.updatedAt = new Date().toISOString()
  persist(all)
  return target
}

export function getApplicationSchema(jobId: string): Record<string, string[]> {
  const job = jobs.find((item) => item.id === jobId) ?? jobs[0]

  return {
    personal: ['Full Name', 'Email', 'Phone', 'Location', 'LinkedIn', 'Portfolio'],
    experience: ['Current Company', 'Current Role', 'Years of Experience', 'Previous Company', 'Previous Role'],
    skills: ['Skills'],
    education: ['Degree', 'University', 'Graduation Year'],
    preferences: ['Expected Salary', 'Notice Period', 'Preferred Location', 'Work Mode'],
    resume: ['Resume'],
    questions: job.requirements.slice(0, 4).map((req, i) => `Question ${i + 1}: ${req}`),
  }
}

function buildApplicationData(job: Job): ApplicationFormData {
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
    previousRole: 'Database Analyst',
    skills: currentCandidate.skills.slice(0, 6),
    degree: currentCandidate.education,
    university: 'VIT Pune',
    graduationYear: '2019',
    expectedSalary: currentCandidate.expectedSalary,
    noticePeriod: currentCandidate.noticePeriod,
    preferredLocation: job.location,
    workMode: job.workMode,
    screeningAnswers: {
      'How many years of Oracle RAC experience do you have?': '4 years',
      'Have you worked with GoldenGate?': 'Yes, I have configured and managed replication pipelines.',
      'Describe your experience with database disaster recovery.': 'I have managed backup, restore, and failover drills across enterprise production systems.',
      'Are you willing to work hybrid from Pune?': 'Yes',
      'What is your notice period?': currentCandidate.noticePeriod,
    },
    resumeName: currentCandidate.resumeName,
    resumeUploaded: true,
  }
}

function persist(list: Application[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
  applications = list
}
