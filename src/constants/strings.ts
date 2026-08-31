/**
 * Every word the user reads.
 *
 * ---------------------------------------------------------------------------
 * Why this file exists
 * ---------------------------------------------------------------------------
 * Copy scattered through fifty screens cannot be reviewed, cannot be kept
 * consistent, and cannot be translated. Keeping it here means the client can
 * read the entire product's wording in one pass, and the day a second language
 * is needed the work is already done — this object is the shape a translation
 * file takes.
 *
 * ---------------------------------------------------------------------------
 * Rules for adding copy
 * ---------------------------------------------------------------------------
 * - Group by feature, matching the folder it is used in.
 * - Write from the reader's side of the screen. A dispatcher manages
 *   "drivers", not "user records".
 * - A button says exactly what happens: "Send invitation", then a confirmation
 *   that says "Invitation sent".
 * - Errors say what went wrong and what to do about it. No apologies.
 * - Anything that varies at runtime is a function, so the sentence stays
 *   readable instead of being assembled from fragments at the call site.
 */

export const STRINGS = {
  /** Shared across the whole console. */
  common: {
    appName: 'B2bSamsaraFleet',
    save: 'Save',
    saving: 'Saving…',
    cancel: 'Cancel',
    close: 'Close',
    edit: 'Edit',
    remove: 'Remove',
    search: 'Search',
    filter: 'Filter',
    export: 'Export',
    retry: 'Try again',
    loading: 'Loading…',
    noResults: 'Nothing matches those filters',
    required: 'Required',
    optional: 'Optional',
  },

  /** Signed-out screens: features/auth */
  auth: {
    brand: {
      eyebrow: 'Fleet operations',
      headline: 'Every truck, driver and hour in one place.',
      body: 'Plan the day, keep the fleet legal, and see where everyone is — without chasing paperwork.',
      stats: [
        { label: 'Hours', value: 'Tracked live' },
        { label: 'Inspections', value: 'Filed from the cab' },
        { label: 'Fleet', value: 'On one map' },
      ],
    },

    login: {
      title: 'Sign in',
      subtitle: 'Use the work email your fleet administrator invited.',
      emailLabel: 'Work email',
      emailPlaceholder: 'you@company.com',
      passwordLabel: 'Password',
      passwordPlaceholder: '••••••••••',
      forgotLink: 'Forgot password?',
      keepSignedIn: 'Keep me signed in on this computer',
      submit: 'Sign in',
      supportPrefix: 'Trouble signing in?',
      supportLink: 'Contact support',
      errors: {
        emailMissing: 'Enter your work email',
        emailInvalid: 'That does not look like an email address',
        passwordMissing: 'Enter your password',
        passwordTooShort: (min: number) => `Your password is at least ${min} characters`,
        wrongCredentials: 'That email and password do not match. Check both and try again.',
        accountLocked:
          'This account is locked after too many attempts. Ask your fleet administrator to unlock it.',
      },
    },

    forgotPassword: {
      title: 'Reset your password',
      subtitle: 'We will email you a link to set a new one.',
      emailLabel: 'Work email',
      emailPlaceholder: 'you@company.com',
      submit: 'Send reset link',
      backToSignIn: 'Back to sign in',
      errors: {
        emailInvalid: 'Enter the email address you sign in with',
      },
      sent: {
        title: 'Check your email',
        subtitle: (email: string) =>
          `If an account exists for ${email}, a reset link is on its way.`,
        noticeTitle: 'The link expires in one hour',
        noticeBody:
          'Not arrived after a few minutes? Check the spam folder, or ask your fleet administrator to resend the invitation.',
      },
    },

    resetPassword: {
      title: 'Choose a new password',
      subtitle: 'You will use this every time you sign in.',
      passwordLabel: 'New password',
      confirmLabel: 'Confirm new password',
      submit: 'Save password',
      backToSignIn: 'Back to sign in',
      errors: {
        mismatch: 'The two passwords do not match',
      },
      done: {
        title: 'Password saved',
        subtitle: 'Sign in with your new password.',
        cta: 'Go to sign in',
      },
    },

    acceptInvite: {
      title: (org: string) => `Join ${org}`,
      subtitle: 'Set up your account to get started.',
      invitedAs: (role: string) => `You have been invited as a ${role}`,
      signingInWith: 'Signing in with',
      nameLabel: 'Your name',
      namePlaceholder: 'Priya Sharma',
      passwordLabel: 'Create a password',
      submit: 'Create account',
      notExpecting:
        'Not expecting this invitation? Close this page and tell your fleet administrator.',
      errors: {
        nameMissing: 'Enter your name as colleagues will see it',
      },
    },

    /** Shared by every screen that sets a password. */
    password: {
      minLength: 10,
      strengthLabels: ['', 'Weak', 'Fair', 'Good', 'Strong'] as const,
      problems: {
        empty: 'Choose a password',
        tooShort: (min: number) => `Use at least ${min} characters`,
        needsMixedCase: 'Mix upper and lower case letters',
        needsNumber: 'Include at least one number',
      },
    },
  },

  /** Pinned to the bottom of every signed-out screen. */
  authFooter: {
    copyright: (year: number) => `© ${year} B2bSamsaraFleet`,
    privacy: 'Privacy',
    terms: 'Terms',
    status: 'All systems operational',
  },

  /** The signed-in shell: app/layouts/ConsoleLayout */
  console: {
    subtitle: 'Fleet console',
    signOut: 'Sign out',
    accountMenu: 'Account menu',
    accountSettings: 'Account settings',
    orgSettings: 'Organisation settings',
    help: 'Help & support',
    searchPlaceholder: 'Search drivers, vehicles, routes',
    searchGroups: { drivers: 'Drivers', vehicles: 'Vehicles', routes: 'Routes', staff: 'Users' },
    searchNoResults: (query: string) => `Nothing matches “${query}”`,
    searchHint: 'Type to search across drivers, vehicles, routes and users.',
    searchCount: (n: number) => (n === 1 ? '1 result' : `${n} results`),
    notifications: 'Notifications',
    unreadCount: (n: number) => `${n} unread`,
    notDesignedYet: 'Screens for this module are not designed yet.',
    moduleEyebrow: (id: string) => `Module ${id}`,
    pageNotFound: 'Page not found',
  },

  /** Notifications: features/notifications */
  notifications: {
    title: 'Notifications',
    open: 'Open notifications',
    unreadCount: (n: number) => (n === 1 ? '1 unread' : `${n} unread`),
    markAllRead: 'Mark all as read',
    markRead: 'Mark as read',
    allRead: 'All caught up',
    tabs: { all: 'All', unread: 'Unread' },
    empty: {
      all: 'Nothing here yet. Alerts about hours, defects and expiries will appear as they happen.',
      unread: 'No unread notifications.',
    },
    viewAll: 'View all notifications',
    pageSubtitle: 'Everything the system has flagged, newest first.',
  },

  /** Dashboard: features/dashboard  (module A02) */
  dashboard: {
    title: 'Dashboard',
    greetings: {
      morning: 'Good morning',
      afternoon: 'Good afternoon',
      evening: 'Good evening',
      night: 'Working late',
    },
    greeting: (greeting: string, name: string) => `${greeting}, ${name.split(' ')[0]}`,
    subtitle: 'Here is what needs attention across the fleet right now.',
    needsAttention: 'Needs attention',
    needsAttentionHint: 'Newest first. Clearing these keeps the fleet legal.',
    recentActivity: 'Recent activity',
    recentActivityHint: 'What your team changed today.',
    viewAll: 'View all',
    allClear: 'Nothing needs attention. The fleet is clear.',
    quickActions: 'Quick actions',
    actions: {
      addDriver: 'Add a driver',
      addVehicle: 'Add a vehicle',
      planRoute: 'Plan a route',
      messageFleet: 'Message the fleet',
    },
  },

  /**
   * Sidebar names for the fifteen admin modules.
   * Keys are the reference codes from the scope document, so a conversation
   * about "A06" means the same thing in the code, the document and the invoice.
   */
  modules: {
    A01: 'Users & access',
    A02: 'Dashboard',
    A03: 'Live map',
    A04: 'Drivers',
    A05: 'Vehicles & maintenance',
    A06: 'Working hours',
    A07: 'Inspections & defects',
    A08: 'Dispatch & routes',
    A09: 'Form builder',
    A10: 'Messages',
    A11: 'Safety & coaching',
    A12: 'Training',
    A13: 'Documents',
    A14: 'Reports',
    A15: 'Settings & audit',
  },

  /** Anything that produces a file. */
  export: {
    csv: 'Export CSV',
    started: (filename: string) => `Downloaded ${filename}`,
    nothingToExport: 'There is nothing to export with these filters.',
  },

  /** Dialogs, forms and confirmations shared across modules. */
  dialog: {
    saved: 'Saved',
    cancel: 'Cancel',
    confirmSignOutTitle: 'Sign out?',
    confirmSignOutMessage:
      'You will need your email and password to get back in. Anything unsaved on this screen is lost.',
    confirmSignOut: 'Sign out',
    required: 'This field is required',
    invalidEmail: 'Enter a valid email address',
  },

  forms_common: {
    addDriverTitle: 'Add a driver',
    addDriverDescription: 'They will appear as off duty until they sign into the app.',
    addDriverSubmit: 'Add driver',
    addDriverToast: (name: string) => `${name} added to the fleet`,
    driverFields: {
      firstName: 'First name',
      lastName: 'Last name',
      employeeNumber: 'Employee number',
      terminal: 'Home terminal',
      email: 'Email',
      phone: 'Phone',
      licenceExpires: 'Licence expires',
    },

    addVehicleTitle: 'Add a vehicle',
    addVehicleDescription: 'Odometer readings are stored in kilometres throughout.',
    addVehicleSubmit: 'Add vehicle',
    addVehicleToast: (name: string) => `${name} added to the fleet`,
    vehicleFields: {
      name: 'Name',
      namePlaceholder: 'Truck 231',
      plate: 'Registration plate',
      makeModel: 'Make & model',
      year: 'Year',
      terminal: 'Home terminal',
      odometer: 'Odometer (km)',
    },

    inviteTitle: 'Invite a user',
    inviteDescription: 'They receive an email with a link to set their password.',
    inviteSubmit: 'Send invitation',
    inviteToast: (email: string) => `Invitation sent to ${email}`,
    inviteFields: { name: 'Name', email: 'Work email', role: 'Role', fleet: 'Fleet' },

    routeTitle: 'Plan a route',
    routeDescription: 'Assign a driver and a vehicle, and set how many stops the run has.',
    routeSubmit: 'Create route',
    routeToast: (ref: string) => `Route ${ref} created`,
    routeFields: {
      driver: 'Driver',
      vehicle: 'Vehicle',
      stops: 'Number of stops',
      startTime: 'Start time',
      notes: 'Notes for the driver',
    },
    routeHoursWarning: (name: string) =>
      `${name} has no driving hours left today. Assigning this route would put them over the limit.`,

    formTitle: 'New form',
    formDescription: 'Create the form, then drag fields into it. It stays a draft until published.',
    formSubmit: 'Create form',
    formToast: (name: string) => `${name} created as a draft`,
    formFields: { name: 'Form name', assignedTo: 'Assign to' },

    courseTitle: 'New course',
    courseDescription: 'Courses stay a draft until you add content and publish them.',
    courseSubmit: 'Create course',
    courseToast: (name: string) => `${name} created as a draft`,
    courseFields: { name: 'Course name', length: 'Length (minutes)', assignTo: 'Assign to' },
  },

  /** Shared table chrome: pagination and empty states. */
  table: {
    pagination: 'Pagination',
    previous: 'Previous',
    next: 'Next',
    showing: (first: number, last: number, total: number) =>
      `Showing ${first}–${last} of ${total}`,
  },

  empty: {
    /** Nothing exists yet. */
    noneYetTitle: 'Nothing here yet',
    /** A filter or search removed everything. */
    noMatchTitle: 'No matches',
    noMatchHint: 'Try a different search, or clear the filters to see everything.',
    clearFilters: 'Clear filters',
  },

  /** Module screens. One block per module, keyed by its reference code. */
  users: {
    title: 'Users & access',
    description: 'Who can open this console, and what each of them may do.',
    invite: 'Invite a user',
    searchPlaceholder: 'Search by name or email',
    tabs: { all: 'All', active: 'Active', invited: 'Invited', suspended: 'Suspended' },
    columns: { user: 'User', role: 'Role', fleet: 'Fleet', status: 'Status', lastActive: 'Last active' },
    empty: 'No users match those filters.',
    rolesTitle: 'Roles',
    rolesHint: 'What each role can reach. Custom roles can be added.',
    peopleCount: (n: number) => (n === 1 ? '1 person' : `${n} people`),
  },

  drivers: {
    title: 'Drivers',
    description: 'Everyone who drives for the fleet, and whether they are legal to do so.',
    add: 'Add a driver',
    searchPlaceholder: 'Search by name or employee number',
    tabs: { all: 'All', driving: 'Driving', on_duty: 'On duty', off_duty: 'Off duty', offline: 'Offline' },
    columns: { driver: 'Driver', terminal: 'Home terminal', status: 'Status', vehicle: 'Vehicle', hoursLeft: 'Hours left', licence: 'Licence expires', score: 'Safety' },
    empty: 'No drivers match those filters.',
    licenceWarning: 'Expiring soon',
    noVehicle: 'Not assigned',
    back: 'All drivers',
    notFound: 'That driver no longer exists.',
    tabsDetail: {
      overview: 'Overview',
      hours: 'Hours',
      inspections: 'Inspections',
      safety: 'Safety',
      documents: 'Documents',
    },
    detail: {
      employment: 'Employment',
      compliance: 'Compliance',
      currentAssignment: 'Current assignment',
      employeeNumber: 'Employee number',
      terminal: 'Home terminal',
      status: 'Duty status',
      hoursLeft: 'Driving hours left',
      licence: 'Licence expires',
      safetyScore: 'Safety score',
      vehicle: 'Vehicle',
      noVehicleHint: 'This driver has not taken a vehicle out.',
      recentLogs: 'Last seven days',
      noInspections: 'No inspections filed by this driver yet.',
      noSafety: 'No safety events recorded for this driver.',
      noDocuments: 'No documents uploaded by this driver yet.',
      message: 'Message driver',
    },
  },

  vehicles: {
    title: 'Vehicles & maintenance',
    description: 'Trucks, trailers and the work needed to keep them on the road.',
    add: 'Add a vehicle',
    searchPlaceholder: 'Search by name or plate',
    tabs: { all: 'All', active: 'Active', in_maintenance: 'In maintenance', out_of_service: 'Out of service' },
    columns: { vehicle: 'Vehicle', makeModel: 'Make & model', status: 'Status', driver: 'Current driver', odometer: 'Odometer', service: 'Next service' },
    empty: 'No vehicles match those filters.',
    back: 'All vehicles',
    notFound: 'That vehicle no longer exists.',
    detail: {
      identity: 'Identity',
      condition: 'Condition',
      plate: 'Registration plate',
      makeModel: 'Make & model',
      year: 'Year',
      status: 'Status',
      driver: 'Current driver',
      odometer: 'Odometer',
      nextService: 'Next service',
      openWorkOrders: 'Open work orders',
      noWorkOrders: 'No repair jobs open for this vehicle.',
      recentInspections: 'Recent inspections',
      noInspections: 'No inspections filed for this vehicle yet.',
    },
    overdueBy: (km: number) => `Overdue by ${km.toLocaleString()} km`,
    dueIn: (km: number) => `Due in ${km.toLocaleString()} km`,
    unassigned: 'Unassigned',
    workOrders: 'Work orders',
    workOrdersHint: 'Repairs raised from defects, schedules or by hand.',
    woColumns: { reference: 'Reference', vehicle: 'Vehicle', job: 'Job', status: 'Status', mechanic: 'Mechanic', opened: 'Opened' },
  },

  hours: {
    title: 'Working hours',
    description: 'Driver logs, breaches and the corrections waiting on a decision.',
    exportPack: 'Export audit pack',
    gridTitle: 'Log review',
    gridHint: 'One row per driver, one column per day. Colour marks anything not certified.',
    violationsTitle: 'Violations',
    violationsHint: 'Every breach of the working-hours rules, newest first.',
    editRequestsTitle: 'Correction requests',
    editRequestsHint: 'A driver has asked to change a past log. Approving pushes the change to their phone.',
    unassignedTitle: 'Unassigned driving',
    unassignedHint: 'Driving recorded with no driver signed in. Assign it or annotate it.',
    approve: 'Approve',
    reject: 'Reject',
    assign: 'Assign',
    review: 'Review',
    noViolations: 'No violations in this period.',
    allViolationsReviewed: 'Every violation in this period has been reviewed.',
    noEditRequests: 'No corrections waiting on a decision.',
    noUnassigned: 'All driving time is accounted for.',
    confirmReviewTitle: 'Mark as reviewed?',
    confirmReviewMessage: (driver: string, type: string) =>
      `This records that you have seen ${driver}'s ${type.toLowerCase()} breach. It stays in the compliance record either way.`,
    confirmReview: 'Mark reviewed',
    reviewedToast: 'Violation marked as reviewed',
    confirmApproveTitle: 'Approve this correction?',
    confirmApproveMessage: (driver: string) =>
      `The change is sent to ${driver}'s phone. They must accept it before the log is updated — you cannot change a driver's record on their behalf.`,
    confirmApprove: 'Approve and send',
    approvedToast: 'Correction sent to the driver',
    confirmRejectTitle: 'Reject this correction?',
    confirmRejectMessage: (driver: string) =>
      `${driver} is told the request was rejected. The original log is unchanged.`,
    confirmReject: 'Reject',
    rejectedToast: 'Correction rejected',
    assignedToast: 'Driving time assigned',
    legend: 'Legend',
  },

  inspections: {
    title: 'Inspections & defects',
    description: 'What drivers found when they walked around the vehicle.',
    searchPlaceholder: 'Search by vehicle or driver',
    tabs: { all: 'All', open_defect: 'Open defects', pending: 'Awaiting review', resolved: 'Resolved' },
    columns: { vehicle: 'Vehicle', driver: 'Driver', type: 'Type', submitted: 'Submitted', defects: 'Defects', status: 'Status' },
    empty: 'No inspections match those filters.',
    noDefects: 'None',
  },

  map: {
    title: 'Live map',
    description: 'Where every vehicle is right now.',
    vehiclesOnMap: (n: number) => `${n} vehicles`,
    schematicNote: 'Schematic view',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    recentre: 'Centre on the fleet',
    mapTypes: { roadmap: 'Standard', satellite: 'Satellite', hybrid: 'Hybrid', terrain: 'Terrain' },
    mapTypeLabel: 'Map view',
    noKeyTitle: 'Google Maps is not configured',
    noKeyHint:
      'Add VITE_GOOGLE_MAPS_API_KEY to .env.local and restart the dev server to replace this with a live map. Everything else on this screen already works.',
    lastPing: 'Last ping',
    speed: 'Speed',
    stationary: 'Stationary',
  },

  dispatch: {
    title: 'Dispatch & routes',
    description: "Today's work, who is doing it, and whether it is running to time.",
    newRoute: 'Plan a route',
    searchPlaceholder: 'Search by route, driver or vehicle',
    tabs: { all: 'All', in_progress: 'In progress', late: 'Running late', planned: 'Planned', completed: 'Completed' },
    columns: { route: 'Route', driver: 'Driver', vehicle: 'Vehicle', progress: 'Stops', status: 'Status', eta: 'Timing' },
    empty: 'No routes match those filters.',
    stopsOf: (done: number, total: number) => `${done} of ${total}`,
    back: 'All routes',
    notFound: 'That route no longer exists.',
    detail: {
      assignment: 'Assignment',
      progress: 'Progress',
      driver: 'Driver',
      vehicle: 'Vehicle',
      status: 'Status',
      timing: 'Timing',
      stopsTitle: 'Stops',
      stopsHint: 'In the order the driver will visit them.',
      stopDone: 'Completed',
      stopNext: 'Next stop',
      stopPending: 'Not started',
      arrived: 'Arrived',
      window: 'Window',
      viewOnMap: 'View on map',
      messageDriver: 'Message driver',
    },
  },

  forms: {
    title: 'Form builder',
    description: 'Build the paperwork your drivers fill in, without waiting for a developer.',
    newForm: 'New form',
    columns: { form: 'Form', fields: 'Fields', version: 'Version', status: 'Status', assigned: 'Assigned to', submissions: 'Submissions', updated: 'Updated' },
    empty: 'No forms yet.',
    fieldTypesTitle: 'Available field types',
    fieldTypesHint: 'Drag any of these into a form. Each one renders natively on the phone.',
  },

  messages: {
    title: 'Messages',
    description: 'Every conversation with every driver, in one inbox.',
    broadcast: 'Message the fleet',
    searchPlaceholder: 'Search conversations',
    empty: 'No conversations yet.',
    selectThread: 'Choose a conversation to read it.',
    composePlaceholder: 'Write a message',
    send: 'Send',
    sentToast: (driver: string) => `Message sent to ${driver}`,
    broadcastTitle: 'Message the fleet',
    broadcastDescription: 'Goes to every driver you select, as a push notification and an in-app message.',
    broadcastSubmit: 'Send to fleet',
    broadcastToast: (n: number) => `Message sent to ${n} ${n === 1 ? 'driver' : 'drivers'}`,
    broadcastFields: { audience: 'Send to', message: 'Message' },
    broadcastAudience: {
      all: 'Every driver',
      pune: 'Pune depot only',
      nashik: 'Nashik depot only',
      onDuty: 'Drivers on duty right now',
    },
    broadcastEmpty: 'Write something to send.',
  },

  safety: {
    title: 'Safety & coaching',
    description: 'Incidents recorded on the road, and what was done about them.',
    tabs: { all: 'All', new: 'Needs review', coachable: 'Coaching assigned', dismissed: 'Dismissed' },
    columns: { driver: 'Driver', event: 'Event', severity: 'Severity', location: 'Location', at: 'When', status: 'Status' },
    empty: 'No events match those filters.',
    assignCoaching: 'Assign coaching',
    dismiss: 'Dismiss',
    confirmCoachTitle: 'Assign coaching?',
    confirmCoachMessage: (driver: string, kind: string) =>
      `${driver} gets a coaching task about this ${kind.toLowerCase()} on their phone, and must acknowledge it.`,
    confirmCoach: 'Assign coaching',
    coachedToast: (driver: string) => `Coaching assigned to ${driver}`,
    confirmDismissTitle: 'Dismiss this event?',
    confirmDismissMessage:
      'It stays in the safety record but stops counting towards the driver\'s score and needs no action.',
    confirmDismiss: 'Dismiss event',
    dismissedToast: 'Event dismissed',
    scoreboardTitle: 'Safety scoreboard',
    scoreboardHint: 'Highest scores this month.',
  },

  training: {
    title: 'Training',
    description: 'Short courses assigned to drivers, and who still owes you one.',
    newCourse: 'New course',
    columns: { course: 'Course', length: 'Length', assigned: 'Assigned', completed: 'Completed', overdue: 'Overdue', status: 'Status' },
    empty: 'No courses yet.',
    minutes: (n: number) => `${n} min`,
  },

  documents: {
    title: 'Documents',
    description: 'Paperwork captured from the cab, filed and searchable.',
    searchPlaceholder: 'Search by file, driver or vehicle',
    exportAll: 'Export selection',
    confirmExportTitle: 'Export documents?',
    confirmExportMessage: (n: number) =>
      `${n} ${n === 1 ? 'document' : 'documents'} will be packaged as a ZIP and emailed to you when it is ready.`,
    confirmExport: 'Start export',
    exportToast: 'Export started — you will get an email when it is ready',
    tabs: { all: 'All', bol: 'Bills of lading', pod: 'Proof of delivery', receipt: 'Receipts', fuel: 'Fuel dockets' },
    columns: { file: 'File', kind: 'Type', driver: 'Driver', vehicle: 'Vehicle', uploaded: 'Uploaded', size: 'Size' },
    empty: 'No documents match those filters.',
  },

  reports: {
    title: 'Reports',
    description: 'Eleven standard reports. Narrow any of them by date and depot, then export.',
    run: 'Run',
    lastRun: (when: string) => `Last run ${when.toLowerCase()}`,
    scheduleTitle: 'Scheduled delivery',
    scheduleHint: 'Send a report by email on a schedule, so nobody has to remember to run it.',
  },

  settings: {
    title: 'Settings & audit',
    description: 'How the organisation is configured, and a record of every change.',
    orgTitle: 'Organisation',
    orgHint: 'Name and branding, used here and in the driver app.',
    alertsTitle: 'Alert rules',
    alertsHint: 'Who gets told, and when.',
    auditTitle: 'Audit log',
    auditHint: 'Every change made in this console, with who made it. Required for audits.',
    auditColumns: { who: 'Who', action: 'Action', target: 'What', at: 'When' },
    channels: 'Channels',
    on: 'On',
    off: 'Off',
    fields: { name: 'Organisation name', country: 'Country', timezone: 'Timezone', dot: 'Regulator number' },
  },

  /** Sidebar section headings. */
  moduleGroups: {
    Overview: 'Overview',
    Fleet: 'Fleet',
    Compliance: 'Compliance',
    Operations: 'Operations',
    People: 'People',
    Admin: 'Admin',
  },
} as const

export type Strings = typeof STRINGS
