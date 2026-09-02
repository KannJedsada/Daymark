import type { Project } from '../../shared/types/domain'

export function useProjects() {
  const request = useFetch<Project[]>('/api/projects', {
    key: 'projects',
    lazy: true,
    default: () => [],
  })

  const pending = computed(() => request.status.value === 'pending')

  return {
    data: request.data,
    error: request.error,
    pending,
    refresh: request.refresh,
  }
}

export function projectLabel(project: Project) {
  return project.jiraProjectKey ? `${project.jiraProjectKey} · ${project.name}` : project.name
}
