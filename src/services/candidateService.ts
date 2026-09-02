import { currentCandidate } from '../data/candidates'
import type { Candidate } from '../types'

export function getCandidateProfile(): Candidate {
  return currentCandidate
}

export function updateCandidateProfile(profile: Partial<Candidate>): Candidate {
  Object.assign(currentCandidate, profile)
  return currentCandidate
}
