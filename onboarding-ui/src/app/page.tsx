'use client';

import React, { useState } from 'react';
import ObjectiveLibrary from '@/components/ObjectiveLibrary';
import ObjectiveBuilder from '@/components/ObjectiveBuilder';
import ConfigPreview from '@/components/ConfigPreview';
import TestMode from '@/components/TestMode';
import DeployConfig from '@/components/DeployConfig';
import type { TenantConfig, Objective } from '@/types/config';
import { Locale } from '@/types/config';

export default function OnboardingPage() {
  const [config, setConfig] = useState<TenantConfig>({
    tenant_id: '',
    tenant_name: '',
    locale: Locale.EN_AU,
    schema_version: 'v1',
    objectives: [],
    metadata: {
      created_at: new Date().toISOString(),
    },
  });

  const [activeTab, setActiveTab] = useState<'library' | 'builder' | 'preview' | 'test' | 'deploy'>('library');
  const [showTenantForm, setShowTenantForm] = useState(true);

  const handleAddObjective = (objective: Objective) => {
    setConfig((prev) => ({
      ...prev,
      objectives: [...prev.objectives, objective],
    }));
    setActiveTab('builder');
  };

  const handleUpdateObjectives = (objectives: Objective[]) => {
    setConfig((prev) => ({
      ...prev,
      objectives,
    }));
  };

  const handleConfigUpdate = (updatedConfig: TenantConfig) => {
    setConfig(updatedConfig);
  };

  const handleTenantSubmit = (tenantData: { tenant_id: string; tenant_name: string; locale: Locale }) => {
    setConfig((prev) => ({
      ...prev,
      tenant_id: tenantData.tenant_id,
      tenant_name: tenantData.tenant_name,
      locale: tenantData.locale,
    }));
    setShowTenantForm(false);
  };

  if (showTenantForm) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome to Voice AI Onboarding</h1>
          <p className="text-gray-600 mb-6">Let's get started by setting up your tenant information</p>
          
          <TenantForm onSubmit={handleTenantSubmit} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Voice AI Configuration</h1>
              <p className="text-sm text-gray-600 mt-1">
                {config.tenant_name} ({config.tenant_id})
              </p>
            </div>
            <div className="text-sm text-gray-500">
              {config.objectives.length} objective{config.objectives.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white border-b border-gray-200 sticky top-[73px] z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-1 overflow-x-auto">
            {[
              { id: 'library', label: '📚 Library', count: null },
              { id: 'builder', label: '⚙️ Builder', count: config.objectives.length },
              { id: 'preview', label: '👁️ Preview', count: null },
              { id: 'test', label: '🧪 Test', count: null },
              { id: 'deploy', label: '🚀 Deploy', count: null },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
                {tab.count !== null && tab.count > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-primary-100 text-primary-700 rounded-full text-xs">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'library' && (
          <div className="space-y-6">
            <ObjectiveLibrary onAddObjective={handleAddObjective} />
          </div>
        )}

        {activeTab === 'builder' && (
          <div className="space-y-6">
            <ObjectiveBuilder
              objectives={config.objectives}
              onUpdateObjectives={handleUpdateObjectives}
              onPreview={() => setActiveTab('preview')}
            />
          </div>
        )}

        {activeTab === 'preview' && (
          <div className="space-y-6">
            <ConfigPreview config={config} />
          </div>
        )}

        {activeTab === 'test' && (
          <div className="space-y-6">
            <TestMode config={config} />
          </div>
        )}

        {activeTab === 'deploy' && (
          <div className="space-y-6">
            <DeployConfig config={config} onConfigUpdate={handleConfigUpdate} />
          </div>
        )}
      </main>
    </div>
  );
}

function TenantForm({ onSubmit }: { onSubmit: (data: { tenant_id: string; tenant_name: string; locale: Locale }) => void }) {
  const [tenantId, setTenantId] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [locale, setLocale] = useState<Locale>(Locale.EN_AU);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tenantId.trim() && tenantName.trim()) {
      onSubmit({ tenant_id: tenantId.trim(), tenant_name: tenantName.trim(), locale });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="tenant_id" className="block text-sm font-medium text-gray-700 mb-1">
          Tenant ID *
        </label>
        <input
          type="text"
          id="tenant_id"
          value={tenantId}
          onChange={(e) => setTenantId(e.target.value)}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          placeholder="e.g., acme-corp"
        />
        <p className="text-xs text-gray-500 mt-1">Unique identifier for your tenant</p>
      </div>

      <div>
        <label htmlFor="tenant_name" className="block text-sm font-medium text-gray-700 mb-1">
          Tenant Name *
        </label>
        <input
          type="text"
          id="tenant_name"
          value={tenantName}
          onChange={(e) => setTenantName(e.target.value)}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          placeholder="e.g., Acme Corporation"
        />
      </div>

      <div>
        <label htmlFor="locale" className="block text-sm font-medium text-gray-700 mb-1">
          Locale *
        </label>
        <select
          id="locale"
          value={locale}
          onChange={(e) => setLocale(e.target.value as Locale)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        >
          <option value={Locale.EN_AU}>English (Australia)</option>
          <option value={Locale.EN_US}>English (United States)</option>
          <option value={Locale.EN_GB}>English (United Kingdom)</option>
        </select>
      </div>

      <button
        type="submit"
        className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
      >
        Continue
      </button>
    </form>
  );
}
