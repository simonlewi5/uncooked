import { supabase } from './supabase'

export async function getJobApplications(userId: string) {
  const { data, error } = await supabase
    .from('job_applications')
    .select('*, company_profiles(company_name)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function createJobApplication(userId: string, data: {
  company_name: string
  job_title: string
  job_description: string
}) {
  const { data: resume, error: resumeError } = await supabase
  .from('resumes')
  .insert({
    user_id: userId,
    title: `${data.company_name} — ${data.job_title}`,
    is_primary: false,
    parse_status: 'edited',
  })
  .select()
  .single()
  if (resumeError) throw resumeError

  const { data: company, error: companyError } = await supabase
    .from('company_profiles')
    .insert({ user_id: userId, company_name: data.company_name })
    .select()
    .single()
  if (companyError) throw companyError

  const { data: app, error } = await supabase
    .from('job_applications')
    .insert({
      user_id: userId,
      resume_id: resume.id,
      company_profile_id: company.id,
      job_title: data.job_title,
      job_description: data.job_description,
    })
    .select()
    .single()
  if (error) throw error

  return { app, resumeId: resume.id }
}

export async function saveJobDescription(jobApplicationId: string, jobDescription: string) {
  const { error } = await supabase
    .from('job_applications')
    .update({ job_description: jobDescription })
    .eq('id', jobApplicationId)
  if (error) throw error
}