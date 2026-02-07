 'use client';
 
 import React, { useState } from 'react';
 import { Button } from '@/components/ui/Button';
 import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
 import { Select } from '@/components/ui/Select';
 import { Textarea } from '@/components/ui/Textarea';
 
 const SECTIONS = [
   { id: 'layer2', label: 'Layer 2 Config' },
   { id: 'layer3', label: 'Layer 3 Hooks' },
   { id: 'model', label: 'Model Config' },
   { id: 'escalation', label: 'Escalation Rules' },
 ];
 
 export function ConfigEditor() {
   const [activeSection, setActiveSection] = useState('layer2');
   const [scope, setScope] = useState('global');
 
   return (
     <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
       <Card className="h-fit border-border shadow-sm">
         <CardHeader>
           <CardTitle className="text-sm font-semibold">Configuration</CardTitle>
         </CardHeader>
         <CardContent className="space-y-2">
           {SECTIONS.map((section) => (
             <Button
               key={section.id}
               variant={activeSection === section.id ? 'primary' : 'outline'}
               className="w-full justify-start"
               onClick={() => setActiveSection(section.id)}
             >
               {section.label}
             </Button>
           ))}
         </CardContent>
       </Card>
 
       <div className="space-y-4">
         <Card className="border-border shadow-sm">
           <CardHeader>
             <CardTitle className="text-sm font-semibold">Edit {activeSection}</CardTitle>
           </CardHeader>
           <CardContent className="space-y-4">
             <Textarea rows={12} placeholder="Paste JSON or YAML config..." />
             <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
               <div className="flex items-center gap-2">
                 <Select value={scope} onChange={(event) => setScope(event.target.value)}>
                   <option value="global">Apply to global default</option>
                   <option value="tenant">Apply to single tenant</option>
                 </Select>
                 {scope === 'tenant' ? (
                   <Select>
                     <option value="">Select tenant</option>
                   </Select>
                 ) : null}
               </div>
               <div className="flex items-center gap-2">
                 <Button variant="outline">Show Diff</Button>
                 <Button>Save Changes</Button>
               </div>
             </div>
           </CardContent>
         </Card>
 
         <Card className="border-border shadow-sm">
           <CardHeader>
             <CardTitle className="text-sm font-semibold">Version History</CardTitle>
           </CardHeader>
           <CardContent className="space-y-3 text-sm text-muted-foreground">
             <div className="rounded-lg border border-border/60 p-3">
               <p className="font-semibold text-foreground">v1.3.2 - Current</p>
               <p>Modified by Leo • 2026-02-05 14:30</p>
               <div className="mt-2 flex gap-2">
                 <Button size="sm" variant="outline">
                   View Diff
                 </Button>
                 <Button size="sm" variant="outline">
                   Rollback
                 </Button>
               </div>
             </div>
             <div className="rounded-lg border border-border/60 p-3">
               <p className="font-semibold text-foreground">v1.3.1</p>
               <p>Modified by Kai • 2026-02-01 09:12</p>
               <div className="mt-2 flex gap-2">
                 <Button size="sm" variant="outline">
                   View Diff
                 </Button>
                 <Button size="sm" variant="outline">
                   Rollback
                 </Button>
               </div>
             </div>
           </CardContent>
         </Card>
       </div>
     </div>
   );
 }
