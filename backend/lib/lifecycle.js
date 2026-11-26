// The ticket lifecycle: Open → In Progress → Waiting for Student → Resolved → Closed.
// These are the only moves the server allows. Anything else returns 400.

const STATUSES = ['Open', 'In Progress', 'Waiting for Student', 'Resolved', 'Closed'];
const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
const ROLES = ['student', 'technician', 'admin'];
const STAFF = ['technician', 'admin'];

// Moves staff can make.
const STAFF_TRANSITIONS = {
  'Open': ['In Progress'],
  'In Progress': ['Waiting for Student', 'Resolved'],
  'Waiting for Student': ['In Progress', 'Resolved'],
  'Resolved': ['In Progress', 'Closed'], // reopen if the fix did not work
  'Closed': [],
};

// Moves the student who owns the ticket can make:
// confirm the fix (Resolved → Closed), or say it is still broken (Resolved → In Progress).
const OWNER_TRANSITIONS = {
  'Resolved': ['Closed', 'In Progress'],
};

function allowedTransitions(from, { isStaff, isOwner }) {
  if (isStaff) return STAFF_TRANSITIONS[from] || [];
  if (isOwner) return OWNER_TRANSITIONS[from] || [];
  return [];
}

function canTransition(from, to, who) {
  return allowedTransitions(from, who).includes(to);
}

module.exports = { STATUSES, PRIORITIES, ROLES, STAFF, STAFF_TRANSITIONS, OWNER_TRANSITIONS, allowedTransitions, canTransition };
