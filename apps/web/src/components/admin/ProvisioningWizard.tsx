 'use client';
 
 import React, { useState } from 'react';
 import { Button } from '@/components/ui/Button';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
 import { Input } from '@/components/ui/Input';
 import { Select } from '@/components/ui/Select';
 import { Textarea } from '@/components/ui/Textarea';
 
 const STEPS = [
   'Customer Identity',
   'Phone & Routing',
   'Services & Intent',
   'Integrations',
   'Validation & Test',
   'Activate',
 ];
 
 export function ProvisioningWizard() {
   const [step, setStep] = useState(0);
 
   const nextStep = () => setStep((prev) => Math.min(prev + 1, STEPS.length - 1));
   const prevStep = () => setStep((prev) => Math.max(prev - 1, 0));
 
   return (
     <Card className="border-border shadow-sm">
       <CardHeader>
         <CardTitle className="text-sm font-semibold">
           Step {step + 1} of {STEPS.length}: {STEPS[step]}
         </CardTitle>
       </CardHeader>
       <CardContent className="space-y-6">
         {step === 0 && (
           <div className="grid gap-4 md:grid-cols-2">
             <Input placeholder="Business name" />
             <Input placeholder="Industry" />
             <Input placeholder="Primary contact name" />
             <Input placeholder="Primary contact email" />
             <Input placeholder="Primary location" />
           </div>
         )}
 
         {step === 1 && (
           <div className="grid gap-4 md:grid-cols-2">
             <Input placeholder="Assigned phone number" />
             <Select>
               <option value="">Business hours (timezone)</option>
               <option value="aest">AEST</option>
               <option value="pst">PST</option>
               <option value="est">EST</option>
             </Select>
             <Input placeholder="Routing strategy (e.g., round robin)" />
             <Input placeholder="Escalation phone" />
           </div>
         )}
 
         {step === 2 && (
           <div className="space-y-4">
             <Textarea rows={4} placeholder="List top services (comma-separated)" />
             <Textarea rows={4} placeholder="Common intents or FAQs" />
             <Textarea rows={4} placeholder="Escalation conditions" />
           </div>
         )}
 
         {step === 3 && (
           <div className="grid gap-4 md:grid-cols-2">
             <Input placeholder="CRM webhook URL" />
             <Input placeholder="n8n workflow URL" />
             <Input placeholder="Notification email" />
             <Input placeholder="Slack webhook URL" />
           </div>
         )}
 
         {step === 4 && (
           <div className="space-y-4">
             <p className="text-sm text-muted-foreground">
               Run validation and test call scenarios before activation.
             </p>
             <div className="flex flex-col gap-2">
               <Button variant="outline">Validate Configuration</Button>
               <Button variant="outline">Run Test Call</Button>
             </div>
           </div>
         )}
 
         {step === 5 && (
           <div className="space-y-4">
             <p className="text-sm text-muted-foreground">
               Activate the tenant, register monitoring, and generate dashboard links.
             </p>
             <Button>Activate Tenant</Button>
           </div>
         )}
 
         <div className="flex items-center justify-between border-t pt-4">
           <Button variant="outline" onClick={prevStep} disabled={step === 0}>
             Back
           </Button>
           <Button onClick={nextStep} disabled={step === STEPS.length - 1}>
             Next
           </Button>
         </div>
       </CardContent>
     </Card>
   );
 }
