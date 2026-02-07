'use client';

import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Input } from '../ui/Input';

interface Props {
  phoneNumber?: string;
  telnyxApiKey?: string;
  telnyxConnectionId?: string;
  telnyxPhoneNumber?: string;
  voiceWebhookUrl?: string;
  statusCallbackUrl?: string;
  transferContactName?: string;
  transferContactTitle?: string;
  transferContactPhone?: string;
  onNext: (data: any) => void;
  onBack: () => void;
  isSaving?: boolean;
}

export default function Step6Telephony({
  phoneNumber,
  telnyxApiKey,
  telnyxConnectionId,
  telnyxPhoneNumber,
  voiceWebhookUrl,
  statusCallbackUrl,
  transferContactName,
  transferContactTitle,
  transferContactPhone,
  onNext,
  onBack,
  isSaving,
}: Props) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        onNext({
          phone_number: data.get('phone_number'),
          telnyx_api_key: data.get('telnyx_api_key'),
          telnyx_connection_id: data.get('telnyx_connection_id'),
          telnyx_phone_number: data.get('telnyx_phone_number'),
          voice_webhook_url: data.get('voice_webhook_url'),
          status_callback_url: data.get('status_callback_url'),
          transfer_contact_name: data.get('transfer_contact_name'),
          transfer_contact_title: data.get('transfer_contact_title'),
          transfer_contact_phone: data.get('transfer_contact_phone'),
        });
      }}
      className="flex flex-col gap-6"
    >
      <div>
        <h2 className="text-2xl font-semibold text-foreground">Telephony</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Configure Telnyx so incoming calls route to your SpotFunnel agent.
        </p>
      </div>

      <Card className="border border-border p-5">
        <h3 className="text-sm font-semibold">Telnyx setup checklist</h3>
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
          <li>• Create a Telnyx account and Call Control application.</li>
          <li>• Purchase a Telnyx phone number and assign it to the Call Control app.</li>
          <li>
            • In the Telnyx portal, set the Call Control <strong>Webhook URL</strong> to
            your voice webhook URL (HTTP POST).
          </li>
          <li>
            • Set any <strong>Status Callback</strong> URL for call events if needed.
          </li>
          <li>• Ensure your webhook URL is HTTPS (ngrok ok for dev).</li>
        </ul>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Primary business number</label>
            <Input
              name="phone_number"
              defaultValue={phoneNumber || ''}
              placeholder="+1 555 010 2222"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Telnyx API key</label>
            <Input
              name="telnyx_api_key"
              defaultValue={telnyxApiKey || ''}
              placeholder="KEYxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Telnyx connection ID</label>
            <Input
              name="telnyx_connection_id"
              defaultValue={telnyxConnectionId || ''}
              placeholder="xxxxxxxxxxxxxxxxxxxx"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Telnyx phone number</label>
            <Input
              name="telnyx_phone_number"
              defaultValue={telnyxPhoneNumber || ''}
              placeholder="+1 555 010 3333"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Voice webhook URL</label>
            <Input
              name="voice_webhook_url"
              defaultValue={voiceWebhookUrl || 'https://api.spotfunnel.com/api/telnyx/webhook'}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Status callback URL</label>
            <Input
              name="status_callback_url"
              defaultValue={statusCallbackUrl || 'https://api.spotfunnel.com/twilio/status'}
            />
          </div>
        </div>
      </div>

      <Card className="border border-border p-5">
        <h3 className="text-sm font-semibold">Transfer contact (for escalations)</h3>
        <p className="text-xs text-muted-foreground mt-1 mb-4">
          When the AI can't help, it will attempt to transfer to this contact.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm font-medium">Contact name</label>
            <Input
              name="transfer_contact_name"
              defaultValue={transferContactName || ''}
              placeholder="John Smith"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Title / Role</label>
            <Input
              name="transfer_contact_title"
              defaultValue={transferContactTitle || ''}
              placeholder="Service Manager"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Phone number</label>
            <Input
              name="transfer_contact_phone"
              defaultValue={transferContactPhone || ''}
              placeholder="+1 555 010 4444"
            />
          </div>
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <Button type="button" variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button type="submit" loading={isSaving} disabled={isSaving}>
          Finish onboarding
        </Button>
      </div>
    </form>
  );
}
