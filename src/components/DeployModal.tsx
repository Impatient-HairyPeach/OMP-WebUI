import React, { useState } from 'react';
import { X, Rocket, Check, AlertCircle, ArrowRight } from 'lucide-react';
import { ProjectScope } from '../types';

interface DeployModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  onConfirmDeploy: (target: string) => void;
}

export const DeployModal: React.FC<DeployModalProps> = ({
  isOpen,
  onClose,
  projectName,
  onConfirmDeploy,
}) => {
  const [cluster, setCluster] = useState<'staging' | 'prod'>('staging');
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployed, setDeployed] = useState(false);

  if (!isOpen) return null;

  const handleDeploy = () => {
    setIsDeploying(true);
    setTimeout(() => {
      setIsDeploying(false);
      setDeployed(true);
      onConfirmDeploy(cluster);
      setTimeout(() => {
        setDeployed(false);
        onClose();
      }, 900);
    }, 1100);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm select-none">
      <div className="w-full max-w-lg bg-[#0c0c0e] border border-[#27272a] rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#27272a] bg-[#121215]">
          <div className="flex items-center gap-2">
            <Rocket className="w-4 h-4 text-[#a78bfa]" />
            <h3 className="text-xs font-semibold text-[#fafafa] tracking-tight">
              Deploy Orchestration Graph &amp; Tools
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#71717a] hover:text-[#fafafa] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 text-xs">
          <div>
            <div className="text-[11px] font-mono text-[#a1a1aa] mb-1">
              Active Project Scope
            </div>
            <div className="px-3 py-2 rounded bg-[#121215] border border-[#27272a] font-mono text-[#fafafa] flex items-center justify-between">
              <span>{projectName}</span>
              <span className="text-[10px] text-[#34d399]">3 Override Rules Validated</span>
            </div>
          </div>

          <div>
            <div className="text-[11px] font-mono text-[#a1a1aa] mb-1.5">
              Target Execution Cluster
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCluster('staging')}
                className={`p-2.5 rounded border text-left cursor-pointer transition-colors ${
                  cluster === 'staging'
                    ? 'border-[#a78bfa] bg-[#18181b]'
                    : 'border-[#27272a] bg-[#121215] text-[#71717a]'
                }`}
              >
                <div className="font-mono font-medium text-xs text-[#fafafa]">
                  Staging Cluster
                </div>
                <div className="text-[10px] text-[#71717a] mt-0.5">
                  k8s-us-west-staging · canary 10%
                </div>
              </button>

              <button
                type="button"
                onClick={() => setCluster('prod')}
                className={`p-2.5 rounded border text-left cursor-pointer transition-colors ${
                  cluster === 'prod'
                    ? 'border-[#a78bfa] bg-[#18181b]'
                    : 'border-[#27272a] bg-[#121215] text-[#71717a]'
                }`}
              >
                <div className="font-mono font-medium text-xs text-[#fafafa]">
                  Production Multi-Region
                </div>
                <div className="text-[10px] text-[#71717a] mt-0.5">
                  HA Cluster · Strictly Sandboxed
                </div>
              </button>
            </div>
          </div>

          {/* Verification checks */}
          <div className="p-3 rounded bg-[#121215] border border-[#27272a] space-y-1.5 text-[11px] font-mono">
            <div className="text-[#a1a1aa] mb-1 font-sans font-medium text-xs">
              Preflight Manifest Verification:
            </div>
            <div className="flex items-center gap-2 text-[#34d399]">
              <Check className="w-3.5 h-3.5" />
              <span>MCP stdio socket permission boundaries OK</span>
            </div>
            <div className="flex items-center gap-2 text-[#34d399]">
              <Check className="w-3.5 h-3.5" />
              <span>SSE Cloud gateway certificates valid (expires in 88 days)</span>
            </div>
            <div className="flex items-center gap-2 text-[#34d399]">
              <Check className="w-3.5 h-3.5" />
              <span>Prompt procedure signatures verified with SHA-256</span>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-[#27272a]">
            {deployed ? (
              <span className="flex items-center gap-1.5 text-xs font-mono text-[#34d399]">
                <Check className="w-4 h-4" />
                Deployed to {cluster}!
              </span>
            ) : <span />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded border border-[#27272a] text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#18181b] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeploy}
                disabled={isDeploying || deployed}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-[#a78bfa] hover:bg-[#bca6fc] text-[#09090b] font-medium transition-colors cursor-pointer disabled:opacity-50"
              >
                <Rocket className="w-3.5 h-3.5" />
                <span>{isDeploying ? 'Deploying Graph...' : 'Confirm Rollout'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
