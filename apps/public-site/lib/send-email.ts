interface BookingFormData {
  name: string;
  business: string;
  email: string;
  phone: string;
  website: string;
  teamSize: string;
  time: string;
  problem: string;
}

export async function sendBookingEmail(formData: BookingFormData): Promise<void> {
  const apiKey = import.meta.env.VITE_RESEND_API_KEY;
  const recipientEmail = import.meta.env.VITE_ALERT_EMAIL || 'inquiry@getspotfunnel.com';

  if (!apiKey) {
    throw new Error('Resend API key not configured. Please add VITE_RESEND_API_KEY to your .env.local file.');
  }

  const timeLabels: Record<string, string> = {
    morning: 'Morning (9am - 12pm)',
    afternoon: 'Afternoon (12pm - 5pm)',
    evening: 'Evening (5pm - 8pm)'
  };

  const problemLabels: Record<string, string> = {
    'losing-jobs': 'Losing jobs because calls are missed',
    'tied-to-phone': "I'm constantly tied to my phone",
    'after-hours-exhausting': 'After-hours calls are exhausting',
    'unqualified-calls': 'Too many unqualified / time-wasting calls',
    'cant-keep-up': "We're growing and can't keep up with calls"
  };

  const teamSizeLabels: Record<string, string> = {
    'solo': 'Just me',
    '2-5': '2–5 people',
    '6-10': '6–10 people',
    '11-25': '11–25 people',
    '26+': '26+ people'
  };

  const emailHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Consultation Request</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%); padding: 30px; text-align: center;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold;">New Consultation Request</h1>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px 30px;">
                    <p style="margin: 0 0 30px 0; color: #64748b; font-size: 14px; line-height: 1.5;">
                      You have received a new consultation request from <strong>${formData.business}</strong>.
                    </p>
                    
                    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                      <tr>
                        <td style="padding: 15px 0; border-bottom: 1px solid #e2e8f0;">
                          <div style="color: #64748b; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px;">Contact Name</div>
                          <div style="color: #0f172a; font-size: 15px; font-weight: 500;">${formData.name}</div>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 15px 0; border-bottom: 1px solid #e2e8f0;">
                          <div style="color: #64748b; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px;">Business Name</div>
                          <div style="color: #0f172a; font-size: 15px; font-weight: 500;">${formData.business}</div>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 15px 0; border-bottom: 1px solid #e2e8f0;">
                          <div style="color: #64748b; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px;">Email Address</div>
                          <div style="color: #0f172a; font-size: 15px; font-weight: 500;">
                            <a href="mailto:${formData.email}" style="color: #0EA5E9; text-decoration: none;">${formData.email}</a>
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 15px 0; border-bottom: 1px solid #e2e8f0;">
                          <div style="color: #64748b; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px;">Phone Number</div>
                          <div style="color: #0f172a; font-size: 15px; font-weight: 500;">
                            <a href="tel:${formData.phone}" style="color: #0EA5E9; text-decoration: none;">${formData.phone}</a>
                          </div>
                        </td>
                      </tr>
                      ${formData.website ? `
                      <tr>
                        <td style="padding: 15px 0; border-bottom: 1px solid #e2e8f0;">
                          <div style="color: #64748b; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px;">Website</div>
                          <div style="color: #0f172a; font-size: 15px; font-weight: 500;">
                            <a href="${formData.website.startsWith('http') ? formData.website : 'https://' + formData.website}" style="color: #0EA5E9; text-decoration: none;">${formData.website}</a>
                          </div>
                        </td>
                      </tr>
                      ` : ''}
                      ${formData.teamSize ? `
                      <tr>
                        <td style="padding: 15px 0; border-bottom: 1px solid #e2e8f0;">
                          <div style="color: #64748b; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px;">Team Size</div>
                          <div style="color: #0f172a; font-size: 15px; font-weight: 500;">${teamSizeLabels[formData.teamSize] || formData.teamSize}</div>
                        </td>
                      </tr>
                      ` : ''}
                      <tr>
                        <td style="padding: 15px 0; border-bottom: 1px solid #e2e8f0;">
                          <div style="color: #64748b; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px;">Best Time to Call</div>
                          <div style="color: #0f172a; font-size: 15px; font-weight: 500;">${timeLabels[formData.time] || formData.time}</div>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 15px 0;">
                          <div style="color: #64748b; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px;">Main Problem</div>
                          <div style="color: #0f172a; font-size: 15px; font-weight: 500;">${problemLabels[formData.problem] || formData.problem}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="padding: 20px 30px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
                    <p style="margin: 0; color: #64748b; font-size: 12px;">
                      This email was sent from the SpotFunnel consultation form
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'SpotFunnel <onboarding@resend.dev>',
      to: [recipientEmail],
      subject: `New Consultation Request from ${formData.business}`,
      html: emailHtml,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to send email');
  }
}
