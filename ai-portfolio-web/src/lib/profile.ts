/**
 * Identity and contact links. Anything left empty is hidden across the site,
 * never rendered as a placeholder link.
 */
type Profile = {
  name: string;
  title: string;
  headline: string;
  github: string;
  linkedin: string;
  resume: string;
  email: string;
};

export const PROFILE: Profile = {
  name: "Seme Semeglo",
  title: "Senior AI Engineer",
  headline: "I build agentic and production AI systems — and the evaluation harnesses that decide whether they can be trusted.",
  github: "https://github.com/SemePro/ai-engineering-portfolio",
  /** Full URL, e.g. https://www.linkedin.com/in/<handle> */
  linkedin: "",
  /** Path under /public (e.g. /resume.pdf) or an absolute URL */
  resume: "",
  /** Public contact address */
  email: "",
};

export const REPO_URL = PROFILE.github;
export const repoPath = (path: string) => `${REPO_URL}/tree/main/${path}`;
export const repoFile = (path: string) => `${REPO_URL}/blob/main/${path}`;
