import { FolderKanban } from "lucide-react";

import { ProjectPortfolioView } from "./project-portfolio-view";
import { listProjects } from "@/lib/appsync/crm";

export default async function ProjectsPage() {
  const projects = await listProjects();
  return (
    <div className="space-y-6">
      <div>
        <p className="flex items-center gap-2 text-sm font-medium text-cyan-700">
          <FolderKanban className="size-4" />
          Operaciones · Portafolio
        </p>
        <h1 className="brand-heading mt-2 text-3xl text-slate-950">Proyectos</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Planifica entregas, coordina al equipo y controla cada presupuesto.
        </p>
      </div>

      <ProjectPortfolioView initialProjects={projects} />
    </div>
  );
}
