// All UI text in one replaceable file (D-31, frontend rule 13). Text follows ASD-STE100 where practical.
export const STRINGS = {
  appName: 'OJT-DTR',
  logo: 'LOGO',
  login: {
    title: 'Log in',
    email: 'Email',
    password: 'Password',
    submit: 'Log in',
    emailRequired: 'Type your email address.',
    emailInvalid: 'Type a correct email address, for example name@school.edu.ph.',
    passwordRequired: 'Type your password.',
    failure: {
      'invalid-credentials': 'The email or the password is not correct. Examine them and try again.',
      'rate-limited': 'Too many login attempts. Wait 5 minutes, then try again.',
      network: 'The server is not reachable. Make sure that you have a network connection, then try again.',
      'wrong-platform':
        'This account cannot use this app. OJT and facilitator accounts use the mobile app. Admin accounts use the web app.',
      inactive: 'This account is not active. Ask the admin.',
      unknown: 'The login did not work. Try again.',
    },
  },
  logout: 'Log out',
  placeholderNote: 'This screen is a wireframe. The function comes in a later stage.',
  pages: {
    ojtHome: 'Home',
    ojtDtr: 'DTR',
    ojtReports: 'Reports',
    ojtProgress: 'Progress',
    facOjts: 'My OJTs',
    facReviews: 'Reviews',
    adminDashboard: 'Dashboard',
    adminUsers: 'Users',
    adminCompanies: 'Host companies',
    adminBatches: 'Batches',
    adminAssignments: 'Assignments',
    adminAudit: 'Audit log',
    profile: 'Profile',
    notifications: 'Notifications',
    syncIssues: 'Sync issues',
  },
} as const;

export type PageKey = keyof typeof STRINGS.pages;
