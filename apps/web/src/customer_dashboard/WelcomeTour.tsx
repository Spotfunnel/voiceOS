'use client';

import { useState, useEffect } from 'react';
import { X, ArrowRight, Phone, ListChecks, FileText } from 'lucide-react';
import { Button } from "@/shared_ui/components/ui/Button";
import { cn } from "@/shared_ui/lib/utils";

interface WelcomeTourProps {
  onComplete: () => void;
}

const TOUR_STEPS = [
  {
    id: 'overview',
    title: 'Welcome to Your Dashboard',
    description: 'See your call summary, action items, and recent activity at a glance.',
    icon: Phone,
    highlights: [
      'Total calls and minutes',
      'Action items requiring attention',
      'Recent call history',
    ],
  },
  {
    id: 'action',
    title: 'Action Required',
    description: 'Manage urgent callbacks, follow-ups, and customer requests that need your attention.',
    icon: ListChecks,
    highlights: [
      'Priority callbacks',
      'Pending follow-ups',
      'Customer requests',
    ],
  },
  {
    id: 'calls',
    title: 'Call Logs',
    description: 'Review all your call history with transcripts, captured data, and detailed analytics.',
    icon: FileText,
    highlights: [
      'Full call transcripts',
      'Captured customer information',
      'Call outcomes and duration',
    ],
  },
];

export function WelcomeTour({ onComplete }: WelcomeTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Fade in after mount
    setTimeout(() => setIsVisible(true), 100);
  }, []);

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = () => {
    setIsVisible(false);
    setTimeout(onComplete, 300);
  };

  const step = TOUR_STEPS[currentStep];
  const Icon = step.icon;
  const isLastStep = currentStep === TOUR_STEPS.length - 1;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300",
        isVisible ? "opacity-100" : "opacity-0"
      )}
    >
      <div
        className={cn(
          "bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 transition-all duration-300",
          isVisible ? "scale-100 opacity-100" : "scale-95 opacity-0"
        )}
      >
        {/* Header */}
        <div className="relative p-6 border-b">
          <button
            onClick={handleSkip}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close tour"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <Icon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{step.title}</h2>
              <p className="text-sm text-gray-500 mt-1">
                Step {currentStep + 1} of {TOUR_STEPS.length}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-gray-700 leading-relaxed">{step.description}</p>

          <div className="space-y-2">
            {step.highlights.map((highlight, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <div className="w-2 h-2 rounded-full bg-blue-600" />
                </div>
                <p className="text-sm text-gray-600">{highlight}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Progress Dots */}
        <div className="flex justify-center gap-2 px-6 pb-4">
          {TOUR_STEPS.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentStep(idx)}
              className={cn(
                "w-2 h-2 rounded-full transition-all duration-300",
                idx === currentStep
                  ? "bg-blue-600 w-6"
                  : "bg-gray-300 hover:bg-gray-400"
              )}
              aria-label={`Go to step ${idx + 1}`}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50 rounded-b-xl">
          <Button
            variant="ghost"
            onClick={handleSkip}
            className="text-gray-600 hover:text-gray-900"
          >
            Skip Tour
          </Button>

          <Button
            onClick={handleNext}
            className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
          >
            {isLastStep ? (
              'Get Started'
            ) : (
              <>
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
