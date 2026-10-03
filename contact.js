const requestedTopic = new URLSearchParams(window.location.search).get('topic');
const topicLabels = { 'field-testing': 'Forge field testing', investor: 'Investor conversation', sponsor: 'Sponsorship', affiliate: 'Affiliate partnership', technical: 'Technical collaboration', press: 'Press inquiry' };
const subject = topicLabels[requestedTopic] || 'Tethered Unicorn Labs conversation';
document.querySelector('#contact-email').href = `mailto:tetheredunicorn@gmail.com?subject=${encodeURIComponent(subject)}`;
document.querySelector('#contact-whatsapp').href = `https://wa.me/14079687358?text=${encodeURIComponent(`Hello, I'd like to talk about ${subject.toLowerCase()}.`)}`;

document.querySelectorAll('[data-copy]').forEach((button) => {
  button.addEventListener('click', async () => {
    await navigator.clipboard.writeText(button.dataset.copy);
    const original = button.textContent;
    button.textContent = 'Copied';
    setTimeout(() => { button.textContent = original; }, 1400);
  });
});
