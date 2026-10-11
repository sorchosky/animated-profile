export type ProjectVisual = 'conversation' | 'wayfinding' | 'access' | 'telemetry';

export interface Project {
  slug: string;
  title: string;
  /** Discipline and context, a quiet line above the title. */
  meta: string;
  /** One action- or data-led line on the value delivered. */
  subhead: string;
  visual: ProjectVisual;
}

// DRAFT COPY: meta lines and subheads are placeholders until the real case-study
// numbers land. Every [TK] marks a figure to replace.
export const projects: Project[] = [
  {
    slug: 'ask-target',
    title: 'Ask Target',
    meta: 'Conversational AI · Target',
    subhead: 'Turned guest questions into answers in seconds, deflecting [TK]% of help-center contacts.',
    visual: 'conversation',
  },
  {
    slug: 'store-mode',
    title: 'Store Mode',
    meta: 'Digital-physical product · Target',
    subhead: 'Built the 0-to-1 in-store layer of the Target app, used by [TK]M guests a month.',
    visual: 'wayfinding',
  },
  {
    slug: 'smart-door',
    title: 'Smart Door',
    meta: 'Connected hardware · Product design',
    subhead: 'Designed hardware and app as one system, cutting setup time from [TK] to [TK] minutes.',
    visual: 'access',
  },
  {
    slug: 'oil-production-platform',
    title: 'Oil Production Platform',
    meta: 'Industrial data · Enterprise UX',
    subhead: 'Gave field engineers one live view of [TK] wells, flagging issues [TK]% faster.',
    visual: 'telemetry',
  },
];

export const resumeUrl = '/resume.pdf';
