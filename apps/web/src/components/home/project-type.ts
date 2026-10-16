import type { ProjectEntry } from '@/lib/api-client';

export interface ProjectTypePresentation {
  label: string;
  description: string;
}

export function projectTypePresentation(
  type: ProjectEntry['projectType'],
): ProjectTypePresentation {
  if (type === 'storybook') {
    return {
      label: 'Storybook',
      description: 'Component project with Storybook',
    };
  }
  if (type === 'html') {
    return {
      label: 'HTML/CSS',
      description: 'Static HTML and CSS project',
    };
  }
  if (type === 'react') {
    return {
      label: 'React',
      description: 'React project without Storybook',
    };
  }
  return {
    label: 'Project',
    description: 'Project type is not indexed yet',
  };
}
