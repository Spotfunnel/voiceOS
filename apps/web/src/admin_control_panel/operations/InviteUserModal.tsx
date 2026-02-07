'use client';

import { useState } from 'react';
import { X, Mail, User, MessageSquare, Loader2 } from 'lucide-react';
import { Button } from "@/shared_ui/components/ui/Button";
import { Input } from "@/shared_ui/components/ui/Input";
import { Label } from "@/shared_ui/components/ui/Label";
import { Textarea } from "@/shared_ui/components/ui/Textarea";
import { cn } from "@/shared_ui/lib/utils";

interface InviteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  agentId: string;
  agentName: string;
  businessName: string;
  onInviteSent?: () => void;
}

export function InviteUserModal({
  isOpen,
  onClose,
  agentId,
  agentName,
  businessName,
  onInviteSent
}: InviteUserModalProps) {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/admin/invite-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenant_id: agentId,
          email,
          first_name: firstName || null,
          last_name: lastName || null,
          custom_message: customMessage || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to send invitation');
      }

      setSuccess(true);
      setTimeout(() => {
        onInviteSent?.();
        handleClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to send invitation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setFirstName('');
    setLastName('');
    setCustomMessage('');
    setError('');
    setSuccess(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Invite Customer User</h2>
            <p className="text-sm text-gray-500 mt-1">
              Send an invitation to access {businessName}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isSubmitting}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Email (Required) */}
          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Email Address <span className="text-red-500">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="customer@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isSubmitting || success}
              className="w-full"
            />
          </div>

          {/* First Name (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="firstName" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              First Name
            </Label>
            <Input
              id="firstName"
              type="text"
              placeholder="John"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              disabled={isSubmitting || success}
              className="w-full"
            />
          </div>

          {/* Last Name (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="lastName">Last Name</Label>
            <Input
              id="lastName"
              type="text"
              placeholder="Doe"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              disabled={isSubmitting || success}
              className="w-full"
            />
          </div>

          {/* Custom Message (Optional) */}
          <div className="space-y-2">
            <Label htmlFor="customMessage" className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Custom Message (Optional)
            </Label>
            <Textarea
              id="customMessage"
              placeholder="Add a personalized message to the invitation email..."
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              disabled={isSubmitting || success}
              className="w-full min-h-[100px] resize-none"
            />
            <p className="text-xs text-gray-500">
              This message will be included in the invitation email.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-600">
                ✓ Invitation sent successfully! The customer will receive an email shortly.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || success || !email}
              className="flex-1"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : success ? (
                '✓ Sent'
              ) : (
                'Send Invitation'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
