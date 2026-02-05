'use client';

import React, { useState } from 'react';
import { Play, RotateCcw, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import type { Objective, TenantConfig } from '@/types/config';

interface TestModeProps {
  config: TenantConfig;
}

interface TestState {
  currentObjectiveIndex: number;
  capturedData: Record<string, any>;
  conversationLog: Array<{
    type: 'bot' | 'user' | 'system';
    message: string;
    timestamp: Date;
  }>;
  isRunning: boolean;
  isComplete: boolean;
}

export default function TestMode({ config }: TestModeProps) {
  const [testState, setTestState] = useState<TestState>({
    currentObjectiveIndex: 0,
    capturedData: {},
    conversationLog: [],
    isRunning: false,
    isComplete: false,
  });

  const [userInput, setUserInput] = useState('');

  const simulateBotMessage = (message: string) => {
    setTestState((prev) => ({
      ...prev,
      conversationLog: [
        ...prev.conversationLog,
        {
          type: 'bot',
          message,
          timestamp: new Date(),
        },
      ],
    }));
  };

  const simulateUserMessage = (message: string) => {
    setTestState((prev) => ({
      ...prev,
      conversationLog: [
        ...prev.conversationLog,
        {
          type: 'user',
          message,
          timestamp: new Date(),
        },
      ],
    }));
  };

  const simulateSystemMessage = (message: string) => {
    setTestState((prev) => ({
      ...prev,
      conversationLog: [
        ...prev.conversationLog,
        {
          type: 'system',
          message,
          timestamp: new Date(),
        },
      ],
    }));
  };

  const startTest = () => {
    const initialState: TestState = {
      currentObjectiveIndex: 0,
      capturedData: {},
      conversationLog: [
        {
          type: 'system',
          message: 'Test conversation started',
          timestamp: new Date(),
        },
      ],
      isRunning: true,
      isComplete: false,
    };

    setTestState(initialState);

    // Simulate greeting
    setTimeout(() => {
      simulateBotMessage('Hello! I\'m here to help you. Let\'s get started.');
      setTimeout(() => {
        startObjective(0, initialState);
      }, 500);
    }, 500);
  };

  const startObjective = (index: number, state: TestState) => {
    if (index >= config.objectives.length) {
      simulateBotMessage('Thank you! I have all the information I need. Have a great day!');
      simulateSystemMessage('Conversation completed successfully');
      setTestState((prev) => ({ ...prev, isComplete: true, isRunning: false }));
      return;
    }

    const objective = config.objectives[index];
    const purposeMessages: Record<string, string> = {
      appointment_confirmation: 'I need your email address to send you a confirmation.',
      callback: 'What\'s the best phone number to reach you?',
      service_location: 'Where should we send our service team?',
      service_selection: 'What type of service do you need?',
      booking: 'When would be a good time for you?',
    };

    const message =
      purposeMessages[objective.purpose] ||
      `I need to collect some information. ${objective.type}`;

    simulateBotMessage(message);
    simulateSystemMessage(`Objective ${index + 1}: ${objective.id} (${objective.type})`);
  };

  const handleUserInput = () => {
    if (!userInput.trim() || !testState.isRunning) return;

    simulateUserMessage(userInput);

    const currentObjective = config.objectives[testState.currentObjectiveIndex];
    if (!currentObjective) {
      setUserInput('');
      return;
    }

    // Simulate capture (simplified validation)
    const isValid = userInput.trim().length > 0;

    setTimeout(() => {
      if (isValid) {
        const newData = {
          ...testState.capturedData,
          [currentObjective.id]: userInput.trim(),
        };

        simulateSystemMessage(
          `✓ Captured: ${currentObjective.id} = "${userInput.trim()}"`
        );

        const nextIndex = testState.currentObjectiveIndex + 1;
        setTestState((prev) => ({
          ...prev,
          currentObjectiveIndex: nextIndex,
          capturedData: newData,
        }));

        setTimeout(() => {
          startObjective(nextIndex, {
            ...testState,
            currentObjectiveIndex: nextIndex,
            capturedData: newData,
          });
        }, 500);
      } else {
        simulateBotMessage(
          'I didn\'t catch that. Could you please repeat?'
        );
      }
      setUserInput('');
    }, 300);
  };

  const resetTest = () => {
    setTestState({
      currentObjectiveIndex: 0,
      capturedData: {},
      conversationLog: [],
      isRunning: false,
      isComplete: false,
    });
    setUserInput('');
  };

  // Estimate cost per call
  const estimateCostPerCall = (): number => {
    // Rough estimates based on typical voice AI costs
    const baseCost = 0.05; // Base cost per call
    const objectiveCost = 0.02; // Cost per objective
    const avgTurnsPerObjective = 2.5; // Average turns per objective
    
    const totalObjectives = config.objectives.length;
    const estimatedTurns = totalObjectives * avgTurnsPerObjective;
    
    // STT: $0.0043 per minute, LLM: ~$0.01 per turn, TTS: $0.015 per minute
    const sttCost = (estimatedTurns * 0.5) * 0.0043; // ~30 seconds per turn
    const llmCost = estimatedTurns * 0.01;
    const ttsCost = (estimatedTurns * 0.5) * 0.015;
    
    return baseCost + sttCost + llmCost + ttsCost;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Test Mode</h2>
          <p className="text-sm text-gray-600 mt-1">
            Simulate a conversation to test your workflow before deploying
          </p>
        </div>
        <div className="flex gap-2">
          {!testState.isRunning && !testState.isComplete && (
            <button
              onClick={startTest}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Play className="w-4 h-4" />
              Start Test
            </button>
          )}
          {(testState.isRunning || testState.isComplete) && (
            <button
              onClick={resetTest}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conversation Log */}
        <div className="lg:col-span-2">
          <div className="bg-gray-50 rounded-lg p-4 h-96 overflow-y-auto border border-gray-200">
            {testState.conversationLog.length === 0 ? (
              <div className="text-center text-gray-500 py-12">
                <p>Click &quot;Start Test&quot; to begin simulation</p>
              </div>
            ) : (
              <div className="space-y-3">
                {testState.conversationLog.map((entry, index) => (
                  <div
                    key={index}
                    className={`flex ${
                      entry.type === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        entry.type === 'user'
                          ? 'bg-primary-600 text-white'
                          : entry.type === 'system'
                          ? 'bg-yellow-100 text-yellow-800 text-xs'
                          : 'bg-white border border-gray-200 text-gray-900'
                      }`}
                    >
                      <p className="text-sm">{entry.message}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {entry.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* User Input */}
          {testState.isRunning && (
            <div className="mt-4 flex gap-2">
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleUserInput();
                  }
                }}
                placeholder="Type your response..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <button
                onClick={handleUserInput}
                className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Send
              </button>
            </div>
          )}
        </div>

        {/* State & Data Panel */}
        <div className="space-y-4">
          {/* Current Objective */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">
              Current Objective
            </h3>
            {testState.currentObjectiveIndex < config.objectives.length ? (
              <div>
                <p className="text-sm text-blue-800 font-medium">
                  {config.objectives[testState.currentObjectiveIndex]?.id}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Step {testState.currentObjectiveIndex + 1} of{' '}
                  {config.objectives.length}
                </p>
              </div>
            ) : (
              <p className="text-sm text-blue-800">Completed</p>
            )}
          </div>

          {/* Captured Data */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-green-900 mb-2">
              Captured Data
            </h3>
            {Object.keys(testState.capturedData).length === 0 ? (
              <p className="text-xs text-green-700">No data captured yet</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(testState.capturedData).map(([key, value]) => (
                  <div key={key} className="text-xs">
                    <span className="font-medium text-green-800">{key}:</span>
                    <span className="text-green-700 ml-1">{String(value)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cost Estimation */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-purple-900 mb-2">
              Estimated Cost Per Call
            </h3>
            <p className="text-2xl font-bold text-purple-700">
              ${estimateCostPerCall().toFixed(3)}
            </p>
            <p className="text-xs text-purple-600 mt-1">
              Based on {config.objectives.length} objective{config.objectives.length !== 1 ? 's' : ''} and average conversation length
            </p>
            <div className="mt-2 text-xs text-purple-700 space-y-1">
              <div>• STT: ${(estimateCostPerCall() * 0.3).toFixed(3)}</div>
              <div>• LLM: ${(estimateCostPerCall() * 0.5).toFixed(3)}</div>
              <div>• TTS: ${(estimateCostPerCall() * 0.2).toFixed(3)}</div>
            </div>
          </div>

          {/* Status */}
          {testState.isComplete && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <p className="text-sm font-semibold text-green-900">
                  Test Completed Successfully
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
