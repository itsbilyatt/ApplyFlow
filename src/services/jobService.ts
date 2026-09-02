import { jobs } from '../data/jobs'
import { currentCandidate } from '../data/candidates'
import type { Job } from '../types'

export type JobFilters = {
  query?: string
  location?: string
  experience?: string
  workMode?: string
  salary?: string
  jobType?: string
}

export function searchJobs(filters: JobFilters = {}): Job[] {
  const query = (filters.query ?? '').trim().toLowerCase()

  return jobs.filter((job) => {
    const matchesQuery =
      !query ||
      job.title.toLowerCase().includes(query) ||
      job.company.toLowerCase().includes(query) ||
      job.skills.some((skill) => skill.toLowerCase().includes(query)) ||
      job.location.toLowerCase().includes(query)

    const matchesLocation = !filters.location || filters.location === 'All' || job.location === filters.location
    const matchesExperience = !filters.experience || filters.experience === 'Any' || job.experience.includes(filters.experience.replace('+', '')) || job.experience === filters.experience
    const matchesWorkMode = !filters.workMode || filters.workMode === 'All' || job.workMode === filters.workMode
    const matchesSalary = !filters.salary || filters.salary === 'Any' || salaryMatches(job.salary, filters.salary)
    const matchesJobType = !filters.jobType || filters.jobType === 'All' || job.jobType === filters.jobType

    return matchesQuery && matchesLocation && matchesExperience && matchesWorkMode && matchesSalary && matchesJobType
  })
}

export function getJobDetails(jobId: string): Job | undefined {
  return jobs.find((job) => job.id === jobId)
}

export function getRecommendedJobs(): Job[] {
  return [...jobs]
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 4)
}

export function getCandidateMatch(job: Job): number {
  const candidateSkills = currentCandidate.skills.map((skill) => skill.toLowerCase())
  const matched = job.skills.filter((skill) => candidateSkills.includes(skill.toLowerCase()))
  const score = Math.min(98, Math.max(60, Math.round((matched.length / Math.max(job.skills.length, 1)) * 100)))
  return score
}

function salaryMatches(jobSalary: string, filter: string): boolean {
  const values = jobSalary.replace(/[₹L,\s]/g, '').split('–')
  const min = parseFloat(values[0]) || 0
  const max = parseFloat(values[1]) || min

  if (filter === '₹15L+') return min >= 15
  if (filter === '₹20L+') return min >= 20
  if (filter === '₹25L+') return min >= 25
  if (filter === '₹30L+') return min >= 30
  return true
}
