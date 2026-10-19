'use strict';

const grid = document.querySelector('#people-grid');
const teamGrid = document.querySelector('#team-grid');
const filters = document.querySelector('#people-filters');

function element(name, text, className) {
  const node = document.createElement(name);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function portrait(person) {
  const image = element('div', '', 'portrait');
  image.setAttribute('role', 'img');
  image.setAttribute('aria-label', `Fictional illustrated portrait of ${person.name}`);
  image.style.backgroundPosition = `${person.portrait.column * 25}% ${person.portrait.row * 100}%`;
  return image;
}

function personCard(person, people) {
  const card = element('article', '', 'person-card');
  card.id = person.id;
  card.dataset.tags = person.tags.join(' ');
  card.append(portrait(person));
  const body = element('div', '', 'person-body');
  body.append(element('p', `${person.role} · ${person.pronouns}`, 'person-role'));
  body.append(element('h3', person.name));
  body.append(element('p', person.sample, 'person-voice'));
  const details = element('details');
  details.append(element('summary', 'Read their fictional story'));
  [['Fictional past', person.past], ['Present', person.present], ['Future direction', person.future], ['Voice and working habits', person.voice], ['Life outside the desk', person.texture], ['Growing edge', person.growth]].forEach(([heading, copy]) => {
    details.append(element('h4', heading));
    details.append(element('p', copy));
  });
  const partners = person.partners.map(id => people.find(candidate => candidate.id === id)?.name).filter(Boolean).join(', ');
  details.append(element('h4', 'Frequent collaborators'));
  details.append(element('p', partners));
  body.append(details);
  body.append(element('p', person.tags.filter(tag => tag !== 'lantern-company').join(' · '), 'person-tags'));
  card.append(body);
  return card;
}

function teamCard([id, team], people) {
  const card = element('article', '', 'team-card');
  const lead = people.find(person => person.id === team.lead)?.name || team.lead;
  const members = team.members.map(member => people.find(person => person.id === member)?.name || member).join(' · ');
  card.append(element('p', id.replaceAll('-', ' '), 'team-name'));
  card.append(element('h3', `Led by ${lead}`));
  card.append(element('p', team.purpose));
  card.append(element('p', `Working group: ${members}`, 'team-members'));
  return card;
}

fetch('assets/lantern-company.json')
  .then(response => response.ok ? response.json() : Promise.reject(new Error('Roster unavailable.')))
  .then(company => {
    company.people.forEach(person => grid.append(personCard(person, company.people)));
    Object.entries(company.teams).forEach(team => teamGrid.append(teamCard(team, company.people)));
    filters.addEventListener('click', event => {
      const button = event.target.closest('button[data-filter]');
      if (!button) return;
      const filter = button.dataset.filter;
      filters.querySelectorAll('button').forEach(candidate => candidate.setAttribute('aria-pressed', String(candidate === button)));
      grid.querySelectorAll('.person-card').forEach(card => {
        const tags = card.dataset.tags.split(' ');
        const matches = filter === 'research' ? tags.some(tag => tag.includes('research') || tag === 'verification' || tag === 'public-records') : tags.includes(filter);
        card.hidden = filter !== 'all' && !matches;
      });
    });
  })
  .catch(() => { grid.append(element('p', 'The Lantern Company roster is temporarily unavailable.')); });
