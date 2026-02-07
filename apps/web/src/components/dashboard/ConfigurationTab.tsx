'use client';

import React, { useState } from 'react';
import {
  Mic,
  BookOpen,
  Mail,
  Check,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Textarea } from '@/components/ui/Textarea';
import { cn } from '@/components/ui/cn';

type ConfigSection = 'voice' | 'knowledge' | 'email';

const NAV_ITEMS = [
  {
    id: 'voice' as ConfigSection,
    label: 'Voice & Persona',
    description: 'Tuning and voice selection',
    icon: Mic,
  },
  {
    id: 'knowledge' as ConfigSection,
    label: 'Knowledge Base',
    description: 'FAQs and business context',
    icon: BookOpen,
  },
  {
    id: 'email' as ConfigSection,
    label: 'Email Templates',
    description: 'Follow-up messaging',
    icon: Mail,
  },
];

const VOICE_OPTIONS = [
  { id: 'clarity', name: 'Clarity', description: 'Warm, confident delivery.' },
  { id: 'calm', name: 'Calm', description: 'Gentle, patient tone.' },
  { id: 'precise', name: 'Precise', description: 'Direct and concise.' },
];

export function ConfigurationTab() {
  const [activeSection, setActiveSection] = useState<ConfigSection>('voice');
  const [selectedVoice, setSelectedVoice] = useState('clarity');
  const [knowledgeBase, setKnowledgeBase] = useState(
    'Hours: Mon-Fri 8am-6pm\nServices: Consultation, Installation, Repair\nEscalation: Complex billing or medical concerns'
  );
  const [emailTemplate, setEmailTemplate] = useState(
    'Subject: Follow-up on your recent call\n\nHi {{name}},\n\nThanks for reaching out to us. We have your request and will contact you shortly.\n\nBest,\nSpotFunnel Team'
  );

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configuration</h1>
        <p className="text-muted-foreground">
          Fine-tune how your agent behaves
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-1 border-border shadow-md">
          <CardContent className="p-4">
            <nav className="space-y-2">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    className={cn(
                      'w-full flex items-center gap-4 px-4 py-4 rounded-xl transition-all duration-200',
                      isActive
                        ? 'bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-lg'
                        : 'hover:bg-muted/50'
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <div className="flex-1 text-left">
                      <div className="font-bold text-sm">{item.label}</div>
                      <div className="text-xs opacity-80">
                        {item.description}
                      </div>
                    </div>
                    {isActive && <ChevronRight className="w-5 h-5" />}
                  </button>
                );
              })}
            </nav>
          </CardContent>
        </Card>

        <div className="lg:col-span-3 space-y-6">
          {activeSection === 'voice' && (
            <Card className="border-border shadow-md">
              <CardHeader>
                <CardTitle className="text-xl">Voice Selection</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {VOICE_OPTIONS.map((option) => {
                    const isActive = selectedVoice === option.id;
                    return (
                      <button
                        key={option.id}
                        onClick={() => setSelectedVoice(option.id)}
                        className={cn(
                          'p-6 rounded-xl border-2 transition-all duration-200 text-left',
                          isActive
                            ? 'border-primary bg-primary/10 ring-4 ring-primary/20'
                            : 'border-border hover:border-primary/40'
                        )}
                      >
                        <div className="flex justify-between mb-3">
                          <span className="font-bold">{option.name}</span>
                          {isActive && <Check className="w-5 h-5 text-primary" />}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {option.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-3">
                  <Button>Save Voice Settings</Button>
                  <Button variant="outline">Reset</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {activeSection === 'knowledge' && (
            <Card className="border-border shadow-md">
              <CardHeader>
                <CardTitle className="text-xl">Knowledge Base</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={knowledgeBase}
                  onChange={(event) => setKnowledgeBase(event.target.value)}
                  className="min-h-[320px] font-mono text-sm"
                />
                <div className="flex gap-3">
                  <Button>Save Knowledge</Button>
                  <Button variant="outline">Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {activeSection === 'email' && (
            <Card className="border-border shadow-md">
              <CardHeader>
                <CardTitle className="text-xl">Email Templates</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={emailTemplate}
                  onChange={(event) => setEmailTemplate(event.target.value)}
                  className="min-h-[240px] font-mono text-sm"
                />
                <div className="flex gap-3">
                  <Button>Save Template</Button>
                  <Button variant="outline">Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
