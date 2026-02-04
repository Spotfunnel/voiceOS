'use client';

import React, { useState } from 'react';
import { Trash2, ChevronUp, ChevronDown, Eye } from 'lucide-react';
import type { Objective, PrimitiveType, EscalationStrategy } from '@/types/config';
import { PrimitiveType as PT, EscalationStrategy as ES } from '@/types/config';

interface ObjectiveBuilderProps {
  objectives: Objective[];
  onUpdateObjectives: (objectives: Objective[]) => void;
  onPreview: () => void;
}

export default function ObjectiveBuilder({
  objectives,
  onUpdateObjectives,
  onPreview,
}: ObjectiveBuilderProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const updateObjective = (index: number, updates: Partial<Objective>) => {
    const updated = [...objectives];
    updated[index] = { ...updated[index], ...updates };
    onUpdateObjectives(updated);
  };

  const deleteObjective = (index: number) => {
    const updated = objectives.filter((_, i) => i !== index);
    // Update on_success/on_failure references
    const deletedId = objectives[index].id;
    updated.forEach((obj) => {
      if (obj.on_success === deletedId) {
        obj.on_success = updated[index]?.id || 'end_call';
      }
      if (obj.on_failure === deletedId) {
        obj.on_failure = updated[index]?.id || 'end_call';
      }
    });
    onUpdateObjectives(updated);
  };

  const moveObjective = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === objectives.length - 1)
    ) {
      return;
    }

    const updated = [...objectives];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];

    // Update sequencing references
    updated.forEach((obj, i) => {
      if (i < updated.length - 1) {
        obj.on_success = updated[i + 1].id;
      } else {
        obj.on_success = 'end_call';
      }
    });

    onUpdateObjectives(updated);
  };

  const getNextObjectiveOptions = (currentIndex: number): string[] => {
    const options = ['end_call'];
    objectives.forEach((obj, i) => {
      if (i !== currentIndex) {
        options.push(obj.id);
      }
    });
    return options;
  };

  const primitiveTypeLabels: Record<PrimitiveType, string> = {
    [PT.CAPTURE_EMAIL_AU]: 'Capture Email (AU)',
    [PT.CAPTURE_PHONE_AU]: 'Capture Phone (AU)',
    [PT.CAPTURE_ADDRESS_AU]: 'Capture Address (AU)',
    [PT.CAPTURE_NAME_AU]: 'Capture Name (AU)',
    [PT.CAPTURE_DATE_AU]: 'Capture Date (AU)',
    [PT.CAPTURE_TIME_AU]: 'Capture Time (AU)',
    [PT.CAPTURE_DATETIME_AU]: 'Capture Date/Time (AU)',
    [PT.CAPTURE_SERVICE_TYPE]: 'Capture Service Type',
    [PT.CAPTURE_PREFERRED_DATETIME]: 'Capture Preferred Date/Time',
  };

  const escalationLabels: Record<EscalationStrategy, string> = {
    [ES.TRANSFER]: 'Transfer to Human',
    [ES.SKIP]: 'Skip & Continue',
    [ES.RETRY]: 'Retry Objective',
    [ES.ABORT]: 'Abort Conversation',
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Objective Builder
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Configure your conversation flow. Objectives execute in order.
          </p>
        </div>
        <button
          onClick={onPreview}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Eye className="w-4 h-4" />
          Preview Flow
        </button>
      </div>

      {objectives.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
          <p className="text-gray-500 mb-2">No objectives yet</p>
          <p className="text-sm text-gray-400">
            Add objectives from the Objective Library above
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {objectives.map((objective, index) => (
            <div
              key={objective.id}
              className="border border-gray-200 rounded-lg p-4 hover:border-primary-300 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => moveObjective(index, 'up')}
                      disabled={index === 0}
                      className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                      aria-label="Move up"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => moveObjective(index, 'down')}
                      disabled={index === objectives.length - 1}
                      className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                      aria-label="Move down"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        Step {index + 1}
                      </span>
                      <span className="text-sm font-medium text-gray-900">
                        {primitiveTypeLabels[objective.type] || objective.type}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">ID: {objective.id}</p>
                  </div>
                </div>
                <button
                  onClick={() => deleteObjective(index)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  aria-label="Delete objective"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Purpose
                  </label>
                  <input
                    type="text"
                    value={objective.purpose}
                    onChange={(e) =>
                      updateObjective(index, { purpose: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="e.g., appointment_confirmation"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Why are you capturing this information?
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Retries
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={objective.max_retries || 3}
                    onChange={(e) =>
                      updateObjective(index, {
                        max_retries: parseInt(e.target.value) || 3,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Maximum attempts before escalation
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Required
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={objective.required}
                      onChange={(e) =>
                        updateObjective(index, { required: e.target.checked })
                      }
                      className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">
                      Block progress if this fails
                    </span>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Escalation Strategy
                  </label>
                  <select
                    value={objective.escalation || ES.TRANSFER}
                    onChange={(e) =>
                      updateObjective(index, {
                        escalation: e.target.value as EscalationStrategy,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    {Object.entries(escalationLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    On Success → Next Objective
                  </label>
                  <select
                    value={objective.on_success || 'end_call'}
                    onChange={(e) =>
                      updateObjective(index, { on_success: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    {getNextObjectiveOptions(index).map((opt) => (
                      <option key={opt} value={opt}>
                        {opt === 'end_call'
                          ? 'End Call'
                          : `→ ${opt} (Step ${
                              objectives.findIndex((o) => o.id === opt) + 1
                            })`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    On Failure → Next Objective
                  </label>
                  <select
                    value={objective.on_failure || 'end_call'}
                    onChange={(e) =>
                      updateObjective(index, { on_failure: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    {['end_call', ...getNextObjectiveOptions(index)].map((opt) => (
                      <option key={opt} value={opt}>
                        {opt === 'end_call'
                          ? 'End Call'
                          : `→ ${opt} (Step ${
                              objectives.findIndex((o) => o.id === opt) + 1
                            })`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
