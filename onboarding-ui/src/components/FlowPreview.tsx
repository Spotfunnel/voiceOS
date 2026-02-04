'use client';

import React from 'react';
import { ArrowRight, CheckCircle, XCircle } from 'lucide-react';
import type { Objective, TenantConfig } from '@/types/config';

interface FlowPreviewProps {
  config: TenantConfig;
  onClose: () => void;
}

export default function FlowPreview({ config, onClose }: FlowPreviewProps) {
  const getObjectiveById = (id: string): Objective | undefined => {
    return config.objectives.find((obj) => obj.id === id);
  };

  const buildFlowGraph = () => {
    const nodes: Array<{
      objective: Objective;
      index: number;
      nextOnSuccess?: Objective;
      nextOnFailure?: Objective;
    }> = [];

    config.objectives.forEach((objective, index) => {
      nodes.push({
        objective,
        index,
        nextOnSuccess:
          objective.on_success && objective.on_success !== 'end_call'
            ? getObjectiveById(objective.on_success)
            : undefined,
        nextOnFailure:
          objective.on_failure && objective.on_failure !== 'end_call'
            ? getObjectiveById(objective.on_failure)
            : undefined,
      });
    });

    return nodes;
  };

  const nodes = buildFlowGraph();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-gray-900">
            Conversation Flow Preview
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="p-6">
          <div className="space-y-6">
            {nodes.map((node, index) => (
              <div key={node.objective.id}>
                <div className="flex items-start gap-4">
                  {/* Step Number */}
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary-600 text-white flex items-center justify-center font-semibold">
                    {index + 1}
                  </div>

                  {/* Objective Card */}
                  <div className="flex-1 bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {node.objective.id}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {node.objective.type}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {node.objective.required ? (
                          <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded">
                            Required
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                            Optional
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 space-y-2 text-sm">
                      <div>
                        <span className="text-gray-600">Purpose:</span>{' '}
                        <span className="font-medium text-gray-900">
                          {node.objective.purpose}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Max Retries:</span>{' '}
                        <span className="font-medium text-gray-900">
                          {node.objective.max_retries || 3}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Escalation:</span>{' '}
                        <span className="font-medium text-gray-900">
                          {node.objective.escalation || 'transfer'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Arrows */}
                {index < nodes.length - 1 && (
                  <div className="flex items-center gap-4 ml-5 mt-2 mb-2">
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-xs font-medium">On Success</span>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-400" />
                    {node.nextOnSuccess && (
                      <span className="text-xs text-gray-600">
                        → {node.nextOnSuccess.id}
                      </span>
                    )}
                    {!node.nextOnSuccess && (
                      <span className="text-xs text-gray-600">→ End Call</span>
                    )}
                  </div>
                )}

                {node.nextOnFailure && (
                  <div className="flex items-center gap-4 ml-5 mt-2 mb-4">
                    <div className="flex items-center gap-2 text-red-600">
                      <XCircle className="w-4 h-4" />
                      <span className="text-xs font-medium">On Failure</span>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-400" />
                    <span className="text-xs text-gray-600">
                      → {node.nextOnFailure.id}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2">Flow Summary</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Total Objectives: {config.objectives.length}</li>
              <li>
                • Required Objectives:{' '}
                {config.objectives.filter((obj) => obj.required).length}
              </li>
              <li>• Locale: {config.locale}</li>
              <li>• Tenant: {config.tenant_name}</li>
            </ul>
          </div>
        </div>

        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
