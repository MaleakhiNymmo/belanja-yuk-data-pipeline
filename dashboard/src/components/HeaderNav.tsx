import { Activity, CheckCircle2, Github } from "lucide-react";
import { PipelineMetadata } from "../types";

interface HeaderNavProps {
  metadata: PipelineMetadata;
  onOpenPipelineModal: () => void;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  metadata,
  onOpenPipelineModal,
}) => {
  return (
    <header className="top-navbar">
      <div className="container nav-inner">
        <div className="nav-brand">
          <span className="brand-badge">ELT / DWH</span>
          <div>
            <span className="brand-title">Belanja Yuk Analytics</span>
            <span className="label-mono" style={{ marginLeft: "10px", opacity: 0.75 }}>
              v3.3 Marts
            </span>
          </div>
        </div>

        <div className="nav-actions">
          <div className="status-pill success" style={{ display: "none" }}>
            <span className="status-dot" />
            <span>dbt tests: {metadata.dbt_tests_passed}/{metadata.dbt_tests_total} Passed</span>
          </div>

          <button
            onClick={onOpenPipelineModal}
            className="btn btn-sm"
            title="Lihat status orkestrasi Airflow & dbt"
          >
            <Activity size={14} color="var(--color-accent)" />
            <span>Pipeline Health</span>
            <CheckCircle2 size={13} color="var(--color-success)" />
          </button>

          <a
            href="https://github.com/MaleakhiNymmo/belanja-yuk-data-pipeline"
            target="_blank"
            rel="noreferrer"
            className="btn btn-sm"
          >
            <Github size={14} />
            <span>GitHub</span>
          </a>
        </div>
      </div>
    </header>
  );
};
