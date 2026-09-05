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
    actions: 'Actions',
    loading: 'Loading…',
    noResults: 'Nothing matches those filters',
    required: 'Required',
    optional: 'Optional',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
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
        noAccess:
          'That account has no access to a fleet. Ask your fleet administrator to grant you a role.',
        inviteFailed:
          'That invitation could not be completed. Ask your fleet administrator to send a new one.',
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
      /** Shown when the link carries no invitation details. */
      invalid: {
        title: 'This invitation link is not complete',
        subtitle: 'Ask your fleet administrator to send a new one.',
        noticeTitle: 'Nothing to accept',
        noticeBody:
          'The link is missing the organisation and role it was issued for, so there is nothing to set up. A fresh invitation will work.',
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
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    searchPlaceholder: 'Search drivers, vehicles, routes',
    searchPlaceholderCompact: 'Search',
    searchGroups: { drivers: 'Drivers', vehicles: 'Vehicles', routes: 'Routes', staff: 'Users' },
    searchNoResults: (query: string) => `Nothing matches “${query}”`,
    searchHint: 'Type to search across drivers, vehicles, routes and users.',
    searchCount: (n: number) => (n === 1 ? '1 result' : `${n} results`),
    notifications: 'Notifications',
    unreadCount: (n: number) => `${n} unread`,
    notDesignedYet: 'Screens for this module are not designed yet.',
    pageNotFound: 'Page not found',
  },

  /** Notifications: features/notifications */
  notifications: {
    /** Built from what already needs attention — see NotificationsProvider. */
    derived: {
      unsafeDefect: (vehicle: string) => `${vehicle} marked unsafe to drive`,
      licenceExpired: (driver: string) => `${driver}'s licence has expired`,
      licenceExpiring: (driver: string) => `${driver}'s licence expires soon`,
      correctionWaiting: (driver: string) => `${driver} asked to change a past log`,
      routeLate: (reference: string) => `Route ${reference} is running late`,
      driverMessaged: (driver: string) => `${driver} sent you a message`,
      driverMessagedCount: (driver: string, n: number) =>
        `${driver} sent ${n} messages`,
    },
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
    liveNow: 'Live',
    /**
     * The position feed's own state. "Live" is a claim about right now, so it
     * is only shown when something actually reported recently.
     */
    feed: {
      live: 'Live',
      stale: 'No recent reports',
      silent: 'Nothing reporting',
    },
    openMap: 'Open live map',
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

    /**
     * Dashboard tiles and alerts.
     *
     * Each label says what is genuinely being counted. Where the schema cannot
     * produce a figure yet — duty status, hours violations, stops completed —
     * there is no tile at all rather than a label the number does not support.
     */
    live: {
      driversActive: 'Active drivers',
      ofRoster: (total: number) => `of ${total} on the roster`,
      vehiclesActive: 'Vehicles in service',
      ofFleet: (total: number) => `of ${total} in the fleet`,
      outOfService: 'Out of service',
      outOfServiceHint: 'must not be driven',
      expiringDocuments: 'Documents expiring',
      expiringDocumentsHint: 'within 30 days',
      serviceDue: 'Service due',
      serviceDueHint: 'past the scheduled interval',
      openWorkOrders: 'Open work orders',
      openWorkOrdersHint: 'in the workshop',
      driversWithoutLogin: 'Not on the app',
      driversWithoutLoginHint: 'drivers yet to sign in',

      unnamedVehicle: 'A vehicle',
      serviceOverdue: (vehicle: string, service: string) => `${vehicle} is due for ${service}`,
      serviceOverdueByKm: (km: number) => `Overdue by ${km.toLocaleString()} km`,
      serviceDueOn: (day: string) => `Was due ${day}`,
      documentExpiring: (driver: string, doc: string) => `${driver}'s ${doc} expires soon`,
      documentExpired: (driver: string, doc: string) => `${driver}'s ${doc} has expired`,
      expiresOn: (day: string) => `Expires ${day}`,
      workOrderOpen: (reference: string) => `Work order ${reference} is still open`,
      workOrderOn: (vehicle: string) => `On ${vehicle}`,

      today: 'today',
      inDays: (days: number) => `in ${days} ${days === 1 ? 'day' : 'days'}`,
      daysAgo: (days: number) => `${days} ${days === 1 ? 'day' : 'days'} ago`,

      loading: 'Loading the fleet…',
      loadFailed: 'The dashboard could not be loaded.',
      alertsUnknown: 'Alerts could not be loaded, so this list is not complete.',
      activityUnavailable: 'Activity appears here once the audit trail is recording.',
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
    save: 'Save',
    cancel: 'Cancel',
    confirmSignOutTitle: 'Sign out?',
    confirmSignOutMessage:
      'You will need your email and password to get back in. Anything unsaved on this screen is lost.',
    confirmSignOut: 'Sign out',
    required: 'This field is required',
    /** Depot pickers: no depot chosen, and no depots existing at all. */
    noDepot: 'No depot',
    noDepots: 'No depots yet',
    addDepot: 'Add a depot',
    noDepotShort: 'No depot',
    invalidEmail: 'Enter a valid email address',
    invalidPhone: 'Enter a phone number',
  },

  forms_common: {
    addDriverTitle: 'Add a driver',
    addDriverDescription: 'They will appear as off duty until they sign into the app.',
    addDriverSubmit: 'Add driver',
    editDriverTitle: 'Edit driver',
    editDriverDescription: 'Name, depot, vehicle, contact and licence. Sign-in is unchanged.',
    editDriverSubmit: 'Save changes',
    editDriverToast: (name: string) => `${name} saved`,
    addDriverToast: (name: string) => `${name} added to the fleet`,
    addDriverFailed: 'That driver could not be saved.',
    addDriverDuplicateEmployee: 'That employee number is already on the roster.',
    addDriverInvitedToast: (name: string) => `${name} added — a one-time password is on its way`,
    addDriverNoInviteToast: (name: string) => `${name} added, but the app invitation did not go`,

    /**
     * Shown when the account was created and the email was not sent. This is
     * the only copy of the password that exists, so the wording has to make it
     * clear that closing the dialog loses it.
     */
    handoverTitle: 'Pass this on yourself',
    handoverDescription: (name: string) =>
      `${name} is on the roster and has an app account, but the email did not send.`,
    handoverNotEmailed: 'The email could not be sent',
    handoverPassword: 'One-time password',
    handoverHint:
      'This is the only copy \u2014 it is not stored anywhere and closing this will lose it. Send it to the driver yourself. It does not expire, so they should choose their own password the first time they sign in.',
    handoverDone: 'I have sent it',
    driverFields: {
      firstName: 'First name',
      lastName: 'Last name',
      employeeNumber: 'Employee number',
      depot: 'Depot',
      vehicle: 'Vehicle',
      vehicleHint: 'Optional. Vehicles at the chosen depot are listed first.',
      noVehicle: 'Assign later',
      currentlyHeld: (vehicle: string, driver: string) => `${vehicle} \u2014 currently ${driver}`,
      email: 'Email',
      emailEditHint: 'Contact only — this does not change how they sign in.',
      phone: 'Phone',
      licenceExpires: 'Licence expires',
      employment: 'Employment',
    },

    addVehicleTitle: 'Add a vehicle',
    addVehicleDescription: 'Identity, depot, who drives it, odometer and when it is next due for service.',
    addVehicleSubmit: 'Add vehicle',
    editVehicleTitle: 'Edit vehicle',
    editVehicleDescription: 'Identity, depot, who drives it, odometer and the next service.',
    editVehicleSubmit: 'Save changes',
    editVehicleToast: (name: string) => `${name} saved`,
    addVehicleToast: (name: string) => `${name} added to the fleet`,
    addVehicleFailed: 'That vehicle could not be saved.',
    vehicleFields: {
      name: 'Name',
      namePlaceholder: 'Truck 231',
      plate: 'Registration plate',
      platePlaceholder: 'MH 12 AB 0000',
      vin: 'VIN',
      vinPlaceholder: '17 characters',
      vinHint: 'On the chassis plate. Leave blank if you do not have it.',
      vinInvalid: 'A VIN is 17 characters.',
      makeModel: 'Make & model',
      makeModelPlaceholder: 'Tata Prima 4028',
      year: 'Year',
      depot: 'Depot',
      driver: 'Driver',
      driverHint: 'Optional. Drivers at the chosen depot are listed first.',
      noDriver: 'Assign later',
      odometer: 'Odometer (km)',
      nextService: 'Next service (km)',
      nextServiceHint: 'Defaults to 20,000 km after the current reading.',
      nextServiceInvalid: 'Enter the odometer reading when the next service is due.',
      status: 'Status',
    },

    inviteTitle: 'Invite a user',
    inviteDescription: 'They receive an email with a link to set their password.',
    inviteSubmit: 'Send invitation',
    inviteToast: (email: string) => `Invitation sent to ${email}`,
    inviteFields: { name: 'Name', email: 'Work email', role: 'Role', depot: 'Depot' },

    routeTitle: 'Plan a route',
    routeDescription: 'From one depot to another. Stops are placed evenly along that drive.',
    routeSubmit: 'Create route',
    routeToast: (ref: string) => `Route ${ref} created`,
    routeToastWithKm: (ref: string, km: string, spacing: string) =>
      `Route ${ref} created · ${km} · ${spacing}`,
    routeToastStraight: (ref: string, km: string, spacing: string) =>
      `Route ${ref} created · ${km} · ${spacing} (straight line — enable Directions API on the map key to follow the road)`,
    routeSaved: 'Route planned',
    routeFailed: 'That route could not be saved.',
    routePlotting: 'Plotting the drive…',
    routeNoMap:
      'No map key is configured, so stops will be named from the depots rather than placed on the road.',
    routeNoDepots: 'Add two depots with addresses in Settings before planning a route between them.',
    routeFields: {
      driver: 'Driver',
      vehicle: 'Vehicle',
      origin: 'From',
      destination: 'To',
      stops: 'Number of stops',
      startTime: 'Start time',
      notes: 'Notes for the driver',
    },
    routeAssignLater: 'Assign later',
    routeChooseDriver: 'Choose a driver',
    routeChooseVehicle: 'Choose a vehicle',
    routePairHint: 'Assigning both also puts this driver on that vehicle on the Drivers and Vehicles lists.',
    /*
      Warnings, not refusals. A dispatcher plans tomorrow's route while the
      driver is out on today's, and a rule that blocked a second open route
      would refuse the normal case to prevent the mistaken one. So the office
      is told what the driver is already on and decides.
    */
    routeOpenWarning: (name: string, reference: string) =>
      `${name} is already on route ${reference}, and it is not finished.`,
    routeNoVehicleWarning: (name: string) =>
      `${name} has no truck. Pick one, or this route is planned against no vehicle and nothing will track it.`,
    routeConfirmTitle: 'Plan it anyway?',
    routeConfirmSubmit: 'Plan the route',
    routeOtherAddress: 'Another address',
    originPlaceholder: 'Street, area, city',
    destinationPlaceholder: 'Street, area, city',
    stopsHint: 'Including start and end. They sit evenly along the drive.',
    originHint: 'The depot the run starts at.',
    destinationHint: 'The depot the run finishes at.',
    depotNeedsLocation: (name: string) =>
      `${name} has no address. Add one in Settings, or choose another address.`,
    samePlace: 'Start and end have to be different places.',
    addVehicleDocsTitle: (name: string) => `Documents for ${name}`,
    addVehicleDocsDescription:
      'RC, insurance, fitness, permit. You can add more from the vehicle page later.',
    addVehicleDocsUpload: 'Upload a document',
    addVehicleDocsDone: 'Done',
    addVehicleDocsCount: (n: number) =>
      n === 1 ? '1 document filed' : `${n} documents filed`,
    routeHoursWarning: (name: string) =>
      `${name} has no driving hours left today. Assigning this route would put them over the limit.`,
    routeHoursConfirmTitle: 'Dispatch anyway?',
    routeHoursConfirmMessage: (name: string) =>
      `${name} has no driving hours left. Creating this route would put them over the limit.`,
    routeHoursConfirm: 'Create route anyway',

    formTitle: 'New form',
    formDescription: 'Create the form. It stays a draft until you publish it.',
    formSubmit: 'Create form',
    formToast: (name: string) => `${name} created as a draft`,
    formFailed: 'That form could not be saved.',
    formFields: { name: 'Form name', assignedTo: 'Assign to' },

    courseTitle: 'New course',
    courseDescription: 'Courses stay a draft until you add content and publish them.',
    courseSubmit: 'Create course',
    courseToast: (name: string) => `${name} created as a draft`,
    courseFailed: 'That course could not be created.',
    courseFields: {
      name: 'Course name',
      description: 'What the driver should read',
      descriptionHint: 'Shown in the app above the file. On its own this is a read-and-acknowledge course.',
      length: 'Length (minutes)',
      lengthHint: 'The driver cannot mark it done until they have spent this long on it.',
      // Deliberately not "Assign to": this field only decides who can see the
      // course. Giving it to a driver is a separate step on the course screen,
      // and the old label made people think they had already done it.
      visibleTo: 'Visible to',
      visibleToHint: 'Assigning it to drivers is the next step, on the course screen.',
      file: 'Material',
      fileHint: 'PDF, image or video, up to 100 MB. Optional.',
    },
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
    loading: 'Loading the user list…',
    loadFailed: 'The user list could not be loaded.',
    allDepots: 'All depots',
    emptyHint: 'Colleagues you invite appear here.',
    neverSignedIn: 'Never signed in',
    inviteFailed: 'That invitation could not be recorded.',
    inviteNotEmailed:
      'This records the invitation and shows them as Invited. Sending the email needs an SMTP provider, which is not connected yet — pass the link on yourself for now.',
    title: 'Users & access',
    description: 'Who can open this console, and what each of them may do.',
    invite: 'Invite a user',
    searchPlaceholder: 'Search by name or email',
    tabs: { all: 'All', active: 'Active', invited: 'Invited', suspended: 'Suspended' },
    columns: { user: 'User', role: 'Role', depot: 'Depot', status: 'Status', lastActive: 'Last active' },
    empty: 'No users match those filters.',
    rolesTitle: 'Roles',
    rolesHint: 'What each role can reach. Custom roles can be added.',
    peopleCount: (n: number) => (n === 1 ? '1 person' : `${n} people`),
    back: 'All users',
    notFound: 'That user no longer exists.',
    detail: {
      profile: 'Profile',
      access: 'Access',
      email: 'Email',
      role: 'Role',
      depot: 'Depot',
      status: 'Status',
      lastActive: 'Last active',
      permissions: 'What this role can do',
    },
  },

  drivers: {
    title: 'Drivers',
    description: 'Everyone who drives for the fleet, and whether they are legal to do so.',
    add: 'Add a driver',
    searchPlaceholder: 'Search by name or employee number',
    /**
     * Tabs filter on employment, not on duty status. The roster's own question
     * is "who works here"; whether someone is driving right this minute is the
     * working-hours screen's question, and needs the phone to be reporting.
     */
    tabs: { all: 'All', active: 'Active', inactive: 'Inactive', terminated: 'Left' },
    loading: 'Loading the roster…',
    loadFailed: 'The roster could not be loaded.',
    emptyHint: 'Drivers added to the fleet will appear here.',
    columns: { driver: 'Driver', depot: 'Depot', status: 'Status', vehicle: 'Vehicle', hoursLeft: 'Hours left', licence: 'Licence expires', score: 'Safety', actions: '' },
    empty: 'No drivers match those filters.',
    licenceWarning: 'Expiring soon',
    licenceExpired: 'Expired — not legal to drive',
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
      depot: 'Depot',
      edit: 'Edit',
      email: 'Email',
      phone: 'Phone',
      status: 'Duty status',
      employmentStatus: 'Employment',
      onApp: 'On the app',
      onAppYes: 'Signed in',
      onAppNo: 'Not yet',
      inviteApp: 'Send app invite',
      inviteNeedEmail: 'Add an email on Edit first.',
      inviteToast: (name: string) => `Invitation sent to ${name}`,
      inviteFailed: 'That invitation could not be sent.',
      /** Shown where hours of service or safety scoring has nothing recorded. */
      notRecorded: 'Not recorded yet',
      notScored: 'Not scored yet',
      noLicence: 'No licence on file',
      hoursLeft: 'Driving hours left',
      licence: 'Licence expires',
      safetyScore: 'Safety score',
      vehicle: 'Vehicle',
      noVehicleHint: 'This driver has not taken a vehicle out.',
      weekTitle: 'This week',
      weekHint: 'Measured from the duty events, Monday to Sunday.',
      weekDriving: 'Driving',
      weekOnDuty: 'On duty',
      weekDays: 'Days worked',
      recentLogs: 'Last seven days',
      logGraph: 'Daily log',
      logGraphHint: 'Duty status across 24 hours — the same chart the driver sees on the phone.',
      noDutyRecorded: 'Nothing recorded for this day.',
      logStatuses: {
        off: 'Off duty',
        sleeper: 'Sleeper',
        driving: 'Driving',
        on_duty: 'On duty',
      },
      /*
       * Deliberately "today" and "longest", not bare nouns. These are hours
       * USED, measured from the duty events. Read as hours remaining they
       * would be exactly backwards, which is the worst way for a compliance
       * figure to be wrong.
       */
      recap: {
        onDuty: 'On duty today',
        driving: 'Driving today',
        break: 'Longest break',
        cycle: 'Cycle to date',
      },
      previousDay: 'Previous day',
      nextDay: 'Next day',
      pickLogDate: 'Choose a log date',
      today: 'Today',
      noInspections: 'No inspections filed by this driver yet.',
      noSafety: 'No safety events recorded for this driver.',
      tripDocuments: 'From the cab',
      tripDocumentsHint: 'Delivery notes and receipts the driver captured on a job.',
      noDocuments: 'No documents uploaded by this driver yet.',
      message: 'Message driver',
    },
  },

  vehicles: {
    assignDialog: {
      title: (vehicle: string) => `Who is driving ${vehicle}?`,
      description:
        'Drivers normally pick their own truck in the app at the start of a shift. Use this to pre-assign one, or to correct a wrong pick.',
      field: 'Driver',
      hint: 'Only active drivers with a valid licence are listed.',
      nobody: 'Nobody \u2014 leave it unassigned',
      currentlyOn: (driver: string, vehicle: string) => `${driver} \u2014 currently on ${vehicle}`,
      submit: 'Save assignment',
      noDrivers: 'There are no drivers on the roster yet. Add one first.',
      failed: 'That assignment could not be saved.',
      assignedToast: (driver: string, vehicle: string) => `${driver} assigned to ${vehicle}`,
      clearedToast: (vehicle: string) => `${vehicle} is now unassigned`,
      /*
        The option list already says which truck a driver is on. This says what
        pressing save will DO about it — the assignments table allows one open
        assignment per driver, so putting them here takes them out of there.
        Usually intended; not always.
      */
      movesFrom: (name: string, from: string, to: string) =>
        `${name} is on ${from}. Saving moves them to ${to}.`,
    },

    kindTruck: 'Truck',
    kindTrailer: 'Trailer',
    loading: 'Loading the fleet…',
    loadFailed: 'The fleet could not be loaded.',
    emptyHint: 'Trucks and trailers added to the fleet will appear here.',
    noWorkOrders: 'No work orders',
    noWorkOrdersHint: 'Repair jobs raised against a vehicle will appear here.',
    title: 'Vehicles & maintenance',
    description: 'Trucks, trailers and the work needed to keep them on the road.',
    add: 'Add a vehicle',
    searchPlaceholder: 'Search by name, plate or VIN',
    tabs: { all: 'All', active: 'Active', in_maintenance: 'In maintenance', out_of_service: 'Out of service' },
    columns: { vehicle: 'Vehicle', makeModel: 'Make & model', depot: 'Depot', status: 'Status', driver: 'Current driver', odometer: 'Odometer', service: 'Next service', actions: '' },
    empty: 'No vehicles match those filters.',
    back: 'All vehicles',
    notFound: 'That vehicle no longer exists.',
    detail: {
      kind: 'Type',
      trailerCondition: 'Nothing to report',
      trailerConditionHint:
        'A trailer has no engine, so it records no odometer, takes no driver and has no service interval.',
      noSchedule: 'No service schedule set',
      identity: 'Identity',
      condition: 'Condition',
      depot: 'Depot',
      edit: 'Edit',
      vin: 'VIN',
      assignDriver: 'Assign a driver',
      changeDriver: 'Change driver',
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
    noSchedule: 'Not set',
    overdueBy: (km: number) => `Overdue by ${km.toLocaleString()} km`,
    dueIn: (km: number) => `Due in ${km.toLocaleString()} km`,
    /*
      Shown on the job rather than in its own column: a work order the driver
      raised is still a work order, and the origin only matters while somebody
      is deciding what to do with it.
    */
    raisedByDriver: (name: string) => `Raised by ${name}`,
    unassigned: 'Unassigned',
    workOrders: 'Work orders',
    workOrdersHint: 'Repairs raised from defects, schedules or by hand.',
    woColumns: { reference: 'Reference', vehicle: 'Vehicle', job: 'Job', status: 'Status', mechanic: 'Mechanic', opened: 'Opened' },
    woBack: 'All vehicles',
    woNotFound: 'That work order no longer exists.',
    woDetail: {
      about: 'Work order',
      reference: 'Reference',
      vehicle: 'Vehicle',
      job: 'Job',
      status: 'Status',
      mechanic: 'Mechanic',
      opened: 'Opened',
      cost: 'Cost so far',
      openVehicle: 'Open vehicle',
    },
  },

  hours: {
    loadFailed: 'Working hours could not be loaded.',
    loading: 'Loading the logs…',
    noLogs: 'No logs yet',
    noLogsHint:
      'Logs appear here once drivers record their duty status in the app.',
    title: 'Working hours',
    description: 'Driver logs, breaches and the corrections waiting on a decision.',
    exportPack: 'Export audit pack',
    gridTitle: 'Log review',

    /**
     * Tick a driver in the grid and their graph opens above it. The grid
     * answers "is anything wrong across the fleet"; the graph answers "what
     * did this driver's day actually look like" — and comparing two drivers
     * side by side needed leaving the page until now.
     */
    selectDriverAria: (driver: string) => `Show the log graph for ${driver}`,
    graphsDay: (driver: string, day: string) => `${driver} — ${day}`,
    graphsClear: 'Clear selection',
    graphsOpenProfile: 'Open profile',
    gridHints: {
      day: 'One day. Colour marks anything not certified.',
      week: 'Monday to Sunday. Colour marks anything not certified.',
      month: 'Every day in the month. Scroll sideways if you need to.',
    },
    period: { day: 'Day', week: 'Week', month: 'Month' },
    periodAria: 'Log review period',
    previousPeriod: { day: 'Previous day', week: 'Previous week', month: 'Previous month' },
    nextPeriod: { day: 'Next day', week: 'Next week', month: 'Next month' },
    pickDate: 'Choose a date',
    pickMonth: 'Choose a month',
    jumpToToday: 'Today',
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
    decisionFailed: 'That decision was not saved. Try again.',
    nothingToExport: 'No logs in this period to export',

    /**
     * Nothing evaluates the working-hours rules yet, and nothing detects
     * driving with no driver signed in. Saying "no violations" would claim a
     * check that never ran — a compliance officer would read it as a clean
     * fleet.
     */
    violationsNotEvaluated: 'No rule book has been chosen',
    violationsNotEvaluatedHint:
      'A breach is worked out from duty records against the rules in force, and the limits differ by regulator \u2014 11 hours of driving under FMCSA is 9 under EU rules. Set the regulator in Settings and these are checked from then on, history included.',
    unassignedNotDetected: 'Unassigned driving is not being detected yet',
    unassignedNotDetectedHint:
      'Spotting driving with nobody signed in needs vehicle telemetry, which is not connected yet.',
    noUnassigned: 'All driving time is accounted for.',
    reviewViolationTitle: 'Review this violation',
    reviewViolationHint: 'Check the details, then approve if this is a real breach or reject it if it is not.',
    reviewCorrectionTitle: 'Review this correction',
    reviewCorrectionHint:
      'A driver asked to change a past log. Approving sends the change to their phone — you cannot edit the log yourself.',
    fields: {
      driver: 'Driver',
      vehicle: 'Vehicle',
      rule: 'Rule',
      occurred: 'Recorded',
      logDate: 'Log date',
      limit: 'Limit',
      actual: 'What happened',
      overage: 'Over by',
      location: 'Where',
      loggedAs: 'Currently logged as',
      changeTo: 'Asked to change to',
      timeBlock: 'Time block',
      reason: 'Driver’s reason',
      kind: 'Request',
    },
    requestKinds: {
      change: 'Change an existing block',
      add: 'Add a missing block',
    },
    timeRange: (from: string, to: string) => `${from} – ${to}`,
    statusChange: (from: string, to: string) => `${from} → ${to}`,
    violationDecisionNote:
      'Approving records that this is a real breach. Rejecting dismisses it as not a violation. The original log is unchanged either way.',
    correctionDecisionNote: (driver: string) =>
      `Approving sends the change to ${driver}’s phone — they must accept it before the log is updated. Rejecting leaves the original log unchanged.`,
    approvedViolationToast: 'Violation confirmed',
    dismissedViolationToast: 'Violation dismissed',
    approvedToast: 'Correction sent to the driver',
    rejectedToast: 'Correction rejected',
    assignedToast: (driver: string) => `Assigned to ${driver}`,
    assignTitle: 'Assign this driving time',
    assignHint: 'Choose the driver who was behind the wheel. This attaches the segment to their log.',
    assignSubmit: 'Assign to driver',
    assignDriver: 'Driver',
    confirmExportTitle: 'Export the audit pack?',
    confirmExportMessage: 'A spreadsheet of every driver and day in this period will download now.',
    confirmExport: 'Export',
    legend: 'Legend',
  },

  inspections: {
    reportedTitle: 'Reported directly',
    reportedHint: 'Faults a driver raised without filing a whole inspection \u2014 usually mid-route.',

    /** What the office can do about a defect a driver reported. */
    defectActions: {
      raise: 'Raise work order',
      close: 'Close',
      actionTaken: 'Action taken',
      onWorkOrder: (reference: string) => `Work order ${reference}`,

      raiseTitle: 'Raise a work order',
      raiseDescription: (vehicle: string) =>
        `Opens a repair job against ${vehicle} and links it to this defect.`,
      raiseSubmit: 'Open work order',
      raiseFailed: 'That work order could not be opened.',
      raisedToast: (vehicle: string) => `Work order opened for ${vehicle}`,
      jobTitle: 'What needs doing',
      jobNotes: 'Notes for the workshop',
      jobNotesHint: 'Optional. Anything the mechanic should know before starting.',

      closeTitle: 'Close this defect',
      closeDescription: 'Fixed, or looked at and needed nothing. Both are recorded.',
      closeSubmit: 'Close defect',
      closeFailed: 'That defect could not be closed.',
      outcome: 'Outcome',
      outcomeResolved: 'Fixed',
      outcomeDismissed: 'No action needed',
      whatWasDone: 'What was done',
      whatWasDoneHint: 'Optional, but it is what the next inspection reads.',
      whyDismissed: 'Why no action was needed',
      reasonRequired: 'Say why this needed no action \u2014 a dismissed defect with no reason is what an inspector stops on.',
      resolvedToast: 'Defect closed as fixed',
      dismissedToast: 'Defect dismissed',
    },

    loadFailed: 'Inspections could not be loaded.',
    title: 'Inspections & defects',
    description: 'What drivers found when they walked around the vehicle.',
    searchPlaceholder: 'Search by vehicle or driver',
    tabs: { all: 'All', open_defect: 'Open defects', pending: 'Awaiting review', resolved: 'Resolved' },
    columns: { vehicle: 'Vehicle', driver: 'Driver', type: 'Type', submitted: 'Submitted', defects: 'Defects', status: 'Status' },
    empty: 'No inspections match those filters.',
    noDefects: 'None',
    back: 'All inspections',
    notFound: 'That inspection no longer exists.',
    detail: {
      summary: 'Inspection',
      defectsTitle: 'Defects',
      defectsHint: 'Found on the walk-around. Safety-critical items stop the vehicle.',
      noDefects: 'No defects recorded on this inspection.',
      vehicle: 'Vehicle',
      driver: 'Driver',
      type: 'Type',
      submitted: 'Submitted',
      status: 'Status',
      area: 'Area',
      finding: 'Finding',
      severity: 'Severity',
      openVehicle: 'Open vehicle',
      openDriver: 'Open driver',
      openStaff: 'Open profile',
    },
  },

  map: {
    title: 'Live map',
    description: 'Where every vehicle is right now, and the routes planned for them.',
    vehiclesOnMap: (n: number) => `${n} vehicles`,
    routesOnMap: (n: number) => (n === 1 ? '1 route' : `${n} routes`),
    routesTitle: 'Routes',
    routeStopsCount: (n: number) => (n === 1 ? '1 stop' : `${n} stops`),
    stopStart: 'Start',
    stopEnd: 'End',
    stopNumber: (n: number) => `Stop ${n}`,
    schematicNote: 'Schematic view',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    recentre: 'Centre on the fleet',
    mapTypes: { roadmap: 'Standard', satellite: 'Satellite', hybrid: 'Hybrid', terrain: 'Terrain' },
    mapTypeLabel: 'Map view',
    noKeyTitle: 'Google Maps is not configured',
    noKeyHint:
      'Add VITE_GOOGLE_MAPS_API_KEY to .env.local and restart the dev server to replace this with a live map. Everything else on this screen already works.',
    routeOverlay: (ref: string) => `Showing ${ref}`,
    lastPing: 'Last ping',
    speed: 'Speed',
    openDriver: 'Open driver',
    stationary: 'Stationary',
    openVehicle: 'Open vehicle',
    location: 'Location',

    /**
     * Live map, when the console is reading from Supabase.
     *
     * Status is worked out from the last report — position, speed, ignition —
     * rather than stored, so these words describe what was measured. There is
     * no reverse geocoding, so a position is coordinates and nothing more.
     */
    live: {
      secondsAgo: (n: number) => `${n} sec ago`,
      minutesAgo: (n: number) => `${n} min ago`,
      hoursAgo: (n: number) => `${n} ${n === 1 ? 'hour' : 'hours'} ago`,
      daysAgo: (n: number) => `${n} ${n === 1 ? 'day' : 'days'} ago`,
      neverReported: 'Never reported',
      noPosition: 'No position reported',
      coordinates: (lat: number, lng: number) => `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      noDriver: 'No driver signed on',
      loading: 'Finding the fleet…',
      loadFailed: 'The map could not be loaded.',
      noVehicles: 'No vehicles yet',
      noVehiclesHint:
        'Vehicles added to the fleet appear here once they report a position.',
    },
  },

  dispatch: {
    title: 'Dispatch & routes',
    description: "Today's work, who is doing it, and whether it is running to time.",
    newRoute: 'Plan a route',
    searchPlaceholder: 'Search by route, driver or vehicle',
    tabs: { all: 'All', in_progress: 'In progress', late: 'Running late', planned: 'Planned', completed: 'Completed', cancelled: 'Cancelled' },
    columns: { route: 'Route', driver: 'Driver', vehicle: 'Vehicle', progress: 'Stops', status: 'Status', eta: 'Timing', actions: '' },
    empty: 'No routes match those filters.',
    stopsOf: (done: number, total: number) => `${done} of ${total}`,
    via: (from: string, to: string) => `${from} → ${to}`,
    distance: (km: string) => km,
    back: 'All routes',
    notFound: 'That route no longer exists.',
    actions: {
      assignDriver: 'Assign driver',
      assignVehicle: 'Assign vehicle',
      viewOnMap: 'View on map',
      messageDriver: 'Message driver',
      open: 'Open',
    },
    assign: {
      driverTitle: 'Assign a driver',
      driverDescription:
        'Who is running this route. If a vehicle is already on it, they are also assigned to that truck on the fleet lists.',
      driverField: 'Driver',
      vehicleTitle: 'Assign a vehicle',
      vehicleDescription:
        'Which truck is running this route. If a driver is already on it, they are also assigned to this truck on the fleet lists.',
      vehicleField: 'Vehicle',
      nobody: 'Not assigned',
      submit: 'Save',
      failed: 'That assignment could not be saved.',
      driverToast: (name: string, route: string) => `${name} assigned to ${route}`,
      vehicleToast: (name: string, route: string) => `${name} assigned to ${route}`,
      clearedDriver: (route: string) => `No driver on ${route}`,
      clearedVehicle: (route: string) => `No vehicle on ${route}`,
    },
    detail: {
      assignment: 'Assignment',
      progress: 'Progress',
      driver: 'Driver',
      vehicle: 'Vehicle',
      status: 'Status',
      timing: 'Timing',
      distance: 'Distance',
      mapTitle: 'Route',
      mapHint: 'Start, end, and stops along the drive.',
      mapEmpty: 'This route has no map yet. Plan one with a start and an end.',
      stopsTitle: 'Stops',
      stopsHint: 'In the order the driver will visit them, with kilometres from the start.',
      kmFromStart: (km: string) => km,
      stopDone: 'Completed',
      stopNext: 'Next stop',
      stopPending: 'Not started',
      arrived: 'Arrived',
      /*
        How far the driver was when they marked it. The app refuses beyond a
        kilometre, so a figure here is a confirmation; the absence of one is
        the interesting case — an arrival nobody could measure.
      */
      arrivedWithin: (away: string) => `· ${away} away`,
      arrivedUnverified: '· position not checked',
      window: 'Window',
      noWindow: 'No time window',
      viewOnMap: 'View on map',
      messageDriver: 'Message driver',
      assignDriver: 'Assign driver',
      assignVehicle: 'Assign vehicle',
    },
  },

  forms: {
    publish: 'Publish',
    unpublish: 'Back to draft',
    publishedToast: (name: string) => `${name} published \u2014 drivers can fill it in now`,
    unpublishedToast: (name: string) => `${name} is a draft again`,
    publishFailed: 'That could not be published.',
    draftHint: 'A draft is not visible in the driver app. Publish it when it is ready.',
    allDrivers: 'All drivers',
    title: 'Form builder',
    description: 'Build the paperwork your drivers fill in, without waiting for a developer.',
    newForm: 'New form',
    columns: { form: 'Form', fields: 'Fields', version: 'Version', status: 'Status', assigned: 'Assigned to', submissions: 'Submissions', updated: 'Updated' },
    empty: 'No forms yet.',
    fieldTypesTitle: 'Available field types',
    fieldTypesHint: 'These field types appear on the phone. Open a form to see them in use.',
    back: 'All forms',
    notFound: 'That form no longer exists.',
    detail: {
      about: 'About this form',
      fieldsTitle: 'Fields',
      fieldsHint: 'In the order the driver sees them on the phone.',
      name: 'Name',
      version: 'Version',
      status: 'Status',
      assigned: 'Assigned to',
      submissions: 'Submissions',
      updated: 'Last updated',
      required: 'Required',
      optional: 'Optional',
    },
  },

  messages: {
    unreadCount: (n: number) => `${n} unread`,
    loadFailed: 'Conversations could not be loaded.',
    sendFailed: 'That message was not sent.',
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
      onDuty: 'Drivers on duty right now',
    },
    broadcastEmpty: 'Write something to send.',
    backToInbox: 'All conversations',
    newThreadPreview: 'No messages yet — write the first one.',
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
    noScores: 'No safety scores yet',
    noScoresHint:
      'A score needs a scoring rule over recorded events. Nothing is scoring them yet.',
    back: 'All events',
    notFound: 'That event no longer exists.',
    detail: {
      about: 'Event',
      driver: 'Driver',
      kind: 'What happened',
      severity: 'Severity',
      location: 'Location',
      at: 'When',
      status: 'Status',
      openDriver: 'Open driver',
    },
  },

  training: {
    publish: 'Publish',
    unpublish: 'Back to draft',
    publishedToast: (name: string) => `${name} published`,
    unpublishedToast: (name: string) => `${name} is a draft again`,
    publishFailed: 'That could not be published.',
    draftHint: 'A draft is not visible in the driver app. Publish it, then assign it.',
    allDrivers: 'All drivers',
    title: 'Training',
    description: 'Short courses assigned to drivers, and who still owes you one.',
    newCourse: 'New course',
    columns: { course: 'Course', length: 'Length', assigned: 'Assigned', completed: 'Completed', overdue: 'Overdue', status: 'Status' },
    empty: 'No courses yet.',
    minutes: (n: number | null) => (n === null ? '—' : `${n} min`),
    back: 'All courses',
    notFound: 'That course no longer exists.',
    detail: {
      about: 'Course',
      material: 'Material',
      materialNone: 'No file attached',
      materialNoneHint: 'The driver sees only the description. Add a PDF, image or video if there is one.',
      materialAdd: 'Attach a file',
      materialReplace: 'Replace',
      materialRemove: 'Remove',
      materialOpen: 'Open',
      materialUploaded: (name: string) => `${name} attached`,
      materialRemoved: 'File removed',
      materialFailed: 'That file could not be attached.',
      materialOpenFailed: 'That file could not be opened.',
      materialTooBig: 'That file is larger than 100 MB.',
      description: 'Description',
      noDescription: 'No description',
      editDetails: 'What the driver sees',
      editHint: 'The title is not editable — drivers already have it in their history.',
      savedToast: 'Course updated',
      saveFailed: 'That could not be saved.',
      timeSpent: 'Time spent',
      /** Minutes, because a driver's course is measured in minutes, not seconds. */
      timeSpentValue: (seconds: number) =>
        seconds < 60 ? 'Under a minute' : `${Math.floor(seconds / 60)} min`,
      learnersTitle: 'Assigned drivers',
      learnersHint: 'Who still owes you this course.',
      length: 'Length',
      assigned: 'Assigned',
      completed: 'Completed',
      overdue: 'Overdue',
      status: 'Status',
      learnerStatus: {
        completed: 'Completed',
        overdue: 'Overdue',
        in_progress: 'In progress',
        assigned: 'Not started',
      },
      assign: 'Assign drivers',
      remove: 'Remove',
      removedToast: (name: string) => `Course removed from ${name}`,
      removeFailed: 'That could not be removed.',
      noLearners: 'Nobody has this course yet',
      noLearnersHint: 'Assign it to drivers and their progress appears here.',
      dueBy: (date: string) => `Due by ${date}`,
      noDeadline: 'No deadline',
    },

    assignDialog: {
      title: 'Assign this course',
      description: (course: string) => `Who needs to do ${course}?`,
      submit: 'Assign',
      submitCount: (n: number) => `Assign to ${n} ${n === 1 ? 'driver' : 'drivers'}`,
      dueOn: 'Due by',
      dueOnHint: 'Optional. Without a date it never counts as overdue.',
      quickPick: 'Quick pick',
      everyoneOutstanding: (n: number) => `Everyone without it (${n})`,
      alreadyHas: 'Already assigned',
      pickSomeone: 'Choose at least one driver.',
      noDrivers: 'There are no active drivers on the roster yet.',
      failed: 'That could not be assigned.',
      assignedToast: (n: number) =>
        n === 0 ? 'They already had this course' : `Assigned to ${n} ${n === 1 ? 'driver' : 'drivers'}`,
    },
  },

  documents: {
    /** Filing compliance paperwork from the office. */
    upload: {
      title: 'Upload a document',
      description: (owner: string) => `Filed against ${owner}.`,
      submit: 'Upload',
      docType: 'Document type',
      reference: 'Number',
      referenceHint: 'Optional \u2014 licence or policy number.',
      expiresOn: 'Expires on',
      expiresOnHint: 'The dashboard warns 30 days before this date.',
      titleField: 'Label',
      titleHint: 'Optional. Defaults to the file name.',
      file: 'File',
      fileHint: 'JPG, PNG, HEIC, WebP or PDF. Up to 25 MB.',
      pickFile: 'Choose a file to upload.',
      tooBig: 'That file is larger than 25 MB.',
      failed: 'That document could not be uploaded.',
      uploadedToast: (owner: string) => `Document filed against ${owner}`,
    },

    /** Compliance paperwork panels on the driver and vehicle screens. */
    compliance: {
      title: 'Documents',
      hint: 'Licences, certificates and insurance. Expiry dates feed the dashboard alerts.',
      add: 'Upload',
      empty: 'No documents filed yet',
      emptyHint: 'Upload a licence or certificate and its expiry appears on the dashboard.',
      loadFailed: 'Those documents could not be loaded.',
      noFile: 'Record only \u2014 no file was uploaded',
      expires: (date: string) => `Expires ${date}`,
      expired: (date: string) => `Expired ${date}`,
      noExpiry: 'No expiry',
      download: 'Download',
    },

    nothingToExport: 'No documents match those filters',
    loadFailed: 'Documents could not be loaded.',
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
    back: 'All documents',
    notFound: 'That document no longer exists.',
    detail: {
      about: 'File',
      preview: 'Preview',
      previewHint: 'Captured from the cab.',
      noFile: 'No file was uploaded with this record',
      openFailed: 'That file could not be opened.',
      file: 'File name',
      kind: 'Type',
      driver: 'Driver',
      vehicle: 'Vehicle',
      uploaded: 'Uploaded',
      size: 'Size',
      openDriver: 'Open driver',
      openVehicle: 'Open vehicle',
      download: 'Download',
    },
  },

  reports: {
    nothingToRun: (name: string) => `${name} has no data to export yet`,
    title: 'Reports',
    description: 'Eleven standard reports. Filter by depot, then export a spreadsheet.',
    run: 'Run',
    depotAria: 'Depot',
    depots: { all: 'All depots' },
    scheduleTitle: 'Scheduled delivery',
    scheduleHint: 'Send a report by email on a schedule, so nobody has to remember to run it.',
  },

  settings: {
    /** Depots. One word for what the table calls a fleet — see the depots migration. */
    depots: {
      title: 'Depots',
      hint: 'Where drivers are based and vehicles are kept. A depot’s address is the start or end of a route.',
      add: 'Add a depot',
      edit: 'Edit',
      archive: 'Archive',
      emptyTitle: 'No depots yet',
      emptyHint: 'Add one with an address and it appears in the driver, vehicle and route pickers.',
      based: (drivers: number, vehicles: number) =>
        `${drivers} ${drivers === 1 ? 'driver' : 'drivers'} \u00b7 ${vehicles} ${vehicles === 1 ? 'vehicle' : 'vehicles'}`,
      archiveTitle: 'Archive this depot?',
      archiveMessage: (name: string) =>
        `${name} stops appearing in the pickers. Its past duty logs and inspections are kept, because a closed depot still has to explain them.`,
      archiveFailed: 'That depot could not be archived.',
      archivedToast: (name: string) => `${name} archived`,
    },

    depotDialog: {
      addTitle: 'Add a depot',
      editTitle: 'Edit depot',
      addDescription: 'The address is where routes from this depot start and end.',
      description: 'Renaming is safe — drivers and vehicles stay linked to the depot, not to its name.',
      add: 'Add depot',
      save: 'Save changes',
      failed: 'That depot could not be saved.',
      addedToast: (name: string) => `${name} added`,
      savedToast: (name: string) => `${name} saved`,
      namePlaceholder: 'Pune depot',
      codePlaceholder: 'PNQ',
      addressPlaceholder: '12 Hadapsar Industrial Estate, Pune',
      addressHint: 'Used as the start or end when planning a route from this depot.',
      timezoneHint: 'When the working day starts and ends here.',
      fields: { name: 'Name', address: 'Address', code: 'Code', timezone: 'Timezone' },
    },

    systemActor: 'System',
    noAlertRules: 'No alert rules yet',
    noAlertRulesHint:
      'A rule decides who is told when something needs attention. None are set up, so nothing is being notified.',
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
    /*
      "Hours rule book", not "Regulator number". It was neither a number nor
      optional bookkeeping: the driver app parses this value to decide which
      limits to subtract from, and until it is set every clock in the driver's
      hours strip shows a dash.
    */
    fields: { name: 'Organisation name', country: 'Country', timezone: 'Timezone', dot: 'Hours rule book' },
    regulatorHint:
      'Which limits the driver app works to. Until this is set, every clock on the driver’s hours screen shows a dash.',
    regulatorOptions: {
      none: 'Not chosen yet',
      FMCSA: 'FMCSA — 11h driving, 14h window, 70h / 8 days',
      EU: 'EU — 9h driving, 4h30 before a break, 56h / week',
    },
    saveOrg: 'Save organisation',
    savedToast: 'Organisation saved',
    saveFailed: 'The organisation could not be saved.',
    alertOnToast: (name: string) => `${name} alerts are on`,
    alertOffToast: (name: string) => `${name} alerts are off`,
    turnOn: 'Turn on',
    turnOff: 'Turn off',
  },

  help: {
    title: 'Help & support',
    description: 'How this console works, and who to contact when something is wrong.',
    contactTitle: 'Contact support',
    contactHint: 'A person reads this. Include the organisation name and what you were doing.',
    emailLabel: 'Email',
    email: 'support@example.com',
    hoursLabel: 'Hours',
    hours: 'Monday–Saturday, 8:00–20:00 IST',
    replyLabel: 'Typical reply',
    reply: 'Same working day',
    emailCta: 'Write to support',
    guidesTitle: 'How the console works',
    guidesHint: 'The few things that are easy to get wrong.',
    guides: [
      {
        title: 'Search from the top of any page',
        body: 'Type a driver, vehicle, route or user. Results are grouped so you can tell which is which.',
      },
      {
        title: 'Open a row for the full record',
        body: 'Lists are summaries. Click a driver, vehicle, inspection or violation to see every field and take an action.',
      },
      {
        title: 'Review is a decision, not a tick',
        body: 'On working hours, Review opens the details. Approve confirms the breach or sends a log change to the driver’s phone. Reject leaves the original log as it is.',
      },
      {
        title: 'You cannot edit a driver’s log',
        body: 'A carrier may not change a driver’s record on their behalf. Approving a correction request sends it to their phone for them to accept.',
      },
    ],
    topicsTitle: 'Jump to a module',
    topicsHint: 'Open the screen instead of hunting for it in the sidebar.',
    topics: [
      { to: '/hours', title: 'Working hours', body: 'Logs, violations and correction requests.' },
      { to: '/inspections', title: 'Inspections', body: 'Walk-around findings and open defects.' },
      { to: '/drivers', title: 'Drivers', body: 'People, licences and hours remaining.' },
      { to: '/vehicles', title: 'Vehicles', body: 'The fleet, service due and work orders.' },
      { to: '/dispatch', title: 'Dispatch', body: 'Today’s routes and who is on them.' },
      { to: '/messages', title: 'Messages', body: 'Conversations with drivers, and a fleet broadcast.' },
      { to: '/safety', title: 'Safety', body: 'Events from the road and coaching assigned.' },
      { to: '/settings', title: 'Settings', body: 'Organisation, alert rules and the audit log.' },
    ],
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
