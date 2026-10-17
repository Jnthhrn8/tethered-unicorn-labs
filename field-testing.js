'use strict';

const form = document.querySelector('#accessRequestForm');
const status = document.querySelector('#requestStatus');
const button = form?.querySelector('button[type="submit"]');

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!form.reportValidity() || button.disabled) return;
  const values = Object.fromEntries(new FormData(form));
  const payload = {
    name: values.name.trim(), email: values.email.trim(), username: values.username.trim(), reason: values.reason.trim(),
    consent: values.consent === 'on', ageConfirmed: values.ageConfirmed === 'on',
    onboarding: { goals: values.goals.trim(), communicationStyle: values.communicationStyle.trim(), experience: values.experience.trim() },
    feedback: { devices: values.devices.trim(), workflows: values.workflows.trim(), frustrations: values.frustrations.trim(), mustHave: values.mustHave.trim(), privacyComfort: values.privacyComfort, testingAvailability: values.testingAvailability.trim() },
  };
  button.disabled = true;
  button.textContent = 'Sending your request…';
  status.className = 'form-status';
  status.textContent = 'Saving your application. Please keep this page open.';
  try {
    const response = await fetch('https://messages.tetheredunicorn.com/field-request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(20000) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Your request could not be saved. Please try again later.');
    form.reset();
    status.className = 'form-status success';
    status.textContent = `Your request is saved. Reference: ${result.reference}. This is a request, not an approval. Keep the reference and wait for an invitation.`;
    status.focus();
  } catch (error) {
    status.className = 'form-status error';
    status.textContent = error.name === 'TimeoutError' ? 'The connection timed out. Your request may have arrived; please contact The Unicorn before sending it again.' : error.message;
    status.focus();
  } finally {
    button.disabled = false;
    button.textContent = 'Send my access request 🦋';
  }
});
