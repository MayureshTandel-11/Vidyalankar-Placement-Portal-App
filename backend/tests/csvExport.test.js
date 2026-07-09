const test = require('node:test');
const assert = require('node:assert/strict');
const {
  generateStudentAnalyticsCSV,
  generateOpportunityAnalyticsCSV,
} = require('../src/utils/csvExport');

test('generateStudentAnalyticsCSV includes dynamic opportunity columns and escapes values', () => {
  const rows = [
    {
      studentName: 'Rahul, Rao',
      rollNumber: '123',
      department: 'Computer Engineering',
      division: 'A',
      year: 'Third Year',
      instituteEmail: 'rahul@vidyalankar.edu.in',
      personalGmail: 'rahul@example.com',
      gender: 'Male',
      sscPercentage: 88,
      hscPercentage: 90,
      cgpa: 9.1,
      technicalSkills: ['Java', 'Node.js'],
      phoneNumber: '9876543210',
      appliedDate: '2026-01-15T10:00:00.000Z',
      aptitude: 'YES',
      groupDiscussion: 'NO',
      technicalInterview: 'NO',
      hrInterview: 'NO',
      result: 'NO',
      opportunityApplications: { Google: 'YES', Amazon: 'NO' },
    },
  ];

  const csv = generateStudentAnalyticsCSV(rows, ['Google', 'Amazon']);

  assert.match(csv, /Student Name/);
  assert.match(csv, /Google/);
  assert.match(csv, /Amazon/);
  assert.match(csv, /Rahul, Rao/);
  assert.match(csv, /Java, Node.js/);
  assert.match(csv, /YES/);
});

test('generateOpportunityAnalyticsCSV uses YES/NO round status values', () => {
  const rows = [
    {
      studentName: 'Sneha',
      rollNumber: '456',
      department: 'Information Technology',
      division: 'B',
      year: 'Second Year',
      instituteEmail: 'sneha@vidyalankar.edu.in',
      personalGmail: 'sneha@example.com',
      gender: 'Female',
      sscPercentage: 85,
      hscPercentage: 87,
      cgpa: 8.9,
      technicalSkills: ['Python'],
      phoneNumber: '9123456780',
      appliedDate: '2026-02-20T11:00:00.000Z',
      aptitude: 'YES',
      groupDiscussion: 'YES',
      technicalInterview: 'NO',
      hrInterview: 'NO',
      result: 'NO',
    },
  ];

  const csv = generateOpportunityAnalyticsCSV(rows, 'Google Internship', {
    announcementHeading: 'Google Internship',
    activeStages: ['Aptitude Test', 'Group Discussion', 'Technical Interview', 'HR Interview', 'Result'],
  });

  assert.match(csv, /Aptitude Test/);
  assert.match(csv, /Group Discussion/);
  assert.match(csv, /Technical Interview/);
  assert.match(csv, /HR Interview/);
  assert.match(csv, /Result/);
  assert.match(csv, /Sneha/);
  assert.match(csv, /YES/);
  assert.match(csv, /Not Qualified/);
});

test('generateStudentAnalyticsCSV builds dynamic opportunity-stage columns from announcement headings', () => {
  const rows = [
    {
      studentName: 'Rahul Rao',
      rollNumber: '123',
      department: 'Computer Engineering',
      division: 'A',
      year: 'Third Year',
      instituteEmail: 'rahul@vidyalankar.edu.in',
      personalGmail: 'rahul@example.com',
      gender: 'Male',
      sscPercentage: 88,
      hscPercentage: 90,
      cgpa: 9.1,
      technicalSkills: ['Java', 'Node.js'],
      phoneNumber: '9876543210',
      appliedDate: '2026-01-15T10:00:00.000Z',
      opportunityAnalytics: {
        'Google Summer Internship 2027': {
          applied: true,
          stages: {
            'Aptitude Test': 'Qualified',
            'Technical Interview': 'Not Qualified',
          },
        },
      },
    },
  ];

  const opportunities = [
    { announcementHeading: 'Google Summer Internship 2027', activeStages: ['Aptitude Test', 'Technical Interview'] },
  ];

  const csv = generateStudentAnalyticsCSV(rows, opportunities);

  assert.match(csv, /Google Summer Internship 2027 - Applied/);
  assert.match(csv, /Google Summer Internship 2027 - Aptitude Test/);
  assert.match(csv, /Google Summer Internship 2027 - Technical Interview/);
  assert.match(csv, /YES/);
  assert.match(csv, /Qualified/);
  assert.match(csv, /Not Qualified/);
});

test('generateOpportunityAnalyticsCSV uses opportunity-specific round columns dynamically', () => {
  const rows = [
    {
      studentName: 'Sneha',
      rollNumber: '456',
      department: 'Information Technology',
      division: 'B',
      year: 'Second Year',
      instituteEmail: 'sneha@vidyalankar.edu.in',
      personalGmail: 'sneha@example.com',
      gender: 'Female',
      sscPercentage: 85,
      hscPercentage: 87,
      cgpa: 8.9,
      technicalSkills: ['Python'],
      phoneNumber: '9123456780',
      appliedDate: '2026-02-20T11:00:00.000Z',
      applied: true,
      stageStatuses: {
        'Resume Screening': 'Qualified',
        'Coding Test': 'Not Qualified',
      },
    },
  ];

  const csv = generateOpportunityAnalyticsCSV(rows, 'Google Summer Internship 2027', {
    announcementHeading: 'Google Summer Internship 2027',
    activeStages: ['Resume Screening', 'Coding Test'],
  });

  assert.match(csv, /Google Summer Internship 2027 - Applied/);
  assert.match(csv, /Google Summer Internship 2027 - Resume Screening/);
  assert.match(csv, /Google Summer Internship 2027 - Coding Test/);
  assert.match(csv, /Qualified/);
  assert.match(csv, /Not Qualified/);
});
