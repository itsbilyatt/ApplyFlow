export type WorkMode = 'Hybrid' | 'Remote' | 'On-site'
export type JobType = 'Full-time' | 'Contract' | 'Part-time'
export type ApplicationStatus =
  | 'Draft'
  | 'Application Submitted'
  | 'Under Review'
  | 'Shortlisted'
  | 'Interview'
  | 'Rejected'

export type Candidate = {
  id: string
  name: string
  email: string
  location: string
  experience: number
  currentRole: string
  skills: string[]
  education: string
  noticePeriod: string
  expectedSalary: string
  workPreference: string
  phone: string
  linkedin: string
  portfolio: string
  profileCompletion: number
  summary: string
  certifications: string[]
  resumeName: string
}

export type Job = {
  id: string
  title: string
  company: string
  location: string
  workMode: WorkMode
  salary: string
  experience: string
  type: JobType
  postedDaysAgo: number
  matchScore: number
  skills: string[]
  description: string
  responsibilities: string[]
  requirements: string[]
  niceToHave: string[]
  fields: number
  jobType: string
}

export type ApplicationFormData = {
  fullName: string
  email: string
  phone: string
  location: string
  linkedin: string
  portfolio: string
  currentCompany: string
  currentRole: string
  yearsOfExperience: string
  previousCompany: string
  previousRole: string
  skills: string[]
  degree: string
  university: string
  graduationYear: string
  expectedSalary: string
  noticePeriod: string
  preferredLocation: string
  workMode: string
  screeningAnswers: Record<string, string>
  resumeName: string
  resumeUploaded: boolean
}

export type Application = {
  id: string
  jobId: string
  jobTitle: string
  company: string
  matchScore: number
  status: ApplicationStatus
  submittedAt: string
  updatedAt: string
  data: ApplicationFormData
  draft?: boolean
}
