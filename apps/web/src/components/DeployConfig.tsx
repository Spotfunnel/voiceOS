'use client';

import React, { useState } from 'react';
import { Upload, Phone, Play, Rocket, CheckCircle, AlertCircle, Download, Loader } from 'lucide-react';
import type { TenantConfig } from '@/types/config';
import { validateConfig, generateYAML, downloadConfig } from '@/utils/configGenerator';

interface DeployConfigProps {
  config: TenantConfig;
  onConfigUpdate: (config: TenantConfig) => void;
}

export default function DeployConfig({ config, onConfigUpdate }: DeployConfigProps) {
  const [validationResult, setValidationResult] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentStatus, setDeploymentStatus] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [deploymentStep, setDeploymentStep] = useState<'validate' | 'upload' | 'phone' | 'test' | 'deploy' | 'complete'>('validate');

  const handleValidate = () => {
    const result = validateConfig(config);
    setValidationResult(result);
    if (result.valid) {
      setDeploymentStep('upload');
    }
    return result.valid;
  };

  const handleDownloadConfig = () => {
    if (!handleValidate()) {
      alert('Please fix validation errors before downloading');
      return;
    }
    downloadConfig(config);
  };

  const handleUploadConfig = async () => {
    if (!handleValidate()) {
      return;
    }

    setIsUploading(true);
    setDeploymentStep('upload');
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
      const response = await fetch(`${apiUrl}/config/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ config }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Validation failed');
      }

      setDeploymentStatus('Config validated successfully! Ready to deploy.');
      setDeploymentStep('phone');
    } catch (error: any) {
      setDeploymentStatus(`Error: ${error.message}`);
      setDeploymentStep('validate');
    } finally {
      setIsUploading(false);
    }
  };

  const handleAssignPhone = async () => {
    setIsUploading(true);
    setDeploymentStep('phone');
    try {
      // In production, this would call Twilio API
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const mockPhoneNumber = `+61 4${Math.floor(Math.random() * 10)}${Math.floor(Math.random() * 10)} ${Math.floor(Math.random() * 1000)} ${Math.floor(Math.random() * 1000)}`;
      setPhoneNumber(mockPhoneNumber);
      setDeploymentStatus(`Phone number assigned: ${mockPhoneNumber}`);
      setDeploymentStep('test');
    } catch (error: any) {
      setDeploymentStatus(`Error assigning phone: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleTestCall = () => {
    if (!phoneNumber) {
      alert('Please assign a phone number first');
      return;
    }
    setDeploymentStatus('Test call initiated. Check your phone!');
    setDeploymentStep('deploy');
    // In production, this would trigger a test call
  };

  const handleGoLive = async () => {
    if (!handleValidate()) {
      return;
    }

    if (!phoneNumber) {
      alert('Please assign a phone number first');
      return;
    }

    setIsDeploying(true);
    setDeploymentStep('deploy');
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
      const yamlContent = generateYAML(config);

      // In production, this would upload to orchestration service
      const response = await fetch(`${apiUrl}/config/load`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenant_id: config.tenant_id,
          yaml_content: yamlContent,
          phone_number: phoneNumber,
        }),
      });

      if (!response.ok) {
        throw new Error('Deployment failed');
      }

      setDeploymentStatus('✅ Successfully deployed! Your voice AI is now live.');
      setDeploymentStep('complete');
    } catch (error: any) {
      setDeploymentStatus(`Deployment error: ${error.message}`);
    } finally {
      setIsDeploying(false);
    }
  };

  const isStepComplete = (step: string) => {
    const stepOrder = ['validate', 'upload', 'phone', 'test', 'deploy', 'complete'];
    return stepOrder.indexOf(deploymentStep) > stepOrder.indexOf(step);
  };

  const isStepActive = (step: string) => deploymentStep === step;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Deploy Configuration</h2>
        <p className="text-sm text-gray-600">
          Validate your configuration and deploy your voice AI workflow to production
        </p>
      </div>

      {/* Validation Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Step 1: Configuration Validation</h3>
          <button
            onClick={handleValidate}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
          >
            Validate Config
          </button>
        </div>

        {validationResult && (
          <div
            className={`p-4 rounded-lg border ${
              validationResult.valid
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
            }`}
          >
            <div className="flex items-start gap-2">
              {validationResult.valid ? (
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              )}
              <div className="flex-1">
                <p
                  className={`font-medium ${
                    validationResult.valid ? 'text-green-900' : 'text-red-900'
                  }`}
                >
                  {validationResult.valid
                    ? 'Configuration is valid!'
                    : 'Configuration has errors'}
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
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Download Config */}
      <div className="mb-6">
        <button
          onClick={handleDownloadConfig}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <Download className="w-4 h-4" />
          Download YAML Config
        </button>
      </div>

      {/* Deployment Steps */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Deployment Steps</h3>

        {/* Step 1: Upload Config */}
        <div className={`flex items-center justify-between p-4 rounded-lg border-2 transition-colors ${
          isStepComplete('upload')
            ? 'bg-green-50 border-green-200'
            : isStepActive('upload')
            ? 'bg-blue-50 border-blue-300'
            : 'bg-gray-50 border-gray-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
              isStepComplete('upload')
                ? 'bg-green-600 text-white'
                : isStepActive('upload')
                ? 'bg-blue-600 text-white'
                : 'bg-gray-300 text-gray-600'
            }`}>
              {isStepComplete('upload') ? <CheckCircle className="w-5 h-5" /> : '1'}
            </div>
            <div>
              <p className="font-medium text-gray-900">Upload Configuration</p>
              <p className="text-sm text-gray-600">
                Upload your config to the orchestration service
              </p>
            </div>
          </div>
          <button
            onClick={handleUploadConfig}
            disabled={isUploading || !validationResult?.valid}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {isUploading ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Upload Config
              </>
            )}
          </button>
        </div>

        {/* Step 2: Assign Phone Number */}
        <div className={`flex items-center justify-between p-4 rounded-lg border-2 transition-colors ${
          isStepComplete('phone')
            ? 'bg-green-50 border-green-200'
            : isStepActive('phone')
            ? 'bg-blue-50 border-blue-300'
            : 'bg-gray-50 border-gray-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
              isStepComplete('phone')
                ? 'bg-green-600 text-white'
                : isStepActive('phone')
                ? 'bg-blue-600 text-white'
                : 'bg-gray-300 text-gray-600'
            }`}>
              {isStepComplete('phone') ? <CheckCircle className="w-5 h-5" /> : '2'}
            </div>
            <div>
              <p className="font-medium text-gray-900">Assign Phone Number</p>
              <p className="text-sm text-gray-600">
                {phoneNumber
                  ? `Assigned: ${phoneNumber}`
                  : 'Get a Twilio phone number for your voice AI'}
              </p>
            </div>
          </div>
          <button
            onClick={handleAssignPhone}
            disabled={isUploading || !!phoneNumber || !isStepComplete('upload')}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {isUploading ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Assigning...
              </>
            ) : phoneNumber ? (
              <>
                <CheckCircle className="w-4 h-4" />
                Assigned
              </>
            ) : (
              <>
                <Phone className="w-4 h-4" />
                Assign Phone
              </>
            )}
          </button>
        </div>

        {/* Step 3: Test Call */}
        <div className={`flex items-center justify-between p-4 rounded-lg border-2 transition-colors ${
          isStepComplete('test')
            ? 'bg-green-50 border-green-200'
            : isStepActive('test')
            ? 'bg-blue-50 border-blue-300'
            : 'bg-gray-50 border-gray-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
              isStepComplete('test')
                ? 'bg-green-600 text-white'
                : isStepActive('test')
                ? 'bg-blue-600 text-white'
                : 'bg-gray-300 text-gray-600'
            }`}>
              {isStepComplete('test') ? <CheckCircle className="w-5 h-5" /> : '3'}
            </div>
            <div>
              <p className="font-medium text-gray-900">Test Call</p>
              <p className="text-sm text-gray-600">
                Make a test call to verify everything works
              </p>
            </div>
          </div>
          <button
            onClick={handleTestCall}
            disabled={!phoneNumber || !isStepComplete('phone')}
            className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            <Play className="w-4 h-4" />
            Test Call
          </button>
        </div>

        {/* Step 4: Go Live */}
        <div className={`flex items-center justify-between p-4 rounded-lg border-2 transition-colors ${
          isStepComplete('complete')
            ? 'bg-green-50 border-green-200'
            : isStepActive('deploy')
            ? 'bg-blue-50 border-blue-300'
            : 'bg-gray-50 border-gray-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
              isStepComplete('complete')
                ? 'bg-green-600 text-white'
                : isStepActive('deploy')
                ? 'bg-blue-600 text-white'
                : 'bg-gray-300 text-gray-600'
            }`}>
              {isStepComplete('complete') ? <CheckCircle className="w-5 h-5" /> : '4'}
            </div>
            <div>
              <p className="font-medium text-gray-900">Go Live</p>
              <p className="text-sm text-gray-600">
                Deploy your voice AI workflow to production
              </p>
            </div>
          </div>
          <button
            onClick={handleGoLive}
            disabled={isDeploying || !phoneNumber || !validationResult?.valid || !isStepComplete('test')}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold"
          >
            {isDeploying ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Deploying...
              </>
            ) : (
              <>
                <Rocket className="w-4 h-4" />
                Go Live
              </>
            )}
          </button>
        </div>
      </div>

      {/* Deployment Status */}
      {deploymentStatus && (
        <div className={`mt-6 p-4 rounded-lg border ${
          deploymentStep === 'complete'
            ? 'bg-green-50 border-green-200'
            : 'bg-blue-50 border-blue-200'
        }`}>
          <div className="flex items-start gap-2">
            {deploymentStep === 'complete' ? (
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
            ) : (
              <Loader className="w-5 h-5 text-blue-600 mt-0.5 animate-spin" />
            )}
            <p className={`text-sm ${
              deploymentStep === 'complete' ? 'text-green-900' : 'text-blue-900'
            }`}>
              {deploymentStatus}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
