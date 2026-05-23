import "./styles/Work.css";
import { SiAppstore, SiGithub } from "react-icons/si";
import { HiArrowUpRight } from "react-icons/hi2";
import {
  featuredProjects,
  openSourceProjects,
  GITHUB_PROFILE_URL,
  type Project,
} from "../data/projects";

const getPlaceholderInitials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const ProjectCard = ({
  project,
  variant,
}: {
  project: Project;
  variant: "featured" | "open-source";
}) => {
  const linkUrl = project.storeUrl ?? project.repoUrl;
  const isFeatured = variant === "featured";

  const content = (
    <>
      {isFeatured && <span className="project-featured-badge">Featured</span>}
      <div className="project-card-glow" aria-hidden="true" />
      <div className="project-card-header">
        <span className="project-card-num">{project.num}</span>
        <div className="project-card-titles">
          <h3>{project.name}</h3>
          <p className="project-card-category">{project.category}</p>
        </div>
      </div>

      <div
        className={`project-card-visual${
          project.image ? "" : " project-card-visual--placeholder"
        }`}
      >
        {project.image ? (
          <img src={project.image} alt={project.alt ?? project.name} loading="lazy" />
        ) : (
          <div className="project-card-placeholder" aria-hidden="true">
            <span className="project-card-placeholder-icon">
              {getPlaceholderInitials(project.name)}
            </span>
          </div>
        )}
      </div>

      <p className="project-card-description">{project.description}</p>

      <div className="project-card-contributions">
        <h4>Key Contributions</h4>
        <ul>
          {project.contributions.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </div>

      {project.storeUrl && (
        <span className="project-card-cta project-store-cta">
          <SiAppstore className="project-cta-icon" aria-hidden="true" />
          <span>View on App Store</span>
          <HiArrowUpRight className="project-cta-arrow" aria-hidden="true" />
        </span>
      )}

      {project.repoUrl && (
        <span className="project-card-cta project-repo-cta">
          <SiGithub className="project-cta-icon" aria-hidden="true" />
          <span>View Repository</span>
          <HiArrowUpRight className="project-cta-arrow" aria-hidden="true" />
        </span>
      )}
    </>
  );

  const className = [
    "project-card",
    isFeatured ? "project-card--featured" : "project-card--open-source",
    linkUrl ? "project-card--linked" : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (linkUrl) {
    const label = project.storeUrl
      ? `${project.name} on the App Store`
      : `${project.name} on GitHub`;
    return (
      <a
        className={className}
        href={linkUrl}
        target="_blank"
        rel="noopener noreferrer"
        data-cursor="disable"
        aria-label={label}
      >
        {content}
      </a>
    );
  }

  return <article className={className}>{content}</article>;
};

const Work = () => {
  return (
    <section className="work-section section-container" id="work">
      <div className="work-header">
        <h2>
          Featured <span>Projects</span>
        </h2>
        <p className="work-subtitle">
          Production mobile apps shipped to the App Store
        </p>
      </div>

      <div className="projects-grid projects-grid--featured">
        {featuredProjects.map((project) => (
          <ProjectCard key={project.id} project={project} variant="featured" />
        ))}
      </div>

      <div className="work-divider" aria-hidden="true" />

      <div className="work-subsection">
        <h3 className="work-subsection-title">Open Source Projects</h3>
        <p className="work-subsection-subtitle">
          Tap any card to explore the source code on GitHub
        </p>
        <div className="projects-grid projects-grid--open-source">
          {openSourceProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              variant="open-source"
            />
          ))}
        </div>
        <a
          className="work-github-more"
          href={GITHUB_PROFILE_URL}
          target="_blank"
          rel="noopener noreferrer"
          data-cursor="disable"
        >
          <SiGithub aria-hidden="true" />
          <span>View more on GitHub</span>
          <HiArrowUpRight aria-hidden="true" />
        </a>
      </div>
    </section>
  );
};

export default Work;
