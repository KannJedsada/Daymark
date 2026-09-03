import type { CreateProjectBody } from '../../shared/schemas/task'
import type { Project } from '../../shared/types/domain'
import type { TaskRepository } from '../repositories/tasks'

export function createProjectService(repository: Pick<TaskRepository, 'listProjects' | 'upsertProject'>) {
  return {
    listProjects(): Promise<Project[]> {
      return repository.listProjects()
    },

    createProject(input: CreateProjectBody): Promise<Project> {
      return repository.upsertProject({
        name: input.name,
        jiraProjectKey: input.jiraProjectKey,
      })
    },
  }
}

export type ProjectService = ReturnType<typeof createProjectService>
