'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Copy, CheckCircle, AlertCircle, FileCode, RefreshCw } from 'lucide-react';
import type { TenantConfig } from '@/types/config';
import { generateYAML, validateConfig } from '@/utils/configGenerator';

interface ConfigPreviewProps {
  config: TenantConfig;
}

export default function ConfigPreview({ config }: ConfigPreviewProps) {
  const [yamlContent, setYamlContent] = useState('');
  const [validationResult, setValidationResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const updatePreview = useCallback(() => {
    const yaml = generateYAML(config);
    setYamlContent(yaml);
    const validation = validateConfig(config);
    setValidationResult(validation);
  }, [config]);

  useEffect(() => {
    if (autoRefresh) {
      updatePreview();
    }
  }, [autoRefresh, updatePreview]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(yamlContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const hasErrors = validationResult && !validationResult.valid;
  const hasWarnings = validationResult?.warnings?.length > 0;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Configuration Preview</h2>
          <p className="text-sm text-gray-600 mt-1">
            Real-time YAML generation and validation. No manual editing required.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
            />
            Auto-refresh
          </label>
          <button
            onClick={updatePreview}
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Validation Status */}
      {validationResult && (
        <div className={`mb-6 p-4 rounded-lg border ${
          hasErrors
            ? 'bg-red-50 border-red-200'
            : hasWarnings
            ? 'bg-yellow-50 border-yellow-200'
            : 'bg-green-50 border-green-200'
        }`}>
          <div className="flex items-start gap-2">
            {hasErrors ? (
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            ) : (
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
            )}
            <div className="flex-1">
              <p className={`font-medium ${
                hasErrors ? 'text-red-900' : 'text-green-900'
              }`}>
                {hasErrors
                  ? 'Configuration has errors'
                  : hasWarnings
                  ? 'Configuration is valid with warnings'
                  : 'Configuration is valid ✓'}
              </p>
              
              {validationResult.errors?.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {validationResult.errors.map((error: any, index: number) => (
                    <li key={index} className="text-sm text-red-800">
                      <span className="font-medium">{error.field}:</span> {error.message}
                    </li>
                  ))}
                </ul>
              )}

              {validationResult.warnings?.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {validationResult.warnings.map((warning: any, index: number) => (
                    <li key={index} className="text-sm text-yellow-800">
                      <span className="font-medium">{warning.field}:</span> {warning.message}
                    </li>
                  ))}
                </ul>
              )}

              {!hasErrors && !hasWarnings && (
                <p className="text-sm text-green-800 mt-2">
                  ✓ All objectives configured correctly<br />
                  ✓ DAG validation passed (no cycles detected)<br />
                  ✓ All required fields present
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* YAML Preview */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCode className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-medium text-gray-900">Generated YAML</h3>
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm"
          >
            {copied ? (
              <>
                <CheckCircle className="w-4 h-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy YAML
              </>
            )}
          </button>
        </div>

        <div className="relative">
          <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm font-mono max-h-96 overflow-y-auto">
            <code>{yamlContent || '// No configuration yet. Add objectives from the Library tab.'}</code>
          </pre>
        </div>

        <p className="text-xs text-gray-500">
          This YAML is automatically generated from your configuration. You can copy it or download it from the Deploy tab.
        </p>
      </div>

      {/* DAG Visualization */}
      {config.objectives.length > 0 && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">Flow Graph</h3>
          <div className="text-xs text-blue-800 space-y-1">
            {config.objectives.map((obj, index) => (
              <div key={obj.id} className="flex items-center gap-2">
                <span className="font-mono bg-white px-2 py-0.5 rounded">{obj.id}</span>
                {obj.on_success && obj.on_success !== 'end_call' && (
                  <>
                    <span className="text-green-600">→</span>
                    <span className="font-mono bg-white px-2 py-0.5 rounded text-green-700">
                      {obj.on_success} (success)
                    </span>
                  </>
                )}
                {obj.on_failure && obj.on_failure !== 'end_call' && (
                  <>
                    <span className="text-red-600 ml-2">→</span>
                    <span className="font-mono bg-white px-2 py-0.5 rounded text-red-700">
                      {obj.on_failure} (failure)
                    </span>
                  </>
                )}
                {(!obj.on_success || obj.on_success === 'end_call') && 
                 (!obj.on_failure || obj.on_failure === 'end_call') && (
                  <span className="text-gray-500 ml-2">→ end_call</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
