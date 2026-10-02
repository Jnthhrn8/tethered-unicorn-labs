const CONTACT_ENDPOINT = 'https://messages.tetheredunicorn.com/contact';
const contactForm = document.querySelector('#contact-form');
const formStatus = document.querySelector('#form-status');

const requestedTopic = new URLSearchParams(window.location.search).get('topic');
const topicSelect = contactForm?.elements.namedItem('topic');
if (requestedTopic && topicSelect && [...topicSelect.options].some((option) => option.value === requestedTopic)) {
  topicSelect.value = requestedTopic;
}

document.querySelectorAll('[data-copy]').forEach((button) => {
  button.addEventListener('click', async () => {
    await navigator.clipboard.writeText(button.dataset.copy);
    const original = button.textContent;
    button.textContent = 'Copied';
    setTimeout(() => { button.textContent = original; }, 1400);
  });
});

contactForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!contactForm.reportValidity()) return;
  const submitButton = contactForm.querySelector('button[type="submit"]');
  const payload = Object.fromEntries(new FormData(contactForm).entries());
  submitButton.disabled = true;
  formStatus.className = 'form-status';
  formStatus.textContent = 'Delivering your message securely…';
  try {
    const response = await fetch(CONTACT_ENDPOINT, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'The Forge message service is temporarily unavailable.');
    contactForm.reset();
    formStatus.className = 'form-status success';
    formStatus.textContent = `Delivered. Your reference is ${result.reference}. The Unicorn will review your message.`;
  } catch (error) {
    formStatus.className = 'form-status error';
    formStatus.textContent = `${error.message} Please copy the company email or phone number shown on this page.`;
  } finally { submitButton.disabled = false; }
});
