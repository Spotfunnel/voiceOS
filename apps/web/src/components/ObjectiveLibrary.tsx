'use client';

import React from 'react';
import { Plus } from 'lucide-react';
import { OBJECTIVE_TEMPLATES } from '@/data/objectiveTemplates';
import type { ObjectiveTemplate, Objective } from '@/types/config';
import { EscalationStrategy } from '@/types/config';

interface ObjectiveLibraryProps {
  onAddObjective: (objective: Objective) => void;
}

export default function ObjectiveLibrary({ onAddObjective }: ObjectiveLibraryProps) {
  const handleAddTemplate = (template: ObjectiveTemplate) => {
    const objective: Objective = {
      id: `${template.type}_${Date.now()}`,
      type: template.type,
      version: 'v1',
      purpose: template.defaultPurpose,
      required: template.defaultRequired,
      max_retries: template.defaultMaxRetries,
      escalation: EscalationStrategy.TRANSFER,
    };

    onAddObjective(objective);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        Objective Library
      </h2>
      <p className="text-sm text-gray-600 mb-6">
        Click on any template below to add it to your workflow. These are pre-configured
        objectives optimized for Australian voice interactions.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {OBJECTIVE_TEMPLATES.map((template) => (
          <div
            key={template.id}
            className="border border-gray-200 rounded-lg p-4 hover:border-primary-500 hover:shadow-md transition-all cursor-pointer group"
            onClick={() => handleAddTemplate(template)}
          >
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-medium text-gray-900 group-hover:text-primary-600">
                {template.name}
              </h3>
              <button
                className="ml-2 p-1 rounded-full bg-primary-50 text-primary-600 opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label={`Add ${template.name}`}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-2">{template.description}</p>
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                <span className="font-medium">Example:</span> {template.example}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
